/* Acceso a datos. Todas las operaciones pasan por Supabase con la sesión del
   usuario: la base de datos decide si tiene permiso (RLS + verificación de rol). */
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    // sessionStorage: la sesión vive solo en esta pestaña y se borra al cerrarla.
    storage: window.sessionStorage,
    storageKey: 'volt-admin-auth',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit'
  }
});

export class ApiError extends Error {
  constructor(message, code, raw) { super(message); this.code = code; this.raw = raw; }
}

const CONSTRAINTS = {
  products_price_range: 'El precio máximo debe ser mayor o igual al precio.',
  products_gallery_shape: 'La galería admite hasta 8 imágenes válidas.',
  products_features_shape: 'Las características admiten hasta 12 elementos.',
  media_url_shape: 'La dirección de la imagen no es válida.',
  site_content_size: 'El contenido es demasiado grande.'
};

// Convierte errores técnicos en mensajes comprensibles (sin exponer detalles internos).
export function friendly(err) {
  if (!err) return 'Ocurrió un error inesperado.';
  if (err instanceof ApiError) return err.message;
  const msg = String(err.message || err.error_description || err.error || err);
  const code = err.code || '';
  const status = err.status || err.statusCode;
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(msg)) return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
  if (/Invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.';
  if (/Email not confirmed/i.test(msg)) return 'Esta cuenta aún no confirmó su correo.';
  if (status === 429 || /rate limit|too many/i.test(msg)) return 'Demasiados intentos seguidos. Espera unos minutos e inténtalo de nuevo.';
  if (/JWT expired|invalid JWT|PGRST301|session.*(missing|expired)/i.test(msg) || code === 'PGRST301') return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  if (/Password should be|weak password/i.test(msg)) return 'La contraseña es demasiado débil: usa al menos 10 caracteres combinando letras y números.';
  if (/same password|different from the old/i.test(msg)) return 'La nueva contraseña debe ser distinta de la actual.';
  if (code === '42501' || /row-level security|permission denied/i.test(msg)) {
    return /^No autorizado|^No se puede|^No puedes/.test(msg) ? msg : 'No tienes permiso para esta acción.';
  }
  if (code === '40001' || code === 'P0002') return msg;
  if (code === '22023') {
    if (/does not match/i.test(msg)) return msg.replace(/:.*$/, ': hay un enlace, imagen o color con formato no válido.');
    if (/Additional properties/i.test(msg)) return msg.replace(/:.*$/, ': hay un campo que no está permitido.');
    if (/longer than|maxLength/i.test(msg)) return msg.replace(/:.*$/, ': un texto supera el largo máximo.');
    return msg;
  }
  if (code === '23505') return 'Ya existe un registro con ese valor (por ejemplo, el mismo código).';
  if (code === '23503') return 'No se puede eliminar: otros elementos dependen de este (por ejemplo, una categoría que todavía tiene productos).';
  if (code === '23514') {
    const k = Object.keys(CONSTRAINTS).find(c => msg.includes(c));
    return k ? CONSTRAINTS[k] : 'Algún valor no es válido. Revisa precios, textos y enlaces.';
  }
  if (status === 413 || /too large|exceeded the maximum/i.test(msg)) return 'El archivo supera el tamaño máximo permitido (5 MB).';
  if (/mime type|invalid_mime|not supported/i.test(msg)) return 'Tipo de archivo no permitido. Usa JPG, PNG, WebP o GIF.';
  if (/already exists|Duplicate/i.test(msg)) return 'Ya existe un archivo con ese nombre.';
  return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}

function fail(error) {
  if (error && /JWT expired|PGRST301/.test(String(error.message) + error.code)) {
    window.dispatchEvent(new CustomEvent('volt:session-expired'));
  }
  return new ApiError(friendly(error), error && error.code, error);
}
async function rpc(name, args) {
  const { data, error } = await sb.rpc(name, args || {});
  if (error) throw fail(error);
  return data;
}
async function q(promise) {
  const { data, error, count } = await promise;
  if (error) throw fail(error);
  return count !== undefined && count !== null ? { data, count } : data;
}

export const api = {
  /* ----- sesión y resumen ----- */
  profile: () => rpc('my_admin_profile'),
  recordLogin: () => rpc('record_login'),
  overview: () => rpc('get_admin_overview'),
  previewSite: () => rpc('get_preview_site'),
  async publicSiteCheck() {
    const t0 = performance.now();
    const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/get_public_site', {
      method: 'POST', cache: 'no-store', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: '{}'
    });
    if (!r.ok) throw new ApiError('El sitio público no responde (HTTP ' + r.status + ').');
    const j = await r.json();
    return { ms: Math.round(performance.now() - t0), products: (j.products || []).length };
  },

  /* ----- contenido ----- */
  drafts: () => q(sb.from('site_content').select('key,data,version,updated_at,updated_by_email')),
  published: () => q(sb.from('site_published').select('key,data,published_at,published_by_email')),
  async content(key) {
    const [d, p] = await Promise.all([
      q(sb.from('site_content').select('key,data,version,updated_at,updated_by_email').eq('key', key).maybeSingle()),
      q(sb.from('site_published').select('data,published_at,published_by_email').eq('key', key).maybeSingle())
    ]);
    return { draft: d, published: p };
  },
  saveDraft: (key, data, version) => rpc('save_draft', { p_key: key, p_data: data, p_expected_version: version ?? null }),
  publish: (keys, note) => rpc('publish_content', { p_keys: keys && keys.length ? keys : null, p_note: note || null }),
  discard: keys => rpc('discard_drafts', { p_keys: keys }),
  versions: key => q(sb.from('content_versions').select('id,key,published_at,published_by_email,note').eq('key', key).order('published_at', { ascending: false }).limit(40)),
  versionData: id => q(sb.from('content_versions').select('data').eq('id', id).single()),
  restoreVersion: id => rpc('restore_version', { p_id: id }),
  audit({ page = 0, size = 30, entity = '', action = '', search = '' } = {}) {
    let s = sb.from('audit_log').select('id,at,user_email,action,entity,entity_id,label,before,after', { count: 'exact' })
      .order('at', { ascending: false }).range(page * size, page * size + size - 1);
    if (entity) s = s.eq('entity', entity);
    if (action) s = s.eq('action', action);
    if (search) s = s.or(`label.ilike.%${search.replace(/[%,()]/g, ' ')}%,user_email.ilike.%${search.replace(/[%,()]/g, ' ')}%`);
    return q(s);
  },

  /* ----- catálogo ----- */
  categories: () => q(sb.from('categories').select('*').order('sort_order').order('name')),
  async saveCategory(c) {
    const fields = { name: c.name, singular: c.singular, icon: c.icon, active: c.active };
    if (c.id) return q(sb.from('categories').update(fields).eq('id', c.id).select().single());
    return q(sb.from('categories').insert({ ...fields, code: c.code, sort_order: c.sort_order || 999 }).select().single());
  },
  deleteCategory: id => q(sb.from('categories').delete().eq('id', id)),
  reorderCategories: ids => rpc('reorder_categories', { p_ids: ids }),
  products: () => q(sb.from('products').select('*').order('sort_order').order('name')),
  async saveProduct(p, version) {
    const row = { ...p }; delete row.id; delete row.version; delete row.created_at; delete row.updated_at; delete row.updated_by; delete row.updated_by_email;
    if (!p.id) return q(sb.from('products').insert(row).select().single());
    let s = sb.from('products').update(row).eq('id', p.id);
    if (version != null) s = s.eq('version', version);
    const data = await q(s.select());
    if (!data || !data.length) throw new ApiError('Otra persona modificó este producto mientras lo editabas. Recarga para ver la versión actual.', '40001');
    return data[0];
  },
  updateProducts: (ids, fields) => q(sb.from('products').update(fields).in('id', ids).select('id,version,active,featured,stock,updated_at')),
  deleteProducts: ids => q(sb.from('products').delete().in('id', ids)),
  reorderProducts: ids => rpc('reorder_products', { p_ids: ids }),

  /* ----- medios ----- */
  media: () => q(sb.from('media').select('*').order('created_at', { ascending: false })),
  mediaUsage: url => rpc('media_usage', { p_url: url }),
  replaceMedia: (oldUrl, newUrl) => rpc('replace_media_url', { p_old: oldUrl, p_new: newUrl }),
  updateMedia: (id, fields) => q(sb.from('media').update(fields).eq('id', id).select().single()),
  async deleteMedia(m) {
    if (m.path) {
      const { data, error } = await sb.storage.from('media').remove([m.path]);
      if (error) throw fail(error);
      if (!data || !data.length) throw new ApiError('No se puede eliminar: la imagen sigue en uso o no tienes permiso.');
    }
    const rows = await q(sb.from('media').delete().eq('id', m.id).select('id'));
    if (!rows || !rows.length) throw new ApiError('No se puede eliminar: la imagen sigue en uso.');
  },
  async uploadMedia(blob, { path, filename, alt, folder, mime, width, height }) {
    const up = await sb.storage.from('media').upload(path, blob, { contentType: mime, cacheControl: '31536000', upsert: false });
    if (up.error) throw fail(up.error);
    const url = sb.storage.from('media').getPublicUrl(path).data.publicUrl;
    try {
      return await q(sb.from('media').insert({ path, url, filename, alt: alt || '', folder, mime, size_bytes: blob.size, width, height }).select().single());
    } catch (e) {
      await sb.storage.from('media').remove([path]);   // no deja archivos huérfanos
      throw e;
    }
  },

  /* ----- respaldos y usuarios ----- */
  exportSite: () => rpc('export_site'),
  importSite: (payload, replaceCatalog) => rpc('import_site', { p_payload: payload, p_replace_catalog: !!replaceCatalog }),
  admins: () => q(sb.from('admin_users').select('user_id,email,role,created_at').order('created_at')),
  grantAdmin: (email, role) => rpc('grant_admin', { p_email: email, p_role: role }),
  revokeAdmin: userId => rpc('revoke_admin', { p_user_id: userId })
};

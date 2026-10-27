/* Acceso a datos del panel: todo va al servidor del propio sitio (/api, PHP).
   El servidor verifica sesión, rol y token CSRF en cada operación; aquí solo
   se envían las peticiones y se muestran sus mensajes. */
const API = new URL('../api/', location.href).href;
let csrf = '';

export class ApiError extends Error {
  constructor(message, code, status, extra) { super(message); this.code = code; this.status = status; this.extra = extra || {}; }
}

export function friendly(err) {
  if (err instanceof ApiError) return err.message;
  if (/Failed to fetch|NetworkError|Load failed/i.test(String(err && err.message))) return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
  return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}

async function call(action, { method = 'GET', query, body, form } = {}) {
  const url = new URL(API);
  url.searchParams.set('a', action);
  for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  const opts = { method, credentials: 'same-origin', cache: 'no-store', headers: {} };
  if (method === 'POST') {
    opts.headers['X-CSRF-Token'] = csrf;
    if (form) opts.body = form;
    else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body ?? {}); }
  }
  let res;
  try { res = await fetch(url, opts); }
  catch { throw new ApiError('No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.', 'network', 0); }
  let json = null;
  try { json = await res.json(); } catch { /* respuesta sin JSON */ }
  if (!res.ok) {
    const msg = (json && json.error) || (res.status === 413 ? 'El archivo es demasiado grande.' : 'Ocurrió un error en el servidor. Inténtalo de nuevo.');
    if (res.status === 401 && !['login', 'me', 'setup', 'recover'].includes(action)) {
      window.dispatchEvent(new CustomEvent('volt:logout', { detail: { message: 'Tu sesión expiró. Vuelve a iniciar sesión.', type: 'warn' } }));
    }
    throw new ApiError(msg, (json && json.code) || String(res.status), res.status, json);
  }
  return json ? json.data : null;
}
const get = (a, query) => call(a, { query });
const post = (a, body) => call(a, { method: 'POST', body });
const withCsrf = p => { csrf = p.csrf || ''; delete p.csrf; return p; };

export const api = {
  /* ----- acceso ----- */
  status: () => get('status'),
  setup: (key, email, password) => post('setup', { key, email, password }).then(withCsrf),
  login: (email, password) => post('login', { email, password }).then(withCsrf),
  me: () => get('me').then(withCsrf),
  logout: () => post('logout').finally(() => { csrf = ''; }),
  logoutAll: () => post('logout_all').finally(() => { csrf = ''; }),
  changePassword: (current, password) => post('change_password', { current, password }),
  recoverStart: () => post('recover_start'),
  recover: (key, email, password) => post('recover', { key, email, password }),

  /* ----- resumen y vista previa ----- */
  overview: () => get('overview'),
  previewSite: () => get('preview'),
  async publicSiteCheck() {
    const t0 = performance.now();
    const r = await fetch(new URL('../api/?a=public', location.href), { cache: 'no-store' });
    if (!r.ok) throw new ApiError('La página pública no responde (HTTP ' + r.status + ').', 'public', r.status);
    const j = await r.json();
    return { ms: Math.round(performance.now() - t0), products: (j.products || []).length };
  },

  /* ----- contenido ----- */
  drafts: () => get('drafts'),
  published: () => get('published'),
  content: key => get('content', { key }),
  saveDraft: (key, data, version) => post('save_draft', { key, data, expected_version: version ?? null }),
  publish: (keys, note) => post('publish', { keys: keys && keys.length ? keys : null, note: note || null }),
  discard: keys => post('discard', { keys }),
  versions: key => get('versions', { key }),
  versionData: id => get('version', { id }),
  restoreVersion: id => post('restore_version', { id }),
  audit: ({ page = 0, entity = '', action = '', search = '' } = {}) => get('audit', { page, entity, action, search }),

  /* ----- catálogo ----- */
  categories: () => get('categories'),
  saveCategory: c => post('category_save', c),
  deleteCategory: id => post('category_delete', { id }),
  reorderCategories: ids => post('categories_reorder', { ids }),
  products: () => get('products'),
  saveProduct: (p, version) => post('product_save', { product: p, version: version ?? null }),
  updateProducts: (ids, fields) => post('products_update', { ids, fields }),
  deleteProducts: ids => post('products_delete', { ids }),
  reorderProducts: ids => post('products_reorder', { ids }),

  /* ----- medios ----- */
  media: () => get('media'),
  mediaUsage: url => get('media_usage', { url }),
  replaceMedia: (oldUrl, newUrl) => post('media_replace', { old: oldUrl, new: newUrl }),
  updateMedia: (id, fields) => post('media_update', { id, ...fields }),
  deleteMedia: m => post('media_delete', { id: m.id }),
  uploadMedia(blob, { filename, folder, alt }) {
    const form = new FormData();
    form.append('file', blob, filename);
    form.append('folder', folder);
    form.append('alt', alt || '');
    return call('media_upload', { method: 'POST', form });
  },

  /* ----- respaldos y usuarios ----- */
  exportSite: () => get('export'),
  importSite: (payload, replaceCatalog) => post('import', { payload, replace_catalog: !!replaceCatalog }),
  admins: () => get('users'),
  createAdmin: (email, password, role) => post('user_create', { email, password, role }),
  setRole: (id, role) => post('user_update', { id, role }),
  setPassword: (id, password) => post('user_password', { id, password }),
  removeAdmin: id => post('user_delete', { id })
};

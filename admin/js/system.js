/* Resumen, publicación, historial, respaldos, usuarios y cuenta. */
import { api, sb, friendly } from './api.js';
import { h, icon, clear, toast, modal, confirmDialog, fmtDate, fmtRel, loadingBox, notice, busy, download, deepEqual } from './ui.js';
import { CONTENT, CONTENT_KEYS } from './schema.js';
import { openPreviewTab, invalidatePreview } from './preview.js';
import { SUPABASE_DASHBOARD } from './config.js';

const label = k => (CONTENT[k] && CONTENT[k].label) || k;
const ACTIONS = { insert: 'creó', update: 'editó', delete: 'eliminó', publish: 'publicó', restore: 'restauró', import: 'importó', login: 'inició sesión' };
const ENTITIES = { site_content: 'contenido', site_published: 'contenido', products: 'producto', categories: 'categoría', media: 'imagen', admin_users: 'usuario', backup: 'respaldo', session: '', seed: 'carga inicial' };
function describe(r) {
  if (r.action === 'login') return 'Inició sesión';
  if (r.action === 'publish') return 'Publicó: ' + String(r.entity_id || '').split(',').map(label).join(', ');
  if (r.entity === 'site_content') return `${(ACTIONS[r.action] || r.action).replace(/^./, c => c.toUpperCase())} el borrador de “${label(r.entity_id)}”`;
  return `${(ACTIONS[r.action] || r.action).replace(/^./, c => c.toUpperCase())} ${ENTITIES[r.entity] || r.entity}${r.label ? ' “' + r.label + '”' : ''}`;
}

/* ===================== Resumen ===================== */
export async function dashboardView(ctx) {
  ctx.setTitle('Resumen');
  const root = h('div'); ctx.mount(root); root.append(loadingBox());
  let o;
  try { o = await api.overview(); } catch (e) { clear(root).append(notice('err', e.message)); return; }
  const siteState = h('span', { class: 'badge', text: 'Comprobando…' });
  api.publicSiteCheck().then(r => { siteState.className = 'badge badge--ok'; siteState.textContent = `En línea · responde en ${r.ms} ms · ${r.products} productos visibles`; })
    .catch(e => { siteState.className = 'badge badge--err'; siteState.textContent = e.message; });
  const stat = (n, l, href) => h('a', { class: 'stat', href, style: null }, h('div', { class: 'stat__n', text: String(n) }), h('div', { class: 'stat__l', text: l }));
  clear(root).append(
    h('div', { class: 'pagehead' }, h('div', null, h('h1', { text: `Hola${ctx.profile.email ? ', ' + ctx.profile.email.split('@')[0] : ''}` }),
      h('p', { text: 'Desde aquí administras toda la página de VOLT STORE CO.' }))),
    h('div', { class: 'row', style: null }, h('strong', { text: 'Estado de la página: ' }), siteState),
    h('div', { class: 'stats' },
      stat(o.products_active, `productos visibles de ${o.products_total}`, '#/productos'),
      stat(o.products_out, 'agotados (stock 0)', '#/productos'),
      stat(o.products_featured, 'destacados', '#/productos'),
      stat(o.categories, 'categorías', '#/categorias'),
      stat(o.media, 'imágenes', '#/medios')),
    o.pending.length ? h('div', { class: 'card' },
      h('div', { class: 'card__head' }, h('h2', { text: `Cambios sin publicar (${o.pending.length})` }), h('a', { class: 'btn btn--primary', href: '#/publicar' }, icon('send'), 'Revisar y publicar')),
      h('p', { class: 'muted', text: o.pending.map(label).join(' · ') })) :
      h('div', { class: 'card' }, h('div', { class: 'card__head' }, h('h2', { text: 'Todo está publicado' }), h('span', { class: 'badge badge--ok', text: 'Al día' })),
        h('p', { class: 'muted', text: o.last_publish ? `Última publicación ${fmtRel(o.last_publish.at)}${o.last_publish.by ? ' por ' + o.last_publish.by : ''}.` : '' })),
    h('div', { class: 'card' }, h('div', { class: 'card__head' }, h('h2', { text: 'Accesos rápidos' })),
      h('div', { class: 'quick' },
        h('a', { href: '#/productos/nuevo' }, icon('plus'), 'Agregar producto'),
        h('a', { href: '#/productos' }, icon('box'), 'Precios y stock'),
        h('a', { href: '#/contenido/hero' }, icon('home'), 'Editar la portada'),
        h('a', { href: '#/contenido/general' }, icon('chat'), 'WhatsApp y redes'),
        h('a', { href: '#/medios' }, icon('upload'), 'Subir imágenes'),
        h('a', { href: '#/secciones' }, icon('layers'), 'Ordenar secciones'),
        h('a', { href: '#/diseno' }, icon('palette'), 'Colores y tipografía'),
        h('a', { href: '#/respaldos' }, icon('download'), 'Descargar respaldo'))),
    h('div', { class: 'card' }, h('div', { class: 'card__head' }, h('h2', { text: 'Actividad reciente' }), h('a', { class: 'btn btn--sm', href: '#/historial' }, 'Ver todo')),
      o.recent.length ? h('div', { class: 'feed' }, o.recent.map(r => h('div', { class: 'feed__row' },
        h('span', { class: 'feed__when', text: fmtRel(r.at) }), h('span', null, describe(r), r.user_email ? h('span', { class: 'muted', text: ' · ' + r.user_email }) : null))))
        : h('div', { class: 'empty', text: 'Sin actividad todavía.' })));
}

/* ===================== Publicar ===================== */
function flatten(o, prefix = '', out = {}) {
  if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
    if (Array.isArray(o) && !o.length) out[prefix] = '(vacío)';
  } else out[prefix] = o;
  return out;
}
function diffList(a, b) {
  const A = flatten(a || {}), B = flatten(b || {});
  const keys = [...new Set([...Object.keys(A), ...Object.keys(B)])].filter(k => !deepEqual(A[k], B[k]));
  if (!keys.length) return h('p', { class: 'muted', text: 'Sin diferencias.' });
  return h('div', { class: 'diff' }, keys.slice(0, 60).map(k => h('div', { class: 'diff__row' },
    h('div', { class: 'diff__path', text: k.replace(/\.(\d+)\./g, (m, n) => ` #${+n + 1} › `).replace(/\./g, ' › ') }),
    A[k] !== undefined ? h('div', { class: 'diff__old', text: String(A[k]) }) : null,
    B[k] !== undefined ? h('div', { class: 'diff__new', text: String(B[k]) }) : null)),
    keys.length > 60 ? h('p', { class: 'muted small', text: `…y ${keys.length - 60} cambios más.` }) : null);
}

export async function publishView(ctx) {
  ctx.setTitle('Publicar cambios');
  const root = h('div'); ctx.mount(root); root.append(loadingBox());
  let drafts, pubs;
  try { [drafts, pubs] = await Promise.all([api.drafts(), api.published()]); }
  catch (e) { clear(root).append(notice('err', e.message)); return; }
  const P = Object.fromEntries(pubs.map(p => [p.key, p]));
  const pending = drafts.filter(d => !P[d.key] || !deepEqual(d.data, P[d.key].data)).sort((a, b) => CONTENT_KEYS.indexOf(a.key) - CONTENT_KEYS.indexOf(b.key));
  const chosen = new Set(pending.map(d => d.key));
  const note = h('input', { class: 'input', maxlength: 200, placeholder: 'Ej.: Nuevos precios de iPhone (opcional)' });
  const btn = h('button', { class: 'btn btn--primary' }, icon('send'), 'Publicar seleccionados');
  btn.addEventListener('click', async () => {
    const keys = [...chosen];
    if (!keys.length) return toast('Selecciona al menos una sección.', 'warn');
    if (!await confirmDialog({ title: 'Publicar cambios', message: `Se publicarán ${keys.length} sección(es): ${keys.map(label).join(', ')}. Los visitantes las verán al recargar la página.`, confirmLabel: 'Publicar ahora' })) return;
    try {
      const r = await busy(btn, () => api.publish(keys, note.value.trim()));
      toast(`Publicado: ${(r.published || []).map(label).join(', ') || 'sin cambios'}.`);
      invalidatePreview(); ctx.refreshBadge(); ctx.reload();
    } catch (e) { toast(e.message, 'err'); }
  });
  const head = h('div', { class: 'pagehead' }, h('div', null, h('h1', { text: 'Publicar cambios' }),
    h('p', { text: 'Los cambios del contenido se guardan como borrador. Aquí revisas qué cambió y lo publicas. (Los productos se publican solos al guardarlos.)' })));
  if (!pending.length) {
    clear(root).append(head, h('div', { class: 'card' }, h('div', { class: 'empty' }, icon('check'), h('p', { text: 'No hay cambios pendientes: todo lo que ves en el panel ya está publicado.' }))));
    return;
  }
  clear(root).append(head,
    h('div', { class: 'card' },
      h('div', { class: 'card__head' }, h('h2', { text: `${pending.length} sección(es) con cambios` }),
        h('button', { class: 'btn', onclick: () => openPreviewTab(Object.fromEntries(drafts.map(d => [d.key, d.data]))) }, icon('eye'), 'Vista previa de todo')),
      h('div', { class: 'list' }, pending.map(d => {
        const cb = h('input', { type: 'checkbox', checked: true, 'aria-label': 'Publicar ' + label(d.key) });
        cb.addEventListener('change', () => cb.checked ? chosen.add(d.key) : chosen.delete(d.key));
        const body = h('div', { class: 'item__body' }, diffList(P[d.key] && P[d.key].data, d.data));
        const item = h('div', { class: 'item is-collapsed' },
          h('div', { class: 'item__head', onclick: e => { if (e.target.closest('input,button,a')) return; item.classList.toggle('is-collapsed'); } },
            cb, h('span', { class: 'item__chev' }, icon('chev')),
            h('span', { class: 'item__title', text: label(d.key) }),
            h('span', { class: 'small muted hide-sm', text: `${fmtRel(d.updated_at)}${d.updated_by_email ? ' · ' + d.updated_by_email : ''}` }),
            h('a', { class: 'btn btn--sm', href: d.key === 'layout' ? '#/secciones' : d.key === 'theme' ? '#/diseno' : d.key === 'seo' ? '#/seo' : '#/contenido/' + d.key }, icon('edit')),
            h('button', {
              class: 'btn btn--sm btn--danger', title: 'Descartar este borrador', onclick: async () => {
                if (!await confirmDialog({ title: 'Descartar borrador', message: `Los cambios sin publicar de “${label(d.key)}” se perderán.`, confirmLabel: 'Descartar', danger: true })) return;
                try { await api.discard([d.key]); invalidatePreview(); ctx.refreshBadge(); toast('Borrador descartado.'); ctx.reload(); } catch (e) { toast(e.message, 'err'); }
              }
            }, icon('undo'))),
          body);
        return item;
      })),
      h('div', { class: 'field', style: null }, h('label', { class: 'field__label', text: 'Nota de la publicación (queda en el historial)' }), note),
      btn));
}

/* ===================== Historial ===================== */
export async function historyView(ctx, params) {
  ctx.setTitle('Historial');
  const root = h('div'); ctx.mount(root);
  const tabs = h('div', { class: 'row' });
  const body = h('div');
  const key = params.get('k');
  root.append(h('div', { class: 'pagehead' }, h('div', null, h('h1', { text: 'Historial y versiones' }),
    h('p', { text: 'Registro de todos los cambios (quién, qué y cuándo) y las versiones publicadas de cada sección, que puedes restaurar.' }))), tabs, h('div', { class: 'card' }, body));
  const show = which => {
    clear(tabs).append(
      h('button', { class: 'btn' + (which === 'v' ? ' btn--dark' : ''), onclick: () => show('v') }, icon('archive'), 'Versiones publicadas'),
      h('button', { class: 'btn' + (which === 'a' ? ' btn--dark' : ''), onclick: () => show('a') }, icon('clock'), 'Registro de actividad'));
    which === 'v' ? versions(body, key, ctx) : activity(body);
  };
  show(key ? 'v' : 'a');
}

async function versions(body, initialKey, ctx) {
  const sel = h('select', { class: 'select' }, CONTENT_KEYS.map(k => h('option', { value: k, text: label(k), selected: k === initialKey })));
  const list = h('div');
  const load = async () => {
    clear(list).append(loadingBox());
    try {
      const rows = await api.versions(sel.value);
      clear(list).append(rows.length ? h('div', { class: 'tablewrap' }, h('table', null,
        h('thead', null, h('tr', null, h('th', { text: 'Publicada' }), h('th', { text: 'Por' }), h('th', { text: 'Nota' }), h('th', null, ''))),
        h('tbody', null, rows.map((v, i) => h('tr', null,
          h('td', null, fmtDate(v.published_at), i === 0 ? [' ', h('span', { class: 'badge badge--ok', text: 'Actual' })] : null),
          h('td', { text: v.published_by_email || '—' }), h('td', { text: v.note || '' }),
          h('td', null, h('div', { class: 'row' },
            h('button', {
              class: 'btn btn--sm', onclick: async () => {
                const { data } = await api.versionData(v.id);
                modal({ title: `${label(v.key)} · ${fmtDate(v.published_at)}`, wide: true, body: h('pre', { class: 'code', text: JSON.stringify(data, null, 2) }), actions: [{ label: 'Cerrar' }] });
              }
            }, icon('eye'), 'Ver'),
            i === 0 ? null : h('button', {
              class: 'btn btn--sm', onclick: async () => {
                if (!await confirmDialog({ title: 'Restaurar versión', message: `El borrador de “${label(v.key)}” se reemplazará por la versión del ${fmtDate(v.published_at)}. Después revísalo y publícalo.`, confirmLabel: 'Restaurar como borrador' })) return;
                try { await api.restoreVersion(v.id); invalidatePreview(); ctx.refreshBadge(); toast('Versión restaurada como borrador. Revísala y publícala.'); location.hash = v.key === 'layout' ? '#/secciones' : v.key === 'theme' ? '#/diseno' : v.key === 'seo' ? '#/seo' : '#/contenido/' + v.key; }
                catch (e) { toast(e.message, 'err'); }
              }
            }, icon('undo'), 'Restaurar')))))))) : h('div', { class: 'empty', text: 'Esta sección aún no tiene versiones publicadas.' }));
    } catch (e) { clear(list).append(notice('err', e.message)); }
  };
  sel.addEventListener('change', load);
  clear(body).append(h('div', { class: 'toolbar' }, h('label', { class: 'small muted', text: 'Sección:' }), sel), list);
  load();
}

async function activity(body) {
  let page = 0;
  const entity = h('select', { class: 'select', 'aria-label': 'Tipo' }, [['', 'Todo'], ['products', 'Productos'], ['categories', 'Categorías'], ['site_content', 'Contenido'], ['site_published', 'Publicaciones'], ['media', 'Imágenes'], ['admin_users', 'Usuarios'], ['session', 'Inicios de sesión'], ['backup', 'Respaldos']].map(([v, l]) => h('option', { value: v, text: l })));
  const search = h('input', { class: 'input grow', type: 'search', placeholder: 'Buscar por nombre o usuario', 'aria-label': 'Buscar' });
  const list = h('div'), pager = h('div', { class: 'pager' });
  const load = async () => {
    clear(list).append(loadingBox());
    try {
      const { data, count } = await api.audit({ page, entity: entity.value, search: search.value.trim() });
      const pages = Math.max(1, Math.ceil(count / 30));
      clear(list).append(data.length ? h('div', { class: 'feed' }, data.map(r => {
        const det = (r.before || r.after) && r.entity !== 'session' ? h('button', {
          class: 'btn btn--sm btn--ghost', onclick: () => modal({
            title: describe(r), wide: true, actions: [{ label: 'Cerrar' }],
            body: r.before && r.after ? diffList(strip(r.before), strip(r.after)) : h('pre', { class: 'code', text: JSON.stringify(strip(r.after || r.before), null, 2) })
          })
        }, 'Detalles') : null;
        return h('div', { class: 'feed__row' }, h('span', { class: 'feed__when', text: fmtDate(r.at) }),
          h('span', { class: 'grow' }, describe(r), h('span', { class: 'muted', text: r.user_email ? ' · ' + r.user_email : ' · sistema' })), det);
      })) : h('div', { class: 'empty', text: 'Sin registros con ese filtro.' }));
      clear(pager).append(h('span', { text: `${count} registros · página ${page + 1} de ${pages}` }), h('div', { class: 'row' },
        h('button', { class: 'btn btn--sm', disabled: page === 0, onclick: () => { page--; load(); } }, 'Anterior'),
        h('button', { class: 'btn btn--sm', disabled: page >= pages - 1, onclick: () => { page++; load(); } }, 'Siguiente')));
    } catch (e) { clear(list).append(notice('err', e.message)); }
  };
  let t; search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { page = 0; load(); }, 350); });
  entity.addEventListener('change', () => { page = 0; load(); });
  clear(body).append(h('div', { class: 'toolbar' }, search, entity), list, pager);
  load();
}
function strip(o) {
  if (!o) return o;
  const c = { ...o };
  ['updated_at', 'updated_by', 'version', 'created_at', 'updated_by_email', 'created_by'].forEach(k => delete c[k]);
  return c.data && c.key ? c.data : c;
}

/* ===================== Respaldos ===================== */
export async function backupsView(ctx) {
  ctx.setTitle('Respaldos');
  const isOwner = ctx.profile.role === 'owner';
  const exp = h('button', { class: 'btn btn--primary' }, icon('download'), 'Descargar respaldo completo');
  exp.addEventListener('click', () => busy(exp, async () => {
    try {
      const data = await api.exportSite();
      download(`volt-respaldo-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2));
      toast('Respaldo descargado. Guárdalo en un lugar seguro.');
    } catch (e) { toast(e.message, 'err'); }
  }));
  const file = h('input', { type: 'file', accept: 'application/json,.json', class: 'input' });
  const replace = h('input', { type: 'checkbox', id: 'rep-cat' });
  const imp = h('button', { class: 'btn btn--danger-solid', disabled: !isOwner }, icon('upload'), 'Restaurar respaldo');
  imp.addEventListener('click', async () => {
    const f = file.files[0];
    if (!f) return toast('Elige el archivo de respaldo (.json).', 'warn');
    if (f.size > 10 * 1024 * 1024) return toast('El archivo es demasiado grande para ser un respaldo.', 'err');
    let payload;
    try { payload = JSON.parse(await f.text()); } catch { return toast('El archivo no es un JSON válido.', 'err'); }
    if (payload.format !== 'volt-backup') return toast('Ese archivo no es un respaldo de VOLT.', 'err');
    const summary = `Respaldo del ${fmtDate(payload.exported_at)}: ${Object.keys(payload.drafts || {}).length} secciones, ${(payload.categories || []).length} categorías y ${(payload.products || []).length} productos.`;
    const ok = await confirmDialog({
      title: 'Restaurar respaldo', danger: true, typed: 'RESTAURAR', confirmLabel: 'Restaurar',
      message: h('div', null, h('p', { text: summary }),
        h('ul', { class: 'list small' },
          h('li', { text: 'El contenido se carga como BORRADOR: tendrás que publicarlo.' }),
          h('li', { text: 'Las categorías y productos del respaldo se crean o actualizan.' }),
          replace.checked ? h('li', null, h('strong', { text: 'Se borrarán los productos que no estén en el respaldo.' })) : h('li', { text: 'Los productos que no estén en el respaldo se conservan.' }),
          h('li', { text: 'Las imágenes no se borran nunca.' })),
        h('p', { class: 'small muted', text: 'Si algo del archivo no es válido, no se cambia nada.' }))
    });
    if (!ok) return;
    try {
      const r = await busy(imp, () => api.importSite(payload, replace.checked));
      invalidatePreview(); ctx.refreshBadge();
      toast(`Respaldo restaurado: ${r.content} secciones (en borrador), ${r.categories} categorías y ${r.products} productos.`, 'ok', 8000);
    } catch (e) { toast(e.message, 'err'); }
  });
  ctx.mount(h('div', null,
    h('div', { class: 'pagehead' }, h('div', null, h('h1', { text: 'Respaldos' }), h('p', { text: 'Descarga una copia de todo lo administrable y restáurala si algo sale mal.' }))),
    h('div', { class: 'card' }, h('div', { class: 'card__head' }, h('h2', { text: 'Descargar respaldo' })),
      h('p', { text: 'Incluye: textos y configuración de todas las secciones (borrador y publicado), diseño, SEO, categorías, productos (precios, stock, imágenes asignadas) y la lista de imágenes con sus textos alternativos.' }),
      h('p', { class: 'small muted', text: 'No incluye los archivos de imagen: las subidas están en Supabase Storage y las originales en el repositorio de GitHub. Además, GitHub guarda cada día una copia de lo publicado (data/site.json).' }),
      exp),
    h('div', { class: 'card' }, h('div', { class: 'card__head' }, h('h2', { text: 'Restaurar respaldo' }), isOwner ? null : h('span', { class: 'badge badge--warn', text: 'Solo propietario' })),
      notice('warn', 'Antes de restaurar, descarga un respaldo actual por si necesitas volver atrás.'),
      h('div', { class: 'field' }, h('label', { class: 'field__label', text: 'Archivo de respaldo (.json)' }), file),
      h('div', { class: 'field' }, h('label', { class: 'switch', for: 'rep-cat' }, replace, h('span', { class: 'switch__track' }), h('span', { text: 'Reemplazar todo el catálogo (borra productos que no estén en el respaldo)' }))),
      imp)));
}

/* ===================== Usuarios ===================== */
export async function usersView(ctx) {
  ctx.setTitle('Usuarios');
  if (ctx.profile.role !== 'owner') { ctx.mount(notice('warn', 'Solo el propietario puede administrar usuarios.')); return; }
  const root = h('div'); ctx.mount(root); root.append(loadingBox());
  const tbody = h('tbody');
  const load = async () => {
    try {
      const rows = await api.admins();
      clear(tbody).append(...rows.map(u => {
        const role = h('select', { class: 'select input--sm', 'aria-label': 'Rol de ' + u.email }, [['owner', 'Propietario'], ['editor', 'Editor']].map(([v, l]) => h('option', { value: v, text: l, selected: u.role === v })));
        role.addEventListener('change', async () => {
          try { await api.grantAdmin(u.email, role.value); toast('Rol actualizado.'); } catch (e) { toast(e.message, 'err'); role.value = u.role; }
        });
        return h('tr', null, h('td', null, h('strong', { text: u.email }), u.user_id === ctx.profile.user_id ? h('span', { class: 'badge badge--info', text: ' Tú' }) : null),
          h('td', null, role), h('td', { class: 'hide-sm', text: fmtDate(u.created_at) }),
          h('td', null, h('button', {
            class: 'btn btn--sm btn--danger', onclick: async () => {
              if (!await confirmDialog({ title: 'Quitar acceso', message: `${u.email} ya no podrá entrar al panel. Su cuenta sigue existiendo en Supabase.`, confirmLabel: 'Quitar acceso', danger: true })) return;
              try { await api.revokeAdmin(u.user_id); toast('Acceso retirado.'); load(); } catch (e) { toast(e.message, 'err'); }
            }
          }, icon('trash'), 'Quitar')));
      }));
    } catch (e) { clear(tbody).append(h('tr', null, h('td', { colspan: 4 }, notice('err', e.message)))); }
  };
  const email = h('input', { class: 'input', type: 'email', placeholder: 'correo@ejemplo.com', autocomplete: 'off' });
  const role = h('select', { class: 'select' }, h('option', { value: 'editor', text: 'Editor (contenido, catálogo, imágenes, publicar)' }), h('option', { value: 'owner', text: 'Propietario (además usuarios y restaurar respaldos)' }));
  const add = h('button', { class: 'btn btn--primary' }, icon('plus'), 'Dar acceso');
  add.addEventListener('click', () => busy(add, async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) return toast('Escribe un correo válido.', 'err');
    try { await api.grantAdmin(email.value.trim(), role.value); toast('Acceso concedido.'); email.value = ''; load(); } catch (e) { toast(e.message, 'err'); }
  }));
  clear(root).append(
    h('div', { class: 'pagehead' }, h('div', null, h('h1', { text: 'Usuarios administradores' }), h('p', { text: 'Quién puede entrar al panel y con qué permisos.' }))),
    h('div', { class: 'card' }, h('div', { class: 'card__head' }, h('h2', { text: 'Dar acceso a una persona' })),
      notice('info', h('span', null, 'Primero crea su cuenta en ', h('a', { href: SUPABASE_DASHBOARD + '/auth/users', target: '_blank', rel: 'noopener', text: 'Supabase → Authentication → Users' }),
        ' (“Add user” → “Create new user”, marca “Auto Confirm User”). Luego escribe aquí su correo.')),
      h('div', { class: 'grid2' }, h('div', { class: 'field' }, h('label', { class: 'field__label', text: 'Correo' }), email),
        h('div', { class: 'field' }, h('label', { class: 'field__label', text: 'Rol' }), role)), add),
    h('div', { class: 'card' }, h('div', { class: 'tablewrap' }, h('table', null,
      h('thead', null, h('tr', null, h('th', { text: 'Correo' }), h('th', { text: 'Rol' }), h('th', { class: 'hide-sm', text: 'Desde' }), h('th', null, ''))), tbody))));
  load();
}

/* ===================== Mi cuenta ===================== */
export async function accountView(ctx) {
  ctx.setTitle('Mi cuenta');
  const p1 = h('input', { class: 'input', type: 'password', autocomplete: 'new-password', minlength: 10 });
  const p2 = h('input', { class: 'input', type: 'password', autocomplete: 'new-password' });
  const save = h('button', { class: 'btn btn--primary' }, icon('key'), 'Cambiar contraseña');
  save.addEventListener('click', () => busy(save, async () => {
    if (p1.value.length < 10) return toast('Usa al menos 10 caracteres.', 'err');
    if (!/[a-zA-Z]/.test(p1.value) || !/[0-9]/.test(p1.value)) return toast('Combina letras y números.', 'err');
    if (p1.value !== p2.value) return toast('Las contraseñas no coinciden.', 'err');
    const { error } = await sb.auth.updateUser({ password: p1.value });
    if (error) return toast(friendly(error), 'err');
    p1.value = p2.value = ''; toast('Contraseña actualizada.');
  }));
  const out = h('button', { class: 'btn btn--danger' }, icon('logout'), 'Cerrar sesión en todos los dispositivos');
  out.addEventListener('click', async () => {
    if (!await confirmDialog({ title: 'Cerrar todas las sesiones', message: 'Se cerrará tu sesión aquí y en cualquier otro dispositivo.', confirmLabel: 'Cerrar todas', danger: true })) return;
    await sb.auth.signOut({ scope: 'global' });
  });
  ctx.mount(h('div', null,
    h('div', { class: 'pagehead' }, h('div', null, h('h1', { text: 'Mi cuenta' }))),
    h('div', { class: 'card' }, h('p', null, 'Correo: ', h('strong', { text: ctx.profile.email })),
      h('p', null, 'Rol: ', h('strong', { text: ctx.profile.role === 'owner' ? 'Propietario' : 'Editor' })),
      h('p', { class: 'small muted', text: 'Por seguridad, la sesión se cierra sola tras 30 minutos sin actividad y al cerrar la pestaña.' })),
    h('div', { class: 'card' }, h('div', { class: 'card__head' }, h('h2', { text: 'Cambiar contraseña' })),
      h('div', { class: 'grid2' }, h('div', { class: 'field' }, h('label', { class: 'field__label', text: 'Nueva contraseña (mín. 10 caracteres, letras y números)' }), p1),
        h('div', { class: 'field' }, h('label', { class: 'field__label', text: 'Repite la contraseña' }), p2)), save),
    h('div', { class: 'card' }, h('div', { class: 'card__head' }, h('h2', { text: 'Sesiones' })), out)));
}

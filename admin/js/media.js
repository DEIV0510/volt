/* Biblioteca de medios: subir (optimizando), elegir, reemplazar y borrar con seguridad. */
import { api } from './api.js';
import { h, icon, clear, toast, modal, confirmDialog, bytes, fmtDate, imgUrl, busy, loadingBox, notice } from './ui.js';
import { CONTENT } from './schema.js';
import { invalidatePreview } from './preview.js';

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon'];
const MAX_INPUT = 15 * 1024 * 1024;   // antes de optimizar
const MAX_OUT = 5 * 1024 * 1024;      // límite del servidor
const MAX_SIDE = 2000;                // lado mayor tras optimizar
export const FOLDERS = [['general', 'General'], ['portada', 'Portada'], ['productos', 'Productos'], ['catalogo', 'Catálogo'], ['galeria', 'Galería'], ['marca', 'Marca y logos']];

let cache = null;
export async function loadMedia(force) { if (!cache || force) cache = await api.media(); return cache; }

function slug(name) {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'imagen';
}
function dims(file) {
  return new Promise(res => { const i = new Image(); i.onload = () => { res({ width: i.naturalWidth, height: i.naturalHeight }); URL.revokeObjectURL(i.src); }; i.onerror = () => res({}); i.src = URL.createObjectURL(file); });
}

// Optimiza en el navegador: redimensiona y convierte a WebP. Al re-codificar, cualquier
// contenido que no sea imagen se descarta (el archivo nunca se sirve como código).
export async function optimize(file) {
  if (!ACCEPT.includes(file.type)) throw new Error(`“${file.name}”: tipo no permitido. Usa JPG, PNG, WebP o GIF.`);
  if (file.size > MAX_INPUT) throw new Error(`“${file.name}” pesa ${bytes(file.size)}; el máximo es 15 MB.`);
  if (file.type === 'image/gif' || file.type.includes('icon')) {
    if (file.size > MAX_OUT) throw new Error(`“${file.name}” supera 5 MB.`);
    const d = await dims(file);
    const mime = file.type === 'image/gif' ? 'image/gif' : 'image/x-icon';
    return { blob: file, mime, ext: mime === 'image/gif' ? 'gif' : 'ico', ...d };
  }
  let bmp;
  try { bmp = await createImageBitmap(file); } catch { throw new Error(`“${file.name}” no es una imagen válida.`); }
  if (bmp.width < 16 || bmp.height < 16) throw new Error(`“${file.name}” es demasiado pequeña.`);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), hgt = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = hgt;
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, hgt);
  if (bmp.close) bmp.close();
  let blob = null;
  for (let q = 0.86; q >= 0.5; q -= 0.12) {
    blob = await new Promise(r => canvas.toBlob(r, 'image/webp', q));
    if (!blob || blob.type !== 'image/webp' || blob.size <= MAX_OUT) break;
  }
  if (!blob || blob.type !== 'image/webp') blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85));
  if (!blob || blob.size > MAX_OUT) throw new Error(`No se pudo reducir “${file.name}” por debajo de 5 MB.`);
  return { blob, mime: blob.type, ext: blob.type === 'image/webp' ? 'webp' : 'jpg', width: w, height: hgt };
}

export async function uploadFiles(files, folder, onProgress) {
  const out = [], errors = [];
  let n = 0;
  for (const file of files) {
    try {
      const o = await optimize(file);
      out.push(await api.uploadMedia(o.blob, { filename: `${slug(file.name)}.${o.ext}`, alt: '', folder }));
    } catch (e) { errors.push(e.message); }
    onProgress && onProgress(++n / files.length);
  }
  if (out.length) { cache = null; }
  if (errors.length) toast(errors.join(' · '), 'err');
  if (out.length) toast(out.length === 1 ? 'Imagen subida y optimizada.' : `${out.length} imágenes subidas y optimizadas.`);
  return out;
}

function dropzone(onFiles, folderSel) {
  const input = h('input', { type: 'file', accept: ACCEPT.join(','), multiple: true, hidden: true });
  const bar = h('div', { class: 'progress', hidden: true }, h('span'));
  const zone = h('div', { class: 'dropzone' },
    h('p', null, icon('upload'), ' Arrastra imágenes aquí o '),
    h('div', { class: 'row', style: null }, h('button', { type: 'button', class: 'btn btn--primary btn--sm', onclick: () => input.click() }, icon('upload'), 'Seleccionar archivos'),
      folderSel ? h('label', { class: 'small muted' }, 'Carpeta: ', folderSel) : null),
    h('p', { class: 'small muted', text: 'JPG, PNG, WebP o GIF. Se optimizan automáticamente (máx. 2000 px, WebP).' }), bar, input);
  zone.querySelector('.row').classList.add('row--center');
  const run = async files => {
    files = [...files].filter(Boolean); if (!files.length) return;
    bar.hidden = false; const fill = bar.firstChild; fill.style.width = '4%';
    try { await onFiles(files, p => { fill.style.width = Math.round(p * 100) + '%'; }); }
    finally { setTimeout(() => { bar.hidden = true; fill.style.width = '0'; }, 600); }
  };
  input.addEventListener('change', () => { run(input.files); input.value = ''; });
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('is-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('is-over'); run(e.dataTransfer.files); });
  return zone;
}
function folderSelect(value = 'general') {
  return h('select', { class: 'select input--sm' }, FOLDERS.map(([v, l]) => h('option', { value: v, text: l, selected: v === value })));
}

function mediaCard(m, { pick, current, onPick, onChanged } = {}) {
  const repo = m.source === 'repo';
  const card = h('div', { class: 'mcard' + (pick ? ' is-pick' : '') + (current ? ' is-current' : ''), tabindex: pick ? '0' : null },
    h('div', { class: 'mcard__img' }, h('img', { src: imgUrl(m.url), alt: m.alt || '', loading: 'lazy' }),
      repo ? h('span', { class: 'badge mcard__tag', text: 'Original' }) : null),
    h('div', { class: 'mcard__body' },
      h('span', { class: 'mcard__name', text: m.filename, title: m.filename }),
      h('span', { class: 'muted', text: [m.width && m.height ? `${m.width}×${m.height}` : '', bytes(m.size_bytes)].filter(Boolean).join(' · ') || (repo ? 'Del sitio original' : '') }),
      m.alt ? null : h('span', { class: 'badge badge--warn', text: 'Sin texto alternativo' })));
  if (pick) {
    const choose = () => onPick(m.url);
    card.addEventListener('click', choose);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
    return card;
  }
  card.append(h('div', { class: 'mcard__actions' },
    h('button', { class: 'btn btn--sm', title: 'Editar texto alternativo y carpeta', onclick: () => editMedia(m, onChanged) }, icon('edit')),
    h('button', { class: 'btn btn--sm', title: 'Ver dónde se usa', onclick: () => showUsage(m) }, icon('search')),
    h('button', { class: 'btn btn--sm', title: 'Reemplazar en todo el sitio', onclick: () => replaceMedia(m, onChanged) }, icon('refresh')),
    h('button', { class: 'btn btn--sm', title: 'Copiar enlace', onclick: async () => { await navigator.clipboard.writeText(imgUrl(m.url)); toast('Enlace copiado.'); } }, icon('copy')),
    repo ? null : h('button', { class: 'btn btn--sm btn--danger', title: 'Eliminar', onclick: () => removeMedia(m, onChanged) }, icon('trash'))));
  return card;
}

function editMedia(m, onChanged) {
  const alt = h('textarea', { class: 'textarea', maxlength: 200, value: m.alt || '' });
  const folder = folderSelect(m.folder);
  modal({
    title: 'Editar imagen',
    body: h('div', null,
      h('img', { src: imgUrl(m.url), alt: '', class: 'thumb', style: null }),
      h('div', { class: 'field' }, h('label', { class: 'field__label', text: 'Texto alternativo (describe la imagen para Google y lectores de pantalla)' }), alt),
      h('div', { class: 'field' }, h('label', { class: 'field__label', text: 'Carpeta' }), folder)),
    actions: [{ label: 'Cancelar' }, {
      label: 'Guardar', kind: 'btn--primary', onClick: async () => {
        await api.updateMedia(m.id, { alt: alt.value.trim(), folder: folder.value });
        cache = null; toast('Imagen actualizada.'); onChanged && onChanged();
      }
    }]
  });
}

function usageList(u) {
  const label = k => (CONTENT[k] && CONTENT[k].label) || k;
  const rows = [];
  if (u.content.length) rows.push(h('li', null, h('strong', { text: 'Contenido (borrador): ' }), u.content.map(label).join(', ')));
  if (u.published.length) rows.push(h('li', null, h('strong', { text: 'Contenido publicado: ' }), u.published.map(label).join(', ')));
  if (u.products.length) rows.push(h('li', null, h('strong', { text: `Productos (${u.products.length}): ` }), u.products.slice(0, 12).join(', ') + (u.products.length > 12 ? '…' : '')));
  return rows;
}
async function showUsage(m) {
  const body = h('div', null, loadingBox());
  modal({ title: 'Dónde se usa esta imagen', body, actions: [{ label: 'Cerrar' }] });
  try {
    const u = await api.mediaUsage(m.url);
    const rows = usageList(u);
    clear(body).append(rows.length ? h('ul', { class: 'list' }, rows) : notice('info', 'No se usa en ninguna parte. Puedes eliminarla con seguridad.'));
  } catch (e) { clear(body).append(notice('err', e.message)); }
}

async function replaceMedia(m, onChanged) {
  const input = h('input', { type: 'file', accept: ACCEPT.join(','), hidden: true });
  document.body.append(input);
  input.addEventListener('change', async () => {
    const f = input.files[0]; input.remove(); if (!f) return;
    try {
      const [nu] = await uploadFiles([f], m.folder === 'general' ? 'general' : m.folder);
      if (!nu) return;
      if (m.alt) await api.updateMedia(nu.id, { alt: m.alt });
      const r = await api.replaceMedia(m.url, nu.url);
      invalidatePreview();
      toast(`Reemplazada en ${r.content} sección(es) y ${r.products} producto(s). Publica los cambios del contenido para que se vean en la página.`, 'ok', 7000);
      onChanged && onChanged();
    } catch (e) { toast(e.message, 'err'); }
  });
  input.click();
}

async function removeMedia(m, onChanged) {
  try {
    const u = await api.mediaUsage(m.url);
    const rows = usageList(u);
    if (rows.length) {
      modal({ title: 'No se puede eliminar', body: h('div', null, notice('warn', 'Esta imagen todavía se usa. Cámbiala en esos lugares (o usa “Reemplazar”) y publica; luego podrás eliminarla.'), h('ul', { class: 'list' }, rows)), actions: [{ label: 'Entendido' }] });
      return;
    }
    if (!await confirmDialog({ title: 'Eliminar imagen', message: `Se eliminará “${m.filename}” de forma permanente.`, confirmLabel: 'Eliminar', danger: true })) return;
    await api.deleteMedia(m);
    cache = null; toast('Imagen eliminada.'); onChanged && onChanged();
  } catch (e) { toast(e.message, 'err'); }
}

function filters(onChange) {
  const search = h('input', { class: 'input grow', type: 'search', placeholder: 'Buscar por nombre o texto alternativo', 'aria-label': 'Buscar imágenes' });
  const folder = h('select', { class: 'select', 'aria-label': 'Carpeta' }, h('option', { value: '', text: 'Todas las carpetas' }), FOLDERS.map(([v, l]) => h('option', { value: v, text: l })));
  search.addEventListener('input', onChange); folder.addEventListener('change', onChange);
  const apply = list => {
    const s = search.value.trim().toLowerCase();
    return list.filter(m => (!folder.value || m.folder === folder.value) && (!s || (m.filename + ' ' + m.alt).toLowerCase().includes(s)));
  };
  return { el: h('div', { class: 'toolbar' }, search, folder), apply };
}

/* ---------- Vista: biblioteca ---------- */
export async function mediaView(ctx) {
  ctx.setTitle('Biblioteca de medios');
  const grid = h('div', { class: 'mgrid' });
  const count = h('span', { class: 'muted small' });
  const folderSel = folderSelect('general');
  let items = [];
  const f = filters(() => draw());
  const draw = () => {
    const list = f.apply(items);
    count.textContent = `${list.length} de ${items.length} imágenes`;
    clear(grid).append(...(list.length ? list.map(m => mediaCard(m, { onChanged: reload })) : [h('div', { class: 'empty', text: 'No hay imágenes con ese filtro.' })]));
  };
  const reload = async () => { items = await loadMedia(true); draw(); };
  ctx.mount(h('div', null,
    h('div', { class: 'pagehead' }, h('div', null, h('h1', { text: 'Biblioteca de medios' }),
      h('p', { text: 'Sube, organiza y reemplaza las imágenes del sitio. Las fotos se optimizan solas; las que están en uso no se pueden borrar.' })), count),
    dropzone(async (files, prog) => { await uploadFiles(files, folderSel.value, prog); await reload(); }, folderSel),
    f.el, grid));
  grid.append(loadingBox());
  try { await reload(); } catch (e) { clear(grid).append(notice('err', e.message)); }
}

/* ---------- Selector (desde los formularios) ---------- */
export function pickMedia(current, folder = 'general') {
  return new Promise(resolve => {
    let picked = null, dlg;
    const grid = h('div', { class: 'mgrid' }, loadingBox());
    const folderSel = folderSelect(folder);
    let items = [];
    const f = filters(() => draw());
    const choose = url => { picked = url; dlg.close(); };
    const draw = () => clear(grid).append(...f.apply(items).map(m => mediaCard(m, { pick: true, current: m.url === current, onPick: choose })));
    dlg = modal({
      title: 'Elegir imagen', wide: true,
      body: h('div', null,
        dropzone(async (files, prog) => {
          const up = await uploadFiles(files, folderSel.value, prog);
          if (up.length === 1) return choose(up[0].url);
          items = await loadMedia(true); draw();
        }, folderSel),
        f.el, grid),
      actions: [{ label: 'Cancelar' }],
      onClose: () => resolve(picked)
    });
    loadMedia().then(list => { items = list; draw(); }).catch(e => clear(grid).append(notice('err', e.message)));
  });
}

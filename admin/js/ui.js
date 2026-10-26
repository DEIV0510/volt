/* Utilidades de interfaz. h() crea elementos con texto seguro (nunca innerHTML con datos). */
import { REPO_BASE } from './config.js';

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

/* ---------- Íconos (trazos fijos del propio panel) ---------- */
const P = {
  home: 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z',
  store: 'M3 9l1.5-5h15L21 9M3 9h18M3 9v11h18V9M9 20v-6h6v6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  phone: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
  tool: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
  image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15 9.5a1.5 1.5 0 1 0 0-.01',
  bolt: 'M13 2 4 14h7l-2 8 11-13h-7z',
  chat: 'M21 12a8 8 0 0 1-11.8 7L3 21l2-6A8 8 0 1 1 21 12z',
  footer: 'M3 4h18v16H3zM3 15h18',
  layers: 'M12 3 2 8l10 5 10-5zM2 13l10 5 10-5M2 18l10 5 10-5',
  palette: 'M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.6 0-1-.8-1.4-.8-2.3 0-1 .8-1.6 1.8-1.6H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3zM7.5 11.5h.01M10 7.5h.01M15 7.5h.01',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5',
  marquee: 'M3 7h18M3 17h18M7 12h10',
  box: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  tag: 'M3 12V3h9l9 9-9 9zM7.5 7.5h.01',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  archive: 'M3 4h18v4H3zM5 8v12h14V8M10 12h4',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a6 6 0 0 0-4-5.6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  logout: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  edit: 'M4 20h4L20 8l-4-4L4 16zM14 6l4 4',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M18 13l-6 6-6-6',
  drag: 'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01',
  chev: 'M6 9l6 6 6-6',
  x: 'M6 6l12 12M18 6 6 18',
  check: 'M4 12l5 5L20 6',
  alert: 'M12 3 2 21h20zM12 10v4M12 17.5h.01',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5h.01',
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  save: 'M5 3h11l3 3v15H5zM8 3v5h7M8 21v-7h8v7',
  monitor: 'M3 4h18v12H3zM8 20h8M12 16v4',
  mobile: 'M8 2h8a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM12 18h.01',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  key: 'M15 7a4 4 0 1 1-3.5 6L4 20.5V17h3v-3h3l1.5-1.5A4 4 0 0 1 15 7zM16 8h.01'
};
export function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');   // tamaño por defecto; el CSS lo ajusta donde haga falta
  svg.setAttribute('height', '18');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', P[name] || P.info);
  svg.append(path);
  return svg;
}

/* ---------- Avisos ---------- */
export function toast(message, type = 'ok', ms = 3800) {
  const box = document.getElementById('toasts');
  const t = h('div', { class: 'toast toast--' + type, role: type === 'err' ? 'alert' : 'status' },
    icon(type === 'ok' ? 'check' : type === 'err' ? 'alert' : 'info'), h('div', null, message));
  box.append(t);
  setTimeout(() => t.remove(), type === 'err' ? Math.max(ms, 6500) : ms);
}

/* ---------- Diálogos ---------- */
let openModals = 0;
export function modal({ title, body, actions = [], wide = false, onClose }) {
  const prevFocus = document.activeElement;
  const foot = actions.length ? h('div', { class: 'modal__foot' }) : null;
  const box = h('div', { class: 'modal__box' + (wide ? ' modal__box--wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'modal__head' }, h('h2', { text: title }),
      h('button', { class: 'btn btn--ghost btn--icon', 'aria-label': 'Cerrar', onclick: () => close() }, icon('x'))),
    h('div', { class: 'modal__body' }, body), foot);
  const wrap = h('div', { class: 'modal' }, box);
  let closed = false;
  function close(result) {
    if (closed) return; closed = true;
    wrap.remove(); openModals--;
    document.removeEventListener('keydown', onKey);
    if (openModals === 0) document.body.style.overflow = '';
    if (prevFocus && prevFocus.focus) prevFocus.focus();
    if (onClose) onClose(result);
  }
  function onKey(e) {
    if (e.key === 'Escape' && wrap === document.querySelector('.modal:last-of-type')) close();
    if (e.key === 'Tab') {   // mantiene el foco dentro del diálogo
      const f = [...box.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(x => !x.disabled && x.offsetParent);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  }
  for (const a of actions) {
    const b = h('button', { class: 'btn ' + (a.kind || ''), type: 'button' }, a.icon ? icon(a.icon) : null, a.label);
    b.addEventListener('click', async () => {
      if (!a.onClick) return close();
      try { b.classList.add('is-loading'); b.disabled = true; const r = await a.onClick(close); if (r !== false) close(r); }
      catch (e) { toast(e.message || String(e), 'err'); }
      finally { b.classList.remove('is-loading'); b.disabled = false; }
    });
    foot.append(b);
  }
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(wrap); openModals++;
  document.body.style.overflow = 'hidden';
  setTimeout(() => { const f = box.querySelector('input,select,textarea,.btn--primary,.btn--danger-solid'); (f || box.querySelector('button')).focus(); }, 30);
  return { close, el: box };
}

// Confirmación. typed: palabra que hay que escribir para acciones muy destructivas.
export function confirmDialog({ title, message, confirmLabel = 'Confirmar', danger = false, typed = '' }) {
  return new Promise(resolve => {
    const input = typed ? h('input', { class: 'input', 'aria-label': 'Escribe ' + typed, autocomplete: 'off' }) : null;
    const body = h('div', null,
      typeof message === 'string' ? h('p', { text: message }) : message,
      typed ? h('div', { class: 'field' }, h('label', { class: 'field__label', text: `Para confirmar escribe ${typed}` }), input) : null);
    let ok = false;
    modal({
      title, body,
      actions: [
        { label: 'Cancelar', kind: '' },
        { label: confirmLabel, kind: danger ? 'btn--danger-solid' : 'btn--primary', onClick: () => {
          if (typed && input.value.trim().toUpperCase() !== typed.toUpperCase()) { toast(`Escribe ${typed} para confirmar.`, 'warn'); return false; }
          ok = true;
        } }
      ],
      onClose: () => resolve(ok)
    });
  });
}

/* ---------- Formatos ---------- */
export const money = n => n == null || n === '' ? '' : '$' + Number(n).toLocaleString('es-CO', { maximumFractionDigits: 0 });
export const bytes = n => n == null ? '' : n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
export function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function fmtRel(iso) {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  if (s < 86400 * 7) return `hace ${Math.round(s / 86400)} días`;
  return fmtDate(iso);
}
export function imgUrl(u) { return !u ? '' : /^https:/.test(u) ? u : REPO_BASE + u; }
export function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
export function loadingBox(text = 'Cargando…') { return h('div', { class: 'loading' }, h('span', { class: 'spinner' }), text); }
export function notice(type, text, ic) { return h('div', { class: 'notice notice--' + type }, icon(ic || (type === 'err' || type === 'warn' ? 'alert' : 'info')), h('div', null, text)); }
export async function busy(btn, fn) {
  btn.classList.add('is-loading'); btn.disabled = true;
  try { return await fn(); } finally { btn.classList.remove('is-loading'); btn.disabled = false; }
}
export function download(filename, text, type = 'application/json') {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
// Compara sin importar el orden de las claves (Postgres jsonb las reordena al guardar).
function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') return Object.keys(v).sort().reduce((o, k) => { o[k] = canon(v[k]); return o; }, {});
  return v;
}
export function deepEqual(a, b) { return JSON.stringify(canon(a)) === JSON.stringify(canon(b)); }
export function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }

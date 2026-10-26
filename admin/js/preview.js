/* Vista previa: abre la página real (index.html?preview=1) y le envía los
   borradores por postMessage (mismo origen). Los visitantes nunca ven borradores:
   la página pública solo acepta estos mensajes en modo vista previa y desde este mismo origen. */
import { api } from './api.js';
import { h, icon, toast } from './ui.js';
import { PREVIEW_URL } from './config.js';

let base = null;
const targets = new Map();   // ventana → función que arma el contenido a mostrar

window.addEventListener('message', e => {
  if (e.origin !== location.origin || !e.data || e.data.type !== 'volt:preview-ready') return;
  const build = targets.get(e.source);
  if (build) send(e.source, build());
});

function send(win, msg) {
  if (win && !win.closed) win.postMessage(msg, location.origin);
}

export async function previewBase(force) {
  if (!base || force) base = await api.previewSite();
  return base;
}
export function invalidatePreview() { base = null; }

function payload(overrides, scrollTo) {
  return { type: 'volt:preview', scrollTo, site: { ...base, content: { ...base.content, ...(overrides || {}) } } };
}

// Panel con iframe que se actualiza en vivo al editar.
export function previewPanel(getOverrides, scrollTo) {
  const frame = h('iframe', { title: 'Vista previa de la página' });
  const wrap = h('div', { class: 'preview' });
  const mode = h('div', { class: 'row' },
    h('button', { class: 'btn btn--sm btn--ghost', title: 'Escritorio', 'aria-label': 'Vista de escritorio', onclick: () => wrap.classList.remove('is-mobile') }, icon('monitor')),
    h('button', { class: 'btn btn--sm btn--ghost', title: 'Celular', 'aria-label': 'Vista de celular', onclick: () => wrap.classList.add('is-mobile') }, icon('mobile')));
  const closeBtn = h('button', { class: 'btn btn--sm', onclick: () => wrap.dispatchEvent(new CustomEvent('close')) }, icon('x'), 'Cerrar');
  wrap.append(h('div', { class: 'preview__bar' }, icon('eye'), h('strong', { text: 'Vista previa (sin publicar)' }), mode, closeBtn),
    h('div', { class: 'preview__stage' }, frame));
  let ready = false;
  previewBase().then(() => {
    targets.set(frame.contentWindow, () => payload(getOverrides(), scrollTo));
    // Al terminar de cargar, script.js ya escucha: se envía el borrador sin esperar el saludo.
    frame.addEventListener('load', () => {
      ready = true;
      targets.set(frame.contentWindow, () => payload(getOverrides(), scrollTo));
      send(frame.contentWindow, payload(getOverrides(), scrollTo));
    });
    frame.src = PREVIEW_URL;
  }).catch(e => toast(e.message, 'err'));
  return {
    el: wrap,
    update() { if (ready && base) send(frame.contentWindow, payload(getOverrides())); },
    destroy() { targets.delete(frame.contentWindow); }
  };
}

// Vista previa completa en una pestaña nueva.
export async function openPreviewTab(overrides, scrollTo) {
  await previewBase(true);
  const win = window.open(PREVIEW_URL, '_blank');
  if (!win) { toast('El navegador bloqueó la ventana. Permite las ventanas emergentes para este sitio.', 'warn'); return; }
  targets.set(win, () => payload(overrides, scrollTo));
}

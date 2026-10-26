/* Editor de contenido: borrador → vista previa → publicar, con control de
   ediciones simultáneas, validación y aviso de cambios sin guardar. */
import { api } from './api.js';
import { h, icon, clear, toast, modal, confirmDialog, fmtRel, fmtDate, loadingBox, notice, busy, deepEqual, clone, debounce } from './ui.js';
import { CONTENT, SECTION_IDS, SECTION_NAMES } from './schema.js';
import { createForm } from './forms.js';
import { pickMedia } from './media.js';
import { previewPanel, invalidatePreview, openPreviewTab } from './preview.js';

const THEME_DEFAULT = {
  primary: '#FFD400', primary2: '#FFC400', primaryInk: '#1A1500', dark: '#121219', bg: '#FFFFFF', bgSoft: '#F3F4F7',
  ink: '#15161C', muted: '#6A6B76', wa: '#25D366', fontHead: 'Sora', fontBody: 'Inter', scale: 'md', radius: 'square', cardStyle: 'border', spacing: 'normal'
};

/* ---------- contraste (WCAG) ---------- */
function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255].map(c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; })
    .reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
}
export function contrast(a, b) {
  if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return 0;
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
function themeChecks(t) {
  return [
    { label: 'Texto sobre el fondo', fg: t.ink, bg: t.bg, min: 4.5 },
    { label: 'Texto sobre fondo alterno', fg: t.ink, bg: t.bgSoft, min: 4.5 },
    { label: 'Texto secundario sobre el fondo', fg: t.muted, bg: t.bg, min: 3 },
    { label: 'Texto de botones principales', fg: t.primaryInk, bg: t.primary, min: 4.5 },
    { label: 'Texto blanco sobre el color oscuro', fg: '#FFFFFF', bg: t.dark, min: 4.5 },
    { label: 'Texto de botones de WhatsApp', fg: '#04210F', bg: t.wa, min: 4.5 }
  ].map(c => ({ ...c, ratio: contrast(c.fg, c.bg) }));
}

/* ---------- vista genérica ---------- */
export async function contentView(ctx, key) {
  const spec = CONTENT[key];
  if (!spec) return ctx.notFound();
  ctx.setTitle(spec.label);
  const page = h('div');
  ctx.mount(page);
  page.append(loadingBox());

  let draftRow, pubRow;
  try { ({ draft: draftRow, published: pubRow } = await api.content(key)); }
  catch (e) { clear(page).append(notice('err', e.message)); return; }

  let version = draftRow ? draftRow.version : null;
  let saved = clone(draftRow ? draftRow.data : {});
  let published = pubRow ? pubRow.data : null;
  if (key === 'theme') saved = { ...THEME_DEFAULT, ...saved };
  if (key === 'layout') saved = normalizeLayout(saved);

  let form, preview = null;
  const statusEl = h('div', { class: 'actionbar__status' });
  const badges = h('div', { class: 'row' });
  const extraBox = h('div', { class: 'stack' });
  const formCard = h('div', { class: 'card' });
  const editor = h('div', { class: 'editor' }, h('div', null, extraBox, formCard));

  const btnRevert = h('button', { class: 'btn', onclick: revertUnsaved }, icon('undo'), 'Deshacer cambios');
  const btnDiscard = h('button', { class: 'btn btn--danger', onclick: discardDraft }, icon('undo'), 'Volver a lo publicado');
  const btnSave = h('button', { class: 'btn btn--dark', onclick: () => save() }, icon('save'), 'Guardar borrador');
  const btnPublish = h('button', { class: 'btn btn--primary', onclick: publish }, icon('send'), 'Guardar y publicar');
  const btnPreview = h('button', { class: 'btn', onclick: togglePreview }, icon('eye'), 'Vista previa');

  const current = () => form ? form.state : saved;
  const dirty = () => !deepEqual(current(), saved);
  const pending = () => !deepEqual(saved, published);

  function refresh() {
    const d = dirty(), p = pending();
    clear(badges).append(
      d ? h('span', { class: 'badge badge--warn', text: 'Cambios sin guardar' }) : null,
      !d && p ? h('span', { class: 'badge badge--info', text: 'Borrador sin publicar' }) : null,
      !d && !p ? h('span', { class: 'badge badge--ok', text: 'Publicado' }) : null);
    btnSave.disabled = !d;
    btnRevert.hidden = !d;
    btnDiscard.hidden = d || !p || !published;
    btnPublish.disabled = !d && !p;
    clear(statusEl).append(
      draftRow && draftRow.updated_at ? h('span', null, 'Última edición ', h('strong', { text: fmtRel(draftRow.updated_at) }),
        draftRow.updated_by_email ? ` por ${draftRow.updated_by_email}` : '') : null,
      pubRow && pubRow.published_at ? h('span', null, ' · Publicado ', h('strong', { text: fmtRel(pubRow.published_at) })) : null);
    if (spec.special === 'theme') drawContrast();
    if (key === 'seo') drawSerp();
  }

  const livePreview = debounce(() => preview && preview.update(), 350);
  function onChange() { refresh(); livePreview(); }

  function build() {
    clear(formCard);
    if (spec.special === 'layout') { form = layoutEditor(clone(saved), onChange); formCard.append(form.el); return; }
    form = createForm(spec.fields, saved, { onChange, pickImage: cur => pickMedia(cur, folderFor(key)) });
    formCard.append(form.el);
  }

  // Validación extra según la sección.
  function extraErrors(state) {
    if (spec.special === 'theme') {
      const bad = themeChecks(state).filter(c => c.ratio < c.min);
      if (bad.length) return bad.map(c => `${c.label}: contraste ${c.ratio.toFixed(1)}:1 (mínimo ${c.min}:1).`);
    }
    if (key === 'hero' && state.highlight && state.title && !state.title.includes(state.highlight)) {
      return ['La palabra resaltada debe aparecer tal cual dentro del título principal.'];
    }
    return [];
  }

  async function save({ quiet } = {}) {
    const errs = form.validate ? form.validate() : [];
    const extra = extraErrors(form.state);
    if (errs.length || extra.length) {
      toast(extra[0] || (!errs[0].key && errs[0].msg) || `Revisa ${errs.length === 1 ? 'el campo marcado' : `los ${errs.length} campos marcados`} antes de guardar.`, 'err');
      return false;
    }
    try {
      await busy(btnSave, async () => {
        const r = await api.saveDraft(key, form.state, version);
        version = r.version;
        saved = clone(form.state);
        draftRow = { ...(draftRow || {}), version: r.version, updated_at: r.updated_at, updated_by_email: r.updated_by_email };
      });
      invalidatePreview();
      refresh(); ctx.refreshBadge();
      if (!quiet) toast('Borrador guardado. Todavía no es visible en la página: usa “Publicar”.');
      return true;
    } catch (e) {
      if (e.code === '40001') {
        modal({
          title: 'Alguien más editó esta sección',
          body: h('p', { text: e.message + ' Si recargas, perderás los cambios que no guardaste.' }),
          actions: [{ label: 'Seguir editando' }, { label: 'Recargar', kind: 'btn--primary', onClick: () => { ctx.reload(true); } }]
        });
      } else toast(e.message, 'err');
      return false;
    }
  }

  async function publish() {
    if (dirty() && !(await save({ quiet: true }))) return;
    const ok = await confirmDialog({
      title: `Publicar “${spec.label}”`,
      message: 'Los visitantes verán estos cambios en la página en cuanto la recarguen.',
      confirmLabel: 'Publicar ahora'
    });
    if (!ok) return;
    try {
      await busy(btnPublish, () => api.publish([key]));
      published = clone(saved);
      pubRow = { published_at: new Date().toISOString() };
      refresh(); ctx.refreshBadge();
      toast('¡Publicado! Ya está en la página.');
    } catch (e) { toast(e.message, 'err'); }
  }

  async function revertUnsaved() {
    if (!await confirmDialog({ title: 'Deshacer cambios', message: 'Se perderán los cambios que no guardaste.', confirmLabel: 'Deshacer', danger: true })) return;
    build(); refresh(); livePreview();
  }

  async function discardDraft() {
    if (!await confirmDialog({ title: 'Volver a lo publicado', message: 'El borrador se reemplazará por la versión que está publicada en la página.', confirmLabel: 'Descartar borrador', danger: true })) return;
    try {
      await api.discard([key]);
      invalidatePreview(); ctx.refreshBadge(); toast('Borrador descartado.');
      ctx.reload(true);
    } catch (e) { toast(e.message, 'err'); }
  }

  function togglePreview() {
    if (preview) { closePreview(); return; }
    preview = previewPanel(() => ({ [key]: current() }), spec.section);
    preview.el.addEventListener('close', closePreview);
    editor.classList.add('with-preview');
    editor.append(preview.el);
    btnPreview.classList.add('btn--dark');
  }
  function closePreview() {
    if (!preview) return;
    preview.destroy(); preview.el.remove(); preview = null;
    editor.classList.remove('with-preview'); btnPreview.classList.remove('btn--dark');
  }

  /* --- complementos por sección --- */
  const contrastBox = h('div', { class: 'contrast' });
  function drawContrast() {
    clear(contrastBox).append(...themeChecks(current()).map(c => h('div', { class: 'contrast__row' },
      h('span', { class: 'contrast__chip', text: 'Aa', title: c.label }),
      h('span', { class: 'badge ' + (c.ratio >= c.min ? 'badge--ok' : 'badge--err'), text: c.ratio.toFixed(1) + ':1' }),
      h('span', { text: c.label }))));
    contrastBox.querySelectorAll('.contrast__chip').forEach((chip, i) => {
      const c = themeChecks(current())[i]; chip.style.color = c.fg; chip.style.background = c.bg;
    });
  }
  const serp = h('div', { class: 'serp' });
  function drawSerp() {
    const s = current();
    clear(serp).append(
      h('div', { class: 'serp__url', text: 'voltstoreco.com' }),
      h('div', { class: 'serp__title', text: s.title || 'VoltStoreCO – (título configurado en WordPress)' }),
      h('div', { class: 'serp__desc', text: s.description || 'Sin descripción: Google elegirá un fragmento de la página.' }));
  }

  if (spec.special === 'theme') {
    extraBox.append(h('div', { class: 'card' },
      h('div', { class: 'card__head' }, h('h2', { text: 'Legibilidad' }),
        h('button', {
          class: 'btn btn--sm', onclick: () => {
            const next = { ...form.state, ...THEME_DEFAULT };
            clear(formCard); form = createForm(spec.fields, next, { onChange }); formCard.append(form.el);
            refresh(); livePreview();
            toast('Se cargaron los colores y estilos originales de VOLT. Guarda para aplicarlos.', 'warn');
          }
        }, icon('undo'), 'Usar diseño original')),
      h('p', { class: 'small muted', text: 'Para que la página siga siendo fácil de leer, no se puede guardar una combinación con poco contraste.' }),
      contrastBox));
  }
  if (key === 'seo') {
    extraBox.append(h('div', { class: 'card' }, h('div', { class: 'card__head' }, h('h2', { text: 'Así se vería en Google' })), serp,
      h('p', { class: 'small muted', text: 'La página en vivo está dentro de WordPress: si dejas el título vacío se conserva el de WordPress. Las redes sociales (WhatsApp, Facebook) leen los datos que configura WordPress; estos campos los aplica la página al cargar y los usa Google.' })));
  }
  if (key === 'catalogo') extraBox.append(notice('info', 'Aquí cambias los textos de la sección. Los productos, precios y categorías se editan en Catálogo → Productos.'));
  if (key === 'general') extraBox.append(notice('info', 'Estos datos se usan en toda la página: botones de WhatsApp, pie de página, contacto y redes sociales.'));

  build();
  clear(page).append(
    h('div', { class: 'pagehead' },
      h('div', null, h('h1', { text: spec.label }), spec.help ? h('p', { text: spec.help }) : null),
      h('div', { class: 'row' }, badges, btnPreview,
        h('button', { class: 'btn', title: 'Abrir la vista previa completa en otra pestaña', onclick: () => openPreviewTab({ [key]: current() }, spec.section) }, icon('external'), h('span', { class: 'hide-sm', text: 'Pestaña nueva' })),
        h('a', { class: 'btn', href: '#/historial?k=' + key }, icon('clock'), h('span', { class: 'hide-sm', text: 'Versiones' })))),
    editor,
    h('div', { class: 'actionbar' }, statusEl, btnRevert, btnDiscard, btnSave, btnPublish));
  refresh();
  ctx.setDirty(dirty);
}

function folderFor(key) {
  return { hero: 'portada', productos: 'productos', galeria: 'galeria', header: 'marca', seo: 'marca', iphone: 'productos' }[key] || 'general';
}

/* ---------- orden y visibilidad de secciones ---------- */
function normalizeLayout(data) {
  const list = (data && data.sections) || [];
  const seen = new Set();
  const out = list.filter(s => SECTION_IDS.includes(s.id) && !seen.has(s.id) && seen.add(s.id)).map(s => ({ id: s.id, visible: s.visible !== false }));
  SECTION_IDS.forEach(id => { if (!seen.has(id)) out.push({ id, visible: true }); });
  return { sections: out };
}
const EDIT_KEY = { hero: 'hero', marquee: 'marquee', productos: 'productos', catalogo: 'catalogo', iphone: 'iphone', servicio: 'servicio', beneficios: 'beneficios', galeria: 'galeria', cta: 'cta', contacto: 'contacto' };

function layoutEditor(state, onChange) {
  const listEl = h('div', { class: 'sorter' });
  let dragFrom = null;
  const arr = state.sections;
  function move(i, j) { if (j < 0 || j >= arr.length) return; const [m] = arr.splice(i, 1); arr.splice(j, 0, m); draw(); onChange(); }
  function draw() {
    clear(listEl);
    arr.forEach((s, i) => {
      const cb = h('input', { type: 'checkbox', checked: s.visible, id: 'vis-' + s.id });
      cb.addEventListener('change', () => { s.visible = cb.checked; row.classList.toggle('is-hidden-sec', !s.visible); onChange(); });
      const handle = h('span', { class: 'item__handle', title: 'Arrastra para reordenar' }, icon('drag'));
      const row = h('div', { class: 'sorter__row' + (s.visible ? '' : ' is-hidden-sec') },
        handle, h('span', { class: 'badge', text: String(i + 1) }), h('span', { class: 'sorter__name', text: SECTION_NAMES[s.id] }),
        h('label', { class: 'switch', for: 'vis-' + s.id }, cb, h('span', { class: 'switch__track' }), h('span', { class: 'hide-sm', text: 'Visible' })),
        h('button', { class: 'btn btn--ghost btn--icon btn--sm', 'aria-label': 'Subir', disabled: i === 0, onclick: () => move(i, i - 1) }, icon('up')),
        h('button', { class: 'btn btn--ghost btn--icon btn--sm', 'aria-label': 'Bajar', disabled: i === arr.length - 1, onclick: () => move(i, i + 1) }, icon('down')),
        h('a', { class: 'btn btn--sm', href: '#/contenido/' + EDIT_KEY[s.id] }, icon('edit'), h('span', { class: 'hide-sm', text: 'Editar' })));
      handle.addEventListener('mousedown', () => { row.draggable = true; });
      row.addEventListener('dragstart', () => { dragFrom = i; row.classList.add('is-dragging'); });
      row.addEventListener('dragend', () => { row.draggable = false; row.classList.remove('is-dragging'); });
      row.addEventListener('dragover', e => { if (dragFrom !== null) { e.preventDefault(); row.classList.add('is-over'); } });
      row.addEventListener('dragleave', () => row.classList.remove('is-over'));
      row.addEventListener('drop', e => { e.preventDefault(); row.classList.remove('is-over'); if (dragFrom !== null && dragFrom !== i) move(dragFrom, i); dragFrom = null; });
      listEl.append(row);
    });
  }
  draw();
  return {
    el: h('div', null, h('p', { class: 'muted small', text: 'Arrastra (o usa las flechas) para cambiar el orden. Las secciones ocultas desaparecen de la página y de los menús.' }), listEl),
    state, validate: () => (arr.every(s => !s.visible) ? [{ msg: 'Debe quedar al menos una sección visible.' }] : [])
  };
}

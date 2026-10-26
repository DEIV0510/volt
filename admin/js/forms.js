/* Formularios generados desde el modelo (schema.js), con validación en el
   navegador idéntica a la del servidor (que vuelve a validar al guardar). */
import { h, icon, clear, imgUrl, clone } from './ui.js';
import { LINK_PATTERN, IMAGE_PATTERN, COLOR_PATTERN } from './schema.js';

const RE = { link: new RegExp(LINK_PATTERN), image: new RegExp(IMAGE_PATTERN), color: new RegExp(COLOR_PATTERN) };
const ANCHORS = [['#inicio', 'Portada'], ['#productos', 'Productos'], ['#catalogo', 'Catálogo'], ['#iphone', 'iPhone'],
  ['#servicio', 'Servicio técnico'], ['#beneficios', 'Beneficios'], ['#galeria', 'Comunidad'], ['#cta', 'Llamado a la acción'], ['#contacto', 'Contacto']];
const EMOJIS = ['📱', '🔋', '🔌', '💻', '🛠️', '🔍', '⭐', '🤝', '✨', '📲', '📍', '💬', '🏪', '🎧', '⌚', '🛡️', '🧰', '⚡'];
let uid = 0;

function anchorsList() {
  let dl = document.getElementById('volt-anchors');
  if (!dl) {
    dl = h('datalist', { id: 'volt-anchors' }, ANCHORS.map(([v, l]) => h('option', { value: v, label: l })));
    document.body.append(dl);
  }
  return 'volt-anchors';
}

export function defaultFor(f) {
  switch (f.t) {
    case 'bool': return f.def ?? false;
    case 'list': case 'strings': return [];
    case 'button': return { label: '', kind: 'whatsapp', message: '', href: '' };
    case 'select': return f.options[0][0];
    case 'color': return '#000000';
    default: return '';
  }
}
export function newItem(fields) { const o = {}; fields.forEach(f => { o[f.k] = defaultFor(f); }); return o; }

export function createForm(fields, initial, opts = {}) {
  const state = clone(initial) || {};
  const reg = new Map();                       // ruta → { wrap, err }
  const expanded = new WeakMap();              // estado abierto/cerrado de cada elemento de lista
  const changed = () => opts.onChange && opts.onChange(state);
  const root = h('div', { class: 'form' });
  fields.forEach(f => root.append(field(f, state, [f.k])));

  function wrapField(f, path, control, extra) {
    const err = h('div', { class: 'field__error', hidden: true });
    const wrap = h('div', { class: 'field' + (f.t === 'bool' ? ' field--bool' : '') },
      f.t === 'bool' ? null : h('label', { class: 'field__label', for: control.id || null },
        h('span', null, f.label, f.required ? h('span', { class: 'req', text: ' *' }) : null), extra || null),
      control, f.help ? h('div', { class: 'field__help', text: f.help }) : null, err);
    reg.set(path.join('.'), { wrap, err });
    return wrap;
  }

  function field(f, obj, path) {
    if (obj[f.k] === undefined) obj[f.k] = defaultFor(f);
    const id = 'f' + (++uid);
    const set = v => { obj[f.k] = v; changed(); };
    switch (f.t) {
      case 'text': case 'textarea': case 'link': case 'icon': {
        const isArea = f.t === 'textarea';
        const max = f.max || (f.t === 'link' ? 500 : f.t === 'icon' ? 16 : 1000);
        const input = h(isArea ? 'textarea' : 'input', {
          id, class: isArea ? 'textarea' : 'input', maxlength: max, value: obj[f.k] ?? '',
          type: isArea ? null : 'text', list: f.t === 'link' ? anchorsList() : null,
          placeholder: f.t === 'link' ? '#productos o https://…' : null, autocomplete: 'off', spellcheck: f.t === 'link' ? 'false' : null
        });
        if (isArea) input.rows = Math.min(6, Math.max(2, Math.ceil(max / 120)));
        const count = f.t === 'link' ? null : h('span', { class: 'field__count' });
        const upd = () => { if (count) count.textContent = `${input.value.length}/${max}`; };
        input.addEventListener('input', () => { upd(); set(input.value); });
        upd();
        let extraRow = null;
        if (f.t === 'icon') {
          extraRow = h('div', { class: 'row' }, EMOJIS.map(e => h('button', {
            type: 'button', class: 'btn btn--sm btn--ghost', text: e, 'aria-label': 'Usar ' + e,
            onclick: () => { input.value = e; upd(); set(e); }
          })));
        }
        const w = wrapField(f, path, input, count);
        if (extraRow) w.insertBefore(extraRow, w.querySelector('.field__help, .field__error'));
        return w;
      }
      case 'color': {
        const pick = h('input', { type: 'color', value: RE.color.test(obj[f.k]) ? obj[f.k] : '#000000', 'aria-label': f.label });
        const text = h('input', { id, class: 'input', value: obj[f.k] || '', maxlength: 7, autocomplete: 'off', spellcheck: 'false' });
        pick.addEventListener('input', () => { text.value = pick.value.toUpperCase(); set(text.value); });
        text.addEventListener('input', () => { const v = text.value.trim(); if (RE.color.test(v)) pick.value = v; set(v.toUpperCase()); });
        return wrapField(f, path, h('div', { class: 'color' }, pick, text));
      }
      case 'select': {
        const sel = h('select', { id, class: 'select' }, f.options.map(([v, l]) => h('option', { value: v, text: l, selected: obj[f.k] === v })));
        sel.addEventListener('change', () => set(sel.value));
        return wrapField(f, path, sel);
      }
      case 'bool': {
        const cb = h('input', { type: 'checkbox', id, checked: !!obj[f.k] });
        cb.addEventListener('change', () => set(cb.checked));
        return wrapField(f, path, h('label', { class: 'switch', for: id }, cb, h('span', { class: 'switch__track' }), h('span', { text: f.label })));
      }
      case 'image': {
        const thumb = h('div', { class: 'thumb' });
        const name = h('div', { class: 'imgfield__name' });
        const draw = () => {
          clear(thumb); const v = obj[f.k];
          if (v) thumb.append(h('img', { src: imgUrl(v), alt: '' })); else thumb.append('Sin imagen');
          name.textContent = v ? decodeURIComponent(v.split('/').pop()) : '';
          removeBtn.hidden = !v || f.required;
        };
        const removeBtn = h('button', { type: 'button', class: 'btn btn--sm btn--ghost', onclick: () => { set(''); draw(); } }, icon('x'), 'Quitar');
        const pickBtn = h('button', {
          type: 'button', class: 'btn btn--sm', id, onclick: async () => {
            if (!opts.pickImage) return;
            const url = await opts.pickImage(obj[f.k]);
            if (url) { set(url); draw(); }
          }
        }, icon('image'), 'Elegir o subir imagen');
        draw();
        return wrapField(f, path, h('div', { class: 'imgfield' }, thumb, h('div', { class: 'imgfield__meta' }, name, h('div', { class: 'row' }, pickBtn, removeBtn))));
      }
      case 'number': {
        const input = h('input', { id, class: 'input', type: 'number', min: f.min ?? 0, max: f.maxValue ?? 100000000, step: 1, inputmode: 'numeric', value: obj[f.k] ?? '' });
        const hint = f.money ? h('span', { class: 'field__count' }) : null;
        const upd = () => { if (hint) hint.textContent = input.value === '' ? '' : '$' + Number(input.value).toLocaleString('es-CO'); };
        input.addEventListener('input', () => { upd(); set(input.value === '' ? null : Number(input.value)); });
        upd();
        return wrapField(f, path, input, hint);
      }
      case 'images': {
        const arr = obj[f.k] = Array.isArray(obj[f.k]) ? obj[f.k] : [];
        const box = h('div', { class: 'imgfield' });
        const draw = () => {
          clear(box);
          arr.forEach((u, i) => box.append(h('div', { class: 'thumb', title: decodeURIComponent(u.split('/').pop()) },
            h('img', { src: imgUrl(u), alt: '' }))));
          arr.forEach((u, i) => {
            const t = box.children[i];
            t.append(h('button', { type: 'button', class: 'btn btn--sm btn--ghost', 'aria-label': 'Quitar imagen', onclick: () => { arr.splice(i, 1); changed(); draw(); } }, icon('x')));
          });
          if (arr.length < (f.max || 8)) box.append(h('button', {
            type: 'button', class: 'btn btn--sm', onclick: async () => {
              const url = opts.pickImage && await opts.pickImage('');
              if (url && !arr.includes(url)) { arr.push(url); changed(); draw(); }
            }
          }, icon('plus'), 'Agregar imagen'));
        };
        draw();
        return wrapField(f, path, box);
      }
      case 'button': return buttonField(f, obj, path);
      case 'strings': return stringsField(f, obj, path);
      case 'list': return listField(f, obj, path);
    }
    return h('div', { text: 'Campo no soportado: ' + f.t });
  }

  function buttonField(f, obj, path) {
    const b = obj[f.k] = Object.assign({ label: '', kind: 'whatsapp', message: '', href: '' }, obj[f.k] || {});
    const sub = [
      { k: 'label', t: 'text', label: 'Texto del botón', max: 60, help: 'Vacío = el botón no se muestra.' },
      { k: 'kind', t: 'select', label: 'Al hacer clic', options: [['whatsapp', 'Abrir WhatsApp'], ['link', 'Ir a un enlace o sección']] },
      { k: 'message', t: 'textarea', label: 'Mensaje de WhatsApp', max: 400, help: 'Vacío = se usa el mensaje predeterminado del negocio.' },
      { k: 'href', t: 'link', label: 'Enlace' }
    ];
    const els = sub.map(sf => field(sf, b, path.concat(sf.k)));
    const sync = () => { els[2].hidden = b.kind !== 'whatsapp'; els[3].hidden = b.kind !== 'link'; };
    els[1].querySelector('select').addEventListener('change', sync);
    sync();
    const box = h('div', { class: 'fieldset' }, h('span', { class: 'fieldset__legend', text: f.label }), els);
    reg.set(path.join('.'), { wrap: box, err: h('div') });
    return box;
  }

  function moveBtns(arr, i, rerender) {
    const mv = d => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; changed(); rerender(); };
    return [
      h('button', { type: 'button', class: 'btn btn--ghost btn--icon btn--sm', 'aria-label': 'Subir', disabled: i === 0, onclick: e => { e.stopPropagation(); mv(-1); } }, icon('up')),
      h('button', { type: 'button', class: 'btn btn--ghost btn--icon btn--sm', 'aria-label': 'Bajar', disabled: i === arr.length - 1, onclick: e => { e.stopPropagation(); mv(1); } }, icon('down'))
    ];
  }

  function stringsField(f, obj, path) {
    const arr = obj[f.k] = Array.isArray(obj[f.k]) ? obj[f.k] : [];
    const list = h('div', { class: 'list strings' });
    const add = h('button', { type: 'button', class: 'btn btn--sm', onclick: () => { arr.push(''); changed(); draw(); list.querySelector('.row:last-child input').focus(); } }, icon('plus'), 'Agregar');
    function draw() {
      clear(list);
      arr.forEach((s, i) => {
        const input = h('input', { class: 'input', value: s, maxlength: f.itemMax || 100, 'aria-label': `${f.label} ${i + 1}` });
        input.addEventListener('input', () => { arr[i] = input.value; changed(); });
        const err = h('div', { class: 'field__error', hidden: true });
        const row = h('div', { class: 'row' }, input, moveBtns(arr, i, draw),
          h('button', { type: 'button', class: 'btn btn--ghost btn--icon btn--sm', 'aria-label': 'Eliminar', onclick: () => { arr.splice(i, 1); changed(); draw(); } }, icon('trash')));
        list.append(h('div', null, row, err));
        reg.set(path.concat(i).join('.'), { wrap: row.parentElement, err });
      });
      add.disabled = f.max && arr.length >= f.max;
    }
    draw();
    return wrapField(f, path, h('div', null, list, h('div', { class: 'row' }, add, f.max ? h('span', { class: 'small muted', text: `Máximo ${f.max}` }) : null)));
  }

  function listField(f, obj, path) {
    const arr = obj[f.k] = Array.isArray(obj[f.k]) ? obj[f.k] : [];
    const list = h('div', { class: 'list' });
    const add = h('button', {
      type: 'button', class: 'btn btn--sm', onclick: () => {
        const it = newItem(f.fields); arr.push(it); expanded.set(it, true); changed(); draw();
      }
    }, icon('plus'), 'Agregar');
    let dragFrom = null;
    function draw() {
      clear(list);
      arr.forEach((it, i) => {
        if (!expanded.has(it)) expanded.set(it, arr.length <= 3);
        const titleEl = h('span', { class: 'item__title' });
        const setTitle = () => { titleEl.textContent = (f.itemLabel && it[f.itemLabel]) || `${f.label} ${i + 1}`; };
        setTitle();
        const body = h('div', { class: 'item__body' }, f.fields.map(sf => field(sf, it, path.concat(i, sf.k))));
        body.addEventListener('input', setTitle);
        const handle = h('span', { class: 'item__handle', title: 'Arrastra para reordenar' }, icon('drag'));
        const item = h('div', { class: 'item' + (expanded.get(it) ? '' : ' is-collapsed') },
          h('div', { class: 'item__head', onclick: () => { expanded.set(it, !expanded.get(it)); item.classList.toggle('is-collapsed'); } },
            handle, h('span', { class: 'item__chev' }, icon('chev')), titleEl, moveBtns(arr, i, draw),
            h('button', {
              type: 'button', class: 'btn btn--ghost btn--icon btn--sm', 'aria-label': 'Eliminar', onclick: e => {
                e.stopPropagation(); arr.splice(i, 1); changed(); draw();
              }
            }, icon('trash'))),
          body);
        // Arrastrar y soltar (escritorio); en celular se usan las flechas.
        handle.addEventListener('mousedown', () => { item.draggable = true; });
        item.addEventListener('dragstart', e => { dragFrom = i; item.classList.add('is-dragging'); e.dataTransfer.effectAllowed = 'move'; });
        item.addEventListener('dragend', () => { item.draggable = false; item.classList.remove('is-dragging'); });
        item.addEventListener('dragover', e => { if (dragFrom === null) return; e.preventDefault(); item.classList.add('is-over'); });
        item.addEventListener('dragleave', () => item.classList.remove('is-over'));
        item.addEventListener('drop', e => {
          e.preventDefault(); item.classList.remove('is-over');
          if (dragFrom === null || dragFrom === i) return;
          const [m] = arr.splice(dragFrom, 1); arr.splice(i, 0, m); dragFrom = null; changed(); draw();
        });
        list.append(item);
      });
      add.disabled = f.max && arr.length >= f.max;
    }
    draw();
    return wrapField(f, path, h('div', null, list, h('div', { class: 'row' }, add, f.max ? h('span', { class: 'small muted', text: `Máximo ${f.max}` }) : null)));
  }

  /* ---------- validación ---------- */
  function check(f, v, path, errs) {
    const key = path.join('.');
    const add = (msg, k = key) => errs.push({ key: k, msg, label: f.label });
    if (f.t === 'list') {
      (v || []).forEach((it, i) => f.fields.forEach(sf => check(sf, it[sf.k], path.concat(i, sf.k), errs)));
      if (f.max && (v || []).length > f.max) add(`Máximo ${f.max} elementos.`);
      return;
    }
    if (f.t === 'strings') {
      (v || []).forEach((s, i) => { if (f.itemMax && String(s).length > f.itemMax) add(`Máximo ${f.itemMax} caracteres.`, path.concat(i).join('.')); });
      return;
    }
    if (f.t === 'button') {
      if (!v) return;
      if ((v.label || '').length > 60) add('Máximo 60 caracteres.', key + '.label');
      if (v.label && v.kind === 'link' && !RE.link.test(v.href || '')) add('Escribe un enlace válido: #seccion o https://…', key + '.href');
      return;
    }
    if (f.t === 'bool' || f.t === 'select' || f.t === 'images') return;
    if (f.t === 'number') {
      if (v == null || v === '') return f.required ? add('Este campo es obligatorio.') : undefined;
      if (!Number.isInteger(v) || v < (f.min ?? 0)) return add('Escribe un número entero sin puntos ni signos.');
      if (v > (f.maxValue ?? 100000000)) return add('El número es demasiado grande.');
      return;
    }
    const s = v == null ? '' : String(v);
    if (f.required && !s.trim()) return add('Este campo es obligatorio.');
    if (f.max && s.length > f.max) return add(`Máximo ${f.max} caracteres.`);
    if (!s) return;
    if (f.t === 'link' && !RE.link.test(s)) return add('Enlace no válido. Usa #seccion, https://…, mailto: o tel:.');
    if (f.t === 'image' && !RE.image.test(s)) return add('Imagen no válida.');
    if (f.t === 'color' && !RE.color.test(s)) return add('Color no válido. Usa el formato #RRGGBB.');
    if (f.pattern && !new RegExp(f.pattern).test(s)) return add(f.patternMsg || 'Formato no válido.');
  }
  function validate() {
    for (const { wrap, err } of reg.values()) { wrap.classList.remove('has-error'); err.hidden = true; err.textContent = ''; }
    const errs = [];
    fields.forEach(f => check(f, state[f.k], [f.k], errs));
    let first = null;
    for (const e of errs) {
      const r = reg.get(e.key);
      if (!r) continue;
      r.wrap.classList.add('has-error'); r.err.textContent = e.msg; r.err.hidden = false;
      // Abre la lista que contiene el error.
      const item = r.wrap.closest('.item'); if (item) item.classList.remove('is-collapsed');
      if (!first) first = r.wrap;
    }
    if (first) { first.scrollIntoView({ behavior: 'smooth', block: 'center' }); const i = first.querySelector('input,textarea,select'); if (i) setTimeout(() => i.focus(), 300); }
    return errs;
  }

  return { el: root, state, validate };
}

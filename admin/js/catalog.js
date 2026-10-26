/* Catálogo: productos y categorías. Los cambios de productos se ven en la
   página al guardar (como antes con la hoja); "Visible" permite preparar sin mostrar. */
import { api } from './api.js';
import { h, icon, clear, toast, modal, confirmDialog, money, fmtRel, loadingBox, notice, busy, deepEqual, clone, imgUrl } from './ui.js';
import { createForm } from './forms.js';
import { pickMedia } from './media.js';

const PAGE = 25;
let state = { search: '', cat: '', status: '', page: 0 };   // filtros recordados mientras dure la sesión

function priceText(p) {
  if (p.price == null) return 'Consultar';
  const base = money(p.price) + (p.price_max ? '–' + money(p.price_max) : '');
  return p.promo_price != null && p.promo_price < p.price ? `${money(p.promo_price)} (antes ${base})` : base;
}
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/* ===================== Lista de productos ===================== */
export async function productsView(ctx) {
  ctx.setTitle('Productos');
  const root = h('div'); ctx.mount(root); root.append(loadingBox());
  let products, cats;
  try { [products, cats] = await Promise.all([api.products(), api.categories()]); }
  catch (e) { clear(root).append(notice('err', e.message)); return; }
  const catById = Object.fromEntries(cats.map(c => [c.id, c]));
  const selected = new Set();

  const search = h('input', { class: 'input grow', type: 'search', placeholder: 'Buscar por nombre, marca o descripción', value: state.search, 'aria-label': 'Buscar productos' });
  const catSel = h('select', { class: 'select', 'aria-label': 'Categoría' }, h('option', { value: '', text: 'Todas las categorías' }),
    cats.map(c => h('option', { value: c.id, text: `${c.icon} ${c.name}`, selected: state.cat === c.id })));
  const statusSel = h('select', { class: 'select', 'aria-label': 'Estado' }, [['', 'Todos'], ['on', 'Visibles'], ['off', 'Ocultos'], ['feat', 'Destacados'], ['out', 'Agotados'], ['noprice', 'Sin precio']]
    .map(([v, l]) => h('option', { value: v, text: l, selected: state.status === v })));
  const bulk = h('div', { class: 'bulkbar', hidden: true });
  const tbody = h('tbody');
  const pager = h('div', { class: 'pager' });
  const summary = h('span', { class: 'muted small' });

  function filtered() {
    const s = norm(search.value.trim());
    return products.filter(p =>
      (!catSel.value || p.category_id === catSel.value) &&
      (!statusSel.value || (statusSel.value === 'on' && p.active) || (statusSel.value === 'off' && !p.active) ||
        (statusSel.value === 'feat' && p.featured) || (statusSel.value === 'out' && p.stock === 0) || (statusSel.value === 'noprice' && p.price == null)) &&
      (!s || norm(`${p.name} ${p.brand} ${p.detail}`).includes(s)))
      .sort((a, b) => ((catById[a.category_id] || {}).sort_order - (catById[b.category_id] || {}).sort_order) || a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }
  const canReorder = () => catSel.value && !search.value.trim() && !statusSel.value;

  async function patch(ids, fields, msg) {
    try {
      const rows = await api.updateProducts(ids, fields);
      rows.forEach(r => Object.assign(products.find(p => p.id === r.id), r, fields));
      if (msg) toast(msg);
    } catch (e) { toast(e.message, 'err'); }
    draw();
  }

  async function moveRow(p, d) {
    const list = products.filter(x => x.category_id === p.category_id).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    const i = list.indexOf(p), j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    try {
      await api.reorderProducts(list.map(x => x.id));
      list.forEach((x, k) => { x.sort_order = (k + 1) * 10; });
      draw();
    } catch (e) { toast(e.message, 'err'); }
  }

  function row(p) {
    const c = catById[p.category_id] || {};
    const cb = h('input', { type: 'checkbox', checked: selected.has(p.id), 'aria-label': 'Seleccionar ' + p.name });
    cb.addEventListener('change', () => { cb.checked ? selected.add(p.id) : selected.delete(p.id); drawBulk(); tr.classList.toggle('is-selected', cb.checked); });
    const vis = h('input', { type: 'checkbox', checked: p.active, 'aria-label': 'Visible' });
    vis.addEventListener('change', () => patch([p.id], { active: vis.checked }, vis.checked ? 'Producto visible en la página.' : 'Producto oculto.'));
    const stock = h('input', { class: 'input input--sm stock-input', type: 'number', min: 0, step: 1, value: p.stock ?? '', placeholder: '—', 'aria-label': 'Stock de ' + p.name });
    stock.addEventListener('change', () => {
      const v = stock.value === '' ? null : Number(stock.value);
      if (v !== null && (!Number.isInteger(v) || v < 0)) { toast('El stock debe ser un número entero (0 o más).', 'err'); stock.value = p.stock ?? ''; return; }
      patch([p.id], { stock: v }, 'Stock actualizado.');
    });
    const tr = h('tr', { class: (p.active ? '' : 'is-off') + (selected.has(p.id) ? ' is-selected' : '') },
      h('td', null, cb),
      h('td', null, h('div', { class: 'pthumb' }, p.image_url ? h('img', { src: imgUrl(p.image_url), alt: '' }) : c.icon || '🛒')),
      h('td', null, h('a', { href: '#/productos/' + p.id, class: 'cell-main', text: p.name }),
        h('div', { class: 'cell-sub', text: [p.brand, p.detail].filter(Boolean).join(' · ') })),
      h('td', { class: 'hide-sm' }, c.name || '—'),
      h('td', null, priceText(p)),
      h('td', null, stock),
      h('td', null, h('label', { class: 'switch' }, vis, h('span', { class: 'switch__track' }))),
      h('td', { class: 'hide-sm' }, h('button', {
        class: 'star' + (p.featured ? ' is-on' : ''), 'aria-label': p.featured ? 'Quitar de destacados' : 'Destacar', 'aria-pressed': String(p.featured), text: '★',
        onclick: () => patch([p.id], { featured: !p.featured }, p.featured ? 'Ya no está destacado.' : 'Producto destacado: aparece primero.')
      })),
      h('td', null, h('div', { class: 'row' },
        canReorder() ? [h('button', { class: 'btn btn--ghost btn--icon btn--sm', 'aria-label': 'Subir', onclick: () => moveRow(p, -1) }, icon('up')),
          h('button', { class: 'btn btn--ghost btn--icon btn--sm', 'aria-label': 'Bajar', onclick: () => moveRow(p, 1) }, icon('down'))] : null,
        h('a', { class: 'btn btn--sm', href: '#/productos/' + p.id, 'aria-label': 'Editar ' + p.name }, icon('edit')),
        h('button', { class: 'btn btn--sm btn--danger', 'aria-label': 'Eliminar ' + p.name, onclick: () => remove([p.id]) }, icon('trash')))));
    return tr;
  }

  async function remove(ids) {
    const names = products.filter(p => ids.includes(p.id)).map(p => p.name);
    if (!await confirmDialog({
      title: ids.length === 1 ? 'Eliminar producto' : `Eliminar ${ids.length} productos`,
      message: (ids.length === 1 ? `“${names[0]}”` : `${names.slice(0, 5).join(', ')}${names.length > 5 ? '…' : ''}`) +
        ' se eliminará de forma permanente. Si solo quieres que no se vea, usa “Ocultar”. (Queda registrado en el historial.)',
      confirmLabel: 'Eliminar', danger: true, typed: ids.length > 5 ? 'ELIMINAR' : ''
    })) return;
    try {
      await api.deleteProducts(ids);
      products = products.filter(p => !ids.includes(p.id));
      ids.forEach(id => selected.delete(id));
      toast(ids.length === 1 ? 'Producto eliminado.' : `${ids.length} productos eliminados.`);
      draw();
    } catch (e) { toast(e.message, 'err'); }
  }

  function drawBulk() {
    bulk.hidden = !selected.size;
    if (!selected.size) return;
    const ids = [...selected];
    const moveSel = h('select', { class: 'select input--sm', 'aria-label': 'Mover a categoría' }, h('option', { value: '', text: 'Mover a categoría…' }), cats.map(c => h('option', { value: c.id, text: c.name })));
    moveSel.addEventListener('change', () => { if (moveSel.value) patch(ids, { category_id: moveSel.value }, 'Productos movidos.'); });
    clear(bulk).append(h('strong', { text: `${selected.size} seleccionado(s)` }),
      h('button', { class: 'btn btn--sm', onclick: () => patch(ids, { active: true }, 'Productos visibles.') }, icon('eye'), 'Mostrar'),
      h('button', { class: 'btn btn--sm', onclick: () => patch(ids, { active: false }, 'Productos ocultos.') }, 'Ocultar'),
      moveSel,
      h('button', { class: 'btn btn--sm btn--danger', onclick: () => remove(ids) }, icon('trash'), 'Eliminar'),
      h('button', { class: 'btn btn--sm btn--ghost', onclick: () => { selected.clear(); draw(); } }, 'Quitar selección'));
  }

  function draw() {
    state = { search: search.value, cat: catSel.value, status: statusSel.value, page: state.page };
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE));
    if (state.page >= pages) state.page = pages - 1;
    const slice = list.slice(state.page * PAGE, state.page * PAGE + PAGE);
    clear(tbody).append(...(slice.length ? slice.map(row) : [h('tr', null, h('td', { colspan: 9 }, h('div', { class: 'empty', text: 'No hay productos con esos filtros.' })))]));
    summary.textContent = `${list.length} de ${products.length} productos · ${products.filter(p => p.active).length} visibles`;
    clear(pager).append(h('span', { text: `Página ${state.page + 1} de ${pages}` }), h('div', { class: 'row' },
      h('button', { class: 'btn btn--sm', disabled: state.page === 0, onclick: () => { state.page--; draw(); } }, icon('up'), 'Anterior'),
      h('button', { class: 'btn btn--sm', disabled: state.page >= pages - 1, onclick: () => { state.page++; draw(); } }, 'Siguiente', icon('down'))));
    drawBulk();
  }
  const reset = () => { state.page = 0; draw(); };
  search.addEventListener('input', reset); catSel.addEventListener('change', reset); statusSel.addEventListener('change', reset);
  const allCb = h('input', { type: 'checkbox', 'aria-label': 'Seleccionar los de esta página' });
  allCb.addEventListener('change', () => {
    filtered().slice(state.page * PAGE, state.page * PAGE + PAGE).forEach(p => allCb.checked ? selected.add(p.id) : selected.delete(p.id));
    draw();
  });

  clear(root).append(
    h('div', { class: 'pagehead' }, h('div', null, h('h1', { text: 'Productos' }),
      h('p', { text: 'Los cambios se ven en la página al guardar. Para preparar un producto sin mostrarlo, desactiva “Visible”.' })),
      h('div', { class: 'row' }, summary, h('a', { class: 'btn btn--primary', href: '#/productos/nuevo' }, icon('plus'), 'Nuevo producto'))),
    h('div', { class: 'toolbar' }, search, catSel, statusSel),
    h('p', { class: 'small muted', text: 'Para cambiar el orden, filtra por una categoría y usa las flechas.' }),
    bulk,
    h('div', { class: 'tablewrap' }, h('table', { class: 'ptable' }, h('thead', null, h('tr', null,
      h('th', null, allCb), h('th', null, ''), h('th', { text: 'Producto' }), h('th', { class: 'hide-sm', text: 'Categoría' }), h('th', { text: 'Precio' }),
      h('th', { text: 'Stock' }), h('th', { text: 'Visible' }), h('th', { class: 'hide-sm', text: 'Destacado' }), h('th', { text: 'Acciones' }))), tbody)),
    pager);
  draw();
}

/* ===================== Editor de producto ===================== */
export async function productEditView(ctx, id) {
  const isNew = id === 'nuevo';
  ctx.setTitle(isNew ? 'Nuevo producto' : 'Editar producto');
  const root = h('div'); ctx.mount(root); root.append(loadingBox());
  let cats, prod;
  try {
    cats = await api.categories();
    if (!isNew) {
      prod = (await api.products()).find(p => p.id === id);
      if (!prod) { clear(root).append(notice('err', 'Ese producto no existe (quizá alguien lo eliminó).'), h('a', { class: 'btn', href: '#/productos' }, 'Volver a productos')); return; }
    }
  } catch (e) { clear(root).append(notice('err', e.message)); return; }
  const dup = isNew && sessionStorage.getItem('volt-dup');
  sessionStorage.removeItem('volt-dup');
  const initial = prod ? clone(prod) : dup ? JSON.parse(dup) : {
    name: '', category_id: (cats[0] || {}).id, brand: null, detail: null, price: null, price_max: null, promo_price: null, stock: null,
    active: true, featured: false, image_url: null, image_alt: null, gallery: [], features: [], cta_label: null, cta_message: null, cta_url: null
  };
  const version = prod ? prod.version : null;
  const fields = [
    { k: 'name', t: 'text', label: 'Nombre', max: 120, required: true },
    { k: 'category_id', t: 'select', label: 'Categoría', options: cats.map(c => [c.id, `${c.icon} ${c.name}`]) },
    { k: 'brand', t: 'text', label: 'Marca o etiqueta superior', max: 60, help: 'Vacío = se muestra el nombre de la categoría (ej.: “Cargador”).' },
    { k: 'detail', t: 'textarea', label: 'Descripción corta', max: 300 },
    { k: 'price', t: 'number', label: 'Precio (COP)', money: true, help: 'Sin puntos. Vacío = se muestra “Consultar precio”.' },
    { k: 'price_max', t: 'number', label: 'Precio máximo (opcional)', money: true, help: 'Para rangos, como $10.000–$20.000.' },
    { k: 'promo_price', t: 'number', label: 'Precio promocional (opcional)', money: true, help: 'Se muestra el precio normal tachado.' },
    { k: 'stock', t: 'number', label: 'Cantidad disponible', help: 'Vacío = no se muestra. 0 = “Agotado”.' },
    { k: 'active', t: 'bool', label: 'Visible en la página' },
    { k: 'featured', t: 'bool', label: 'Destacado (aparece primero y con etiqueta)' },
    { k: 'image_url', t: 'image', label: 'Imagen principal', help: 'Opcional. Sin imagen se muestra el ícono de la categoría.' },
    { k: 'image_alt', t: 'text', label: 'Texto alternativo de la imagen', max: 160 },
    { k: 'gallery', t: 'images', label: 'Galería (hasta 8 imágenes)', max: 8, help: 'Se ven al tocar la imagen del producto.' },
    { k: 'features', t: 'strings', label: 'Características', max: 12, itemMax: 100 },
    { k: 'cta_label', t: 'text', label: 'Texto del botón', max: 30, help: 'Vacío = “Consultar”.' },
    { k: 'cta_message', t: 'textarea', label: 'Mensaje de WhatsApp', max: 300, help: 'Vacío = el mensaje general del catálogo con el nombre del producto.' },
    { k: 'cta_url', t: 'link', label: 'Enlace en vez de WhatsApp (opcional)' }
  ];
  let saved = clone(initial);
  const form = createForm(fields, initial, { onChange: refresh, pickImage: cur => pickMedia(cur, 'catalogo') });
  const status = h('div', { class: 'actionbar__status' });
  const btnSave = h('button', { class: 'btn btn--primary', onclick: save }, icon('save'), isNew ? 'Crear producto' : 'Guardar cambios');
  const dirty = () => !deepEqual(cleanRow(form.state), cleanRow(saved));
  function refresh() {
    btnSave.disabled = !dirty() && !isNew;
    clear(status).append(dirty() ? h('span', { class: 'badge badge--warn', text: 'Cambios sin guardar' }) :
      prod ? h('span', null, 'Última edición ', h('strong', { text: fmtRel(prod.updated_at) }), prod.updated_by_email ? ` por ${prod.updated_by_email}` : '') : null);
  }
  function cleanRow(s) {
    const o = {};
    for (const f of fields) {
      let v = s[f.k];
      if (typeof v === 'string') { v = v.trim(); if (v === '' && f.k !== 'name') v = null; }
      o[f.k] = v === undefined ? null : v;
    }
    o.features = (o.features || []).map(x => x.trim()).filter(Boolean);
    return o;
  }
  async function save() {
    const errs = form.validate();
    const r = cleanRow(form.state);
    const extra = [];
    if (r.price_max != null && (r.price == null || r.price_max < r.price)) extra.push('El precio máximo debe ser mayor o igual al precio.');
    if (r.promo_price != null && (r.price == null || r.promo_price >= r.price)) extra.push('El precio promocional debe ser menor que el precio normal.');
    if (errs.length || extra.length) { toast(extra[0] || 'Revisa los campos marcados.', 'err'); return; }
    try {
      const out = await busy(btnSave, () => api.saveProduct({ ...r, id: prod && prod.id }, version));
      saved = clone(form.state);
      ctx.setDirty(() => false);
      toast(isNew ? 'Producto creado. Ya está en el catálogo.' : 'Producto guardado. Los cambios ya se ven en la página.');
      location.hash = isNew ? '#/productos/' + out.id : '#/productos';
    } catch (e) { toast(e.message, 'err'); }
  }
  clear(root).append(
    h('div', { class: 'pagehead' }, h('div', null, h('h1', { text: isNew ? 'Nuevo producto' : prod.name }),
      h('p', { text: 'Los cambios de productos se aplican en la página al guardar.' })),
      h('div', { class: 'row' },
        !isNew ? h('button', {
          class: 'btn', onclick: () => {
            sessionStorage.setItem('volt-dup', JSON.stringify({ ...cleanRow(form.state), name: (form.state.name + ' (copia)').slice(0, 120), active: false }));
            location.hash = '#/productos/nuevo';
          }
        }, icon('copy'), 'Duplicar') : null,
        h('a', { class: 'btn', href: '#/productos' }, 'Volver'))),
    h('div', { class: 'card' }, form.el),
    h('div', { class: 'actionbar' }, status,
      !isNew ? h('button', {
        class: 'btn btn--danger', onclick: async () => {
          if (!await confirmDialog({ title: 'Eliminar producto', message: `“${prod.name}” se eliminará de forma permanente. Si solo quieres que no se vea, desactiva “Visible”.`, confirmLabel: 'Eliminar', danger: true })) return;
          try { await api.deleteProducts([prod.id]); ctx.setDirty(() => false); toast('Producto eliminado.'); location.hash = '#/productos'; }
          catch (e) { toast(e.message, 'err'); }
        }
      }, icon('trash'), 'Eliminar') : null,
      btnSave));
  refresh();
  ctx.setDirty(dirty);
}

/* ===================== Categorías ===================== */
export async function categoriesView(ctx) {
  ctx.setTitle('Categorías');
  const root = h('div'); ctx.mount(root); root.append(loadingBox());
  let cats, products;
  try { [cats, products] = await Promise.all([api.categories(), api.products()]); }
  catch (e) { clear(root).append(notice('err', e.message)); return; }
  const tbody = h('tbody');
  const count = id => products.filter(p => p.category_id === id).length;

  async function saveCat(c, fields) {
    try { Object.assign(c, await api.saveCategory({ ...c, ...fields })); toast('Categoría guardada.'); }
    catch (e) { toast(e.message, 'err'); }
    draw();
  }
  async function move(i, d) {
    const j = i + d; if (j < 0 || j >= cats.length) return;
    [cats[i], cats[j]] = [cats[j], cats[i]];
    try { await api.reorderCategories(cats.map(c => c.id)); cats.forEach((c, k) => { c.sort_order = (k + 1) * 10; }); toast('Orden actualizado.'); }
    catch (e) { toast(e.message, 'err'); }
    draw();
  }
  function draw() {
    clear(tbody).append(...cats.map((c, i) => {
      const inp = (k, max, w) => {
        const el = h('input', { class: 'input input--sm', value: c[k], maxlength: max, 'aria-label': k });
        if (w) el.style.width = w;
        el.addEventListener('change', () => { const v = el.value.trim(); if (!v) { toast('Este campo no puede quedar vacío.', 'err'); el.value = c[k]; return; } saveCat(c, { [k]: v }); });
        return el;
      };
      const vis = h('input', { type: 'checkbox', checked: c.active, 'aria-label': 'Visible' });
      vis.addEventListener('change', () => saveCat(c, { active: vis.checked }));
      const n = count(c.id);
      return h('tr', { class: c.active ? '' : 'is-off' },
        h('td', null, h('div', { class: 'row' },
          h('button', { class: 'btn btn--ghost btn--icon btn--sm', 'aria-label': 'Subir', disabled: i === 0, onclick: () => move(i, -1) }, icon('up')),
          h('button', { class: 'btn btn--ghost btn--icon btn--sm', 'aria-label': 'Bajar', disabled: i === cats.length - 1, onclick: () => move(i, 1) }, icon('down')))),
        h('td', null, inp('icon', 16, '64px')),
        h('td', null, inp('name', 40)),
        h('td', null, inp('singular', 40)),
        h('td', { class: 'hide-sm' }, h('code', { text: c.code })),
        h('td', null, h('a', { href: '#/productos', onclick: () => { state = { search: '', cat: c.id, status: '', page: 0 }; }, text: String(n) })),
        h('td', null, h('label', { class: 'switch' }, vis, h('span', { class: 'switch__track' }))),
        h('td', null, h('button', {
          class: 'btn btn--sm btn--danger', disabled: n > 0, title: n > 0 ? 'Tiene productos: muévelos o elimínalos primero' : 'Eliminar',
          'aria-label': 'Eliminar ' + c.name, onclick: async () => {
            if (!await confirmDialog({ title: 'Eliminar categoría', message: `“${c.name}” se eliminará.`, confirmLabel: 'Eliminar', danger: true })) return;
            try { await api.deleteCategory(c.id); cats = cats.filter(x => x !== c); toast('Categoría eliminada.'); draw(); }
            catch (e) { toast(e.message, 'err'); }
          }
        }, icon('trash'))));
    }));
  }
  const nName = h('input', { class: 'input', placeholder: 'Ej.: Portátiles', maxlength: 40 });
  const nSing = h('input', { class: 'input', placeholder: 'Ej.: Portátil', maxlength: 40 });
  const nIcon = h('input', { class: 'input', placeholder: '💻', maxlength: 16, value: '🛒' });
  const addBtn = h('button', {
    class: 'btn btn--primary', onclick: () => busy(addBtn, async () => {
      const name = nName.value.trim(), singular = nSing.value.trim() || name;
      if (!name) { toast('Escribe el nombre de la categoría.', 'err'); return; }
      const code = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'cat';
      try {
        const c = await api.saveCategory({ name, singular, icon: nIcon.value.trim() || '🛒', active: true, code: cats.some(x => x.code === code) ? code.slice(0, 19) + '-' + Math.random().toString(36).slice(2, 6) : code, sort_order: (cats.length + 1) * 10 });
        cats.push(c); nName.value = ''; nSing.value = ''; toast('Categoría creada.'); draw();
      } catch (e) { toast(e.message, 'err'); }
    })
  }, icon('plus'), 'Agregar');
  clear(root).append(
    h('div', { class: 'pagehead' }, h('div', null, h('h1', { text: 'Categorías' }),
      h('p', { text: 'Son los filtros del catálogo. Los cambios se ven al momento. Una categoría oculta oculta también sus productos.' }))),
    h('div', { class: 'card' }, h('div', { class: 'card__head' }, h('h2', { text: 'Nueva categoría' })),
      h('div', { class: 'grid3' },
        h('div', { class: 'field' }, h('label', { class: 'field__label', text: 'Nombre (plural, para el filtro)' }), nName),
        h('div', { class: 'field' }, h('label', { class: 'field__label', text: 'Nombre en singular (en cada tarjeta)' }), nSing),
        h('div', { class: 'field' }, h('label', { class: 'field__label', text: 'Ícono (emoji)' }), nIcon)), addBtn),
    h('div', { class: 'card' }, h('div', { class: 'tablewrap' }, h('table', null,
      h('thead', null, h('tr', null, h('th', { text: 'Orden' }), h('th', { text: 'Ícono' }), h('th', { text: 'Nombre' }), h('th', { text: 'Singular' }),
        h('th', { class: 'hide-sm', text: 'Código' }), h('th', { text: 'Productos' }), h('th', { text: 'Visible' }), h('th', null, ''))), tbody))));
  draw();
}

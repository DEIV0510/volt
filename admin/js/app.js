/* Panel VOLT STORE CO — sesión, estructura y rutas. */
import { api, friendly } from './api.js';
import { h, icon, clear, toast, confirmDialog, loadingBox, notice } from './ui.js';
import { IDLE_MINUTES, LOGIN_MAX_FAILS, LOGIN_LOCK_SECONDS, SITE_URL, REPO_BASE } from './config.js';
import { contentView } from './content.js';
import { productsView, productEditView, categoriesView } from './catalog.js';
import { mediaView } from './media.js';
import { dashboardView, publishView, historyView, backupsView, usersView, accountView } from './system.js';

const app = document.getElementById('app');
let profile = null, shell = null, view = null, titleEl = null, badgeEls = [];
let dirtyFn = () => false, currentHash = location.hash || '#/', routeToken = 0, skipGuard = false;

/* ===================== Pantallas de acceso ===================== */
function authCard(...children) {
  return h('div', { class: 'auth' }, h('main', { class: 'auth__card' },
    h('img', { class: 'auth__logo', src: REPO_BASE + 'img/logo.webp', alt: 'VOLT STORE CO' }), ...children));
}
function field(label, input, help) {
  return h('div', { class: 'field' }, h('label', { class: 'field__label', for: input.id, text: label }), input, help ? h('div', { class: 'field__help', text: help }) : null);
}
function render(node) { shell = null; view = null; document.title = 'Panel · VOLT STORE CO'; clear(app).append(node); }
const strong = v => v.length >= 10 && /[a-zA-Z]/.test(v) && /[0-9]/.test(v);
function passwordPair(prefix) {
  const p1 = h('input', { class: 'input', type: 'password', id: prefix + '-1', autocomplete: 'new-password', maxlength: 200 });
  const p2 = h('input', { class: 'input', type: 'password', id: prefix + '-2', autocomplete: 'new-password', maxlength: 200 });
  return {
    els: [field('Nueva contraseña (mín. 10 caracteres, con letras y números)', p1), field('Repite la contraseña', p2)],
    check() {
      if (!strong(p1.value)) return 'Usa al menos 10 caracteres combinando letras y números.';
      if (p1.value !== p2.value) return 'Las contraseñas no coinciden.';
      return '';
    },
    get value() { return p1.value; }
  };
}
async function submitWith(btn, msgBox, fn) {
  btn.classList.add('is-loading'); btn.disabled = true; clear(msgBox);
  try { return await fn(); }
  catch (e) { msgBox.append(notice('err', friendly(e))); return null; }
  finally { btn.classList.remove('is-loading'); btn.disabled = false; }
}

// Bloqueo temporal tras varios intentos fallidos en este navegador (el servidor también limita).
function fails() { try { return JSON.parse(localStorage.getItem('volt-admin-fails') || '{"n":0,"until":0}'); } catch { return { n: 0, until: 0 }; } }
function setFails(v) { try { localStorage.setItem('volt-admin-fails', JSON.stringify(v)); } catch { /* sin almacenamiento */ } }
function lockLeft() { const f = fails(); return f.until > Date.now() ? Math.ceil((f.until - Date.now()) / 1000) : 0; }
function registerFail() { const f = fails(); f.n++; if (f.n >= LOGIN_MAX_FAILS) { f.until = Date.now() + LOGIN_LOCK_SECONDS * 1000; f.n = 0; } setFails(f); }

function loginScreen(message, type = 'warn') {
  profile = null;
  const email = h('input', { class: 'input', type: 'email', id: 'lg-email', autocomplete: 'username', required: true, maxlength: 160 });
  const pass = h('input', { class: 'input', type: 'password', id: 'lg-pass', autocomplete: 'current-password', required: true, maxlength: 200 });
  const msg = h('div', { role: 'alert' });
  const btn = h('button', { class: 'btn btn--primary btn--block', type: 'submit' }, 'Entrar');
  const form = h('form', { novalidate: true }, field('Correo electrónico', email), field('Contraseña', pass), msg, btn);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const lock = lockLeft();
    if (lock) { clear(msg).append(notice('err', `Demasiados intentos fallidos. Espera ${lock} segundos.`)); return; }
    if (!email.value.trim() || !pass.value) { clear(msg).append(notice('err', 'Escribe tu correo y tu contraseña.')); return; }
    const p = await submitWith(btn, msg, () => api.login(email.value.trim(), pass.value));
    if (!p) { registerFail(); pass.value = ''; pass.focus(); return; }
    setFails({ n: 0, until: 0 });
    profile = p;
    startPanel();
  });
  render(authCard(h('h1', { text: 'Panel de administración' }),
    h('p', { class: 'auth__sub', text: 'Acceso exclusivo para administradores de VOLT STORE CO.' }),
    message ? notice(type, message) : null, form,
    h('div', { class: 'auth__foot' }, h('button', { class: 'linkbtn', type: 'button', onclick: () => recoverScreen() }, '¿Olvidaste tu contraseña?'))));
  setTimeout(() => email.focus(), 50);
}

// Primera configuración: crea la cuenta del propietario con la clave que el servidor dejó en el hosting.
function setupScreen(hint) {
  const key = h('input', { class: 'input', id: 'st-key', autocomplete: 'off', spellcheck: 'false', maxlength: 100 });
  const email = h('input', { class: 'input', type: 'email', id: 'st-email', autocomplete: 'username', maxlength: 160 });
  const pw = passwordPair('st');
  const msg = h('div', { role: 'alert' });
  const btn = h('button', { class: 'btn btn--primary btn--block', type: 'submit' }, 'Crear cuenta de propietario');
  const form = h('form', { novalidate: true },
    field('Clave de instalación', key, `Ábrela en hPanel → Administrador de archivos → carpeta ${hint} → archivo clave-instalacion.txt.`),
    field('Tu correo', email), ...pw.els, msg, btn);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const err = !key.value.trim() ? 'Pega la clave de instalación.' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()) ? 'Escribe un correo válido.' : pw.check();
    if (err) { clear(msg).append(notice('err', err)); return; }
    const p = await submitWith(btn, msg, () => api.setup(key.value.trim(), email.value.trim(), pw.value));
    if (!p) return;
    profile = p;
    toast('Cuenta de propietario creada. ¡Bienvenido!');
    startPanel();
  });
  render(authCard(h('h1', { text: 'Primera configuración' }),
    h('p', { class: 'auth__sub', text: 'Crea la cuenta del propietario del panel. Solo se hace una vez.' }),
    notice('info', 'Para comprobar que eres el dueño del sitio, se pide la clave que el servidor guardó en un archivo privado del hosting.'),
    form));
}

// Recuperación: el servidor genera una clave en un archivo del hosting (solo la ve quien entra a hPanel).
function recoverScreen() {
  const msg = h('div', { role: 'alert' });
  const start = h('button', { class: 'btn btn--dark btn--block', type: 'button' }, icon('key'), 'Generar clave de recuperación');
  const key = h('input', { class: 'input', id: 'rc-key', autocomplete: 'off', spellcheck: 'false', maxlength: 100 });
  const email = h('input', { class: 'input', type: 'email', id: 'rc-email', autocomplete: 'username', maxlength: 160 });
  const pw = passwordPair('rc');
  const btn = h('button', { class: 'btn btn--primary btn--block', type: 'submit' }, 'Cambiar contraseña');
  const form = h('form', { novalidate: true, hidden: true }, field('Clave de recuperación', key), field('Tu correo', email), ...pw.els, btn);
  start.addEventListener('click', async () => {
    const r = await submitWith(start, msg, () => api.recoverStart());
    if (!r) return;
    msg.append(notice('ok', `Listo. En hPanel → Administrador de archivos → carpeta ${r.key_hint}, abre clave-recuperacion.txt y copia la clave (vale 30 minutos).`));
    form.hidden = false; key.focus();
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const err = !key.value.trim() ? 'Pega la clave de recuperación.' : pw.check();
    if (err) { clear(msg).append(notice('err', err)); return; }
    const ok = await submitWith(btn, msg, () => api.recover(key.value.trim(), email.value.trim(), pw.value));
    if (ok) loginScreen('Contraseña actualizada. Ya puedes entrar.', 'ok');
  });
  render(authCard(h('h1', { text: 'Recuperar acceso' }),
    h('p', { class: 'auth__sub', text: 'Necesitas entrar al hosting (hPanel) para leer la clave.' }),
    start, msg, form,
    h('div', { class: 'auth__foot' }, h('button', { class: 'linkbtn', type: 'button', onclick: () => loginScreen() }, 'Volver al inicio de sesión'))));
}

/* ===================== Arranque y sesión ===================== */
async function boot() {
  render(h('div', { class: 'auth' }, loadingBox('Cargando panel…')));
  let st;
  try { st = await api.status(); }
  catch (e) { render(authCard(h('h1', { text: 'Panel no disponible' }), notice('err', friendly(e)), h('button', { class: 'btn btn--block', onclick: boot }, 'Reintentar'))); return; }
  if (st.needs_setup) return setupScreen(st.key_hint);
  try { profile = await api.me(); } catch { return loginScreen(); }
  startPanel();
}
function startPanel() {
  buildShell();
  route();
  refreshBadge();
}

function signOut(message, type = 'ok') {
  dirtyFn = () => false;
  profile = null;
  api.logout().catch(() => { /* la sesión ya no existía */ });
  loginScreen(message || 'Cerraste sesión.', type);
}
window.addEventListener('volt:logout', e => { if (profile) { profile = null; dirtyFn = () => false; loginScreen(e.detail && e.detail.message, (e.detail && e.detail.type) || 'warn'); } });

// Cierre de sesión por inactividad (el servidor también la vence a los 30 minutos).
let lastActivity = Date.now();
['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(ev => window.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true }));
setInterval(() => {
  if (profile && Date.now() - lastActivity > IDLE_MINUTES * 60000) signOut(`Por seguridad se cerró la sesión tras ${IDLE_MINUTES} minutos sin actividad.`, 'warn');
}, 30000);

/* ===================== Estructura ===================== */
const NAV = [
  ['Inicio', [['#/', 'Resumen', 'home']]],
  ['Contenido', [
    ['#/contenido/general', 'Información del negocio', 'store'], ['#/contenido/header', 'Encabezado y menú', 'menu'],
    ['#/contenido/hero', 'Portada', 'home'], ['#/contenido/marquee', 'Franja animada', 'marquee'],
    ['#/contenido/productos', 'Productos (tarjetas)', 'grid'], ['#/contenido/catalogo', 'Catálogo (textos)', 'list'],
    ['#/contenido/iphone', 'iPhone a crédito', 'phone'], ['#/contenido/servicio', 'Servicio técnico', 'tool'],
    ['#/contenido/beneficios', 'Beneficios', 'star'], ['#/contenido/galeria', 'Comunidad (galería)', 'image'],
    ['#/contenido/cta', 'Llamado a la acción', 'bolt'], ['#/contenido/contacto', 'Contacto', 'chat'], ['#/contenido/footer', 'Pie de página', 'footer']]],
  ['Catálogo', [['#/productos', 'Productos', 'box'], ['#/categorias', 'Categorías', 'tag']]],
  ['Medios', [['#/medios', 'Biblioteca de imágenes', 'image']]],
  ['Diseño', [['#/secciones', 'Orden de secciones', 'layers'], ['#/diseno', 'Colores y tipografía', 'palette'], ['#/seo', 'SEO y redes', 'search']]],
  ['Publicación', [['#/publicar', 'Publicar cambios', 'send', 'pending'], ['#/historial', 'Historial', 'clock'], ['#/respaldos', 'Respaldos', 'archive']]],
  ['Cuenta', [['#/usuarios', 'Usuarios', 'users', 'owner'], ['#/cuenta', 'Mi cuenta', 'user']]]
];

function buildShell() {
  badgeEls = [];
  const nav = h('nav', { 'aria-label': 'Menú del panel' }, NAV.map(([group, links]) => [
    h('div', { class: 'side__group', text: group }),
    links.filter(l => l[3] !== 'owner' || profile.role === 'owner').map(([href, text, ic, extra]) => {
      const badge = extra === 'pending' ? h('span', { class: 'badge badge--volt', hidden: true }) : null;
      if (badge) badgeEls.push(badge);
      return h('a', { class: 'side__link', href, dataset: { href } }, icon(ic), h('span', { text }), badge);
    })]));
  const side = h('aside', { class: 'side' },
    h('div', { class: 'side__brand' }, h('img', { src: REPO_BASE + 'img/logo-white.webp', alt: 'VOLT STORE CO' }), h('span', { text: 'Admin' })),
    nav,
    h('div', { class: 'side__foot' }, h('strong', { text: profile.email }), profile.role === 'owner' ? 'Propietario' : 'Editor',
      h('button', { class: 'btn btn--sm btn--block mt', onclick: () => trySignOut() }, icon('logout'), 'Cerrar sesión')));
  titleEl = h('h1', { class: 'top__title' });
  const topBadge = h('a', { class: 'badge badge--warn', href: '#/publicar', hidden: true });
  badgeEls.push(topBadge);
  view = h('div', { class: 'content', id: 'view', tabindex: '-1' });
  const burger = h('button', { class: 'btn btn--ghost btn--icon burger', 'aria-label': 'Abrir menú', onclick: () => shell.classList.toggle('menu-open') }, icon('menu'));
  shell = h('div', { class: 'shell' }, side, h('div', { class: 'scrim', onclick: () => shell.classList.remove('menu-open') }),
    h('div', { class: 'main' },
      h('header', { class: 'top' }, burger, titleEl, topBadge,
        h('a', { class: 'btn btn--sm', href: SITE_URL, target: '_blank', rel: 'noopener' }, icon('external'), h('span', { class: 'hide-sm', text: 'Ver la página' }))),
      view));
  clear(app).append(shell);
}

async function trySignOut() {
  if (dirtyFn() && !await confirmDialog({ title: 'Cambios sin guardar', message: 'Si cierras sesión perderás los cambios que no guardaste.', confirmLabel: 'Cerrar sesión', danger: true })) return;
  signOut();
}

async function refreshBadge() {
  if (!profile) return;
  try {
    const o = await api.overview();
    const n = o.pending.length;
    badgeEls.forEach(b => { b.hidden = !n; b.textContent = b.classList.contains('badge--warn') ? `${n} cambio${n === 1 ? '' : 's'} sin publicar` : String(n); });
  } catch { /* el aviso no es crítico */ }
}

/* ===================== Rutas ===================== */
const ROUTES = [
  [/^#?\/?$/, ctx => dashboardView(ctx)],
  [/^#\/contenido\/(\w+)$/, (ctx, m) => contentView(ctx, m[1])],
  [/^#\/secciones$/, ctx => contentView(ctx, 'layout')],
  [/^#\/diseno$/, ctx => contentView(ctx, 'theme')],
  [/^#\/seo$/, ctx => contentView(ctx, 'seo')],
  [/^#\/productos$/, ctx => productsView(ctx)],
  [/^#\/productos\/([\w-]+)$/, (ctx, m) => productEditView(ctx, m[1])],
  [/^#\/categorias$/, ctx => categoriesView(ctx)],
  [/^#\/medios$/, ctx => mediaView(ctx)],
  [/^#\/publicar$/, ctx => publishView(ctx)],
  [/^#\/historial$/, (ctx, m, params) => historyView(ctx, params)],
  [/^#\/respaldos$/, ctx => backupsView(ctx)],
  [/^#\/usuarios$/, ctx => usersView(ctx)],
  [/^#\/cuenta$/, ctx => accountView(ctx)]
];

function route() {
  if (!shell) return;
  const token = ++routeToken;
  dirtyFn = () => false;
  currentHash = location.hash || '#/';
  const [path, query] = currentHash.split('?');
  const params = new URLSearchParams(query || '');
  const ctx = {
    get profile() { return profile; },
    mount(node) { if (token === routeToken) { clear(view).append(node); } },
    setTitle(t) { if (token === routeToken) { titleEl.textContent = t; document.title = `${t} · Panel VOLT`; } },
    setDirty(fn) { if (token === routeToken) dirtyFn = fn; },
    refreshBadge,
    reload(force) { if (force) dirtyFn = () => false; route(); },
    signOut,
    notFound() { this.mount(notice('warn', 'Esta página del panel no existe.')); }
  };
  shell.classList.remove('menu-open');
  shell.querySelectorAll('.side__link').forEach(a => {
    const href = a.dataset.href;
    a.classList.toggle('is-active', href === '#/' ? path === '#/' || path === '' : path === href || path.startsWith(href + '/'));
    if (a.classList.contains('is-active')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  clear(view).append(loadingBox());
  const found = ROUTES.find(([re]) => re.test(path));
  if (!found) return ctx.notFound();
  Promise.resolve(found[1](ctx, path.match(found[0]), params)).catch(e => ctx.mount(notice('err', friendly(e))));
  view.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

// Aviso al salir de una pantalla con cambios sin guardar.
window.addEventListener('hashchange', async () => {
  if (skipGuard) { skipGuard = false; return; }
  if (!shell) return;
  if (dirtyFn()) {
    const target = location.hash;
    history.replaceState(null, '', currentHash);
    const ok = await confirmDialog({ title: 'Cambios sin guardar', message: 'Tienes cambios sin guardar en esta pantalla. ¿Salir y perderlos?', confirmLabel: 'Salir sin guardar', danger: true });
    if (!ok) return;
    dirtyFn = () => false;
    location.hash = target;
    return;
  }
  route();
});
window.addEventListener('beforeunload', e => { if (dirtyFn()) { e.preventDefault(); e.returnValue = ''; } });

boot();

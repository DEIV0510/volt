/* Panel VOLT STORE CO — sesión, estructura y rutas. */
import { sb, api, friendly } from './api.js';
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
function field(label, input) { return h('div', { class: 'field' }, h('label', { class: 'field__label', for: input.id, text: label }), input); }
function render(node) { shell = null; view = null; document.title = 'Panel · VOLT STORE CO'; clear(app).append(node); }

// Bloqueo temporal tras varios intentos fallidos en este navegador (Supabase además limita por IP).
function fails() { try { return JSON.parse(localStorage.getItem('volt-admin-fails') || '{"n":0,"until":0}'); } catch { return { n: 0, until: 0 }; } }
function setFails(v) { try { localStorage.setItem('volt-admin-fails', JSON.stringify(v)); } catch { /* sin almacenamiento */ } }
function lockLeft() { const f = fails(); return f.until > Date.now() ? Math.ceil((f.until - Date.now()) / 1000) : 0; }
function registerFail() { const f = fails(); f.n++; if (f.n >= LOGIN_MAX_FAILS) { f.until = Date.now() + LOGIN_LOCK_SECONDS * 1000; f.n = 0; } setFails(f); }

function loginScreen(message, type = 'warn') {
  profile = null;
  const email = h('input', { class: 'input', type: 'email', id: 'lg-email', autocomplete: 'username', required: true, maxlength: 160 });
  const pass = h('input', { class: 'input', type: 'password', id: 'lg-pass', autocomplete: 'current-password', required: true, maxlength: 200 });
  const err = h('div', { class: 'notice notice--err', hidden: true, role: 'alert' });
  const btn = h('button', { class: 'btn btn--primary btn--block', type: 'submit' }, 'Entrar');
  const showErr = m => { err.hidden = false; clear(err).append(icon('alert'), h('div', { text: m })); };
  const form = h('form', { novalidate: true }, field('Correo electrónico', email), field('Contraseña', pass), err, btn);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const lock = lockLeft();
    if (lock) return showErr(`Demasiados intentos fallidos. Espera ${lock} segundos.`);
    if (!email.value.trim() || !pass.value) return showErr('Escribe tu correo y tu contraseña.');
    btn.classList.add('is-loading'); btn.disabled = true; err.hidden = true;
    const { error } = await sb.auth.signInWithPassword({ email: email.value.trim(), password: pass.value });
    btn.classList.remove('is-loading'); btn.disabled = false;
    if (error) { registerFail(); pass.value = ''; pass.focus(); return showErr(friendly(error)); }
    setFails({ n: 0, until: 0 });
    await boot({ fresh: true });
  });
  render(authCard(h('h1', { text: 'Panel de administración' }),
    h('p', { class: 'auth__sub', text: 'Acceso exclusivo para administradores de VOLT STORE CO.' }),
    message ? notice(type, message) : null, form,
    h('div', { class: 'auth__foot' }, h('button', { class: 'linkbtn', type: 'button', onclick: () => forgotScreen() }, '¿Olvidaste tu contraseña?'))));
  setTimeout(() => email.focus(), 50);
}

function forgotScreen() {
  const email = h('input', { class: 'input', type: 'email', id: 'fg-email', autocomplete: 'username', maxlength: 160 });
  const btn = h('button', { class: 'btn btn--primary btn--block', type: 'submit' }, 'Enviar enlace');
  const msg = h('div');
  const form = h('form', { novalidate: true }, field('Correo electrónico', email), msg, btn);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { clear(msg).append(notice('err', 'Escribe un correo válido.')); return; }
    btn.classList.add('is-loading'); btn.disabled = true;
    const { error } = await sb.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: location.origin + location.pathname });
    btn.classList.remove('is-loading'); btn.disabled = false;
    // Mensaje neutro: no revela si el correo existe.
    clear(msg).append(error && /rate|429/i.test(error.message + error.status) ? notice('err', friendly(error))
      : notice('ok', 'Si ese correo pertenece a un administrador, recibirás un enlace para crear una nueva contraseña. Revisa también la carpeta de spam.'));
  });
  render(authCard(h('h1', { text: 'Recuperar contraseña' }),
    h('p', { class: 'auth__sub', text: 'Te enviaremos un enlace para crear una contraseña nueva.' }), form,
    h('div', { class: 'auth__foot' }, h('button', { class: 'linkbtn', type: 'button', onclick: () => loginScreen() }, 'Volver al inicio de sesión'))));
}

function recoveryScreen() {
  const p1 = h('input', { class: 'input', type: 'password', id: 'rc-1', autocomplete: 'new-password' });
  const p2 = h('input', { class: 'input', type: 'password', id: 'rc-2', autocomplete: 'new-password' });
  const msg = h('div');
  const btn = h('button', { class: 'btn btn--primary btn--block', type: 'submit' }, 'Guardar contraseña');
  const form = h('form', { novalidate: true }, field('Nueva contraseña (mín. 10 caracteres, letras y números)', p1), field('Repite la contraseña', p2), msg, btn);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const v = p1.value;
    if (v.length < 10 || !/[a-zA-Z]/.test(v) || !/[0-9]/.test(v)) { clear(msg).append(notice('err', 'Usa al menos 10 caracteres combinando letras y números.')); return; }
    if (v !== p2.value) { clear(msg).append(notice('err', 'Las contraseñas no coinciden.')); return; }
    btn.classList.add('is-loading'); btn.disabled = true;
    const { error } = await sb.auth.updateUser({ password: v });
    btn.classList.remove('is-loading'); btn.disabled = false;
    if (error) { clear(msg).append(notice('err', friendly(error))); return; }
    history.replaceState(null, '', location.pathname + '#/');
    toast('Contraseña actualizada.');
    boot({ fresh: true });
  });
  render(authCard(h('h1', { text: 'Crea tu nueva contraseña' }), form));
}

function noAccessScreen(email) {
  render(authCard(h('h1', { text: 'Sin permisos' }),
    notice('warn', `La cuenta ${email} inició sesión, pero no tiene permisos de administrador. Pide acceso al propietario del panel.`),
    h('button', { class: 'btn btn--block', onclick: () => sb.auth.signOut() }, icon('logout'), 'Cerrar sesión')));
}

/* ===================== Arranque y sesión ===================== */
async function boot({ fresh } = {}) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return loginScreen();
  render(h('div', { class: 'auth' }, loadingBox('Verificando permisos…')));
  try { profile = await api.profile(); }
  catch (e) { return loginScreen(e.message, 'err'); }
  if (!profile) return noAccessScreen(session.user.email);
  if (fresh) api.recordLogin().catch(() => {});
  buildShell();
  route();
  refreshBadge();
}

let signOutReason = '';
sb.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') { setTimeout(recoveryScreen, 0); return; }
  if (event === 'SIGNED_OUT') {
    const reason = signOutReason; signOutReason = '';
    setTimeout(() => loginScreen(reason || 'Cerraste sesión.', reason ? 'warn' : 'ok'), 0);
  }
});
async function signOut(reason) {
  signOutReason = reason || '';
  dirtyFn = () => false;
  await sb.auth.signOut();
}
window.addEventListener('volt:session-expired', () => signOut('Tu sesión expiró. Vuelve a iniciar sesión.'));

// Cierre de sesión por inactividad.
let lastActivity = Date.now();
['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(ev => window.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true }));
setInterval(() => {
  if (profile && Date.now() - lastActivity > IDLE_MINUTES * 60000) signOut(`Por seguridad se cerró la sesión tras ${IDLE_MINUTES} minutos sin actividad.`);
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
      h('button', { class: 'btn btn--sm btn--block', onclick: () => trySignOut(), style: null }, icon('logout'), 'Cerrar sesión')));
  side.querySelector('.side__foot .btn').classList.add('mt');
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
  if (/access_token|type=recovery|error_code/.test(location.hash)) return;
  if (!shell) return;
  if (dirtyFn()) {
    const target = location.hash;
    history.replaceState(null, '', currentHash);
    const ok = await confirmDialog({ title: 'Cambios sin guardar', message: 'Tienes cambios sin guardar en esta pantalla. ¿Salir y perderlos?', confirmLabel: 'Salir sin guardar', danger: true });
    if (!ok) return;
    dirtyFn = () => false;
    skipGuard = false;
    location.hash = target;
    return;
  }
  route();
});
window.addEventListener('beforeunload', e => { if (dirtyFn()) { e.preventDefault(); e.returnValue = ''; } });

boot();

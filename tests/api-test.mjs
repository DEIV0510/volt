// Pruebas de la API del panel contra el servidor de desarrollo (datos locales, nunca producción).
//   php -S localhost:5231 scripts/dev-router.php      (en otra terminal)
//   node tests/api-test.mjs http://localhost:5231 ../volt-data-dev
// Crea un propietario de prueba con contraseña aleatoria y la guarda en .claude/dev-credentials.json (ignorado por git).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const BASE = process.argv[2] || 'http://localhost:5231';
const DATA = process.argv[3] || path.resolve('..', 'volt-data-dev');
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) { console.error('Solo se prueba contra un servidor local.'); process.exit(1); }

let pass = 0, failN = 0;
const ok = (cond, label, extra = '') => { if (cond) { pass++; console.log('  ✓ ' + label); } else { failN++; console.log('  ✗ ' + label + (extra ? ' → ' + extra : '')); } };
const pw = () => crypto.randomBytes(9).toString('base64url') + 'a1';

function client() {
  let cookie = '', csrf = '';
  async function call(action, { method = 'GET', body, query, form, headers = {}, noCsrf } = {}) {
    const url = new URL(BASE + '/api/');
    url.searchParams.set('a', action);
    for (const [k, v] of Object.entries(query || {})) url.searchParams.set(k, v);
    const h = { ...headers };
    if (cookie) h.Cookie = cookie;
    if (method === 'POST' && !noCsrf) h['X-CSRF-Token'] = csrf;
    let payload;
    if (form) payload = form; else if (method === 'POST') { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body ?? {}); }
    const r = await fetch(url, { method, headers: h, body: payload });
    const set = r.headers.get('set-cookie');
    if (set) { const m = /volt_admin=([^;]*)/.exec(set); if (m) cookie = m[1] && m[1] !== 'deleted' ? 'volt_admin=' + m[1] : ''; }
    let json = null; try { json = await r.json(); } catch { /* sin cuerpo */ }
    if (json && json.data && json.data.csrf) csrf = json.data.csrf;
    return { status: r.status, json, data: json && json.data, error: json && json.error, code: json && json.code };
  }
  return { call, get: (a, query) => call(a, { query }), post: (a, body, o = {}) => call(a, { method: 'POST', body, ...o }) };
}

const owner = client(), anon = client(), editor = client();
const ownerEmail = 'propietario@volt.test', ownerPass = pw(), editorEmail = 'editor@volt.test', editorPass = pw();

console.log('\n— Instalación');
let r = await anon.get('status');
ok(r.data && r.data.needs_setup === true, 'el panel pide configuración inicial');
const key = fs.readFileSync(path.join(DATA, 'clave-instalacion.txt'), 'utf8').trim();
r = await owner.post('setup', { key: 'clave-incorrecta', email: ownerEmail, password: ownerPass });
ok(r.status === 403, 'clave de instalación incorrecta → rechazada', r.status);
r = await owner.post('setup', { key, email: ownerEmail, password: 'corta' });
ok(r.status === 400, 'contraseña débil → rechazada', r.status);
r = await owner.post('setup', { key, email: ownerEmail, password: ownerPass });
ok(r.status === 200 && r.data.role === 'owner', 'clave correcta → crea propietario e inicia sesión', r.error);
ok(!fs.existsSync(path.join(DATA, 'clave-instalacion.txt')), 'la clave de instalación se borra tras usarla');
r = await anon.post('setup', { key, email: 'otro@volt.test', password: pw() });
ok(r.status === 409, 'no se puede volver a configurar', r.status);
fs.mkdirSync('.claude', { recursive: true });
fs.writeFileSync('.claude/dev-credentials.json', JSON.stringify({ base: BASE, owner: { email: ownerEmail, password: ownerPass }, editor: { email: editorEmail, password: editorPass } }, null, 2));

console.log('\n— Sin sesión');
for (const a of ['overview', 'drafts', 'products', 'media', 'export', 'users', 'preview', 'audit']) {
  r = await anon.get(a); ok(r.status === 401, `${a} sin sesión → 401`, r.status);
}
r = await anon.post('save_draft', { key: 'hero', data: {} }); ok(r.status === 401, 'guardar sin sesión → 401', r.status);
r = await anon.post('publish', {}); ok(r.status === 401, 'publicar sin sesión → 401', r.status);

console.log('\n— CSRF y origen');
r = await owner.post('publish', {}, { noCsrf: true }); ok(r.status === 403 && r.code === 'csrf', 'escritura sin token CSRF → 403', r.status);
r = await owner.post('publish', {}, { headers: { Origin: 'https://atacante.example' } }); ok(r.status === 403 && r.code === 'bad_origin', 'escritura desde otro origen → 403', r.status);
r = await owner.call('overview', { method: 'POST' }); ok(r.status === 405, 'método incorrecto → 405', r.status);

console.log('\n— Contenido: validación, borrador, conflicto, publicación');
r = await owner.get('content', { key: 'hero' });
const hero = r.data.draft.data, v0 = r.data.draft.version;
r = await owner.post('save_draft', { key: 'hero', data: { ...hero, secondary: { ...hero.secondary, kind: 'link', href: 'javascript:alert(1)' } }, expected_version: v0 });
ok(r.status === 400, 'enlace javascript: → rechazado', r.error);
r = await owner.post('save_draft', { key: 'hero', data: { ...hero, campoInventado: '<script>' }, expected_version: v0 });
ok(r.status === 400, 'campo desconocido → rechazado', r.error);
r = await owner.post('save_draft', { key: 'theme', data: { primary: 'red; background:url(x)' } });
ok(r.status === 400, 'color con CSS inyectado → rechazado', r.error);
r = await owner.post('save_draft', { key: 'hero', data: { ...hero, title: 'x'.repeat(161) }, expected_version: v0 });
ok(r.status === 400, 'texto demasiado largo → rechazado', r.error);
r = await owner.post('save_draft', { key: 'no-existe', data: {} });
ok(r.status === 400, 'sección desconocida → rechazada', r.error);
r = await owner.post('save_draft', { key: 'hero', data: { ...hero, title: 'Título de prueba en Convención' }, expected_version: v0 });
ok(r.status === 200 && r.data.version === v0 + 1, 'guardar borrador válido → nueva versión', r.error);
let pub = await (await fetch(BASE + '/api/?a=public')).json();
ok(pub.content.hero.title !== 'Título de prueba en Convención', 'el borrador NO es público todavía');
r = await owner.post('save_draft', { key: 'hero', data: hero, expected_version: v0 });
ok(r.status === 409 && r.code === 'conflict', 'edición simultánea (versión vieja) → 409', r.status);
r = await owner.get('overview'); ok(r.data.pending.includes('hero'), 'el resumen marca «hero» como pendiente');
r = await owner.post('publish', { keys: ['hero'], note: 'prueba' });
ok(r.status === 200 && r.data.published.includes('hero'), 'publicar', r.error);
pub = await (await fetch(BASE + '/api/?a=public')).json();
ok(pub.content.hero.title === 'Título de prueba en Convención', 'lo publicado ya es público');
const home = await (await fetch(BASE + '/')).text();
ok(home.includes('<title>'), 'la portada se sirve con su <head>');
r = await owner.get('versions', { key: 'hero' }); ok(r.data.length === 2, 'quedó una versión nueva en el historial', r.data && r.data.length);
const backups = fs.readdirSync(path.join(DATA, 'respaldos')).filter(f => f.endsWith('.json'));
ok(backups.length >= 1, 'copia automática creada al publicar', backups.length);
r = await owner.post('restore_version', { id: r.data[1].id }); ok(r.status === 200, 'restaurar la versión original como borrador');
r = await owner.post('publish', { keys: ['hero'] }); ok(r.data.published.includes('hero'), 'publicar la restauración');
pub = await (await fetch(BASE + '/api/?a=public')).json();
ok(pub.content.hero.title === hero.title, 'la portada volvió al texto original');

console.log('\n— SEO en el HTML');
r = await owner.get('content', { key: 'seo' });
const seo = r.data.draft.data;
await owner.post('save_draft', { key: 'seo', data: { ...seo, title: 'Título SEO "de prueba" & <x>', index: false } });
await owner.post('publish', { keys: ['seo'] });
let html = await (await fetch(BASE + '/')).text();
ok(html.includes('<title>Título SEO &quot;de prueba&quot; &amp; &lt;x&gt;</title>'), 'título SEO aplicado y escapado en el HTML');
ok(html.includes('content="noindex, nofollow"'), 'indexación desactivada → noindex en el HTML');
await owner.post('save_draft', { key: 'seo', data: seo }); await owner.post('publish', { keys: ['seo'] });
html = await (await fetch(BASE + '/')).text();
ok(!html.includes('noindex'), 'SEO restaurado');

console.log('\n— Catálogo');
r = await owner.get('products'); const prods = r.data;
ok(prods.length === 234, '234 productos migrados', prods.length);
const mouse = prods.find(p => p.name === 'Mouse Inalámbrico');
r = await owner.post('product_save', { product: { ...mouse, price: 50, price_max: 10 }, version: mouse.version });
ok(r.status === 400, 'rango de precio inválido → rechazado', r.error);
r = await owner.post('product_save', { product: { ...mouse, price: 45000, promo_price: 50000 }, version: mouse.version });
ok(r.status === 400, 'promoción mayor que el precio → rechazada', r.error);
r = await owner.post('product_save', { product: { ...mouse, cta_url: 'javascript:alert(1)' }, version: mouse.version });
ok(r.status === 400, 'enlace javascript: en producto → rechazado', r.error);
r = await owner.post('product_save', { product: { ...mouse, price: 45000 }, version: mouse.version });
ok(r.status === 200 && r.data.price === 45000, 'cambiar precio', r.error);
r = await owner.post('product_save', { product: { ...mouse, price: 46000 }, version: mouse.version });
ok(r.status === 409, 'producto editado por otra persona → 409', r.status);
pub = await (await fetch(BASE + '/api/?a=public')).json();
ok(pub.products.find(p => p.id === mouse.id).price === 45000, 'el precio nuevo es público');
r = await owner.post('products_update', { ids: [mouse.id], fields: { active: false } });
pub = await (await fetch(BASE + '/api/?a=public')).json();
ok(!pub.products.some(p => p.id === mouse.id), 'ocultar producto → desaparece de la página');
await owner.post('products_update', { ids: [mouse.id], fields: { active: true, price: 40000 } });
r = await owner.post('product_save', { product: { name: 'Producto de prueba', category_id: mouse.category_id, price: 1000, active: false, featured: false, gallery: [], features: ['A'] } });
ok(r.status === 200, 'crear producto', r.error);
const created = r.data;
r = await owner.post('products_delete', { ids: [created.id] }); ok(r.status === 200, 'eliminar producto');
r = await owner.post('category_delete', { id: mouse.category_id });
ok(r.status === 409, 'no se puede borrar una categoría con productos', r.status);

console.log('\n— Imágenes');
const png = fs.readFileSync('img/logo.png');   // PNG real del sitio
const up = async (buf, name, type) => { const f = new FormData(); f.append('file', new Blob([buf], { type }), name); f.append('folder', 'general'); return owner.call('media_upload', { method: 'POST', form: f }); };
r = await up(png, 'Foto Prueba.png', 'image/png');
ok(r.status === 200 && r.data.mime === 'image/webp' && r.data.url.startsWith('uploads/general/'), 'PNG válido → guardado como WebP', r.error);
const media = r.data;
ok(fs.existsSync(path.resolve('uploads', media.path)), 'el archivo existe en uploads/');
r = await up(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), 'malo.svg', 'image/svg+xml');
ok(r.status === 400, 'SVG → rechazado', r.error);
r = await up(Buffer.from('<?php echo 1; ?>'), 'shell.php.png', 'image/png');
ok(r.status === 400, 'PHP disfrazado de PNG → rechazado', r.error);
r = await up(Buffer.concat([png, Buffer.from('<?php system($_GET[1]); ?>')]), 'trucada.png', 'image/png');
ok(r.status === 400 || (r.status === 200 && !fs.readFileSync(path.resolve('uploads', r.data.path)).includes('<?php')), 'imagen con código pegado → rechazada o limpiada');
const shown = await fetch(BASE + '/' + media.url);
ok(shown.status === 200 && shown.headers.get('content-type') === 'image/webp', 'la imagen se sirve como imagen');
await owner.post('save_draft', { key: 'hero', data: { ...hero, image: media.url } });
r = await owner.post('media_delete', { id: media.id });
ok(r.status === 409 && r.json.usage.content.includes('hero'), 'no se puede borrar una imagen en uso (y dice dónde)', r.status);
await owner.post('discard', { keys: ['hero'] });
r = await owner.post('media_delete', { id: media.id });
ok(r.status === 200 && !fs.existsSync(path.resolve('uploads', media.path)), 'imagen sin uso → eliminada con su archivo', r.error);
r = await owner.get('media'); const repoImg = r.data.find(m => m.source === 'repo');
r = await owner.post('media_delete', { id: repoImg.id }); ok(r.status === 400, 'las imágenes originales no se pueden borrar', r.status);

console.log('\n— Roles');
r = await owner.post('user_create', { email: editorEmail, password: editorPass, role: 'editor' }); ok(r.status === 200, 'el propietario crea un editor', r.error);
r = await editor.post('login', { email: editorEmail, password: editorPass }); ok(r.status === 200 && r.data.role === 'editor', 'el editor inicia sesión');
r = await editor.get('users'); ok(r.status === 403, 'editor → no ve usuarios', r.status);
r = await editor.post('user_create', { email: 'x@volt.test', password: pw(), role: 'owner' }); ok(r.status === 403, 'editor → no puede crear usuarios', r.status);
r = await editor.post('import', { payload: { format: 'volt-backup' } }); ok(r.status === 403, 'editor → no puede restaurar respaldos', r.status);
r = await editor.get('content', { key: 'cta' });
r = await editor.post('save_draft', { key: 'cta', data: r.data.draft.data }); ok(r.status === 200, 'editor → sí puede editar contenido');
r = await owner.get('users'); const me = r.data.find(u => u.email === ownerEmail);
r = await owner.post('user_update', { id: me.user_id, role: 'editor' }); ok(r.status === 409, 'no se puede quitar al único propietario', r.status);
r = await owner.post('user_delete', { id: me.user_id }); ok(r.status === 409, 'no puedes borrarte a ti mismo', r.status);

console.log('\n— Respaldos');
r = await owner.get('export'); ok(r.data.format === 'volt-backup' && r.data.products.length === 234, 'exportar respaldo completo');
const bad = JSON.parse(JSON.stringify(r.data)); bad.drafts.hero.secondary.href = 'javascript:alert(1)'; bad.products[0].name = 'CAMBIO QUE NO DEBE QUEDAR';
r = await owner.post('import', { payload: bad, replace_catalog: false });
ok(r.status === 400, 'respaldo con un dato inválido → rechazado entero', r.error);
r = await owner.get('products'); ok(!r.data.some(p => p.name === 'CAMBIO QUE NO DEBE QUEDAR'), 'no se aplicó nada a medias');

console.log('\n— Intentos de inicio de sesión');
const atk = client();
for (let i = 0; i < 5; i++) await atk.post('login', { email: editorEmail, password: 'incorrecta' + i });
r = await atk.post('login', { email: editorEmail, password: editorPass });
ok(r.status === 429, 'tras 5 intentos fallidos se bloquea (incluso con la contraseña correcta)', r.status);
r = await anon.post('login', { email: 'nadie@volt.test', password: 'loquesea12345' });
ok(r.status === 401 && r.error === 'Correo o contraseña incorrectos.', 'correo inexistente → mismo mensaje genérico');

console.log('\n— Sesión');
r = await owner.post('change_password', { current: 'mala', password: pw() }); ok(r.status === 400, 'cambiar contraseña exige la actual');
r = await owner.post('logout'); ok(r.status === 200, 'cerrar sesión');
r = await owner.get('me'); ok(r.status === 401, 'tras cerrar sesión ya no hay acceso', r.status);
r = await owner.post('login', { email: ownerEmail, password: ownerPass }); ok(r.status === 200, 'volver a entrar');

console.log('\n— Recuperación de acceso');
r = await anon.post('recover_start'); ok(r.status === 200, 'pedir clave de recuperación');
const rkey = fs.readFileSync(path.join(DATA, 'clave-recuperacion.txt'), 'utf8').split('\n')[0].trim();
r = await anon.post('recover', { key: 'mala', email: editorEmail, password: pw() }); ok(r.status === 403, 'clave de recuperación incorrecta → rechazada');
const newEditorPass = pw();
r = await anon.post('recover', { key: rkey, email: editorEmail, password: newEditorPass }); ok(r.status === 200, 'clave correcta → contraseña cambiada');
r = await editor.get('me'); ok(r.status === 401, 'las sesiones abiertas de esa cuenta se cerraron', r.status);
const creds = JSON.parse(fs.readFileSync('.claude/dev-credentials.json', 'utf8')); creds.editor.password = newEditorPass;
fs.writeFileSync('.claude/dev-credentials.json', JSON.stringify(creds, null, 2));

console.log('\n— Historial');
r = await owner.get('audit'); ok(r.data.count > 10 && r.data.data.some(a => a.action === 'publish'), 'el historial registra los cambios', r.data && r.data.count);
ok(!JSON.stringify(r.data).includes(ownerPass) && !JSON.stringify(r.data).includes('password_hash'), 'el historial no guarda contraseñas');

console.log(`\nResultado: ${pass} correctas, ${failN} fallidas`);
process.exit(failN ? 1 : 0);

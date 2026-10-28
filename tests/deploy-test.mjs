// Prueba la actualización desde GitHub contra el servidor de desarrollo (necesita internet).
//   php -S localhost:5231 scripts/dev-router.php
//   node tests/deploy-test.mjs http://localhost:5231 ../volt-data-dev ../volt-deploy-dev
// Instala el último main del repositorio en ../volt-deploy-dev (nunca en esta copia de trabajo).
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] || 'http://localhost:5231';
const DATA = process.argv[3] || path.resolve('..', 'volt-data-dev');
const DEST = process.argv[4] || path.resolve('..', 'volt-deploy-dev');
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) { console.error('Solo se prueba contra un servidor local.'); process.exit(1); }

let pass = 0, failN = 0;
const ok = (cond, label, extra = '') => { if (cond) { pass++; console.log('  ✓ ' + label); } else { failN++; console.log('  ✗ ' + label + (extra ? ' → ' + extra : '')); } };
const deploy = async (headers = {}) => { const r = await fetch(BASE + '/api/?a=deploy', { method: 'POST', headers }); return { status: r.status, j: await r.json().catch(() => null) }; };
const stateFile = path.join(DATA, 'despliegue.json');
const setState = s => fs.writeFileSync(stateFile, JSON.stringify(s));
const exists = p => fs.existsSync(path.join(DEST, p));

console.log('\n— Actualización desde GitHub');
fs.rmSync(DEST, { recursive: true, force: true });
fs.rmSync(stateFile, { force: true });
let r = await deploy({ Origin: 'https://otro-sitio.example' });
ok(r.status === 403, 'una página ajena no puede pedir la actualización', r.status);

r = await deploy();
ok(r.status === 200 && r.j.data.status === 'updated' && /^[0-9a-f]{40}$/.test(r.j.data.sha), 'instala el último commit de main', JSON.stringify(r.j));
const sha = r.j && r.j.data && r.j.data.sha;
ok(['index.html', 'index.php', 'script.js', 'styles.css', '.htaccess', 'api/index.php', 'api/.htaccess', 'admin/index.html'].every(exists), 'el sitio, el panel y la API quedan instalados');
ok(!['tests', 'scripts', 'data', '.github', 'README.md', 'ADMIN.md', '.gitignore'].some(exists), 'no instala pruebas, scripts, documentación ni archivos de git');
ok(!fs.readdirSync(DEST, { recursive: true }).some(f => String(f).endsWith('.volt-nuevo')), 'no quedan archivos temporales');

r = await deploy();
ok(r.j && r.j.data.status === 'wait', 'una segunda petición inmediata espera (límite de frecuencia)', JSON.stringify(r.j));

setState({ ...JSON.parse(fs.readFileSync(stateFile, 'utf8')), checked: 0 });
r = await deploy();
ok(r.j && r.j.data.status === 'unchanged' && r.j.data.sha === sha, 'si no hay commits nuevos no reinstala nada', JSON.stringify(r.j));

// Simula un archivo modificado a mano y otro que se quitó del repositorio desde la publicación anterior.
fs.writeFileSync(path.join(DEST, 'script.js'), '/* modificado */');
fs.writeFileSync(path.join(DEST, 'viejo.txt'), 'quitado del repositorio');
fs.mkdirSync(path.join(DEST, 'uploads'), { recursive: true });
fs.writeFileSync(path.join(DEST, 'uploads', 'foto.webp'), 'imagen subida por el panel');
const st = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
setState({ ...st, sha: '0'.repeat(40), checked: 0, files: [...st.files, 'viejo.txt', 'uploads/foto.webp', '../fuera.txt'] });
r = await deploy();
ok(r.j && r.j.data.status === 'updated' && r.j.data.changed === 1, 'solo reescribe lo que cambió', JSON.stringify(r.j));
ok(fs.readFileSync(path.join(DEST, 'script.js'), 'utf8').length > 1000, 'restaura el archivo modificado');
ok(!exists('viejo.txt'), 'borra lo que se quitó del repositorio');
ok(exists('uploads/foto.webp'), 'nunca borra las imágenes subidas desde el panel');

console.log(`\nResultado: ${pass} correctas, ${failN} fallidas`);
process.exit(failN ? 1 : 0);

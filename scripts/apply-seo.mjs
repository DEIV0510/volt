// Copia al <head> de index.html el SEO publicado en el panel (data/site.json).
// Lo usa la copia automática (.github/workflows/copia-diaria.yml) para que Google,
// WhatsApp y Facebook vean el título, la descripción y la imagen del panel sin ejecutar JavaScript.
// Uso: node scripts/apply-seo.mjs   (sale con código 0 aunque no haya cambios)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://voltstoreco.com/';
const file = path.join(ROOT, 'index.html');
const seo = (JSON.parse(fs.readFileSync(path.join(ROOT, 'data/site.json'), 'utf8')).content || {}).seo || {};
let html = fs.readFileSync(file, 'utf8');
const before = html;

const attr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const text = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const IMG = /^((?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9._-]+\.(?:webp|png|jpe?g|gif)|https:\/\/[^\s"'<>]+)$/;
const absolute = u => /^https:/.test(u) ? u : SITE + u;

function setMeta(key, name, value) {
  if (!value) return;   // vacío = se conserva lo que ya tiene el HTML
  const re = new RegExp(`(<meta ${key}="${name}" content=")[^"]*(" />)`);
  if (re.test(html)) html = html.replace(re, `$1${attr(value)}$2`);
}

if (seo.title) html = html.replace(/<title>[^<]*<\/title>/, `<title>${text(seo.title)}</title>`);
setMeta('name', 'description', seo.description);
setMeta('property', 'og:title', seo.ogTitle || seo.title);
setMeta('property', 'og:description', seo.ogDescription || seo.description);
if (seo.ogImage && IMG.test(seo.ogImage)) setMeta('property', 'og:image', absolute(seo.ogImage));

// Indexación: si en el panel se desactiva, el HTML lleva noindex (lo respeta Google aunque no ejecute JavaScript).
const ROBOTS = '  <meta name="robots" content="noindex, nofollow" data-panel />\n';
html = html.replace(ROBOTS, '');
if (seo.index === false) html = html.replace(/(<meta name="viewport"[^>]*>\n)/, `$1${ROBOTS}`);

if (html !== before) {
  fs.writeFileSync(file, html);
  console.log('index.html actualizado con el SEO publicado.');
} else {
  console.log('El SEO de index.html ya coincide con lo publicado.');
}

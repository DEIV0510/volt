// Genera el SQL que depende del modelo de contenido (admin/js/schema.js):
//   supabase/migrations/20261026000300_content_schemas.sql → validación JSON Schema por sección
//   supabase/seed/seed.sql → contenido inicial, categorías, productos (desde la hoja original) e imágenes del repo
// Uso: node scripts/build-sql.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTENT, CONTENT_KEYS, contentSchema } from '../admin/js/schema.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const q = s => (s === null || s === undefined) ? 'null' : `'${String(s).replace(/'/g, "''")}'`;
const qi = n => (n === null || n === undefined || Number.isNaN(n)) ? 'null' : String(n);

/* ---------- 1. Esquemas de validación ---------- */
const schemaRows = CONTENT_KEYS.map(k =>
  `  (${q(k)}, ${q(CONTENT[k].label)}, ${q(JSON.stringify(contentSchema(k)))})`).join(',\n');
fs.writeFileSync(path.join(ROOT, 'supabase/migrations/20261026000300_content_schemas.sql'),
`-- Generado por scripts/build-sql.mjs a partir de admin/js/schema.js. No editar a mano.
insert into private.content_schemas (key, label, schema) values
${schemaRows}
on conflict (key) do update set label = excluded.label, schema = excluded.schema;
`);

/* ---------- 2. Datos iniciales ---------- */
const content = JSON.parse(fs.readFileSync(path.join(ROOT, 'supabase/seed/content.json'), 'utf8'));
for (const k of CONTENT_KEYS) if (!content[k]) throw new Error('Falta contenido inicial para ' + k);

function parseCSV(text) {
  const rows = []; let row = [], field = '', inQ = false;
  text = String(text).replace(/^﻿/, '').replace(/\r\n/g, '\n');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
    else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const money = s => { const n = parseInt(String(s).replace(/[^0-9]/g, ''), 10); return Number.isNaN(n) ? null : n; };

const CATS = [
  { code: 'cel', sheet: 'Celulares', name: 'Celulares', singular: 'Celular', icon: '📱' },
  { code: 'car', sheet: 'Cargadores', name: 'Cargadores', singular: 'Cargador', icon: '🔌' },
  { code: 'aud', sheet: 'Audífonos', name: 'Audífonos', singular: 'Audio', icon: '🎧' },
  { code: 'sw', sheet: 'Smartwatch', name: 'Smartwatch', singular: 'Smartwatch', icon: '⌚' },
  { code: 'vid', sheet: 'Vidrios Templados', name: 'Vidrios', singular: 'Vidrio templado', icon: '🛡️' },
  { code: 'for', sheet: 'Forros', name: 'Forros', singular: 'Forro', icon: '📲' },
  { code: 'acc', sheet: 'Accesorios', name: 'Accesorios', singular: 'Accesorio', icon: '🧰' }
];

const rows = parseCSV(fs.readFileSync(path.join(ROOT, 'supabase/seed/inventario-inicial.csv'), 'utf8'));
const head = rows[0].map(h => h.trim().toLowerCase());
const col = n => head.indexOf(n);
const order = {};
const products = [];
for (const r of rows.slice(1)) {
  const name = (r[col('nombre')] || '').trim();
  if (!name) continue;
  const cat = CATS.find(c => c.sheet === (r[col('categoria')] || '').trim());
  if (!cat) throw new Error('Categoría desconocida en la hoja: ' + r[col('categoria')]);
  const det = (r[col('detalle')] || '').trim();
  const priceTxt = (r[col('precio')] || '').trim();
  const [p1, p2] = priceTxt ? priceTxt.split(/[–-]/) : [];
  const stockTxt = (r[col('stock')] || '').trim();
  const show = (r[col('mostrar')] || 'si').trim().toLowerCase();
  order[cat.code] = (order[cat.code] || 0) + 10;
  products.push({
    cat: cat.code, name,
    brand: cat.code === 'cel' ? (det || null) : null,
    detail: cat.code === 'cel' ? 'Disponible a crédito o de contado' : (det || null),
    price: p1 ? money(p1) : null,
    price_max: p2 ? money(p2) : null,
    stock: stockTxt === '' ? null : parseInt(stockTxt, 10),
    active: ['si', 'sí', 'yes', 'true', '1', 'x', ''].includes(show),
    sort: order[cat.code]
  });
}

const repoImages = [
  ['img/cases.webp', 'iPhones con accesorios MagSafe', 'portada'],
  ['img/products.webp', 'iPhone disponible a crédito y de contado', 'productos'],
  ['img/store.webp', 'Vitrina con celulares y accesorios', 'productos'],
  ['img/laptop.webp', 'Portátiles para estudio y trabajo', 'productos'],
  ['img/tv.webp', 'Televisores para entretenimiento en casa', 'productos'],
  ['img/team.webp', 'Equipo de VOLT STORE CO atendiendo', 'galeria'],
  ['img/taller.webp', 'Servicio técnico de VOLT STORE CO', 'galeria'],
  ['img/logo.webp', 'VOLT STORE CO', 'marca'],
  ['img/logo.png', 'VOLT STORE CO', 'marca'],
  ['img/logo-white.webp', 'VOLT STORE CO', 'marca'],
  ['img/logo-white.png', 'VOLT STORE CO', 'marca'],
  ['img/og.jpg', 'VOLT STORE CO', 'marca'],
  ['img/og.webp', 'VOLT STORE CO', 'marca'],
  ['favicon.svg', 'Ícono VOLT', 'marca']
];
const mimeOf = f => ({ webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml' })[f.split('.').pop()];

let sql = `-- Generado por scripts/build-sql.mjs. Carga inicial (solo si las tablas están vacías).
begin;

insert into public.site_content (key, data)
select v.key, v.data::jsonb from (values
${CONTENT_KEYS.map(k => `  (${q(k)}, ${q(JSON.stringify(content[k]))})`).join(',\n')}
) as v(key, data)
on conflict (key) do nothing;

insert into public.site_published (key, data, draft_version)
select key, data, version from public.site_content
on conflict (key) do nothing;

insert into public.content_versions (key, data, draft_version, note)
select key, data, version, 'Contenido original de la página' from public.site_content
where not exists (select 1 from public.content_versions);

insert into public.categories (code, name, singular, icon, sort_order) values
${CATS.map((c, i) => `  (${q(c.code)}, ${q(c.name)}, ${q(c.singular)}, ${q(c.icon)}, ${(i + 1) * 10})`).join(',\n')}
on conflict (code) do nothing;

insert into public.products (category_id, name, brand, detail, price, price_max, stock, active, sort_order)
select c.id, v.name, v.brand, v.detail, v.price, v.price_max, v.stock, v.active, v.sort
from (values
${products.map(p => `  (${q(p.cat)}, ${q(p.name)}, ${q(p.brand)}, ${q(p.detail)}, ${qi(p.price)}, ${qi(p.price_max)}, ${qi(p.stock)}, ${p.active}, ${p.sort})`).join(',\n')}
) as v(cat, name, brand, detail, price, price_max, stock, active, sort)
join public.categories c on c.code = v.cat
where not exists (select 1 from public.products);

insert into public.media (url, filename, alt, folder, mime, source) values
${repoImages.map(([u, alt, folder]) => `  (${q(u)}, ${q(u.split('/').pop())}, ${q(alt)}, ${q(folder)}, ${q(mimeOf(u))}, 'repo')`).join(',\n')}
on conflict (url) do nothing;

commit;
`;
fs.writeFileSync(path.join(ROOT, 'supabase/seed/seed.sql'), sql);

const byCat = products.reduce((a, p) => (a[p.cat] = (a[p.cat] || 0) + 1, a), {});
console.log('Esquemas:', CONTENT_KEYS.length, '| Productos:', products.length, JSON.stringify(byCat),
  '| Con rango de precio:', products.filter(p => p.price_max).length, '| Sin precio:', products.filter(p => p.price === null).length);

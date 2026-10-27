// Genera api/lib/schemas.json (validación del servidor) a partir del modelo del panel (admin/js/schema.js).
// Ejecutar después de cambiar schema.js:  node scripts/build-schemas.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTENT_KEYS, contentSchema } from '../admin/js/schema.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = Object.fromEntries(CONTENT_KEYS.map(k => [k, contentSchema(k)]));
fs.writeFileSync(path.join(ROOT, 'api/lib/schemas.json'), JSON.stringify(out, null, 1) + '\n');
console.log('api/lib/schemas.json:', CONTENT_KEYS.length, 'secciones');

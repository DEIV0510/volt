/* Servidor estático mínimo para VOLT STORE CO (solo desarrollo).
   Uso: node serve.js [puerto]   → sitio en /, panel en /admin/
   Envía las mismas cabeceras de seguridad que .htaccess (producción en Hostinger),
   para detectar en local cualquier cosa que la política de seguridad bloquearía. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.argv[2]) || 5230;
const ROOT = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
// Igual que .htaccess (raíz) y admin/.htaccess.
const CSP_SITE = "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://rxdokvoljoxtficvbjhc.supabase.co; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'";
const CSP_ADMIN = "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob: https://rxdokvoljoxtficvbjhc.supabase.co; connect-src 'self' https://rxdokvoljoxtficvbjhc.supabase.co wss://rxdokvoljoxtficvbjhc.supabase.co; frame-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'";

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  const isAdmin = urlPath.startsWith('/admin/');
  const headers = {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': isAdmin ? 'DENY' : 'SAMEORIGIN',
    'Content-Security-Policy': isAdmin ? CSP_ADMIN : CSP_SITE,
  };
  fs.readFile(filePath, (err, data) => {
    if (err) {
      return fs.readFile(path.join(ROOT, '404.html'), (e2, page) => {
        res.writeHead(404, { ...headers, 'Content-Type': e2 ? 'text/plain' : MIME['.html'] });
        res.end(e2 ? '404 Not Found' : page);
      });
    }
    res.writeHead(200, { ...headers, 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`VOLT STORE CO → http://localhost:${PORT}  ·  panel: http://localhost:${PORT}/admin/`));

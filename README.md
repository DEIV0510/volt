# VOLT STORE CO ⚡

Landing page de **VOLT STORE CO**, tienda de tecnología y servicio técnico de celulares en **Convención, Norte de Santander, Colombia**.

Venta de celulares, iPhone (a crédito y de contado), portátiles, televisores, accesorios tecnológicos y servicio técnico.

## Panel de administración
Todo el contenido (textos, imágenes, WhatsApp, redes, catálogo de productos, colores, orden de secciones y SEO) se administra en **/admin**, con inicio de sesión y permisos verificados en el servidor (Supabase). Guía completa: **[ADMIN.md](ADMIN.md)**.

## Tecnología
HTML, CSS y JavaScript **vanilla** (sin frameworks). Tipografías Sora + Inter. Imágenes optimizadas a WebP.
Datos en Supabase (Postgres + Auth + Storage). En vivo dentro de WordPress (voltstoreco.com) mediante `wordpress/puente-wordpress.html`.

## Estructura
```
index.html      → estructura y contenido por defecto (el panel lo reemplaza con lo publicado)
styles.css      → estilos y diseño responsive
script.js       → contenido publicado, catálogo, loader, menú móvil, animaciones, galería
admin/          → panel de administración
supabase/       → migraciones, datos iniciales y pruebas de permisos
data/site.json  → copia diaria de lo publicado (plan B)
favicon.svg     → ícono (rayo)
img/            → imágenes optimizadas (.webp)
serve.js        → servidor estático para desarrollo
```

## Ver en local
```bash
node serve.js
# página: http://localhost:5230 · panel: http://localhost:5230/admin/
```

## Contacto
- WhatsApp: [317 107 6290](https://wa.me/573171076290)
- Instagram: [@voltstoreco](https://www.instagram.com/voltstoreco)
- TikTok: [@voltstoreco21](https://www.tiktok.com/@voltstoreco21)

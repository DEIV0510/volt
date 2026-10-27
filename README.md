# VOLT STORE CO ⚡

Landing page de **VOLT STORE CO**, tienda de tecnología y servicio técnico de celulares en **Convención, Norte de Santander, Colombia**.

Venta de celulares, iPhone (a crédito y de contado), portátiles, televisores, accesorios tecnológicos y servicio técnico.

## Panel de administración
Todo el contenido (textos, imágenes, WhatsApp, redes, catálogo de productos, colores, orden de secciones y SEO) se administra en **/admin**. El panel tiene su propio servidor en PHP (`api/`) con inicio de sesión, roles y permisos verificados en el servidor. Guía completa: **[ADMIN.md](ADMIN.md)**.

## Tecnología
HTML, CSS y JavaScript **vanilla** (sin frameworks). Tipografías Sora + Inter. Imágenes optimizadas a WebP.
Panel con API en PHP 8 + SQLite (sin dependencias). Todo en Hostinger (voltstoreco.com), publicado desde GitHub; panel en voltstoreco.com/admin.

## Estructura
```
index.html      → estructura y contenido por defecto (el panel lo reemplaza con lo publicado)
index.php       → portada con el SEO publicado en el HTML
styles.css      → estilos y diseño responsive
script.js       → contenido publicado, catálogo, loader, menú móvil, animaciones, galería
admin/          → panel de administración
api/            → servidor del panel (PHP + SQLite)
.htaccess       → seguridad, caché y redirecciones en Hostinger
favicon.svg     → ícono (rayo)
img/            → imágenes optimizadas (.webp)
scripts/        → servidor de desarrollo y generador de validaciones
tests/          → pruebas de la API
```

## Ver en local
```bash
php -S localhost:5230 scripts/dev-router.php
# página: http://localhost:5230 · panel: http://localhost:5230/admin/
```

## Contacto
- WhatsApp: [317 107 6290](https://wa.me/573171076290)
- Instagram: [@voltstoreco](https://www.instagram.com/voltstoreco)
- TikTok: [@voltstoreco21](https://www.tiktok.com/@voltstoreco21)

# Panel de administración — VOLT STORE CO

Panel privado para editar toda la página sin tocar el código: textos, imágenes, botones, WhatsApp, redes, catálogo, colores, orden de secciones y SEO. **Todo vive en el mismo código y en el mismo hosting (Hostinger)**: no depende de WordPress ni de servicios externos.

- **Página:** https://voltstoreco.com
- **Panel:** https://voltstoreco.com/admin/
- **Servidor del panel:** `api/` (PHP 8 + SQLite, sin dependencias)
- **Datos:** carpeta `volt-data/`, **fuera de `public_html`** (no se puede abrir desde internet)

## Cómo funciona

```
voltstoreco.com/admin  ──▶  /api (PHP)  ──▶  volt-data/volt.sqlite   (fuera de public_html)
                              │                volt-data/publico.json (lo publicado, ya armado)
                              │                volt-data/respaldos/   (copias automáticas)
voltstoreco.com  ◀── lee ── /api/?a=public          uploads/            (imágenes subidas)
```

1. Editas una sección → **Guardar borrador**. Los visitantes todavía no lo ven.
2. **Vista previa** muestra la página real con tus cambios, en vivo mientras escribes.
3. **Publicar** pasa el borrador a lo publicado en una sola transacción, guarda una versión y hace una copia automática.
4. La página lee lo publicado al cargar y cada 3 minutos. La portada (`index.php`) incluye en el HTML el título, la descripción y la imagen del SEO publicado, que es lo que leen Google, WhatsApp y Facebook.

Los **productos y categorías** se aplican al guardar, como antes con la hoja. Para preparar un producto sin mostrarlo, desactiva «Visible». La hoja de Google ya no se usa: los 234 productos se migraron con sus precios, stock y orden (`api/seed/`).

## Primera vez: crear la cuenta del propietario

1. Entra a https://voltstoreco.com/admin/. Aparece **«Primera configuración»**.
2. En hPanel → **Administrador de archivos**, abre la carpeta `volt-data` (está al lado de `public_html`) y el archivo `clave-instalacion.txt`. Copia la clave.
3. Pégala en el panel, escribe tu correo y una contraseña (mínimo 10 caracteres, con letras y números) y pulsa **Crear cuenta de propietario**.

La clave se borra al usarla. Nadie puede registrarse desde internet: solo quien puede abrir los archivos del hosting crea la primera cuenta, y luego el propietario crea las demás en **Usuarios**.

**¿Olvidaste la contraseña?** En la pantalla de acceso usa **«¿Olvidaste tu contraseña?» → Generar clave de recuperación**. El servidor deja la clave en `volt-data/clave-recuperacion.txt` (vale 30 minutos). Cópiala desde hPanel y elige una contraseña nueva. Así no hace falta correo.

## Roles y seguridad

| Rol | Puede |
|---|---|
| **Propietario** | Todo, más crear, cambiar o quitar usuarios y restaurar respaldos |
| **Editor** | Contenido, catálogo, imágenes, diseño, publicar, historial y descargar respaldos |

- **Autorización en el servidor:** cada operación de `/api` verifica la sesión, el rol y un token CSRF, y en las escrituras también el origen de la petición. Ocultar botones no es la protección.
- **Sesión:** cookie `HttpOnly`, `Secure` y `SameSite=Strict`. Se renueva al entrar, se cierra a los 30 minutos sin actividad y como máximo a las 12 horas. «Cerrar sesión en todos los dispositivos» y cambiar la contraseña invalidan las demás sesiones.
- **Contraseñas:** se guardan con Argon2id (o bcrypt si no está disponible), nunca en texto.
- **Intentos de acceso:** tras 5 intentos fallidos con el mismo correo e IP (o 20 desde una IP) se bloquea 15 minutos. Ante un correo inexistente se responde con el mismo mensaje genérico.
- **Validación:** el contenido de cada sección se valida en el servidor con el mismo modelo que el panel (`admin/js/schema.js` → `api/lib/schemas.json`): largos máximos, colores `#RRGGBB`, enlaces solo `#sección`, `https://`, `mailto:` o `tel:` (se rechaza `javascript:` y similares) y ningún campo desconocido. Productos, categorías e imágenes tienen sus propias reglas. Todas las consultas a la base de datos usan parámetros preparados.
- **Sin inyección de código:** la página escapa todo el texto del panel. El diseño solo acepta opciones de una lista cerrada, sin CSS libre.
- **Cabeceras** (`.htaccess`, `admin/.htaccess`): CSP estricta (solo scripts y conexiones del propio sitio), `nosniff`, HSTS y protección contra incrustar el sitio en otra página. El panel, además, va sin indexar y sin caché.
- **Archivos privados:** `api/lib`, `api/seed`, `.git`, `tests/` y `scripts/` responden 404, y los datos están fuera de `public_html`.
- **Ediciones simultáneas:** si dos personas editan lo mismo, la segunda recibe un aviso en vez de pisar los cambios de la primera.
- **Historial:** cada cambio en contenido, productos, categorías, imágenes y usuarios queda registrado (quién, cuándo, antes y después), sin contraseñas.
- **Secretos:** no hay ninguno en el código. Las contraseñas de los administradores están en la base de datos (cifradas). La única credencial externa es la del FTP de publicación, guardada en los *Secrets* de GitHub.

## Imágenes

- Se suben desde **Medios** o desde cualquier campo de imagen. El navegador las reduce (máx. 2000 px) y el **servidor las vuelve a codificar a WebP con GD**, lo que descarta cualquier contenido que no sea imagen. Se aceptan JPG, PNG, WebP, GIF e ICO; no SVG.
- Se guardan en `uploads/`. Esa carpeta no ejecuta PHP ni scripts (`.htaccess` propio).
- **No se puede borrar una imagen en uso**: el servidor lo impide e indica dónde se usa. **Reemplazar** cambia la imagen en todo el contenido (en borrador) y en los productos.
- Las imágenes originales del sitio (`img/`) aparecen como «Original» y no se pueden borrar desde el panel.

## Respaldos

- **Automáticos:** cada vez que publicas, restauras una versión o importas, el servidor guarda una copia completa en `volt-data/respaldos/` y conserva las últimas 30.
- **Manual:** **Panel → Respaldos → Descargar** genera un JSON con el contenido (borrador y publicado), el diseño, el SEO, las categorías, los productos y la lista de imágenes.
- **Restaurar** (solo propietario): es todo o nada. Si un dato no es válido, no se cambia nada. El contenido entra como borrador y hay que escribir RESTAURAR para confirmar.
- **Versiones:** cada publicación guarda una versión por sección, que se puede restaurar como borrador.
- **No incluidos en el JSON:** los archivos de imagen (`uploads/`). Para un respaldo total descarga también `volt-data/` y `uploads/` desde hPanel (*Archivos → Copias de seguridad*).

## Publicar cambios de código

Cada push a `main` en `DEIV0510/volt` dispara **«Publicar en Hostinger»** (`.github/workflows/publicar-hostinger.yml`). La acción sube por FTP cifrado solo los archivos que cambiaron. Nunca toca `volt-data/` ni `uploads/`, y no sube `tests/`, `scripts/` ni `data/`. (El despliegue Git de hPanel no está disponible porque la cuenta se administra como cliente.)

Si un cambio no se ve, purga la caché en hPanel → *Rendimiento → CDN*. Los cambios de contenido no requieren nada de esto: se hacen en el panel.

### Configuración inicial (una sola vez)

1. **Respaldo de WordPress:** hPanel → voltstoreco.com → *Archivos → Copias de seguridad* → generar o descargar una copia.
2. **Cuenta FTP para GitHub:** *Archivos → Cuentas FTP* → crear una cuenta (por ejemplo `github`) con una contraseña larga y la carpeta `public_html`.
3. **Secretos en GitHub:** `DEIV0510/volt` → *Settings → Secrets and variables → Actions → New repository secret*:
   - `FTP_SERVER` = `147.93.42.15`
   - `FTP_USERNAME` = el usuario completo que muestra hPanel (por ejemplo `u665025194.github`)
   - `FTP_PASSWORD` = su contraseña

   Si esa cuenta no apunta directo a `public_html`, crea también la *variable* `FTP_DIR` con `public_html/`.
4. **Sacar WordPress de `public_html`:** en el *Administrador de archivos* crea `wordpress-respaldo` **fuera** de `public_html` y mueve allí todo su contenido (incluido `.htaccess`). Desde aquí la página queda en blanco hasta el paso 5.
5. **Primera publicación:** GitHub → *Actions → «Publicar en Hostinger» → Run workflow* (uno o dos minutos).
6. **HTTPS y caché:** *Seguridad → SSL* (certificado activo y *Forzar HTTPS* encendido) y *Rendimiento → CDN → Purgar toda la caché*.
7. **Crear el propietario:** abre https://voltstoreco.com/admin/ y sigue «Primera vez» (arriba). El primer acceso crea `volt-data/` con la base de datos y la clave.
8. **Comprobar** la página, el panel y las direcciones antiguas (`/contact/`, `/shop-2/`…). Cuando todo esté bien, la base de datos de WordPress y la carpeta `wordpress-respaldo` se pueden borrar más adelante.

Si el FTP cifrado falla (error de TLS en la acción), cambia `protocol: ftps` por `protocol: ftp` en el flujo.

## Desarrollo y pruebas

```bash
php -S localhost:5230 scripts/dev-router.php
# página: http://localhost:5230 · panel: http://localhost:5230/admin/
node tests/api-test.mjs http://localhost:5230 ../volt-data-dev
```

- `scripts/dev-router.php` imita el `.htaccess` (cabeceras, rutas y bloqueos) y guarda los datos en `../volt-data-dev`.
- `tests/api-test.mjs` recorre 82 pruebas de la API en una instalación local nueva (borra antes `../volt-data-dev`):
  - instalación, sesión, CSRF y origen;
  - validaciones, conflictos, publicación y SEO;
  - catálogo e imágenes (incluidos archivos maliciosos);
  - roles, respaldos atómicos, bloqueo por intentos, recuperación e historial.
- Si cambias `admin/js/schema.js`, ejecuta `node scripts/build-schemas.mjs` para regenerar la validación del servidor.

## Archivos

| Ruta | Qué es |
|---|---|
| `index.html`, `styles.css`, `script.js`, `img/` | La página (contenido por defecto, estilos, lectura de lo publicado e interacciones) |
| `index.php` | Entrega `index.html` con el SEO publicado en el `<head>` |
| `admin/` | Panel (HTML, CSS y módulos JS sin frameworks) |
| `admin/js/schema.js` | Modelo de contenido: genera los formularios y la validación del servidor |
| `api/index.php` | API: rutas, permisos, CSRF y errores |
| `api/lib/` | Núcleo (base de datos, sesión, validación, operaciones, imágenes) |
| `api/seed/` | Contenido y catálogo iniciales (los de la página al migrar) |
| `.htaccess`, `admin/.htaccess`, `api/.htaccess` | Seguridad, caché, redirecciones de WordPress y bloqueos |
| `404.html`, `robots.txt`, `sitemap.xml` | Página de error y archivos para buscadores |
| `.github/workflows/publicar-hostinger.yml` | Publicación por FTP |
| `scripts/`, `tests/` | Desarrollo y pruebas (no se publican) |
| `data/site.json` | Copia de lo publicado que usa la página mientras siga en WordPress (no se sube a Hostinger) |

## Límites conocidos

- WhatsApp y Facebook guardan en caché la vista previa de un enlace durante un tiempo: un cambio de SEO puede tardar en verse allí.
- La página no tiene formularios propios (todo el contacto es por WhatsApp), así que no hay módulo de formularios. Los mensajes de WhatsApp de cada botón sí se editan.
- No hay variantes de producto (tallas o colores) porque el catálogo actual no las usa. Las opciones se describen en «Descripción» o «Características».

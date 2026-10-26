# Panel de administración — VOLT STORE CO

Panel privado para editar toda la página (textos, imágenes, botones, WhatsApp, redes, catálogo, colores, orden de secciones y SEO) sin tocar el código.

- **Panel:** https://deiv0510.github.io/volt/admin/ (en local: `node serve.js` → http://localhost:5230/admin/)
- **Página pública:** https://voltstoreco.com (WordPress) — también funciona sola con `index.html`
- **Base de datos, inicio de sesión e imágenes:** Supabase, proyecto `volt-store` (`rxdokvoljoxtficvbjhc`, plan gratuito)

## Cómo funciona

```
Panel (/admin)  ──guarda──▶  Supabase (Postgres + Auth + Storage)  ◀──lee lo publicado──  Página (script.js)
                             · RLS y funciones verifican el rol en CADA operación
                             · borradores ≠ publicado; historial y versiones
```

1. Editas una sección → **Guardar borrador** (los visitantes todavía no lo ven).
2. **Vista previa** muestra la página real con tus cambios (en vivo mientras escribes).
3. **Publicar** copia el borrador a lo publicado en una sola transacción y guarda una versión.
4. La página lee `get_public_site()` (solo lo publicado y los productos visibles) al cargar y cada 3 minutos.

Los **productos y categorías** se aplican al guardar (como antes con la hoja). Para preparar un producto sin mostrarlo, desactiva «Visible».

La página **ya no usa la hoja de Google**. Los 234 productos se migraron a la base de datos el 26/10/2026 (`supabase/seed/inventario-inicial.csv` guarda la copia exacta de la hoja en ese momento).

## Primer administrador (una sola vez)

Nadie puede registrarse desde el panel. Para crear la cuenta del propietario:

1. Entra a [Supabase → Authentication → Users](https://supabase.com/dashboard/project/rxdokvoljoxtficvbjhc/auth/users) → **Add user** → **Create new user**.
   Escribe el correo y una contraseña segura (mín. 10 caracteres, letras y números) y marca **Auto Confirm User**.
2. En [SQL Editor](https://supabase.com/dashboard/project/rxdokvoljoxtficvbjhc/sql/new) ejecuta (cambiando el correo):
   ```sql
   insert into public.admin_users (user_id, email, role)
   select id, email, 'owner' from auth.users where email = 'correo@ejemplo.com';
   ```
3. Entra al panel con ese correo. Los siguientes usuarios se agregan desde **Panel → Usuarios** (después de crear su cuenta en el paso 1).

**Muy recomendado:** en [Authentication → Sign In / Providers](https://supabase.com/dashboard/project/rxdokvoljoxtficvbjhc/auth/providers) desactiva **Allow new users to sign up**. Aunque alguien lograra registrarse, no tendría permisos (no está en `admin_users`), pero así ni siquiera puede crear la cuenta.

Para que funcione «¿Olvidaste tu contraseña?» en [Authentication → URL Configuration](https://supabase.com/dashboard/project/rxdokvoljoxtficvbjhc/auth/url-configuration) pon como **Site URL** `https://deiv0510.github.io/volt/admin/` y agrégala en **Redirect URLs**. El correo integrado de Supabase solo envía unos pocos mensajes por hora; para uso intensivo configura un SMTP propio (Authentication → Emails → SMTP Settings).

## Roles y seguridad

| Rol | Puede |
|---|---|
| **Propietario** (`owner`) | Todo, más administrar usuarios y restaurar respaldos |
| **Editor** (`editor`) | Contenido, catálogo, imágenes, diseño, publicar, ver historial, descargar respaldos |
| Cualquier otra cuenta | Nada: ve el aviso «Sin permisos» |

- La autorización se verifica **en el servidor**: políticas RLS en cada tabla y en el bucket de imágenes, y las funciones (`save_draft`, `publish_content`, `import_site`, etc.) comprueban el rol antes de actuar. Ocultar botones no es la protección.
- Los visitantes (rol `anon`) solo pueden leer lo publicado y los productos visibles. No ven borradores, historial ni usuarios, y no pueden escribir nada.
- Cada guardado se valida en la base de datos con JSON Schema (generado desde `admin/js/schema.js`): largos máximos, colores `#RRGGBB`, enlaces solo `#sección`, `https://`, `mailto:` o `tel:` (se rechaza `javascript:` y similares) y ningún campo desconocido.
- La página pública escapa todo el texto (no admite HTML ni scripts desde el panel). El diseño solo acepta opciones de una lista cerrada (sin CSS libre).
- Sesión: solo en esa pestaña (`sessionStorage`), se cierra tras 30 minutos sin actividad y al cerrar la pestaña. Tras 5 intentos fallidos se bloquea el formulario 60 s, y Supabase además limita los intentos por IP.
- El panel tiene una política CSP estricta (solo scripts propios; conexiones solo a Supabase) y `noindex`.
- La clave que aparece en el código (`sb_publishable_…`) es **pública por diseño**. La clave secreta (`service_role`) **no se usa en ningún archivo** y no debe ponerse nunca en el frontend.
- **Ediciones simultáneas:** si dos personas editan lo mismo, la segunda recibe un aviso en lugar de pisar los cambios de la primera.
- **Registro:** cada cambio en contenido, productos, categorías, imágenes y usuarios queda en **Historial** (quién, cuándo, antes y después), mediante disparadores de la base de datos. No se puede editar ni borrar desde la API.

## Imágenes

- Se suben desde **Medios** o desde cualquier campo de imagen. El navegador las redimensiona (máx. 2000 px) y las convierte a WebP antes de subirlas. El servidor acepta solo JPG, PNG, WebP, GIF e ICO de hasta 5 MB (sin SVG, que puede contener scripts).
- Se guardan en Supabase Storage (bucket público `media`). Solo los administradores pueden subir, cambiar o borrar.
- **No se puede borrar una imagen en uso** (contenido en borrador o publicado, o productos). Lo impide el servidor y el panel explica dónde se usa.
- **Reemplazar** sube la nueva y la cambia en todo el contenido (en borrador; luego publicas) y en los productos.
- Las imágenes originales del sitio (`img/…` en GitHub) aparecen como «Original» y no se pueden borrar desde el panel.

## Respaldos

- **Panel → Respaldos → Descargar** genera un JSON con todo el contenido (borrador y publicado), diseño, SEO, categorías, productos y la lista de imágenes.
- **Restaurar** (solo propietario): es todo o nada. El contenido entra como borrador, las imágenes nunca se borran y hay que escribir RESTAURAR para confirmar.
- **Automático:** cada día GitHub Actions guarda lo publicado en `data/site.json` (`.github/workflows/copia-diaria.yml`). Esa copia también es el plan B de la página si Supabase no responde.
- **No incluidos en el JSON:** los archivos de imagen (están en Supabase Storage y en `img/` de GitHub). Para un respaldo completo de la base de datos usa Supabase → Database → Backups (el plan gratuito no guarda copias automáticas).
- **Historial de versiones:** cada publicación guarda una versión por sección, que se puede restaurar como borrador.

## Despliegue

1. **Código:** al subir a `main` en `DEIV0510/volt`:
   - jsDelivr sirve `index.html`, `styles.css` y `script.js` a WordPress (su caché tarda hasta 12 h; se fuerza con `https://purge.jsdelivr.net/gh/DEIV0510/volt@main/script.js`, y lo mismo con `styles.css` e `index.html`);
   - `.github/workflows/pages.yml` publica el panel en GitHub Pages.
2. **GitHub Pages (una vez):** Settings → Pages → Source: **GitHub Actions**.
3. **WordPress (una vez):** reemplaza el contenido del bloque HTML de la página de inicio (ID 974) por `wordpress/puente-wordpress.html`. Es el mismo puente de antes, pero sin la hoja de Google, y con una marca horaria en los archivos: jsDelivr deja que los navegadores los guarden hasta 7 días, y así nadie ve una versión de más de una hora. Mientras no se cambie, la página igual muestra el catálogo del panel, porque `script.js` vuelve a dibujarlo si el puente viejo lo reemplaza.
4. **Base de datos:** las migraciones están en `supabase/migrations/` y ya se aplicaron al proyecto. Si cambias `admin/js/schema.js`, ejecuta `node scripts/build-sql.mjs` y aplica la migración `…_content_schemas.sql` que se regenera.

## Variables y configuración

Es un sitio estático, así que **no hay secretos ni variables de entorno en el frontend**:

| Dónde | Qué | ¿Secreto? |
|---|---|---|
| `admin/js/config.js`, `script.js`, `copia-diaria.yml` | URL de Supabase y clave `sb_publishable_…` | No (pública por diseño; RLS protege los datos) |
| Panel de Supabase | Clave `service_role`, contraseña de la base de datos | **Sí**: nunca en el código |

## Archivos

| Ruta | Qué es |
|---|---|
| `admin/` | Panel (HTML, CSS y módulos JS sin frameworks; `vendor/` trae supabase-js 2.117.3, verificado contra npm) |
| `admin/js/schema.js` | Modelo de contenido: genera los formularios y la validación del servidor |
| `script.js` | Página pública: lee lo publicado y lo aplica, con catálogo, interacciones y vista previa |
| `styles.css` | Estilos de la página, más las opciones de diseño del panel |
| `supabase/migrations/` | Esquema, seguridad (RLS), funciones y validación |
| `supabase/seed/` | Contenido inicial y copia de la hoja migrada |
| `supabase/tests/permisos.sql` | Pruebas de permisos por rol (se ejecutan y se deshacen solas) |
| `tests/panel-simulado.html` | El panel real con un servidor simulado en memoria, para probar la interfaz sin tocar los datos reales (acceso: `admin@volt.test` / `prueba-local`, solo en local) |
| `tests/pagina-publica.html` | La página pública con contenido de prueba: tema, secciones ocultas, producto con galería e intentos de inyectar HTML |
| `wordpress/puente-wordpress.html` | Bloque para la página de WordPress |
| `data/site.json` | Copia diaria de lo publicado (plan B) |

## Límites conocidos

- **SEO en WordPress:** el `<head>` real lo genera WordPress. El panel aplica título, descripción, Open Graph e indexación con JavaScript (Google sí los lee). Las vistas previas de WhatsApp y Facebook siguen usando lo que configura WordPress. Si el «Título SEO» queda vacío, se conserva el de WordPress.
- **Plan gratuito de Supabase:** se pausa tras ~7 días sin uso. La copia diaria lo mantiene activo y, si aun así se pausa, la página muestra la última copia (`data/site.json`). Se reactiva desde el panel de Supabase.
- **Correo de recuperación:** usa el SMTP integrado de Supabase, que tiene límites. Ver «Primer administrador».
- La página no tiene formularios propios (todo el contacto es por WhatsApp), así que no hay módulo de formularios. Los mensajes de WhatsApp de cada botón sí se editan.
- No hay variantes de producto (tallas o colores) porque el catálogo actual no las usa. Las opciones se describen en «Descripción» o «Características».

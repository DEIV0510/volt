/* Configuración del panel. No hay claves ni secretos: el panel habla solo con el
   servidor del propio sitio (/api), que verifica la sesión y el rol en cada operación. */
export const SITE_URL = 'https://voltstoreco.com/';
// Raíz del sitio (voltstoreco.com o local): imágenes img/… y uploads/…, y vista previa.
export const REPO_BASE = new URL('../', location.href).href;
export const PREVIEW_URL = new URL('../index.html?preview=1', location.href).href;

export const IDLE_MINUTES = 30;        // cierre de sesión por inactividad (el servidor también lo aplica)
export const LOGIN_MAX_FAILS = 5;      // bloqueo temporal en este navegador (el servidor además limita por IP y correo)
export const LOGIN_LOCK_SECONDS = 60;

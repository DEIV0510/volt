/* Configuración del panel. Nada de esto es secreto:
   - la URL y la clave "publishable" de Supabase son públicas por diseño;
   - la seguridad la imponen las políticas RLS y las funciones de la base de datos,
     que verifican en el servidor el rol de quien inicia sesión. */
export const SUPABASE_URL = 'https://rxdokvoljoxtficvbjhc.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_Sv34Sje2NPVUZEpAWDpzuw_L5X2w7_H';
export const SUPABASE_DASHBOARD = 'https://supabase.com/dashboard/project/rxdokvoljoxtficvbjhc';

export const SITE_URL = 'https://voltstoreco.com/';
// Raíz del sitio servida junto al panel (voltstoreco.com o local): imágenes img/… y vista previa.
export const REPO_BASE = new URL('../', location.href).href;
export const PREVIEW_URL = new URL('../index.html?preview=1', location.href).href;
export const STORAGE_PUBLIC = SUPABASE_URL + '/storage/v1/object/public/media/';

export const IDLE_MINUTES = 30;        // cierre de sesión por inactividad
export const LOGIN_MAX_FAILS = 5;      // bloqueo temporal en este navegador (el servidor además limita por IP)
export const LOGIN_LOCK_SECONDS = 60;

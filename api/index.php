<?php
/* =====================================================================
   VOLT STORE CO — API del panel: /api/?a=<acción>
   Cada acción declara método y permiso. Antes de ejecutarla se verifica:
   sesión válida, rol, token CSRF y origen de la petición (para escrituras).
   ===================================================================== */
declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/validate.php';
require __DIR__ . '/lib/site.php';
require __DIR__ . '/lib/actions.php';
require __DIR__ . '/lib/deploy.php';

// acción => [método, permiso, función, cuerpo]
// permiso: null = público · 'any' = administrador con sesión · 'owner' = solo propietario
// cuerpo: 'json' (arreglos) · 'obj' (objetos, para contenido) · 'form' (subida de archivos) · null
const ROUTES = [
  'public'             => ['GET',  null,    'serve_public',         null],
  'status'             => ['GET',  null,    'act_status',           null],
  'setup'              => ['POST', null,    'act_setup',            'json'],
  'login'              => ['POST', null,    'act_login',            'json'],
  'recover_start'      => ['POST', null,    'act_recover_start',    null],
  'recover'            => ['POST', null,    'act_recover',          'json'],
  'deploy'             => ['POST', null,    'act_deploy',           null],   // instala el último main de GitHub (ver lib/deploy.php)
  'logout'             => ['POST', 'any',   'act_logout',           null],
  'me'                 => ['GET',  'any',   'act_me',               null],
  'logout_all'         => ['POST', 'any',   'act_logout_all',       null],
  'change_password'    => ['POST', 'any',   'act_change_password',  'json'],
  'overview'           => ['GET',  'any',   'overview',             null],
  'preview'            => ['GET',  'any',   'preview_site',         null],
  'drafts'             => ['GET',  'any',   'act_drafts',           null],
  'published'          => ['GET',  'any',   'act_published',        null],
  'content'            => ['GET',  'any',   'act_content',          'query'],
  'save_draft'         => ['POST', 'any',   'act_save_draft',       'obj'],
  'publish'            => ['POST', 'any',   'act_publish',          'json'],
  'discard'            => ['POST', 'any',   'act_discard',          'json'],
  'versions'           => ['GET',  'any',   'act_versions',         'query'],
  'version'            => ['GET',  'any',   'act_version',          'query'],
  'restore_version'    => ['POST', 'any',   'act_restore_version',  'json'],
  'audit'              => ['GET',  'any',   'act_audit',            'query'],
  'categories'         => ['GET',  'any',   'act_categories',       null],
  'category_save'      => ['POST', 'any',   'act_category_save',    'json'],
  'category_delete'    => ['POST', 'any',   'act_category_delete',  'json'],
  'categories_reorder' => ['POST', 'any',   'act_categories_reorder', 'json'],
  'products'           => ['GET',  'any',   'act_products',         null],
  'product_save'       => ['POST', 'any',   'act_product_save',     'json'],
  'products_update'    => ['POST', 'any',   'act_products_update',  'json'],
  'products_delete'    => ['POST', 'any',   'act_products_delete',  'json'],
  'products_reorder'   => ['POST', 'any',   'act_products_reorder', 'json'],
  'media'              => ['GET',  'any',   'act_media',            null],
  'media_usage'        => ['GET',  'any',   'act_media_usage',      'query'],
  'media_upload'       => ['POST', 'any',   'act_media_upload',     'form'],
  'media_update'       => ['POST', 'any',   'act_media_update',     'json'],
  'media_delete'       => ['POST', 'any',   'act_media_delete',     'json'],
  'media_replace'      => ['POST', 'any',   'act_media_replace',    'json'],
  'export'             => ['GET',  'any',   'act_export',           null],
  'import'             => ['POST', 'owner', 'act_import',           'obj'],
  'users'              => ['GET',  'owner', 'act_users',            null],
  'user_create'        => ['POST', 'owner', 'act_user_create',      'json'],
  'user_update'        => ['POST', 'owner', 'act_user_update',      'json'],
  'user_password'      => ['POST', 'owner', 'act_user_password',    'json'],
  'user_delete'        => ['POST', 'owner', 'act_user_delete',      'json'],
];

function respond(int $status, mixed $payload): never {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  header('X-Content-Type-Options: nosniff');
  echo jenc($payload);
  exit;
}

// Las escrituras solo se aceptan desde el propio sitio (además del token CSRF).
function check_same_origin(): void {
  $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
  if ($origin === '') return;   // algunos navegadores no lo envían en peticiones del mismo origen
  $host = $_SERVER['HTTP_HOST'] ?? '';
  if (parse_url($origin, PHP_URL_HOST) . (parse_url($origin, PHP_URL_PORT) ? ':' . parse_url($origin, PHP_URL_PORT) : '') !== $host) {
    fail(403, 'Petición rechazada: origen no permitido.', 'bad_origin');
  }
}

try {
  $action = (string)($_GET['a'] ?? '');
  if (!isset(ROUTES[$action])) fail(404, 'Acción desconocida.', 'not_found');
  [$method, $perm, $fn, $bodyType] = ROUTES[$action];
  if ($_SERVER['REQUEST_METHOD'] !== $method) fail(405, 'Método no permitido.', 'method');
  if ($action === 'public') serve_public();

  if ($method === 'POST') check_same_origin();
  $user = null;
  if ($perm !== null) {
    $user = current_user();
    if (!$user) fail(401, 'Tu sesión expiró o no has iniciado sesión.', 'unauthenticated');
    if ($perm === 'owner' && $user['role'] !== 'owner') fail(403, 'No autorizado: esta acción es solo para el propietario.', 'forbidden');
    if ($method === 'POST' && !hash_equals($_SESSION['csrf'] ?? '', (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
      fail(403, 'La sesión no es válida para esta acción. Recarga la página.', 'csrf');
    }
  }

  $args = [];
  if ($perm !== null) $args[] = $user;
  if ($bodyType === 'json' || $bodyType === 'obj') {
    $raw = file_get_contents('php://input', false, null, 0, 12 * 1024 * 1024) ?: '';
    if (strlen($raw) >= 12 * 1024 * 1024) fail(413, 'La petición es demasiado grande.', 'too_large');
    try { $body = $raw === '' ? ($bodyType === 'obj' ? new stdClass() : []) : json_decode($raw, $bodyType === 'json', 64, JSON_THROW_ON_ERROR); }
    catch (JsonException) { fail(400, 'Datos con formato incorrecto.', 'invalid'); }
    if ($bodyType === 'json' && !is_array($body)) fail(400, 'Datos con formato incorrecto.', 'invalid');
    if ($bodyType === 'obj' && !($body instanceof stdClass)) fail(400, 'Datos con formato incorrecto.', 'invalid');
    $args[] = $body;
  } elseif ($bodyType === 'query') {
    $args[] = $_GET;
  }
  respond(200, ['data' => $fn(...$args)]);
} catch (VoltError $e) {
  respond($e->status, ['error' => $e->getMessage(), 'code' => $e->errorCode] + $e->extra);
} catch (Throwable $e) {
  try { log_error($e); } catch (Throwable) { /* sin registro disponible */ }
  respond(500, ['error' => 'Ocurrió un error en el servidor. Inténtalo de nuevo.', 'code' => 'server']);
}

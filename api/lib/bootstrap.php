<?php
/* =====================================================================
   VOLT STORE CO — núcleo del servidor del panel (PHP + SQLite, sin dependencias).
   - Los datos viven en la carpeta "volt-data", FUERA de public_html (no accesible por web).
   - Toda operación administrativa exige sesión válida, rol y token CSRF (ver index.php).
   ===================================================================== */
declare(strict_types=1);

const IDLE_SECONDS = 1800;        // la sesión se cierra tras 30 min sin actividad
const MAX_SESSION_SECONDS = 43200; // y como máximo a las 12 h
const LOGIN_WINDOW = 900;         // ventana para contar intentos fallidos (15 min)

final class VoltError extends Exception {
  public function __construct(public int $status, string $message, public string $errorCode = '', public array $extra = []) {
    parent::__construct($message);
  }
}
function fail(int $status, string $message, string $code = '', array $extra = []): never {
  throw new VoltError($status, $message, $code, $extra);
}

/* ---------- rutas ---------- */
function site_root(): string { return dirname(__DIR__, 2); }          // public_html
function data_dir(): string {
  static $dir = null;
  if ($dir !== null) return $dir;
  $env = getenv('VOLT_DATA_DIR');
  $candidates = $env ? [$env] : [dirname(__DIR__, 3) . '/volt-data', dirname(__DIR__) . '/data-privada'];
  foreach ($candidates as $c) {
    if ((is_dir($c) || @mkdir($c, 0700, true)) && is_writable($c)) { $dir = $c; break; }
  }
  if ($dir === null) fail(500, 'No se pudo crear la carpeta de datos del panel. Revisa los permisos del hosting.');
  // Por si quedara dentro del sitio, nada en ella es accesible por web.
  if (!is_file($dir . '/.htaccess')) @file_put_contents($dir . '/.htaccess', "Require all denied\n");
  return $dir;
}
function data_dir_hint(): string {
  $d = str_replace('\\', '/', data_dir());
  return str_ends_with($d, '/data-privada') ? 'public_html/api/data-privada' : 'volt-data (al lado de public_html)';
}

/* ---------- utilidades ---------- */
function now(): string { return gmdate('Y-m-d\TH:i:s\Z'); }
function uuid(): string {
  $b = random_bytes(16);
  $b[6] = chr((ord($b[6]) & 0x0f) | 0x40); $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
  return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}
function jenc(mixed $v): string { return json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR); }
function jdec(?string $s, bool $assoc = true): mixed { return $s === null ? null : json_decode($s, $assoc, 512, JSON_THROW_ON_ERROR); }
// JSON con las claves ordenadas: el mismo contenido siempre produce el mismo texto.
function jcanon(mixed $v): string {
  $sort = function (mixed $x) use (&$sort): mixed {
    if ($x instanceof stdClass) {
      $a = get_object_vars($x); ksort($a, SORT_STRING); $o = new stdClass();
      foreach ($a as $k => $y) $o->$k = $sort($y);
      return $o;
    }
    return is_array($x) ? array_map($sort, $x) : $x;
  };
  return jenc($sort($v));
}
function write_atomic(string $file, string $content): void {
  $tmp = $file . '.' . bin2hex(random_bytes(4)) . '.tmp';
  if (file_put_contents($tmp, $content, LOCK_EX) === false || !rename($tmp, $file)) {
    @unlink($tmp);
    fail(500, 'No se pudo guardar un archivo del panel.');
  }
}
function is_https(): bool {
  return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || strtolower($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}
function client_ip(): string {
  // Detrás del CDN de Hostinger, la última IP de X-Forwarded-For la agrega el propio CDN.
  $xff = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
  if ($xff !== '') { $parts = array_map('trim', explode(',', $xff)); $ip = end($parts); if (filter_var($ip, FILTER_VALIDATE_IP)) return $ip; }
  return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}
function log_error(Throwable $e): void {
  @file_put_contents(data_dir() . '/errores.log', '[' . now() . '] ' . get_class($e) . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine() . "\n", FILE_APPEND | LOCK_EX);
}

/* ---------- base de datos ---------- */
function db(): PDO {
  static $pdo = null;
  if ($pdo) return $pdo;
  $pdo = new PDO('sqlite:' . data_dir() . '/volt.sqlite', null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);
  $pdo->exec('PRAGMA journal_mode = WAL');
  $pdo->exec('PRAGMA foreign_keys = ON');
  $pdo->exec('PRAGMA busy_timeout = 5000');
  migrate($pdo);
  return $pdo;
}
function q(string $sql, array $params = []): PDOStatement { $st = db()->prepare($sql); $st->execute($params); return $st; }
function row(string $sql, array $params = []): ?array { $r = q($sql, $params)->fetch(); return $r === false ? null : $r; }
function rows(string $sql, array $params = []): array { return q($sql, $params)->fetchAll(); }
function val(string $sql, array $params = []): mixed { $v = q($sql, $params)->fetchColumn(); return $v === false ? null : $v; }
function tx(callable $fn): mixed {
  $pdo = db();
  $pdo->beginTransaction();
  try { $r = $fn(); $pdo->commit(); return $r; }
  catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
}

function migrate(PDO $pdo): void {
  if ((int)$pdo->query('PRAGMA user_version')->fetchColumn() >= 1) return;
  $pdo->beginTransaction();
  try {
    $pdo->exec(<<<SQL
      CREATE TABLE users (
        id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('owner','editor')), session_epoch INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, created_by TEXT, last_login_at TEXT);
      CREATE TABLE login_attempts (id INTEGER PRIMARY KEY, ip TEXT NOT NULL, email TEXT, at INTEGER NOT NULL, ok INTEGER NOT NULL);
      CREATE INDEX login_attempts_at ON login_attempts (at);
      CREATE TABLE content (
        key TEXT PRIMARY KEY, draft TEXT NOT NULL, published TEXT, version INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT, updated_by_email TEXT, published_at TEXT, published_by_email TEXT);
      CREATE TABLE content_versions (
        id INTEGER PRIMARY KEY, key TEXT NOT NULL, data TEXT NOT NULL, published_at TEXT NOT NULL,
        published_by_email TEXT, note TEXT);
      CREATE INDEX content_versions_key ON content_versions (key, id);
      CREATE TABLE categories (
        id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, singular TEXT NOT NULL, icon TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT, updated_at TEXT, updated_by_email TEXT);
      CREATE TABLE products (
        id TEXT PRIMARY KEY, category_id TEXT NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
        name TEXT NOT NULL, brand TEXT, detail TEXT, price INTEGER, price_max INTEGER, promo_price INTEGER, stock INTEGER,
        active INTEGER NOT NULL DEFAULT 1, featured INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0,
        image_url TEXT, image_alt TEXT, gallery TEXT NOT NULL DEFAULT '[]', features TEXT NOT NULL DEFAULT '[]',
        cta_label TEXT, cta_message TEXT, cta_url TEXT, version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT, updated_at TEXT, updated_by_email TEXT);
      CREATE INDEX products_category ON products (category_id, sort_order);
      CREATE TABLE media (
        id TEXT PRIMARY KEY, path TEXT UNIQUE, url TEXT NOT NULL UNIQUE, filename TEXT NOT NULL, alt TEXT NOT NULL DEFAULT '',
        folder TEXT NOT NULL DEFAULT 'general', mime TEXT, size_bytes INTEGER, width INTEGER, height INTEGER,
        source TEXT NOT NULL DEFAULT 'upload', created_at TEXT, updated_at TEXT, updated_by_email TEXT);
      CREATE TABLE audit_log (
        id INTEGER PRIMARY KEY, at TEXT NOT NULL, user_email TEXT, action TEXT NOT NULL, entity TEXT NOT NULL,
        entity_id TEXT, label TEXT, before TEXT, after TEXT);
      CREATE INDEX audit_log_at ON audit_log (at);
    SQL);
    seed($pdo);
    $pdo->exec('PRAGMA user_version = 1');
    $pdo->commit();
  } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
}

// Carga inicial: el contenido y el catálogo que tenía la página al migrar.
function seed(PDO $pdo): void {
  $dir = dirname(__DIR__) . '/seed';
  $content = jdec(file_get_contents($dir . '/content.json'), false);
  $catalog = jdec(file_get_contents($dir . '/catalog.json'));
  $t = now();
  $st = $pdo->prepare('INSERT INTO content (key, draft, published, version, updated_at, published_at) VALUES (?, ?, ?, 1, ?, ?)');
  $sv = $pdo->prepare('INSERT INTO content_versions (key, data, published_at, note) VALUES (?, ?, ?, ?)');
  foreach ($content as $key => $data) {
    $j = jcanon($data);
    $st->execute([$key, $j, $j, $t, $t]);
    $sv->execute([$key, $j, $t, 'Contenido original de la página']);
  }
  $ids = [];
  $sc = $pdo->prepare('INSERT INTO categories (id, code, name, singular, icon, sort_order, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  foreach ($catalog['categories'] as $c) {
    $ids[$c['code']] = uuid();
    $sc->execute([$ids[$c['code']], $c['code'], $c['name'], $c['singular'], $c['icon'], $c['sort_order'], $c['active'] ? 1 : 0, $t, $t]);
  }
  $sp = $pdo->prepare('INSERT INTO products (id, category_id, name, brand, detail, price, price_max, promo_price, stock, active, featured, sort_order,
    image_url, image_alt, gallery, features, cta_label, cta_message, cta_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  foreach ($catalog['products'] as $p) {
    $sp->execute([$p['id'] ?: uuid(), $ids[$p['category']], $p['name'], $p['brand'], $p['detail'], $p['price'], $p['price_max'], $p['promo_price'], $p['stock'],
      $p['active'] ? 1 : 0, $p['featured'] ? 1 : 0, $p['sort_order'], $p['image_url'], $p['image_alt'], jenc($p['gallery'] ?? []), jenc($p['features'] ?? []),
      $p['cta_label'], $p['cta_message'], $p['cta_url'], $t, $t]);
  }
  $sm = $pdo->prepare("INSERT INTO media (id, url, filename, alt, folder, mime, source, created_at) VALUES (?, ?, ?, ?, ?, ?, 'repo', ?)");
  foreach (jdec(file_get_contents($dir . '/media.json')) as $m) {
    $sm->execute([uuid(), $m['url'], basename($m['url']), $m['alt'], $m['folder'], $m['mime'], $t]);
  }
  $pdo->prepare("INSERT INTO audit_log (at, action, entity, label, after) VALUES (?, 'import', 'seed', ?, ?)")
    ->execute([$t, 'Carga inicial: contenido de la página y ' . count($catalog['products']) . ' productos', jenc(['products' => count($catalog['products'])])]);
}

/* ---------- historial ---------- */
function audit(?array $user, string $action, string $entity, ?string $entityId, ?string $label, mixed $before = null, mixed $after = null): void {
  q('INSERT INTO audit_log (at, user_email, action, entity, entity_id, label, before, after) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
    now(), $user['email'] ?? null, $action, $entity, $entityId, $label,
    $before === null ? null : jenc($before), $after === null ? null : jenc($after)
  ]);
}

/* ---------- sesión ---------- */
function start_session(): void {
  if (session_status() === PHP_SESSION_ACTIVE) return;
  $dir = data_dir() . '/sesiones';
  if (!is_dir($dir)) @mkdir($dir, 0700, true);
  session_save_path($dir);
  ini_set('session.use_strict_mode', '1');
  ini_set('session.use_only_cookies', '1');
  ini_set('session.gc_maxlifetime', (string)MAX_SESSION_SECONDS);
  session_name('volt_admin');
  session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => is_https(), 'httponly' => true, 'samesite' => 'Strict']);
  session_start();
}
function end_session(): void {
  start_session();
  $_SESSION = [];
  $p = session_get_cookie_params();
  setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Strict']);
  session_destroy();
}
function login_session(array $user): void {
  start_session();
  session_regenerate_id(true);
  $_SESSION = ['uid' => (int)$user['id'], 'epoch' => (int)$user['session_epoch'], 'born' => time(), 'last' => time(), 'csrf' => bin2hex(random_bytes(32))];
}
function current_user(): ?array {
  start_session();
  if (empty($_SESSION['uid'])) return null;
  $t = time();
  if ($t - ($_SESSION['last'] ?? 0) > IDLE_SECONDS || $t - ($_SESSION['born'] ?? 0) > MAX_SESSION_SECONDS) { end_session(); return null; }
  $u = row('SELECT id, email, role, session_epoch FROM users WHERE id = ?', [$_SESSION['uid']]);
  if (!$u || (int)$u['session_epoch'] !== (int)($_SESSION['epoch'] ?? -1)) { end_session(); return null; }
  $_SESSION['last'] = $t;
  return $u;
}
function profile(array $u): array {
  return ['user_id' => (int)$u['id'], 'email' => $u['email'], 'role' => $u['role'], 'csrf' => $_SESSION['csrf'] ?? ''];
}

/* ---------- contraseñas e intentos ---------- */
function check_password_policy(string $p): void {
  if (mb_strlen($p) < 10 || !preg_match('/[A-Za-z]/', $p) || !preg_match('/\d/', $p)) {
    fail(400, 'La contraseña debe tener al menos 10 caracteres y combinar letras y números.');
  }
  if (mb_strlen($p) > 200) fail(400, 'La contraseña es demasiado larga.');
}
function hash_password(string $p): string {
  return password_hash($p, defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT);
}
function check_login_rate(string $ip, string $email): void {
  $since = time() - LOGIN_WINDOW;
  q('DELETE FROM login_attempts WHERE at < ?', [time() - 86400]);
  $pair = (int)val('SELECT COUNT(*) FROM login_attempts WHERE ok = 0 AND at > ? AND ip = ? AND email = ?', [$since, $ip, $email]);
  $byIp = (int)val('SELECT COUNT(*) FROM login_attempts WHERE ok = 0 AND at > ? AND ip = ?', [$since, $ip]);
  $byEmail = (int)val('SELECT COUNT(*) FROM login_attempts WHERE ok = 0 AND at > ? AND email = ?', [$since, $email]);
  if ($pair >= 5 || $byIp >= 20 || $byEmail >= 10) {
    fail(429, 'Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.', 'rate_limited');
  }
}
function record_attempt(string $ip, string $email, bool $ok): void {
  q('INSERT INTO login_attempts (ip, email, at, ok) VALUES (?, ?, ?, ?)', [$ip, $email, time(), $ok ? 1 : 0]);
}

/* ---------- claves de instalación y recuperación (archivos que solo ve quien entra al hosting) ---------- */
function key_file(string $name): string { return data_dir() . '/' . $name; }
function ensure_setup_key(): void {
  $f = key_file('clave-instalacion.txt');
  if (!is_file($f)) write_atomic($f, rtrim(strtr(base64_encode(random_bytes(18)), '+/', 'Kx'), '=') . "\n");
}

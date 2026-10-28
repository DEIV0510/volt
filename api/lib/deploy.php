<?php
/* =====================================================================
   Actualización del código desde GitHub, sin contraseñas.
   El repositorio es público: el servidor consulta cuál es el último commit
   de main y descarga exactamente ese commit. La acción de GitHub lo pide
   después de cada push (POST /api/?a=deploy).
   Quien llame solo puede provocar que se instale el último main del
   repositorio fijo: no puede subir código propio ni elegir otra versión.
   Nunca se tocan volt-data/, uploads/ ni los archivos de desarrollo.
   ===================================================================== */
declare(strict_types=1);

const DEPLOY_REPO = 'DEIV0510/volt';
const DEPLOY_BRANCH = 'main';
const DEPLOY_MIN_INTERVAL = 20;   // segundos mínimos entre consultas a GitHub
// Lo que no se publica (como antes con FTP): desarrollo, pruebas, documentación y datos del sitio.
const DEPLOY_EXCLUDE = '~^(\.git|\.github/|\.claude/|tests/|data/|scripts/|_imgwork/|node_modules/|uploads/|volt-data|package(-lock)?\.json$|admin/package\.json$|README\.md$|ADMIN\.md$|serve\.js$)~';
const DEPLOY_REQUIRED = ['index.html', 'index.php', 'script.js', 'styles.css', '.htaccess', 'api/index.php', 'admin/index.html'];

function deploy_target(): string {
  $dir = getenv('VOLT_DEPLOY_DIR') ?: site_root();
  // En una copia de trabajo (con .git) nunca se escribe sobre el código: así no se pierden cambios locales.
  if (!getenv('VOLT_DEPLOY_DIR') && is_dir(site_root() . '/.git')) fail(409, 'Esta copia es de desarrollo: define VOLT_DEPLOY_DIR para probar la actualización.', 'dev_copy');
  if (!is_dir($dir) && !mkdir($dir, 0755, true)) fail(500, 'No se pudo preparar la carpeta del sitio.');
  return rtrim($dir, '/');
}

function github_get(string $url, int $timeout, int $maxBytes): string {
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_USERAGENT => 'voltstoreco-deploy', CURLOPT_FOLLOWLOCATION => false, CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
    CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2, CURLOPT_MAXFILESIZE => $maxBytes,
  ]);
  $body = curl_exec($ch);
  $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  curl_close($ch);
  if (!is_string($body) || $status !== 200 || strlen($body) > $maxBytes) {
    fail(502, 'No se pudo conectar con GitHub. Inténtalo de nuevo en unos minutos.', 'github');
  }
  return $body;
}

// Último commit de main, leído del protocolo de git (no usa la API de GitHub ni su límite por IP).
function github_head(): string {
  $refs = github_get('https://github.com/' . DEPLOY_REPO . '.git/info/refs?service=git-upload-pack', 20, 4_000_000);
  if (!preg_match('~([0-9a-f]{40}) refs/heads/' . preg_quote(DEPLOY_BRANCH, '~') . '(\s|\x00)~', $refs, $m)) {
    fail(502, 'GitHub no indicó la versión actual del sitio.', 'github');
  }
  return $m[1];
}

function deploy_state(): array {
  $f = data_dir() . '/despliegue.json';
  if (!is_file($f)) return [];
  try { $s = jdec((string)file_get_contents($f)); } catch (JsonException) { return []; }
  return is_array($s) ? $s : [];
}

function deploy_rel_ok(string $rel): bool {
  // Solo rutas simples dentro del sitio: sin «..», sin rutas absolutas ni caracteres raros.
  return (bool)preg_match('~^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$~', $rel)
    && !preg_match('~(^|/)\.{1,2}(/|$)~', $rel) && !preg_match(DEPLOY_EXCLUDE, $rel);
}

function act_deploy(): array {
  $lock = fopen(data_dir() . '/despliegue.lock', 'c');
  if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) return ['status' => 'busy'];
  $zipFile = null;
  $staged = [];
  try {
    $state = deploy_state();
    if (time() - (int)($state['checked'] ?? 0) < DEPLOY_MIN_INTERVAL) {
      return ['status' => 'wait', 'sha' => $state['sha'] ?? null, 'retry_after' => DEPLOY_MIN_INTERVAL];
    }
    $root = deploy_target();
    $sha = github_head();
    $state['checked'] = time();
    write_atomic(data_dir() . '/despliegue.json', jenc($state));
    if (($state['sha'] ?? '') === $sha) return ['status' => 'unchanged', 'sha' => $sha];

    $zipFile = tempnam(sys_get_temp_dir(), 'volt');
    file_put_contents($zipFile, github_get('https://codeload.github.com/' . DEPLOY_REPO . '/zip/' . $sha, 120, 60_000_000));
    $za = new ZipArchive();
    if ($za->open($zipFile) !== true) fail(502, 'El paquete descargado de GitHub no es válido.', 'github');
    // GitHub guarda el commit en el comentario del zip: debe ser exactamente el que se pidió.
    if ($za->getArchiveComment() !== $sha) fail(502, 'El paquete descargado no corresponde a la versión esperada.', 'github');

    $prefix = null;
    $files = [];
    for ($i = 0; $i < $za->numFiles; $i++) {
      $name = (string)$za->getNameIndex($i);
      $prefix ??= strstr($name, '/', true) . '/';
      if (!str_starts_with($name, $prefix)) fail(502, 'El paquete descargado tiene una estructura inesperada.', 'github');
      $rel = substr($name, strlen($prefix));
      if ($rel === '' || str_ends_with($rel, '/') || !deploy_rel_ok($rel)) continue;
      $files[$rel] = $i;
    }
    foreach (DEPLOY_REQUIRED as $req) {
      if (!isset($files[$req])) fail(502, 'Al paquete le falta ' . $req . '; no se instaló nada.', 'github');
    }

    // 1) Se preparan todos los archivos que cambian junto a su destino…
    foreach ($files as $rel => $i) {
      $data = $za->getFromIndex($i);
      if ($data === false) fail(502, 'No se pudo leer ' . $rel . ' del paquete.', 'github');
      $dest = $root . '/' . $rel;
      if (is_file($dest) && hash_file('sha256', $dest) === hash('sha256', $data)) continue;
      if (!is_dir(dirname($dest)) && !mkdir(dirname($dest), 0755, true)) fail(500, 'No se pudo crear la carpeta de ' . $rel . '.');
      $tmp = $dest . '.volt-nuevo';
      if (file_put_contents($tmp, $data, LOCK_EX) !== strlen($data)) { @unlink($tmp); fail(500, 'No se pudo escribir ' . $rel . '.'); }
      @chmod($tmp, 0644);
      $staged[$tmp] = $dest;
    }
    $za->close();
    $changed = count($staged);
    // 2) …y se reemplazan todos seguidos, para que la página no mezcle versiones.
    foreach ($staged as $tmp => $dest) {
      if (!rename($tmp, $dest)) fail(500, 'No se pudo reemplazar ' . substr($dest, strlen($root) + 1) . '.');
      unset($staged[$tmp]);
      if (str_ends_with($dest, '.php') && function_exists('opcache_invalidate')) @opcache_invalidate($dest, true);
    }
    // 3) Se borran los archivos que se quitaron del repositorio desde la publicación anterior.
    $removed = 0;
    foreach ((array)($state['files'] ?? []) as $old) {
      if (is_string($old) && !isset($files[$old]) && deploy_rel_ok($old) && is_file($root . '/' . $old) && @unlink($root . '/' . $old)) $removed++;
    }
    $count = count($files);
    $state = ['sha' => $sha, 'deployed_at' => now(), 'checked' => time(), 'files' => array_keys($files)];
    write_atomic(data_dir() . '/despliegue.json', jenc($state));
    audit(null, 'deploy', 'code', $sha, 'Código actualizado desde GitHub (' . substr($sha, 0, 7) . ')', null, ['changed' => $changed, 'removed' => $removed]);
    return ['status' => 'updated', 'sha' => $sha, 'files' => $count, 'changed' => $changed, 'removed' => $removed];
  } finally {
    foreach ($staged as $tmp => $_) @unlink($tmp);
    if ($zipFile) @unlink($zipFile);
    flock($lock, LOCK_UN);
    fclose($lock);
  }
}

// Versión instalada (para el resumen del panel).
function deploy_info(): array {
  $s = deploy_state();
  return ['sha' => $s['sha'] ?? null, 'deployed_at' => $s['deployed_at'] ?? null];
}

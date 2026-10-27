<?php
/* Operaciones del panel. Cada función recibe el usuario ya autenticado y autorizado
   (index.php verifica sesión, rol y token CSRF antes de llamarla). */
declare(strict_types=1);

/* ---------- formatos de salida ---------- */
function ints(array $r, array $keys): array { foreach ($keys as $k) if (isset($r[$k])) $r[$k] = (int)$r[$k]; return $r; }
function product_out(array $p): array {
  $p = ints($p, ['price', 'price_max', 'promo_price', 'stock', 'sort_order', 'version']);
  $p['active'] = (bool)$p['active']; $p['featured'] = (bool)$p['featured'];
  $p['gallery'] = jdec($p['gallery']); $p['features'] = jdec($p['features']);
  return $p;
}
function category_out(array $c): array { $c = ints($c, ['sort_order', 'version']); $c['active'] = (bool)$c['active']; return $c; }
function media_out(array $m): array { return ints($m, ['size_bytes', 'width', 'height']); }
function body_ids(array $b, string $key = 'ids'): array {
  $ids = $b[$key] ?? null;
  if (!is_array($ids) || !array_is_list($ids) || count($ids) > 1000) fail(400, 'Lista de elementos no válida.', 'invalid');
  foreach ($ids as $id) if (!is_string($id) || !preg_match('/^[0-9a-f-]{36}$/', $id)) fail(400, 'Identificador no válido.', 'invalid');
  return $ids;
}
function in_list(array $ids): string { return implode(',', array_fill(0, count($ids), '?')); }

/* ===================== Acceso ===================== */
function act_status(): array {
  $hasUsers = (bool)val('SELECT 1 FROM users LIMIT 1');
  if (!$hasUsers) ensure_setup_key();
  return ['needs_setup' => !$hasUsers, 'key_hint' => data_dir_hint()];
}

function act_setup(array $b): array {
  if (val('SELECT 1 FROM users LIMIT 1')) fail(409, 'El panel ya tiene un propietario. Inicia sesión.', 'already_setup');
  $ip = client_ip();
  check_login_rate($ip, '__setup__');
  $file = key_file('clave-instalacion.txt');
  $key = trim((string)@file_get_contents($file));
  if ($key === '' || !hash_equals($key, trim((string)($b['key'] ?? '')))) {
    record_attempt($ip, '__setup__', false);
    fail(403, 'La clave de instalación no coincide. Cópiala del archivo clave-instalacion.txt.', 'bad_key');
  }
  $email = check_email($b['email'] ?? '');
  check_password_policy((string)($b['password'] ?? ''));
  $user = tx(function () use ($email, $b, $file) {
    q("INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, 'owner', ?)", [$email, hash_password((string)$b['password']), now()]);
    @unlink($file);
    return row('SELECT * FROM users WHERE email = ?', [$email]);
  });
  audit($user, 'insert', 'admin_users', (string)$user['id'], $email, null, ['email' => $email, 'role' => 'owner']);
  login_session($user);
  return profile($user);
}

function act_login(array $b): array {
  $email = is_string($b['email'] ?? null) ? mb_strtolower(trim($b['email'])) : '';
  $pass = is_string($b['password'] ?? null) ? $b['password'] : '';
  if ($email === '' || $pass === '' || mb_strlen($pass) > 200) fail(400, 'Escribe tu correo y tu contraseña.', 'invalid');
  $ip = client_ip();
  check_login_rate($ip, $email);
  $u = row('SELECT * FROM users WHERE email = ?', [$email]);
  // Siempre se verifica un hash (aunque el correo no exista) para no revelar qué correos hay por el tiempo de respuesta.
  $ok = password_verify($pass, $u['password_hash'] ?? '$2y$10$YkErE6vhQ6PHDUh2hmRuduFlR0ytJQU5ix9VWj5ZcyWgqQhT6LUxe');
  record_attempt($ip, $email, $ok && $u !== null);
  if (!$ok || !$u) fail(401, 'Correo o contraseña incorrectos.', 'bad_credentials');
  if (password_needs_rehash($u['password_hash'], defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT)) {
    q('UPDATE users SET password_hash = ? WHERE id = ?', [hash_password($pass), $u['id']]);
  }
  q('UPDATE users SET last_login_at = ? WHERE id = ?', [now(), $u['id']]);
  login_session($u);
  audit($u, 'login', 'session', (string)$u['id'], $u['email']);
  return profile($u);
}

function act_logout(?array $u): array { end_session(); return ['ok' => true]; }
function act_me(array $u): array { return profile($u); }

function act_logout_all(array $u): array {
  q('UPDATE users SET session_epoch = session_epoch + 1 WHERE id = ?', [$u['id']]);
  audit($u, 'update', 'session', (string)$u['id'], 'Cerró todas las sesiones');
  end_session();
  return ['ok' => true];
}

function act_change_password(array $u, array $b): array {
  $full = row('SELECT * FROM users WHERE id = ?', [$u['id']]);
  if (!password_verify((string)($b['current'] ?? ''), $full['password_hash'])) fail(400, 'La contraseña actual no es correcta.', 'invalid');
  $new = (string)($b['password'] ?? '');
  check_password_policy($new);
  if (password_verify($new, $full['password_hash'])) fail(400, 'La nueva contraseña debe ser distinta de la actual.', 'invalid');
  q('UPDATE users SET password_hash = ?, session_epoch = session_epoch + 1 WHERE id = ?', [hash_password($new), $u['id']]);
  $_SESSION['epoch'] = (int)$full['session_epoch'] + 1;   // esta sesión sigue; las demás se cierran
  audit($u, 'update', 'admin_users', (string)$u['id'], 'Cambió su contraseña');
  return ['ok' => true];
}

// Recuperación: el servidor deja una clave en un archivo de volt-data; solo quien entra al hosting puede leerla.
function act_recover_start(): array {
  $ip = client_ip();
  $n = (int)val("SELECT COUNT(*) FROM login_attempts WHERE email = '__recover__' AND ip = ? AND at > ?", [$ip, time() - 3600]);
  if ($n >= 3) fail(429, 'Ya pediste varias claves de recuperación. Espera una hora.', 'rate_limited');
  record_attempt($ip, '__recover__', false);
  $key = rtrim(strtr(base64_encode(random_bytes(18)), '+/', 'Kx'), '=');
  write_atomic(key_file('clave-recuperacion.txt'), $key . "\n" . 'Válida hasta: ' . gmdate('Y-m-d H:i', time() + 1800) . " UTC\n");
  q("INSERT INTO login_attempts (ip, email, at, ok) VALUES (?, '__recover_key__', ?, 1)", [$ip, time()]);
  return ['key_hint' => data_dir_hint()];
}
function act_recover(array $b): array {
  $ip = client_ip();
  check_login_rate($ip, '__recover_try__');
  $file = key_file('clave-recuperacion.txt');
  $lines = is_file($file) ? file($file, FILE_IGNORE_NEW_LINES) : [];
  $fresh = is_file($file) && filemtime($file) > time() - 1800;
  if (!$lines || !$fresh || !hash_equals(trim($lines[0]), trim((string)($b['key'] ?? '')))) {
    record_attempt($ip, '__recover_try__', false);
    fail(403, 'La clave de recuperación no coincide o ya venció (dura 30 minutos). Pide una nueva.', 'bad_key');
  }
  $email = check_email($b['email'] ?? '');
  $u = row('SELECT * FROM users WHERE email = ?', [$email]);
  if (!$u) fail(404, 'No hay ningún administrador con ese correo.', 'not_found');
  $new = (string)($b['password'] ?? '');
  check_password_policy($new);
  q('UPDATE users SET password_hash = ?, session_epoch = session_epoch + 1 WHERE id = ?', [hash_password($new), $u['id']]);
  @unlink($file);
  audit($u, 'update', 'admin_users', (string)$u['id'], 'Recuperó el acceso con la clave del servidor');
  return ['ok' => true];
}

/* ===================== Contenido ===================== */
function content_row_out(array $r): array {
  return ['key' => $r['key'], 'data' => jdec($r['draft'], false), 'version' => (int)$r['version'],
          'updated_at' => $r['updated_at'], 'updated_by_email' => $r['updated_by_email']];
}
function act_drafts(): array { return array_map('content_row_out', rows('SELECT * FROM content ORDER BY key')); }
function act_published(): array {
  return array_map(fn($r) => ['key' => $r['key'], 'data' => jdec($r['published'], false), 'published_at' => $r['published_at'], 'published_by_email' => $r['published_by_email']],
    rows('SELECT * FROM content WHERE published IS NOT NULL ORDER BY key'));
}
function act_content(array $u, array $q): array {
  $r = row('SELECT * FROM content WHERE key = ?', [(string)($q['key'] ?? '')]);
  if (!$r) fail(404, 'Esa sección no existe.', 'not_found');
  return ['draft' => content_row_out($r),
          'published' => $r['published'] === null ? null : ['data' => jdec($r['published'], false), 'published_at' => $r['published_at'], 'published_by_email' => $r['published_by_email']]];
}

function act_save_draft(array $u, object $b): array {
  $key = is_string($b->key ?? null) ? $b->key : '';
  $data = $b->data ?? null;
  $expected = $b->expected_version ?? null;
  validate_content($key, $data);
  return tx(function () use ($u, $key, $data, $expected) {
    $cur = row('SELECT * FROM content WHERE key = ?', [$key]);
    if (!$cur) fail(404, 'Esa sección no existe.', 'not_found');
    if ($expected !== null && (int)$expected !== (int)$cur['version']) {
      fail(409, "Otra persona modificó esta sección mientras editabas. Recarga para ver la versión actual.", 'conflict');
    }
    $json = jcanon($data);
    $t = now();
    q('UPDATE content SET draft = ?, version = version + 1, updated_at = ?, updated_by_email = ? WHERE key = ?', [$json, $t, $u['email'], $key]);
    if ($json !== $cur['draft']) audit($u, 'update', 'site_content', $key, $key, jdec($cur['draft']), jdec($json));
    return ['key' => $key, 'version' => (int)$cur['version'] + 1, 'updated_at' => $t, 'updated_by_email' => $u['email']];
  });
}

function act_publish(array $u, array $b): array {
  $keys = $b['keys'] ?? null;
  if ($keys !== null && (!is_array($keys) || array_diff($keys, content_keys()))) fail(400, 'Secciones no válidas.', 'invalid');
  $note = $b['note'] ?? null;
  if ($note !== null && (!is_string($note) || mb_strlen($note) > 200)) fail(400, 'La nota es demasiado larga.', 'invalid');
  $done = tx(function () use ($u, $keys, $note) {
    $t = now(); $done = [];
    foreach (rows('SELECT key, draft FROM content WHERE published IS NULL OR draft <> published ORDER BY key') as $r) {
      if ($keys && !in_array($r['key'], $keys, true)) continue;
      q('UPDATE content SET published = draft, published_at = ?, published_by_email = ? WHERE key = ?', [$t, $u['email'], $r['key']]);
      q('INSERT INTO content_versions (key, data, published_at, published_by_email, note) VALUES (?, ?, ?, ?, ?)', [$r['key'], $r['draft'], $t, $u['email'], $note ?: null]);
      $done[] = $r['key'];
    }
    if ($done) audit($u, 'publish', 'site_published', implode(',', $done), $note ?: null, null, ['keys' => $done]);
    return $done;
  });
  if ($done) { rebuild_public(); auto_backup('publicar'); }
  return ['published' => $done, 'at' => now()];
}

function act_discard(array $u, array $b): array {
  $keys = $b['keys'] ?? [];
  if (!is_array($keys) || array_diff($keys, content_keys())) fail(400, 'Secciones no válidas.', 'invalid');
  $n = tx(function () use ($u, $keys) {
    $n = 0;
    foreach ($keys as $k) {
      $r = row('SELECT * FROM content WHERE key = ? AND published IS NOT NULL AND draft <> published', [$k]);
      if (!$r) continue;
      q('UPDATE content SET draft = published, version = version + 1, updated_at = ?, updated_by_email = ? WHERE key = ?', [now(), $u['email'], $k]);
      audit($u, 'update', 'site_content', $k, $k . ' (descartó el borrador)', jdec($r['draft']), jdec($r['published']));
      $n++;
    }
    return $n;
  });
  return ['discarded' => $n];
}

function act_versions(array $u, array $q): array {
  return rows('SELECT id, key, published_at, published_by_email, note FROM content_versions WHERE key = ? ORDER BY id DESC LIMIT 40', [(string)($q['key'] ?? '')]);
}
function act_version(array $u, array $q): array {
  $r = row('SELECT data FROM content_versions WHERE id = ?', [(int)($q['id'] ?? 0)]);
  if (!$r) fail(404, 'Esa versión no existe.', 'not_found');
  return ['data' => jdec($r['data'], false)];
}
function act_restore_version(array $u, array $b): array {
  $v = row('SELECT * FROM content_versions WHERE id = ?', [(int)($b['id'] ?? 0)]);
  if (!$v) fail(404, 'Esa versión no existe.', 'not_found');
  tx(function () use ($u, $v) {
    $cur = row('SELECT draft FROM content WHERE key = ?', [$v['key']]);
    q('UPDATE content SET draft = ?, version = version + 1, updated_at = ?, updated_by_email = ? WHERE key = ?', [$v['data'], now(), $u['email'], $v['key']]);
    audit($u, 'restore', 'site_content', $v['key'], 'Versión del ' . substr($v['published_at'], 0, 16), jdec($cur['draft']), jdec($v['data']));
  });
  auto_backup('restaurar');
  return ['key' => $v['key']];
}

function act_audit(array $u, array $q): array {
  $page = max(0, (int)($q['page'] ?? 0)); $size = 30;
  $where = []; $p = [];
  if (!empty($q['entity'])) { $where[] = 'entity = ?'; $p[] = (string)$q['entity']; }
  if (!empty($q['action'])) { $where[] = 'action = ?'; $p[] = (string)$q['action']; }
  if (!empty($q['search'])) { $where[] = '(label LIKE ? OR user_email LIKE ?)'; $s = '%' . mb_substr((string)$q['search'], 0, 80) . '%'; $p[] = $s; $p[] = $s; }
  $w = $where ? 'WHERE ' . implode(' AND ', $where) : '';
  $count = (int)val("SELECT COUNT(*) FROM audit_log $w", $p);
  $data = array_map(function ($r) { $r['before'] = jdec($r['before']); $r['after'] = jdec($r['after']); return $r; },
    rows("SELECT * FROM audit_log $w ORDER BY id DESC LIMIT $size OFFSET " . ($page * $size), $p));
  return ['data' => $data, 'count' => $count];
}

/* ===================== Catálogo ===================== */
function act_categories(): array { return array_map('category_out', rows('SELECT * FROM categories ORDER BY sort_order, name')); }

function act_category_save(array $u, array $b): array {
  $id = $b['id'] ?? null;
  $out = tx(function () use ($u, $b, $id) {
    if ($id) {
      $cur = row('SELECT * FROM categories WHERE id = ?', [$id]);
      if (!$cur) fail(404, 'Esa categoría no existe.', 'not_found');
      $f = clean_category($b, false);
      if (!$f) return $cur;
      $set = implode(', ', array_map(fn($k) => "$k = ?", array_keys($f)));
      q("UPDATE categories SET $set, version = version + 1, updated_at = ?, updated_by_email = ? WHERE id = ?", [...array_values($f), now(), $u['email'], $id]);
      $new = row('SELECT * FROM categories WHERE id = ?', [$id]);
      audit($u, 'update', 'categories', $id, $new['name'], $cur, $new);
      return $new;
    }
    $f = clean_category($b, true);
    if (val('SELECT 1 FROM categories WHERE code = ?', [$f['code']])) fail(409, 'Ya existe una categoría con ese código.', 'conflict');
    $id = uuid(); $t = now();
    $sort = int_or_null($b['sort_order'] ?? null, 'El orden', 0, 1000000) ?? ((int)val('SELECT COALESCE(MAX(sort_order), 0) FROM categories') + 10);
    q('INSERT INTO categories (id, code, name, singular, icon, sort_order, active, created_at, updated_at, updated_by_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [$id, $f['code'], $f['name'], $f['singular'], $f['icon'], $sort, $f['active'], $t, $t, $u['email']]);
    $new = row('SELECT * FROM categories WHERE id = ?', [$id]);
    audit($u, 'insert', 'categories', $id, $new['name'], null, $new);
    return $new;
  });
  rebuild_public();
  return category_out($out);
}
function act_category_delete(array $u, array $b): array {
  $c = row('SELECT * FROM categories WHERE id = ?', [(string)($b['id'] ?? '')]);
  if (!$c) fail(404, 'Esa categoría no existe.', 'not_found');
  if (val('SELECT 1 FROM products WHERE category_id = ? LIMIT 1', [$c['id']])) {
    fail(409, 'No se puede eliminar: la categoría todavía tiene productos. Muévelos o elimínalos primero.', 'in_use');
  }
  q('DELETE FROM categories WHERE id = ?', [$c['id']]);
  audit($u, 'delete', 'categories', $c['id'], $c['name'], $c, null);
  rebuild_public();
  return ['ok' => true];
}
function act_categories_reorder(array $u, array $b): array {
  $ids = body_ids($b);
  tx(function () use ($ids) { foreach ($ids as $i => $id) q('UPDATE categories SET sort_order = ? WHERE id = ?', [($i + 1) * 10, $id]); });
  audit($u, 'update', 'categories', null, 'Cambió el orden de las categorías');
  rebuild_public();
  return ['ok' => true];
}

function act_products(): array { return array_map('product_out', rows('SELECT * FROM products ORDER BY sort_order, name')); }

function act_product_save(array $u, array $b): array {
  $p = $b['product'] ?? null;
  if (!is_array($p)) fail(400, 'Producto no válido.', 'invalid');
  $version = $b['version'] ?? null;
  $out = tx(function () use ($u, $p, $version) {
    $clean = clean_product($p);
    $t = now();
    if (!empty($p['id'])) {
      $cur = row('SELECT * FROM products WHERE id = ?', [(string)$p['id']]);
      if (!$cur) fail(404, 'Ese producto no existe (quizá alguien lo eliminó).', 'not_found');
      if ($version !== null && (int)$version !== (int)$cur['version']) {
        fail(409, 'Otra persona modificó este producto mientras lo editabas. Recarga para ver la versión actual.', 'conflict');
      }
      check_price_rules(array_merge($cur, $clean));
      $set = implode(', ', array_map(fn($k) => "$k = ?", array_keys($clean)));
      q("UPDATE products SET $set, version = version + 1, updated_at = ?, updated_by_email = ? WHERE id = ?", [...array_values($clean), $t, $u['email'], $cur['id']]);
      $new = row('SELECT * FROM products WHERE id = ?', [$cur['id']]);
      audit($u, 'update', 'products', $cur['id'], $new['name'], product_out($cur), product_out($new));
      return $new;
    }
    check_price_rules($clean);
    $id = uuid();
    $clean['sort_order'] = (int)val('SELECT COALESCE(MAX(sort_order), 0) FROM products WHERE category_id = ?', [$clean['category_id']]) + 10;
    $cols = array_keys($clean);
    q('INSERT INTO products (id, ' . implode(', ', $cols) . ', created_at, updated_at, updated_by_email) VALUES (?, ' . in_list($cols) . ', ?, ?, ?)',
      [$id, ...array_values($clean), $t, $t, $u['email']]);
    $new = row('SELECT * FROM products WHERE id = ?', [$id]);
    audit($u, 'insert', 'products', $id, $new['name'], null, product_out($new));
    return $new;
  });
  rebuild_public();
  return product_out($out);
}

function act_products_update(array $u, array $b): array {
  $ids = body_ids($b);
  $fields = $b['fields'] ?? null;
  if (!is_array($fields) || !$fields) fail(400, 'No hay cambios.', 'invalid');
  $allowed = array_intersect_key($fields, array_flip(['active', 'featured', 'stock', 'category_id', 'price', 'price_max', 'promo_price']));
  if (count($allowed) !== count($fields)) fail(400, 'Hay un campo que no se puede cambiar en bloque.', 'invalid');
  $clean = clean_product($allowed, true);
  $rows = tx(function () use ($u, $ids, $clean) {
    $out = [];
    foreach ($ids as $id) {
      $cur = row('SELECT * FROM products WHERE id = ?', [$id]);
      if (!$cur) continue;
      check_price_rules(array_merge($cur, $clean));
      $set = implode(', ', array_map(fn($k) => "$k = ?", array_keys($clean)));
      q("UPDATE products SET $set, version = version + 1, updated_at = ?, updated_by_email = ? WHERE id = ?", [...array_values($clean), now(), $u['email'], $id]);
      $new = row('SELECT * FROM products WHERE id = ?', [$id]);
      audit($u, 'update', 'products', $id, $new['name'], product_out($cur), product_out($new));
      $out[] = product_out($new);
    }
    return $out;
  });
  rebuild_public();
  return $rows;
}
function act_products_delete(array $u, array $b): array {
  $ids = body_ids($b);
  tx(function () use ($u, $ids) {
    foreach ($ids as $id) {
      $cur = row('SELECT * FROM products WHERE id = ?', [$id]);
      if (!$cur) continue;
      q('DELETE FROM products WHERE id = ?', [$id]);
      audit($u, 'delete', 'products', $id, $cur['name'], product_out($cur), null);
    }
  });
  rebuild_public();
  return ['ok' => true];
}
function act_products_reorder(array $u, array $b): array {
  $ids = body_ids($b);
  tx(function () use ($ids) { foreach ($ids as $i => $id) q('UPDATE products SET sort_order = ? WHERE id = ?', [($i + 1) * 10, $id]); });
  rebuild_public();
  return ['ok' => true];
}

/* ===================== Medios ===================== */
const MEDIA_FOLDERS = '/^[a-z0-9-]{1,30}$/';
function act_media(): array { return array_map('media_out', rows('SELECT * FROM media ORDER BY created_at DESC, filename')); }

function media_usage_of(string $url): array {
  $token = jenc($url);   // la URL tal como aparece dentro del JSON: "uploads/…"
  return [
    'content' => array_column(rows('SELECT key FROM content WHERE instr(draft, ?) > 0 ORDER BY key', [$token]), 'key'),
    'published' => array_column(rows('SELECT key FROM content WHERE instr(published, ?) > 0 ORDER BY key', [$token]), 'key'),
    'products' => array_column(rows('SELECT name FROM products WHERE image_url = ? OR instr(gallery, ?) > 0 ORDER BY name', [$url, $token]), 'name'),
  ];
}
function act_media_usage(array $u, array $q): array { return media_usage_of((string)($q['url'] ?? '')); }

function uploads_dir(string $folder): string {
  $root = site_root() . '/uploads';
  if (!is_dir($root)) @mkdir($root, 0755, true);
  // Nada subido se ejecuta como código: sin PHP ni scripts, y sin contenido activo.
  if (!is_file($root . '/.htaccess')) {
    @file_put_contents($root . '/.htaccess', implode("\n", [
      'Options -Indexes -ExecCGI',
      'RemoveHandler .php .phtml .php3 .php4 .php5 .php7 .php8 .phar .pl .py .cgi .sh',
      'RemoveType .php .phtml .phar',
      '<FilesMatch "(?i)\.(php\d?|phtml|phar|pl|py|cgi|sh|html?|svg|js)$">', '  Require all denied', '</FilesMatch>',
      '<IfModule mod_headers.c>', '  Header set X-Content-Type-Options "nosniff"', '  Header set Content-Security-Policy "default-src \'none\'; img-src \'self\'; style-src \'unsafe-inline\'"', '</IfModule>', ''
    ]));
  }
  $dir = $root . '/' . $folder;
  if (!is_dir($dir) && !@mkdir($dir, 0755, true)) fail(500, 'No se pudo crear la carpeta de imágenes.');
  return $dir;
}
function slugify(string $s): string {
  $s = mb_strtolower(pathinfo($s, PATHINFO_FILENAME));
  $s = strtr($s, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n']);
  $s = trim(preg_replace('/[^a-z0-9]+/', '-', $s), '-');
  return substr($s, 0, 60) ?: 'imagen';
}

function act_media_upload(array $u): array {
  $f = $_FILES['file'] ?? null;
  if (!$f || !is_array($f) || ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) {
    $code = $f['error'] ?? UPLOAD_ERR_NO_FILE;
    fail(in_array($code, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) ? 413 : 400,
      in_array($code, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) ? 'El archivo es demasiado grande.' : 'No llegó ningún archivo.', 'invalid');
  }
  if ($f['size'] > 8 * 1024 * 1024) fail(413, 'El archivo supera el máximo permitido (8 MB antes de optimizar).', 'invalid');
  $folder = (string)($_POST['folder'] ?? 'general');
  if (!preg_match(MEDIA_FOLDERS, $folder)) fail(400, 'Carpeta no válida.', 'invalid');
  $alt = trim((string)($_POST['alt'] ?? ''));
  if (mb_strlen($alt) > 200) fail(400, 'El texto alternativo es demasiado largo.', 'invalid');

  $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']) ?: '';
  $raw = file_get_contents($f['tmp_name']);
  $w = $h = null;
  if (in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
    // Se vuelve a codificar con GD: cualquier contenido que no sea imagen se descarta.
    $info = @getimagesizefromstring($raw);
    $img = $info ? @imagecreatefromstring($raw) : false;
    if (!$img) fail(400, 'El archivo no es una imagen válida.', 'invalid');
    [$w, $h] = [imagesx($img), imagesy($img)];
    if ($w < 16 || $h < 16) fail(400, 'La imagen es demasiado pequeña.', 'invalid');
    $scale = min(1, 2000 / max($w, $h));
    if ($scale < 1) {
      $nw = (int)round($w * $scale); $nh = (int)round($h * $scale);
      $dst = imagecreatetruecolor($nw, $nh);
      imagealphablending($dst, false); imagesavealpha($dst, true);
      imagecopyresampled($dst, $img, 0, 0, 0, 0, $nw, $nh, $w, $h);
      imagedestroy($img); $img = $dst; [$w, $h] = [$nw, $nh];
    }
    if (!imageistruecolor($img)) imagepalettetotruecolor($img);
    imagealphablending($img, false); imagesavealpha($img, true);
    ob_start(); imagewebp($img, null, 85); $bytes = ob_get_clean(); imagedestroy($img);
    $ext = 'webp'; $mime = 'image/webp';
  } elseif ($mime === 'image/gif') {
    $info = @getimagesizefromstring($raw);
    if (!$info || $info[2] !== IMAGETYPE_GIF) fail(400, 'El archivo no es una imagen válida.', 'invalid');
    [$w, $h] = $info; $bytes = $raw; $ext = 'gif';
  } elseif (in_array($mime, ['image/x-icon', 'image/vnd.microsoft.icon'], true) && substr($raw, 0, 4) === "\0\0\1\0") {
    if (strlen($raw) > 1024 * 1024) fail(413, 'El ícono supera 1 MB.', 'invalid');
    $bytes = $raw; $ext = 'ico'; $mime = 'image/x-icon';
  } else {
    fail(400, 'Tipo de archivo no permitido. Usa JPG, PNG, WebP o GIF.', 'invalid');
  }
  if (strlen($bytes) > 5 * 1024 * 1024) fail(413, 'La imagen optimizada supera 5 MB.', 'invalid');

  $base = slugify((string)($f['name'] ?? 'imagen'));
  $name = $base . '-' . substr(bin2hex(random_bytes(4)), 0, 6) . '.' . $ext;
  $path = $folder . '/' . $name;
  $dest = uploads_dir($folder) . '/' . $name;
  if (file_put_contents($dest, $bytes, LOCK_EX) === false) fail(500, 'No se pudo guardar la imagen.');
  @chmod($dest, 0644);
  $id = uuid(); $t = now();
  try {
    q("INSERT INTO media (id, path, url, filename, alt, folder, mime, size_bytes, width, height, source, created_at, updated_at, updated_by_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'upload', ?, ?, ?)", [$id, $path, 'uploads/' . $path, $base . '.' . $ext, $alt, $folder, $mime, strlen($bytes), $w, $h, $t, $t, $u['email']]);
  } catch (Throwable $e) { @unlink($dest); throw $e; }
  $m = row('SELECT * FROM media WHERE id = ?', [$id]);
  audit($u, 'insert', 'media', $id, $m['filename'], null, $m);
  return media_out($m);
}

function act_media_update(array $u, array $b): array {
  $m = row('SELECT * FROM media WHERE id = ?', [(string)($b['id'] ?? '')]);
  if (!$m) fail(404, 'Esa imagen no existe.', 'not_found');
  $alt = trim((string)($b['alt'] ?? $m['alt']));
  $folder = (string)($b['folder'] ?? $m['folder']);
  if (mb_strlen($alt) > 200) fail(400, 'El texto alternativo es demasiado largo.', 'invalid');
  if (!preg_match(MEDIA_FOLDERS, $folder)) fail(400, 'Carpeta no válida.', 'invalid');
  q('UPDATE media SET alt = ?, folder = ?, updated_at = ?, updated_by_email = ? WHERE id = ?', [$alt, $folder, now(), $u['email'], $m['id']]);
  $new = row('SELECT * FROM media WHERE id = ?', [$m['id']]);
  audit($u, 'update', 'media', $m['id'], $m['filename'], $m, $new);
  return media_out($new);
}

function act_media_delete(array $u, array $b): array {
  $m = row('SELECT * FROM media WHERE id = ?', [(string)($b['id'] ?? '')]);
  if (!$m) fail(404, 'Esa imagen no existe.', 'not_found');
  if ($m['source'] !== 'upload') fail(400, 'Las imágenes originales del sitio no se pueden eliminar desde el panel.', 'invalid');
  $usage = media_usage_of($m['url']);
  if ($usage['content'] || $usage['published'] || $usage['products']) {
    fail(409, 'No se puede eliminar: la imagen todavía se usa.', 'in_use', ['usage' => $usage]);
  }
  q('DELETE FROM media WHERE id = ?', [$m['id']]);
  $file = site_root() . '/uploads/' . $m['path'];
  if ($m['path'] && is_file($file) && !str_contains($m['path'], '..')) @unlink($file);
  audit($u, 'delete', 'media', $m['id'], $m['filename'], $m, null);
  return ['ok' => true];
}

function act_media_replace(array $u, array $b): array {
  $old = (string)($b['old'] ?? ''); $new = (string)($b['new'] ?? '');
  if ($old === '' || $new === '' || $old === $new) fail(400, 'Indica la imagen anterior y la nueva.', 'invalid');
  if (!val('SELECT 1 FROM media WHERE url = ?', [$new])) fail(400, 'La imagen nueva no está en la biblioteca.', 'invalid');
  [$tOld, $tNew] = [jenc($old), jenc($new)];
  $r = tx(function () use ($u, $old, $new, $tOld, $tNew) {
    $c = 0; $p = 0;
    foreach (rows('SELECT key, draft FROM content WHERE instr(draft, ?) > 0', [$tOld]) as $row) {
      q('UPDATE content SET draft = ?, version = version + 1, updated_at = ?, updated_by_email = ? WHERE key = ?', [str_replace($tOld, $tNew, $row['draft']), now(), $u['email'], $row['key']]);
      $c++;
    }
    foreach (rows('SELECT id, image_url, gallery FROM products WHERE image_url = ? OR instr(gallery, ?) > 0', [$old, $tOld]) as $row) {
      q('UPDATE products SET image_url = ?, gallery = ?, version = version + 1, updated_at = ?, updated_by_email = ? WHERE id = ?',
        [$row['image_url'] === $old ? $new : $row['image_url'], str_replace($tOld, $tNew, $row['gallery']), now(), $u['email'], $row['id']]);
      $p++;
    }
    audit($u, 'update', 'media', null, 'Reemplazó una imagen en todo el sitio', ['url' => $old], ['url' => $new, 'contenido' => $c, 'productos' => $p]);
    return ['content' => $c, 'products' => $p];
  });
  rebuild_public();
  return $r;
}

/* ===================== Respaldos ===================== */
function act_export(): array {
  $code = array_column(rows('SELECT id, code FROM categories'), 'code', 'id');
  return [
    'format' => 'volt-backup', 'format_version' => 2, 'exported_at' => now(),
    'drafts' => content_map('draft'), 'published' => content_map('published'),
    'categories' => array_map(fn($c) => ['code' => $c['code'], 'name' => $c['name'], 'singular' => $c['singular'], 'icon' => $c['icon'], 'sort_order' => (int)$c['sort_order'], 'active' => (bool)$c['active']],
      rows('SELECT * FROM categories ORDER BY sort_order')),
    'products' => array_map(function ($p) use ($code) { $o = product_out($p); $o['category'] = $code[$p['category_id']] ?? null; unset($o['category_id'], $o['version'], $o['created_at'], $o['updated_at'], $o['updated_by_email']); return $o; },
      rows('SELECT * FROM products ORDER BY sort_order')),
    'media' => array_map(fn($m) => array_intersect_key(media_out($m), array_flip(['url', 'path', 'filename', 'alt', 'folder', 'source', 'mime', 'size_bytes', 'width', 'height'])), rows('SELECT * FROM media')),
  ];
}

// Copia automática en volt-data/respaldos (fuera del sitio) tras publicar, restaurar o importar. Se guardan las últimas 30.
function auto_backup(string $reason): void {
  try {
    $dir = data_dir() . '/respaldos';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    write_atomic($dir . '/respaldo-' . gmdate('Ymd-His') . '-' . $reason . '.json', jenc(act_export()));
    $files = glob($dir . '/respaldo-*.json') ?: [];
    sort($files);
    foreach (array_slice($files, 0, max(0, count($files) - 30)) as $old) @unlink($old);
  } catch (Throwable $e) { log_error($e); }   // un respaldo fallido nunca bloquea la operación
}

function act_import(array $u, object $body): array {
  $payload = $body->payload ?? null;
  $replace = ($body->replace_catalog ?? false) === true;
  if (!($payload instanceof stdClass) || ($payload->format ?? '') !== 'volt-backup') fail(400, 'El archivo no es un respaldo de VOLT.', 'invalid');
  $drafts = $payload->drafts ?? new stdClass();
  foreach (get_object_vars($drafts) as $k => $data) validate_content($k, $data);   // todo o nada: se valida antes de tocar algo
  $arr = jdec(jenc($payload));
  $r = tx(function () use ($u, $drafts, $arr, $replace) {
    $nc = 0; $ncat = 0; $np = 0; $t = now();
    foreach (get_object_vars($drafts) as $k => $data) {
      q('UPDATE content SET draft = ?, version = version + 1, updated_at = ?, updated_by_email = ? WHERE key = ?', [jcanon($data), $t, $u['email'], $k]);
      $nc++;
    }
    foreach ($arr['categories'] ?? [] as $c) {
      $f = clean_category($c, true);
      $id = val('SELECT id FROM categories WHERE code = ?', [$f['code']]);
      $sort = (int)($c['sort_order'] ?? 0);
      if ($id) q('UPDATE categories SET name = ?, singular = ?, icon = ?, active = ?, sort_order = ?, updated_at = ?, updated_by_email = ? WHERE id = ?',
        [$f['name'], $f['singular'], $f['icon'], $f['active'], $sort, $t, $u['email'], $id]);
      else q('INSERT INTO categories (id, code, name, singular, icon, sort_order, active, created_at, updated_at, updated_by_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [uuid(), $f['code'], $f['name'], $f['singular'], $f['icon'], $sort, $f['active'], $t, $t, $u['email']]);
      $ncat++;
    }
    if (isset($arr['products']) && is_array($arr['products'])) {
      if ($replace) q('DELETE FROM products');
      foreach ($arr['products'] as $p) {
        $cid = val('SELECT id FROM categories WHERE code = ?', [(string)($p['category'] ?? '')]);
        if (!$cid) fail(400, 'El producto “' . ($p['name'] ?? '?') . '” usa una categoría que no existe.', 'invalid');
        $clean = clean_product(['category_id' => $cid] + $p);
        check_price_rules($clean);
        $clean['sort_order'] = (int)($p['sort_order'] ?? 0);
        $id = (is_string($p['id'] ?? null) && preg_match('/^[0-9a-f-]{36}$/', $p['id'])) ? $p['id'] : uuid();
        $cols = array_keys($clean);
        if (val('SELECT 1 FROM products WHERE id = ?', [$id])) {
          q('UPDATE products SET ' . implode(', ', array_map(fn($k) => "$k = ?", $cols)) . ', version = version + 1, updated_at = ?, updated_by_email = ? WHERE id = ?', [...array_values($clean), $t, $u['email'], $id]);
        } else {
          q('INSERT INTO products (id, ' . implode(', ', $cols) . ', created_at, updated_at, updated_by_email) VALUES (?, ' . in_list($cols) . ', ?, ?, ?)', [$id, ...array_values($clean), $t, $t, $u['email']]);
        }
        $np++;
      }
    }
    audit($u, 'import', 'backup', null, (string)($arr['exported_at'] ?? ''), null, ['content' => $nc, 'categories' => $ncat, 'products' => $np, 'replace_catalog' => $replace]);
    return ['content' => $nc, 'categories' => $ncat, 'products' => $np];
  });
  rebuild_public();
  auto_backup('importar');
  return $r;
}

/* ===================== Usuarios (solo propietario) ===================== */
function act_users(): array {
  return array_map(fn($r) => ['user_id' => (int)$r['id'], 'email' => $r['email'], 'role' => $r['role'], 'created_at' => $r['created_at'], 'last_login_at' => $r['last_login_at']],
    rows('SELECT * FROM users ORDER BY id'));
}
function check_role(mixed $r): string { if (!in_array($r, ['owner', 'editor'], true)) fail(400, 'Rol no válido.', 'invalid'); return $r; }
function owners(): int { return (int)val("SELECT COUNT(*) FROM users WHERE role = 'owner'"); }

function act_user_create(array $u, array $b): array {
  $email = check_email($b['email'] ?? '');
  $role = check_role($b['role'] ?? 'editor');
  check_password_policy((string)($b['password'] ?? ''));
  if (val('SELECT 1 FROM users WHERE email = ?', [$email])) fail(409, 'Ya existe un usuario con ese correo.', 'conflict');
  q('INSERT INTO users (email, password_hash, role, created_at, created_by) VALUES (?, ?, ?, ?, ?)', [$email, hash_password((string)$b['password']), $role, now(), $u['email']]);
  $id = (string)db()->lastInsertId();
  audit($u, 'insert', 'admin_users', $id, $email, null, ['email' => $email, 'role' => $role]);
  return ['user_id' => (int)$id, 'email' => $email, 'role' => $role];
}
function act_user_update(array $u, array $b): array {
  $t = row('SELECT * FROM users WHERE id = ?', [(int)($b['id'] ?? 0)]);
  if (!$t) fail(404, 'Ese usuario no existe.', 'not_found');
  $role = check_role($b['role'] ?? '');
  if ($t['role'] === 'owner' && $role !== 'owner' && owners() <= 1) fail(409, 'Debe quedar al menos un propietario.', 'last_owner');
  q('UPDATE users SET role = ? WHERE id = ?', [$role, $t['id']]);
  audit($u, 'update', 'admin_users', (string)$t['id'], $t['email'], ['role' => $t['role']], ['role' => $role]);
  return ['ok' => true];
}
function act_user_password(array $u, array $b): array {
  $t = row('SELECT * FROM users WHERE id = ?', [(int)($b['id'] ?? 0)]);
  if (!$t) fail(404, 'Ese usuario no existe.', 'not_found');
  check_password_policy((string)($b['password'] ?? ''));
  q('UPDATE users SET password_hash = ?, session_epoch = session_epoch + 1 WHERE id = ?', [hash_password((string)$b['password']), $t['id']]);
  if ((int)$t['id'] === (int)$u['id']) $_SESSION['epoch'] = (int)$t['session_epoch'] + 1;
  audit($u, 'update', 'admin_users', (string)$t['id'], $t['email'] . ' (nueva contraseña)');
  return ['ok' => true];
}
function act_user_delete(array $u, array $b): array {
  $t = row('SELECT * FROM users WHERE id = ?', [(int)($b['id'] ?? 0)]);
  if (!$t) fail(404, 'Ese usuario no existe.', 'not_found');
  if ((int)$t['id'] === (int)$u['id']) fail(409, 'No puedes quitarte el acceso a ti mismo.', 'self');
  if ($t['role'] === 'owner' && owners() <= 1) fail(409, 'Debe quedar al menos un propietario.', 'last_owner');
  q('DELETE FROM users WHERE id = ?', [$t['id']]);
  audit($u, 'delete', 'admin_users', (string)$t['id'], $t['email'], ['email' => $t['email'], 'role' => $t['role']], null);
  return ['ok' => true];
}

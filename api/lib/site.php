<?php
/* Lo que ve el visitante: solo contenido publicado y productos visibles.
   Se guarda ya armado en volt-data/publico.json y se regenera cuando algo cambia. */
declare(strict_types=1);

function catalog_public(): array {
  $cats = rows('SELECT id, code, name, singular, icon FROM categories WHERE active = 1 ORDER BY sort_order, name');
  $code = array_column($cats, 'code', 'id');
  $prods = rows('SELECT p.* FROM products p JOIN categories c ON c.id = p.category_id
                 WHERE p.active = 1 AND c.active = 1 ORDER BY p.featured DESC, c.sort_order, p.sort_order, p.name');
  $out = [];
  foreach ($prods as $p) {
    $gallery = jdec($p['gallery']); $features = jdec($p['features']);
    $out[] = array_filter([
      'id' => $p['id'], 'c' => $code[$p['category_id']], 'n' => $p['name'], 'b' => $p['brand'], 'd' => $p['detail'],
      'price' => $p['price'] === null ? null : (int)$p['price'], 'price_max' => $p['price_max'] === null ? null : (int)$p['price_max'],
      'promo' => $p['promo_price'] === null ? null : (int)$p['promo_price'], 's' => $p['stock'] === null ? null : (int)$p['stock'],
      'f' => $p['featured'] ? true : null, 'img' => $p['image_url'], 'alt' => $p['image_alt'],
      'gallery' => $gallery ?: null, 'features' => $features ?: null,
      'cta' => $p['cta_label'], 'msg' => $p['cta_message'], 'url' => $p['cta_url'],
    ], fn($v) => $v !== null);
  }
  return [
    'categories' => array_map(fn($c) => ['code' => $c['code'], 'name' => $c['name'], 'singular' => $c['singular'], 'icon' => $c['icon']], $cats),
    'products' => $out,
  ];
}
function content_map(string $column): stdClass {
  $o = new stdClass();
  foreach (rows("SELECT key, $column AS data FROM content WHERE $column IS NOT NULL ORDER BY key") as $r) $o->{$r['key']} = jdec($r['data'], false);
  return $o;
}
function public_file(): string { return data_dir() . '/publico.json'; }
function rebuild_public(): void {
  write_atomic(public_file(), jenc(['content' => content_map('published'), 'updated_at' => now()] + catalog_public()));
}
function serve_public(): never {
  if (!is_file(public_file())) rebuild_public();
  $etag = '"' . md5_file(public_file()) . '"';
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-cache');
  header('ETag: ' . $etag);
  if (trim($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) { http_response_code(304); exit; }
  readfile(public_file());
  exit;
}
function preview_site(): array {
  return ['content' => content_map('draft'), 'preview' => true, 'updated_at' => now()] + catalog_public();
}

/* SEO publicado dentro del HTML (para Google, WhatsApp y Facebook, que no ejecutan JavaScript). */
function apply_seo(string $html): string {
  if (!is_file(public_file())) rebuild_public();
  $seo = (jdec(file_get_contents(public_file()))['content']['seo'] ?? []) ?: [];
  $attr = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
  $set = function (string $key, string $name, ?string $value) use (&$html, $attr) {
    if (!$value) return;
    $html = preg_replace('~(<meta ' . $key . '="' . preg_quote($name, '~') . '" content=")[^"]*(" />)~', '${1}' . str_replace(['\\', '$'], ['\\\\', '\\$'], $attr($value)) . '${2}', $html, 1);
  };
  if (!empty($seo['title'])) $html = preg_replace('~<title>[^<]*</title>~', '<title>' . str_replace(['\\', '$'], ['\\\\', '\\$'], $attr($seo['title'])) . '</title>', $html, 1);
  $set('name', 'description', $seo['description'] ?? null);
  $set('property', 'og:title', ($seo['ogTitle'] ?? '') ?: ($seo['title'] ?? null));
  $set('property', 'og:description', ($seo['ogDescription'] ?? '') ?: ($seo['description'] ?? null));
  $img = $seo['ogImage'] ?? '';
  if ($img && preg_match(IMAGE_RE, $img)) $set('property', 'og:image', str_starts_with($img, 'https://') ? $img : 'https://voltstoreco.com/' . $img);
  if (($seo['index'] ?? true) === false) $html = preg_replace('~(<meta name="viewport"[^>]*>)~', "$1\n  <meta name=\"robots\" content=\"noindex, nofollow\" />", $html, 1);
  return $html;
}

/* Resumen del panel. */
function overview(): array {
  $pending = array_column(rows('SELECT key FROM content WHERE published IS NULL OR draft <> published ORDER BY key'), 'key');
  // draft y published se guardan con la misma codificación, así que comparar el texto basta.
  $last = row('SELECT published_at AS at, published_by_email AS by FROM content_versions ORDER BY id DESC LIMIT 1');
  return [
    'products_total' => (int)val('SELECT COUNT(*) FROM products'),
    'products_active' => (int)val('SELECT COUNT(*) FROM products WHERE active = 1'),
    'products_out' => (int)val('SELECT COUNT(*) FROM products WHERE active = 1 AND stock = 0'),
    'products_featured' => (int)val('SELECT COUNT(*) FROM products WHERE featured = 1'),
    'categories' => (int)val('SELECT COUNT(*) FROM categories'),
    'media' => (int)val('SELECT COUNT(*) FROM media'),
    'pending' => $pending,
    'last_publish' => $last,
    'recent' => rows('SELECT at, user_email, action, entity, label FROM audit_log ORDER BY id DESC LIMIT 8'),
  ];
}

<?php
/* Validación en el servidor. El contenido de cada sección se valida contra el JSON Schema
   generado desde admin/js/schema.js (lib/schemas.json); productos, categorías e imágenes
   con reglas propias. Nada se guarda si no pasa. */
declare(strict_types=1);

const LINK_RE = '~^(#[A-Za-z0-9_-]*|https?://[^\s"\'<>]+|mailto:[^\s"\'<>]+|tel:[+0-9 ()-]+)$~';
const IMAGE_RE = '~^((?:[A-Za-z0-9_-]+/)*[A-Za-z0-9._-]+\.(?:webp|png|jpe?g|gif|svg|ico)|https://[^\s"\'<>]+)$~';

function content_schemas(): array {
  static $s = null;
  if ($s === null) $s = get_object_vars(jdec(file_get_contents(__DIR__ . '/schemas.json'), false));
  return $s;
}
function content_keys(): array { return array_keys(content_schemas()); }

// Subconjunto de JSON Schema que usa el modelo: type, enum, pattern, min/maxLength, maxItems, items, properties, additionalProperties.
function schema_error(object $s, mixed $v, string $path): ?string {
  $at = $path === '' ? 'el contenido' : "“{$path}”";
  if (isset($s->enum)) return in_array($v, $s->enum, true) ? null : "$at tiene un valor no permitido.";
  switch ($s->type ?? null) {
    case 'object':
      if (!($v instanceof stdClass)) return "$at debe ser un objeto.";
      foreach (get_object_vars($v) as $k => $sub) {
        if (!isset($s->properties->$k)) {
          if (($s->additionalProperties ?? true) === false) return "hay un campo no permitido ($k).";
          continue;
        }
        if ($e = schema_error($s->properties->$k, $sub, $path === '' ? $k : "$path.$k")) return $e;
      }
      return null;
    case 'array':
      if (!is_array($v) || !array_is_list($v)) return "$at debe ser una lista.";
      if (isset($s->maxItems) && count($v) > $s->maxItems) return "$at admite como máximo {$s->maxItems} elementos.";
      foreach ($v as $i => $item) if ($e = schema_error($s->items, $item, "$path." . ($i + 1))) return $e;
      return null;
    case 'string':
      if (!is_string($v)) return "$at debe ser texto.";
      $len = mb_strlen($v);
      if (isset($s->maxLength) && $len > $s->maxLength) return "$at supera el largo máximo ({$s->maxLength}).";
      if (isset($s->minLength) && $len < $s->minLength) return "$at es obligatorio.";
      if (isset($s->pattern) && !preg_match('~' . str_replace('~', '\~', $s->pattern) . '~u', $v)) return "$at tiene un formato no válido (enlace, imagen o color).";
      return null;
    case 'boolean':
      return is_bool($v) ? null : "$at debe ser sí o no.";
    case 'integer':
      return is_int($v) ? null : "$at debe ser un número entero.";
  }
  return null;
}
function validate_content(string $key, mixed $data): void {
  $schemas = content_schemas();
  if (!isset($schemas[$key])) fail(400, "Sección desconocida: $key", 'invalid');
  if (!($data instanceof stdClass)) fail(400, "El contenido de “{$key}” debe ser un objeto.", 'invalid');
  if (strlen(jenc($data)) > 200000) fail(413, 'El contenido es demasiado grande.', 'invalid');
  if ($e = schema_error($schemas[$key], $data, '')) fail(400, "Datos no válidos en “{$key}”: $e", 'invalid');
}

/* ---------- productos ---------- */
function str_or_null(mixed $v, int $max, string $label): ?string {
  if ($v === null) return null;
  if (!is_string($v)) fail(400, "$label debe ser texto.", 'invalid');
  $v = trim($v);
  if ($v === '') return null;
  if (mb_strlen($v) > $max) fail(400, "$label admite como máximo $max caracteres.", 'invalid');
  return $v;
}
function int_or_null(mixed $v, string $label, int $min = 0, int $max = 100000000): ?int {
  if ($v === null || $v === '') return null;
  if (!is_int($v) && !(is_string($v) && preg_match('/^\d+$/', $v))) fail(400, "$label debe ser un número entero.", 'invalid');
  $v = (int)$v;
  if ($v < $min || $v > $max) fail(400, "$label está fuera del rango permitido.", 'invalid');
  return $v;
}
function check_image(?string $u, string $label): ?string {
  if ($u === null) return null;
  if (!preg_match(IMAGE_RE, $u)) fail(400, "$label no es una imagen válida.", 'invalid');
  return $u;
}
function check_link(?string $u, string $label): ?string {
  if ($u === null) return null;
  if (!preg_match(LINK_RE, $u)) fail(400, "$label no es un enlace válido (usa #seccion, https://, mailto: o tel:).", 'invalid');
  return $u;
}
// Devuelve solo los campos permitidos, limpios y validados. $partial: actualización de algunos campos.
function clean_product(array $p, bool $partial = false): array {
  $out = [];
  $has = fn($k) => array_key_exists($k, $p);
  if (!$partial || $has('name')) {
    $name = str_or_null($p['name'] ?? null, 120, 'El nombre');
    if ($name === null) fail(400, 'El nombre del producto es obligatorio.', 'invalid');
    $out['name'] = $name;
  }
  if (!$partial || $has('category_id')) {
    $cid = (string)($p['category_id'] ?? '');
    if (!val('SELECT 1 FROM categories WHERE id = ?', [$cid])) fail(400, 'La categoría no existe.', 'invalid');
    $out['category_id'] = $cid;
  }
  foreach (['brand' => [60, 'La marca'], 'detail' => [300, 'La descripción'], 'image_alt' => [160, 'El texto alternativo'],
            'cta_label' => [30, 'El texto del botón'], 'cta_message' => [300, 'El mensaje de WhatsApp']] as $k => [$max, $label]) {
    if (!$partial || $has($k)) $out[$k] = str_or_null($p[$k] ?? null, $max, $label);
  }
  foreach (['price' => 'El precio', 'price_max' => 'El precio máximo', 'promo_price' => 'El precio promocional'] as $k => $label) {
    if (!$partial || $has($k)) $out[$k] = int_or_null($p[$k] ?? null, $label);
  }
  if (!$partial || $has('stock')) $out['stock'] = int_or_null($p['stock'] ?? null, 'El stock', 0, 1000000);
  foreach (['active', 'featured'] as $k) {
    if (!$partial || $has($k)) {
      if (!is_bool($p[$k] ?? false)) fail(400, "El campo $k debe ser sí o no.", 'invalid');
      $out[$k] = ($p[$k] ?? ($k === 'active')) ? 1 : 0;
    }
  }
  if ($has('sort_order')) $out['sort_order'] = int_or_null($p['sort_order'], 'El orden', 0, 1000000) ?? 0;
  if (!$partial || $has('image_url')) $out['image_url'] = check_image(str_or_null($p['image_url'] ?? null, 500, 'La imagen'), 'La imagen');
  if (!$partial || $has('cta_url')) $out['cta_url'] = check_link(str_or_null($p['cta_url'] ?? null, 500, 'El enlace'), 'El enlace');
  if (!$partial || $has('gallery')) {
    $g = $p['gallery'] ?? [];
    if (!is_array($g) || !array_is_list($g) || count($g) > 8) fail(400, 'La galería admite hasta 8 imágenes.', 'invalid');
    foreach ($g as $u) if (!is_string($u)) fail(400, 'La galería tiene una imagen no válida.', 'invalid'); else check_image($u, 'Una imagen de la galería');
    $out['gallery'] = jenc(array_values($g));
  }
  if (!$partial || $has('features')) {
    $f = $p['features'] ?? [];
    if (!is_array($f) || !array_is_list($f) || count($f) > 12) fail(400, 'Las características admiten hasta 12 elementos.', 'invalid');
    $f = array_values(array_filter(array_map(fn($x) => is_string($x) ? trim($x) : fail(400, 'Característica no válida.', 'invalid'), $f), fn($x) => $x !== ''));
    foreach ($f as $x) if (mb_strlen($x) > 100) fail(400, 'Cada característica admite como máximo 100 caracteres.', 'invalid');
    $out['features'] = jenc($f);
  }
  return $out;
}
function check_price_rules(array $merged): void {
  if ($merged['price_max'] !== null && ($merged['price'] === null || $merged['price_max'] < $merged['price'])) {
    fail(400, 'El precio máximo debe ser mayor o igual al precio.', 'invalid');
  }
  if ($merged['promo_price'] !== null && ($merged['price'] === null || $merged['promo_price'] >= $merged['price'])) {
    fail(400, 'El precio promocional debe ser menor que el precio normal.', 'invalid');
  }
}

/* ---------- categorías ---------- */
function clean_category(array $c, bool $isNew): array {
  $out = [];
  foreach (['name' => 'El nombre', 'singular' => 'El nombre en singular'] as $k => $label) {
    if ($isNew || array_key_exists($k, $c)) {
      $v = str_or_null($c[$k] ?? null, 40, $label);
      if ($v === null) fail(400, "$label es obligatorio.", 'invalid');
      $out[$k] = $v;
    }
  }
  if ($isNew || array_key_exists('icon', $c)) $out['icon'] = str_or_null($c['icon'] ?? null, 16, 'El ícono') ?? '🛒';
  if ($isNew || array_key_exists('active', $c)) $out['active'] = !empty($c['active']) ? 1 : 0;
  if ($isNew) {
    $code = (string)($c['code'] ?? '');
    if (!preg_match('/^[a-z0-9-]{2,24}$/', $code)) fail(400, 'El código de la categoría no es válido.', 'invalid');
    $out['code'] = $code;
  }
  return $out;
}

function check_email(mixed $e): string {
  $e = is_string($e) ? trim($e) : '';
  if (!filter_var($e, FILTER_VALIDATE_EMAIL) || mb_strlen($e) > 160) fail(400, 'Escribe un correo válido.', 'invalid');
  return $e;
}

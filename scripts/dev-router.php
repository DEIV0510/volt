<?php
/* Servidor de desarrollo (imita el .htaccess de Hostinger):
     php -S localhost:5230 scripts/dev-router.php
   Los datos locales van a ../volt-data-dev (fuera del repositorio). */
declare(strict_types=1);
$root = dirname(__DIR__);
if (!getenv('VOLT_DATA_DIR')) putenv('VOLT_DATA_DIR=' . dirname($root) . '/volt-data-dev');
$path = rawurldecode((string)parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
$admin = str_starts_with($path, '/admin/');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('X-Frame-Options: ' . ($admin ? 'DENY' : 'SAMEORIGIN'));
header('Content-Security-Policy: ' . ($admin
  ? "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"
  : "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"));
header('Cache-Control: no-store');

$notFound = function () use ($root) { http_response_code(404); header('Content-Type: text/html; charset=utf-8'); readfile($root . '/404.html'); return true; };
if (preg_match('~(^|/)\.|^/(api/(lib|seed|data-privada)|scripts|_imgwork|node_modules)(/|$)~', $path)) return $notFound();
if ($path === '/' || $path === '/index.php') { require $root . '/index.php'; return true; }
if ($path === '/api' || $path === '/api/' || $path === '/api/index.php') { require $root . '/api/index.php'; return true; }
if (str_ends_with($path, '/')) $path .= 'index.html';
$file = realpath($root . $path);
if (!$file || !str_starts_with($file, realpath($root)) || !is_file($file) || preg_match('/\.(php\d?|phtml|phar)$/i', $file)) return $notFound();
$types = ['html' => 'text/html; charset=utf-8', 'css' => 'text/css; charset=utf-8', 'js' => 'application/javascript; charset=utf-8',
  'json' => 'application/json; charset=utf-8', 'xml' => 'application/xml', 'txt' => 'text/plain; charset=utf-8', 'svg' => 'image/svg+xml',
  'webp' => 'image/webp', 'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'gif' => 'image/gif', 'ico' => 'image/x-icon'];
header('Content-Type: ' . ($types[strtolower(pathinfo($file, PATHINFO_EXTENSION))] ?? 'application/octet-stream'));
readfile($file);
return true;

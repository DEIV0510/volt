<?php
/* Inicio: entrega index.html con el SEO publicado en el panel ya incluido en el HTML
   (título, descripción, imagen para compartir, indexación), porque Google, WhatsApp y
   Facebook leen el HTML sin ejecutar JavaScript, y con lo publicado como datos para que la
   página aparezca con su contenido real de inmediato. Si algo falla, entrega index.html tal cual. */
declare(strict_types=1);
$html = (string)file_get_contents(__DIR__ . '/index.html');
try {
  require __DIR__ . '/api/lib/bootstrap.php';
  require __DIR__ . '/api/lib/validate.php';
  require __DIR__ . '/api/lib/site.php';
  $html = inline_public(apply_seo($html));
} catch (Throwable $e) {
  // Se entrega el HTML original.
}
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
echo $html;

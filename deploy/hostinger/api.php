<?php
declare(strict_types=1);
// Only this bridge and browser assets live under public_html/tft.
$domain = dirname(__DIR__, 2);
require $domain . '/private/tft/host.php';
require $domain . '/private/tft/current/src/Http.php';

<?php
declare(strict_types=1);
require __DIR__ . '/../src/Tickets.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
// Scaffold is deliberately disabled unless explicitly enabled by its local launcher.
if (getenv('TFT_DEMO_ENABLED') !== '1') {
    http_response_code(503);
    echo json_encode(['error' => 'Demo storage is disabled.']);
    exit;
}
ini_set('session.use_strict_mode', '1');
session_set_cookie_params(['httponly' => true, 'samesite' => 'Strict', 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off']);
session_start();
$_SESSION['workspace'] ??= bin2hex(random_bytes(24));
$_SESSION['csrf'] ??= bin2hex(random_bytes(32));
try {
    $method = $_SERVER['REQUEST_METHOD'];
    if ($method === 'GET' && ($_GET['action'] ?? '') === 'bootstrap') {
        echo json_encode(['categories' => categories(), 'csrf' => $_SESSION['csrf']], JSON_THROW_ON_ERROR);
        exit;
    }
    if (!in_array($method, ['GET', 'POST'], true)) {
        http_response_code(405); header('Allow: GET, POST'); echo json_encode(['error' => 'Method not allowed.']); exit;
    }
    if ($method === 'POST' && !hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) {
        http_response_code(403); echo json_encode(['error' => 'Refresh the page before saving.']); exit;
    }
    $ticket = null;
    if ($method === 'POST') {
        $raw = file_get_contents('php://input', false, null, 0, 32769);
        if (strlen($raw) > 32768) { http_response_code(413); echo json_encode(['error' => 'Submission is too large.']); exit; }
        $input = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
        if (!is_array($input) || array_is_list($input)) throw new InvalidArgumentException('Submit a ticket object.');
        $ticket = validateTicket($input);
    }
    $store = new TicketStore(getenv('TFT_DB_PATH') ?: __DIR__ . '/../var/tickets.sqlite');
    if ($ticket !== null) {
        $result = $store->save($_SESSION['workspace'], $ticket);
        http_response_code(201); echo json_encode($result, JSON_THROW_ON_ERROR);
    } else {
        echo json_encode(['tickets' => $store->list($_SESSION['workspace'])], JSON_THROW_ON_ERROR);
    }
} catch (InvalidArgumentException | JsonException $error) {
    http_response_code(422); echo json_encode(['error' => $error->getMessage()]);
} catch (Throwable $error) {
    http_response_code(500); echo json_encode(['error' => 'Unable to access demo storage. Try again later.']);
}

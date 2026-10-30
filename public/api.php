<?php
declare(strict_types=1);
require __DIR__ . '/../src/Tickets.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
if (getenv('TFT_DEMO_ENABLED') !== '1') {
    http_response_code(503); echo json_encode(['error' => 'Demo storage is disabled.']); exit;
}
ini_set('session.use_strict_mode', '1');
session_set_cookie_params(['httponly' => true, 'samesite' => 'Strict', 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off']);
session_start();
$_SESSION['workspace'] ??= bin2hex(random_bytes(24));
$_SESSION['csrf'] ??= bin2hex(random_bytes(32));
try {
    $method = $_SERVER['REQUEST_METHOD']; $action = $_GET['action'] ?? 'tickets'; $scope = $_GET['scope'] ?? 'user';
    if (!in_array($method, ['GET', 'POST'], true)) {
        http_response_code(405); header('Allow: GET, POST'); echo json_encode(['error' => 'Method not allowed.']); exit;
    }
    if (!in_array($action, ['bootstrap', 'tickets', 'settings', 'reset', 'validate'], true) || !in_array($scope, ['user', 'system'], true)) {
        http_response_code(404); echo json_encode(['error' => 'Unknown action or scope.']); exit;
    }
    if ($method === 'POST' && !hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) {
        http_response_code(403); echo json_encode(['error' => 'Refresh the page before saving.']); exit;
    }
    if ($method === 'POST' && $scope === 'system') {
        $secret = getenv('TFT_ADMIN_TOKEN') ?: '';
        if (strlen($secret) < 32 || !hash_equals($secret, $_SERVER['HTTP_X_TFT_ADMIN'] ?? '')) {
            http_response_code(403); echo json_encode(['error' => 'Administrator access is required to change shared defaults.']); exit;
        }
    }
    $body = [];
    if ($method === 'POST') {
        $raw = file_get_contents('php://input', false, null, 0, 262145);
        if (strlen($raw) > 262144) { http_response_code(413); echo json_encode(['error' => 'Submission is too large.']); exit; }
        $body = json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
        if (!is_array($body) || array_is_list($body)) throw new InvalidArgumentException('Submit a JSON object.');
    }
    $store = new TicketStore(getenv('TFT_DB_PATH') ?: __DIR__ . '/../var/tickets.sqlite');
    $settings = $store->settings(); $workspace = $_SESSION['workspace'];
    $effective = $settings->get($workspace, 'user');
    if ($method === 'GET') {
        $result = match ($action) {
            'bootstrap' => ['categories' => categories(), 'csrf' => $_SESSION['csrf'], 'settings' => $effective, 'tags' => availableTags($effective['config']), 'adminConfigured' => strlen(getenv('TFT_ADMIN_TOKEN') ?: '') >= 32],
            'settings' => $settings->get($workspace, $scope),
            'tickets' => ['tickets' => $store->list($workspace)],
            default => throw new InvalidArgumentException('Use POST for this action.')
        };
    } elseif ($action === 'settings' || $action === 'reset') {
        $result = $settings->save($workspace, $scope, $body, $action === 'reset');
    } elseif ($action === 'tickets' || $action === 'validate') {
        if (!is_int($body['settingsRevision'] ?? null) || !is_int($body['systemRevision'] ?? null) || $body['settingsRevision'] !== $effective['revision'] || $body['systemRevision'] !== $effective['systemRevision']) throw new SettingsConflict('Ticket settings changed. Export your draft, then reload the workspace.');
        $input = $body['ticket'] ?? null;
        if (!is_array($input) || array_is_list($input)) throw new InvalidArgumentException('Submit a ticket object.');
        $known = array_merge(array_column($effective['config']['fields'], 'id'), ['category', 'answers']);
        if (array_diff(array_keys($input), $known)) throw new InvalidArgumentException('Ticket has unrecognized fields. Check settings before importing.');
        $ticket = validateTicket($input, $effective['config']);
        $formatId = $body['formatId'] ?? $effective['config']['defaultFormat'];
        if (!is_string($formatId)) throw new InvalidArgumentException('Choose a valid output format.');
        // Validate selected format even on a preview request.
        $formatted = renderTicket($ticket, $effective['config'], $formatId);
        $result = $action === 'validate' ? ['ticket' => $ticket, 'formatted' => $formatted] : $store->save($workspace, $ticket, $effective['config'], $formatId);
        if ($action === 'tickets') http_response_code(201);
    } else { throw new InvalidArgumentException('Use GET for bootstrap.'); }
    echo json_encode($result, JSON_THROW_ON_ERROR);
} catch (SettingsConflict $error) {
    http_response_code(409); echo json_encode(['error' => $error->getMessage()]);
} catch (InvalidArgumentException | JsonException | TypeError $error) {
    http_response_code(422); echo json_encode(['error' => $error instanceof TypeError ? 'Check the submitted settings and field types.' : $error->getMessage()]);
} catch (Throwable $error) {
    http_response_code(500); echo json_encode(['error' => 'Unable to access demo storage. Try again later.']);
}

<?php
declare(strict_types=1);
require __DIR__ . '/../src/Tickets.php';
function check(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
$input = ['category' => 'network', 'requester' => 'Alex Example', 'summary' => 'Connection unavailable', 'answers' => ['scope' => 'One device'], 'priority' => 'High'];
$ticket = validateTicket($input);
check(str_contains(formatTicket($ticket), "One device"), 'Questionnaire answer must appear in ticket.');
$path = sys_get_temp_dir() . '/tft-test-' . bin2hex(random_bytes(8)) . '/tickets.sqlite';
try {
    $store = new TicketStore($path);
    $saved = $store->save('workspace-a', $ticket);
    $reopened = new TicketStore($path);
    check(count($reopened->list('workspace-a')) === 1, 'Ticket must persist after reopening storage.');
    check($reopened->list('workspace-b') === [], 'Another workspace must not see this ticket.');
    check($saved['formatted'] === $reopened->list('workspace-a')[0]['formatted'], 'Saved format must match.');
    foreach ([['category' => '../config'], ['requester' => ''], ['priority' => 'Urgent'], ['summary' => str_repeat('x',201)], ['answers' => ['scope' => []]]] as $bad) {
        try { validateTicket(array_replace($input,$bad)); throw new RuntimeException('Invalid ticket accepted.'); }
        catch (InvalidArgumentException) {}
    }
    $payload = array_replace($input, ['summary' => "<script>alert('demo')</script>"]);
    $saved = $store->save('workspace-a', validateTicket($payload));
    check(str_contains($saved['formatted'], '<SCRIPT>'), 'Text must remain text, never be rendered as HTML by the UI.');
    echo "PASS persistence, workspace isolation, validation and plain text storage\n";
} finally { if (is_file($path)) unlink($path); if (is_dir(dirname($path))) rmdir(dirname($path)); }

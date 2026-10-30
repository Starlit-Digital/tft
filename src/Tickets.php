<?php
declare(strict_types=1);

function categories(): array
{
    return json_decode(file_get_contents(__DIR__ . '/../config/categories.json'), true, 512, JSON_THROW_ON_ERROR);
}

function validateTicket(array $input): array
{
    $schema = categories();
    if (!is_string($input['category'] ?? null) || !isset($schema[$input['category']])) {
        throw new InvalidArgumentException('Choose a valid issue category.');
    }
    $ticket = ['category' => $input['category']];
    foreach (['requester' => 120, 'summary' => 200, 'location' => 200, 'asset' => 100, 'troubleshooting' => 4000] as $field => $limit) {
        $value = $input[$field] ?? '';
        if (!is_string($value) || strlen($value) > $limit || str_contains($value, "\0")) {
            throw new InvalidArgumentException("Check the $field field and its length.");
        }
        $ticket[$field] = trim($value);
    }
    foreach (['requester', 'summary'] as $required) {
        if ($ticket[$required] === '') throw new InvalidArgumentException("Complete the $required field.");
    }
    $ticket['priority'] = $input['priority'] ?? 'Normal';
    if (!in_array($ticket['priority'], ['Low', 'Normal', 'High'], true)) throw new InvalidArgumentException('Choose a valid priority.');
    $answers = $input['answers'] ?? [];
    if (!is_array($answers)) throw new InvalidArgumentException('Check the questionnaire answers.');
    $ticket['answers'] = [];
    foreach ($schema[$ticket['category']]['questions'] as $key => $label) {
        $answer = $answers[$key] ?? '';
        if (!is_string($answer) || strlen($answer) > 2000 || str_contains($answer, "\0")) throw new InvalidArgumentException('Check the questionnaire answer length.');
        $ticket['answers'][$key] = trim($answer);
    }
    return $ticket;
}

function formatTicket(array $ticket): string
{
    $category = categories()[$ticket['category']];
    $lines = [strtoupper($ticket['summary']), 'Category: ' . $category['label']];
    foreach (['requester' => 'Requester', 'priority' => 'Priority', 'location' => 'Location', 'asset' => 'Asset'] as $key => $label) {
        $lines[] = $label . ': ' . ($ticket[$key] ?: 'Not provided');
    }
    $lines[] = '';
    foreach ($category['questions'] as $key => $label) $lines[] = $label . "\n" . ($ticket['answers'][$key] ?: 'Not provided');
    $lines[] = "\nTroubleshooting:\n" . ($ticket['troubleshooting'] ?: 'Not provided');
    return implode("\n", $lines);
}

final class TicketStore
{
    private PDO $db;
    public function __construct(string $path)
    {
        if (!is_dir(dirname($path)) && !mkdir(dirname($path), 0700, true) && !is_dir(dirname($path))) throw new RuntimeException('Cannot create storage.');
        $this->db = new PDO('sqlite:' . $path, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        chmod($path, 0600);
        $this->db->exec('PRAGMA busy_timeout = 5000');
        $this->db->exec('CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, workspace TEXT NOT NULL, created_at TEXT NOT NULL, payload TEXT NOT NULL, formatted TEXT NOT NULL)');
    }
    public function save(string $workspace, array $ticket): array
    {
        $record = ['id' => 'TFT-' . strtoupper(bin2hex(random_bytes(6))), 'created_at' => gmdate('c'), 'ticket' => $ticket, 'formatted' => formatTicket($ticket)];
        $query = $this->db->prepare('INSERT INTO tickets VALUES (?, ?, ?, ?, ?)');
        $query->execute([$record['id'], $workspace, $record['created_at'], json_encode($ticket, JSON_THROW_ON_ERROR), $record['formatted']]);
        return $record;
    }
    public function list(string $workspace): array
    {
        $query = $this->db->prepare('SELECT id, created_at, payload, formatted FROM tickets WHERE workspace = ? ORDER BY created_at DESC, rowid DESC LIMIT 100');
        $query->execute([$workspace]);
        return array_map(static fn(array $row): array => ['id' => $row['id'], 'created_at' => $row['created_at'], 'ticket' => json_decode($row['payload'], true, 512, JSON_THROW_ON_ERROR), 'formatted' => $row['formatted']], $query->fetchAll(PDO::FETCH_ASSOC));
    }
}

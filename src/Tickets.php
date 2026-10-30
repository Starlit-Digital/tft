<?php
declare(strict_types=1);

function categories(): array
{
    return json_decode(file_get_contents(__DIR__ . '/../config/categories.json'), true, 512, JSON_THROW_ON_ERROR);
}

require_once __DIR__ . "/Settings.php";

function validateTicket(array $input, ?array $settings = null): array
{
    $schema = categories();
    if (!is_string($input['category'] ?? null) || !isset($schema[$input['category']])) {
        throw new InvalidArgumentException('Choose a valid issue category.');
    }
    $settings ??= defaultSettings();
    $ticket = ['category' => $input['category']];
    foreach ($settings['fields'] as $field) {
        $key = $field['id'];
        $value = $input[$key] ?? ($key === 'priority' && in_array('Normal', $field['options'], true) ? 'Normal' : '');
        $limit = match ($key) { 'summary' => 200, 'requester' => 120, 'location' => 200, 'asset' => 100, default => $field['type'] === 'textarea' ? 4000 : 500 };
        if (!is_string($value) || strlen($value) > $limit || str_contains($value, "\0")) throw new InvalidArgumentException('Check ' . $field['label'] . ' and its length.');
        $value = trim($value);
        if ($field['required'] && $value === '') throw new InvalidArgumentException('Complete ' . $field['label'] . '.');
        if ($value !== '' && $field['type'] === 'select' && !in_array($value, $field['options'], true)) throw new InvalidArgumentException('Choose a valid ' . $field['label'] . '.');
        if ($value !== '' && $field['type'] === 'workgroup' && !in_array($value, array_column($settings['workgroups'], 'code'), true)) throw new InvalidArgumentException('Choose a known workgroup code.');
        $ticket[$key] = $value;
    }
    $answers = $input['answers'] ?? [];
    if (!is_array($answers)) throw new InvalidArgumentException('Check the questionnaire answers.');
    if (array_diff(array_keys($answers), array_keys($schema[$ticket['category']]['questions']))) throw new InvalidArgumentException('Questionnaire has unrecognized answers.');
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

function renderTicket(array $ticket, array $settings, string $formatId): string
{
    $formats = array_column($settings['formats'], null, 'id');
    if (!isset($formats[$formatId])) throw new InvalidArgumentException('Choose a known output format.');
    $values = [];
    foreach ($settings['fields'] as $field) $values[$field['id']] = $ticket[$field['id']] ?? '';
    $values['category'] = $ticket['category'];
    $values['category.label'] = categories()[$ticket['category']]['label'];
    $values['workgroup.code'] = $ticket['workgroup'] ?? '';
    $groups = array_column($settings['workgroups'], 'name', 'code');
    $values['workgroup.name'] = $groups[$ticket['workgroup'] ?? ''] ?? '';
    $answers = [];
    foreach (categories()[$ticket['category']]['questions'] as $key => $label) {
        $values['answers.' . $key] = $ticket['answers'][$key] ?? '';
        $answers[] = $label . "\n" . ($values['answers.' . $key] !== '' ? $values['answers.' . $key] : 'Not provided');
    }
    $values['answers'] = implode("\n", $answers);
    return preg_replace_callback('/\{\{(.*?)\}\}/s', static fn($m) => $values[trim($m[1])] ?? '', $formats[$formatId]['body']);
}

final class TicketStore
{
    private PDO $db;
    public function __construct(string $path)
    {
        if (!is_dir(dirname($path)) && !mkdir(dirname($path), 0700, true) && !is_dir(dirname($path))) throw new RuntimeException('Cannot create storage.');
        $this->db = new PDO('sqlite:' . $path, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        if ($path !== ":memory:") chmod($path, 0600);
        $this->db->exec('PRAGMA busy_timeout = 5000');
        $this->db->exec('CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, workspace TEXT NOT NULL, created_at TEXT NOT NULL, payload TEXT NOT NULL, formatted TEXT NOT NULL)');
        $columns = array_column($this->db->query('PRAGMA table_info(tickets)')->fetchAll(PDO::FETCH_ASSOC), 'name');
        if (!in_array('spec', $columns, true)) $this->db->exec('ALTER TABLE tickets ADD COLUMN spec TEXT');
    }
    public function settings(): SettingsStore { return new SettingsStore($this->db); }
    public function save(string $workspace, array $ticket, ?array $settings = null, ?string $formatId = null): array
    {
        $spec = $settings === null ? null : ['config' => $settings, 'formatId' => $formatId ?? $settings['defaultFormat']];
        $record = ['id' => 'TFT-' . strtoupper(bin2hex(random_bytes(6))), 'created_at' => gmdate('c'), 'ticket' => $ticket, 'formatted' => $settings === null ? formatTicket($ticket) : renderTicket($ticket, $settings, $spec['formatId']), 'spec' => $spec];
        $query = $this->db->prepare('INSERT INTO tickets (id, workspace, created_at, payload, formatted, spec) VALUES (?, ?, ?, ?, ?, ?)');
        $query->execute([$record['id'], $workspace, $record['created_at'], json_encode($ticket, JSON_THROW_ON_ERROR), $record['formatted'], $spec === null ? null : json_encode($spec, JSON_THROW_ON_ERROR)]);
        return $record;
    }
    public function list(string $workspace): array
    {
        $query = $this->db->prepare('SELECT id, created_at, payload, formatted, spec FROM tickets WHERE workspace = ? ORDER BY created_at DESC, rowid DESC LIMIT 100');
        $query->execute([$workspace]);
        return array_map(static fn(array $row): array => ['id' => $row['id'], 'created_at' => $row['created_at'], 'ticket' => json_decode($row['payload'], true, 512, JSON_THROW_ON_ERROR), 'formatted' => $row['formatted'], 'spec' => $row['spec'] === null ? null : json_decode($row['spec'], true, 64, JSON_THROW_ON_ERROR)], $query->fetchAll(PDO::FETCH_ASSOC));
    }
}

<?php
declare(strict_types=1);

function categories(): array
{
    return json_decode(file_get_contents(__DIR__ . '/../config/categories.json'), true, 512, JSON_THROW_ON_ERROR);
}

require_once __DIR__ . "/Settings.php";
require_once __DIR__ . "/Workflow.php";

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
    private Workflow $workflow;

    public function __construct(string $path)
    {
        if (!is_dir(dirname($path)) && !mkdir(dirname($path), 0700, true) && !is_dir(dirname($path))) throw new RuntimeException('Cannot create storage.');
        $this->db = new PDO('sqlite:' . $path, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        if ($path !== ':memory:') chmod($path, 0600);
        $this->db->exec('PRAGMA busy_timeout = 5000');
        $this->db->exec('CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, workspace TEXT NOT NULL, created_at TEXT NOT NULL, payload TEXT NOT NULL, formatted TEXT NOT NULL)');
        $this->db->exec('BEGIN IMMEDIATE');
        try {
            $columns = array_column($this->db->query('PRAGMA table_info(tickets)')->fetchAll(PDO::FETCH_ASSOC), 'name');
            if (!in_array('spec', $columns, true)) $this->db->exec('ALTER TABLE tickets ADD COLUMN spec TEXT');
            $this->workflow = new Workflow($this->db);
            $this->db->exec('COMMIT');
        } catch (Throwable $error) { $this->db->exec('ROLLBACK'); throw $error; }
    }

    public function settings(): SettingsStore { return new SettingsStore($this->db); }
    public function workflow(): Workflow { return $this->workflow; }

    private function insert(string $workspace, array $ticket, ?array $settings, ?string $formatId, ?string $time = null): array
    {
        $settings ??= defaultSettings();
        $spec = ['config' => $settings, 'formatId' => $formatId ?? $settings['defaultFormat']];
        $record = ['id' => 'TFT-' . strtoupper(bin2hex(random_bytes(6))), 'created_at' => $time ?? gmdate('c'), 'ticket' => $ticket, 'formatted' => renderTicket($ticket, $settings, $spec['formatId']), 'spec' => $spec];
        $query = $this->db->prepare('INSERT INTO tickets (id, workspace, created_at, payload, formatted, spec) VALUES (?, ?, ?, ?, ?, ?)');
        $query->execute([$record['id'], $workspace, $record['created_at'], json_encode($ticket, JSON_THROW_ON_ERROR), $record['formatted'], json_encode($spec, JSON_THROW_ON_ERROR)]);
        $this->workflow->created($workspace, $record['id'], $ticket, $record['created_at']);
        return $record + ['workflow' => $this->workflow->state($workspace, $record['id'])];
    }

    public function save(string $workspace, array $ticket, ?array $settings = null, ?string $formatId = null): array
    {
        $this->db->exec('BEGIN IMMEDIATE');
        try {
            $record = $this->insert($workspace, $ticket, $settings, $formatId);
            $this->db->exec('COMMIT'); return $record;
        } catch (Throwable $error) { $this->db->exec('ROLLBACK'); throw $error; }
    }

    private function decode(array $row): array
    {
        return ['id' => $row['id'], 'created_at' => $row['created_at'], 'ticket' => json_decode($row['payload'], true, 64, JSON_THROW_ON_ERROR), 'formatted' => $row['formatted'], 'spec' => $row['spec'] === null ? null : json_decode($row['spec'], true, 64, JSON_THROW_ON_ERROR), 'workflow' => ['status' => $row['status'], 'assignee' => $row['assignee'], 'workgroup' => $row['workgroup'], 'priority' => $row['priority'], 'revision' => (int)$row['revision'], 'updated_at' => $row['updated_at'], 'escalation_reason' => $row['escalation_reason']]];
    }

    public function list(string $workspace): array { return $this->queue($workspace)['tickets']; }

    public function queue(string $workspace, array $filters = []): array
    {
        $where = ['t.workspace=?']; $values = [$workspace];
        foreach (['status', 'priority', 'workgroup', 'assignee'] as $field) {
            if (isset($filters[$field]) && $filters[$field] !== '') {
                if (!is_string($filters[$field]) || strlen($filters[$field]) > 100) throw new InvalidArgumentException('Choose valid queue filters.');
                $where[] = 'w.' . $field . '=?'; $values[] = $filters[$field] === '__unassigned' && $field === 'assignee' ? '' : $filters[$field];
            }
        }
        $search = $filters['q'] ?? '';
        if (!is_string($search) || strlen($search) > 200) throw new InvalidArgumentException('Use a search of up to 200 characters.');
        if ($search !== '') {
            $where[] = "(t.id LIKE ? ESCAPE '\\' OR t.payload LIKE ? ESCAPE '\\')";
            $term = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search) . '%';
            array_push($values, $term, $term);
        }
        $base = ' FROM tickets t JOIN ticket_workflow w ON w.ticket_id=t.id AND w.workspace=t.workspace WHERE ' . implode(' AND ', $where);
        $q = $this->db->prepare('SELECT COUNT(*)' . $base); $q->execute($values); $matched = (int)$q->fetchColumn();
        $q = $this->db->prepare('SELECT t.*, w.status, w.assignee, w.workgroup, w.priority, w.revision, w.updated_at, w.escalation_reason' . $base . ' ORDER BY w.updated_at DESC, t.rowid DESC LIMIT 100');
        $q->execute($values);
        return ['tickets' => array_map($this->decode(...), $q->fetchAll(PDO::FETCH_ASSOC)), 'matched' => $matched, 'limit' => 100];
    }

    public function get(string $workspace, string $id, array $settings): array
    {
        $q = $this->db->prepare('SELECT t.*, w.status, w.assignee, w.workgroup, w.priority, w.revision, w.updated_at, w.escalation_reason FROM tickets t JOIN ticket_workflow w ON w.ticket_id=t.id AND w.workspace=t.workspace WHERE t.workspace=? AND t.id=?');
        $q->execute([$workspace, $id]); $row = $q->fetch(PDO::FETCH_ASSOC);
        if (!$row) throw new TicketNotFound('Ticket not found in this workspace.');
        $record = $this->decode($row); $record['events'] = $this->workflow->events($workspace, $id);
        $groupNames = array_column($settings['workgroups'], 'name', 'code') + array_column($record['spec']['config']['workgroups'] ?? [], 'name', 'code');
        $agents = array_column(Workflow::agents(), 'name', 'id'); $state = $record['workflow'];
        $record['handoff'] = implode("\n", [$record['id'] . ' · ' . $record['ticket']['summary'], 'Status: ' . $state['status'], 'Priority: ' . $state['priority'], 'Workgroup: ' . $state['workgroup'] . ' / ' . ($groupNames[$state['workgroup']] ?? 'Unassigned'), 'Assigned to: ' . ($agents[$state['assignee']] ?? 'Unassigned'), 'Escalation reason: ' . ($state['escalation_reason'] ?: 'None'), '', 'Original ticket output:', $record['formatted']]);
        return $record;
    }

    public function overview(string $workspace): array
    {
        $counts = array_fill_keys(Workflow::STATUSES, 0);
        $q = $this->db->prepare('SELECT status, COUNT(*) AS count FROM ticket_workflow WHERE workspace=? GROUP BY status'); $q->execute([$workspace]);
        foreach ($q->fetchAll(PDO::FETCH_ASSOC) as $row) $counts[$row['status']] = (int)$row['count'];
        $q = $this->db->prepare("SELECT COUNT(*) FROM ticket_workflow WHERE workspace=? AND status!='Resolved' AND assignee=''"); $q->execute([$workspace]); $unassigned = (int)$q->fetchColumn();
        $q = $this->db->prepare("SELECT workgroup, COUNT(*) AS count FROM ticket_workflow WHERE workspace=? AND status!='Resolved' GROUP BY workgroup ORDER BY count DESC, workgroup"); $q->execute([$workspace]);
        return ['counts' => $counts, 'total' => array_sum($counts), 'active' => array_sum($counts) - $counts['Resolved'], 'unassigned' => $unassigned, 'workgroups' => $q->fetchAll(PDO::FETCH_ASSOC), 'seeded' => $this->workflow->seeded($workspace)];
    }

    public function seed(string $workspace): array
    {
        $this->db->exec('BEGIN IMMEDIATE');
        try {
            if ($this->workflow->seeded($workspace)) { $this->db->exec('COMMIT'); return ['added' => 0, 'alreadyLoaded' => true]; }
            $fixtures = json_decode(file_get_contents(__DIR__ . '/../config/demo-tickets.json'), true, 64, JSON_THROW_ON_ERROR);
            $config = defaultSettings();
            foreach ($fixtures as $fixture) {
                $created = gmdate('c', time() - (int)$fixture['ageHours'] * 3600);
                $updated = gmdate('c', time() - max(0, (int)$fixture['ageHours'] - 1) * 3600);
                $record = $this->insert($workspace, validateTicket($fixture['ticket'], $config), $config, $config['defaultFormat'], $created);
                $this->workflow->sampleState($workspace, $record['id'], $fixture, $updated);
            }
            $this->workflow->markSeeded($workspace); $this->db->exec('COMMIT');
            return ['added' => count($fixtures), 'alreadyLoaded' => false];
        } catch (Throwable $error) { $this->db->exec('ROLLBACK'); throw $error; }
    }
}

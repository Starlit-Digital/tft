<?php
declare(strict_types=1);

final class TicketNotFound extends RuntimeException {}
final class TicketConflict extends RuntimeException {}

final class Workflow
{
    public const STATUSES = ['Open', 'In progress', 'Waiting', 'Escalated', 'Resolved'];
    public const PRIORITIES = ['Low', 'Normal', 'High'];
    public const TRANSITIONS = [
        'Open' => ['In progress', 'Waiting', 'Escalated', 'Resolved'],
        'In progress' => ['Open', 'Waiting', 'Escalated', 'Resolved'],
        'Waiting' => ['Open', 'In progress', 'Escalated', 'Resolved'],
        'Escalated' => ['In progress', 'Waiting', 'Resolved'],
        'Resolved' => ['Open'],
    ];

    public function __construct(private PDO $db)
    {
        $db->exec('CREATE TABLE IF NOT EXISTS ticket_workflow (ticket_id TEXT PRIMARY KEY, workspace TEXT NOT NULL, status TEXT NOT NULL, assignee TEXT NOT NULL, workgroup TEXT NOT NULL, priority TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL, escalation_reason TEXT NOT NULL)');
        $db->exec('CREATE INDEX IF NOT EXISTS workflow_workspace ON ticket_workflow(workspace, updated_at)');
        $db->exec('CREATE TABLE IF NOT EXISTS ticket_events (id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id TEXT NOT NULL, workspace TEXT NOT NULL, created_at TEXT NOT NULL, kind TEXT NOT NULL, note TEXT NOT NULL, changes TEXT NOT NULL)');
        $db->exec('CREATE INDEX IF NOT EXISTS events_workspace ON ticket_events(workspace, id)');
        $db->exec('CREATE TABLE IF NOT EXISTS demo_seeds (workspace TEXT PRIMARY KEY, created_at TEXT NOT NULL)');
        // Preserve older records. Add lifecycle metadata without changing their text or payload.
        $rows = $db->query('SELECT t.* FROM tickets t LEFT JOIN ticket_workflow w ON w.ticket_id=t.id WHERE w.ticket_id IS NULL')->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $row) $this->created($row['workspace'], $row['id'], json_decode($row['payload'], true, 64, JSON_THROW_ON_ERROR), $row['created_at'], 'Existing ticket added to the workspace queue.');
    }

    public static function agents(): array
    {
        return json_decode(file_get_contents(__DIR__ . '/../config/demo-agents.json'), true, 32, JSON_THROW_ON_ERROR);
    }

    public function created(string $workspace, string $id, array $ticket, string $time, string $note = 'Ticket created.'): void
    {
        $query = $this->db->prepare('INSERT OR IGNORE INTO ticket_workflow VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $priority = in_array($ticket['priority'] ?? '', self::PRIORITIES, true) ? $ticket['priority'] : 'Normal';
        $query->execute([$id, $workspace, 'Open', '', $ticket['workgroup'] ?? '', $priority, 1, $time, '']);
        if ($query->rowCount()) $this->event($workspace, $id, 'created', $note, [], $time);
    }

    private function event(string $workspace, string $id, string $kind, string $note, array $changes, ?string $time = null): void
    {
        $q = $this->db->prepare('INSERT INTO ticket_events (ticket_id, workspace, created_at, kind, note, changes) VALUES (?, ?, ?, ?, ?, ?)');
        $q->execute([$id, $workspace, $time ?? gmdate('c'), $kind, $note, json_encode($changes, JSON_THROW_ON_ERROR)]);
    }

    public function state(string $workspace, string $id): array
    {
        $q = $this->db->prepare('SELECT * FROM ticket_workflow WHERE workspace=? AND ticket_id=?'); $q->execute([$workspace, $id]);
        $state = $q->fetch(PDO::FETCH_ASSOC);
        if (!$state) throw new TicketNotFound('Ticket not found in this workspace.');
        $state['revision'] = (int)$state['revision'];
        unset($state['workspace'], $state['ticket_id']);
        return $state;
    }

    public function events(string $workspace, ?string $id = null): array
    {
        $q = $this->db->prepare('SELECT e.*, t.payload FROM ticket_events e JOIN tickets t ON t.id=e.ticket_id AND t.workspace=e.workspace WHERE e.workspace=?' . ($id === null ? '' : ' AND e.ticket_id=?') . ' ORDER BY e.created_at DESC, e.id DESC LIMIT 200');
        $q->execute($id === null ? [$workspace] : [$workspace, $id]);
        return array_map(static function ($row) {
            $row['changes'] = json_decode($row['changes'], true, 32, JSON_THROW_ON_ERROR);
            $row['summary'] = json_decode($row['payload'], true, 64, JSON_THROW_ON_ERROR)['summary'];
            $row['actor'] = $row['kind'] === 'sample' ? 'Demo scenario' : 'Demo operator';
            unset($row['payload'], $row['workspace']);
            return $row;
        }, $q->fetchAll(PDO::FETCH_ASSOC));
    }

    public function update(string $workspace, array $body, array $settings): array
    {
        $id = $body['id'] ?? null;
        if (!is_string($id) || !is_int($body['revision'] ?? null)) throw new InvalidArgumentException('Select a ticket and reload its latest revision.');
        $allowed = ['id', 'revision', 'status', 'assignee', 'workgroup', 'priority', 'note'];
        if (array_diff(array_keys($body), $allowed)) throw new InvalidArgumentException('Use known ticket workflow fields.');
        $note = settingText($body['note'] ?? '', 4000, true);
        $this->db->exec('BEGIN IMMEDIATE');
        try {
            $current = $this->state($workspace, $id);
            if ($current['revision'] !== $body['revision']) throw new TicketConflict('This ticket changed in another window. Reload it before applying your changes.');
            $next = $current; $changes = [];
            foreach (['status', 'assignee', 'workgroup', 'priority'] as $key) {
                if (array_key_exists($key, $body)) {
                    if (!is_string($body[$key]) || strlen($body[$key]) > 100) throw new InvalidArgumentException('Choose a valid ' . $key . '.');
                    $next[$key] = $body[$key];
                }
                if ($next[$key] !== $current[$key]) $changes[$key] = ['from' => $current[$key], 'to' => $next[$key]];
            }
            if (isset($changes['status']) && !in_array($next['status'], self::TRANSITIONS[$current['status']], true)) throw new InvalidArgumentException('Choose an allowed status transition.');
            if (isset($changes['assignee']) && $next['assignee'] !== '' && !in_array($next['assignee'], array_column(self::agents(), 'id'), true)) throw new InvalidArgumentException('Choose a known demo agent.');
            if (isset($changes['priority']) && !in_array($next['priority'], self::PRIORITIES, true)) throw new InvalidArgumentException('Choose Low, Normal or High priority.');
            if (isset($changes['workgroup']) && $next['workgroup'] !== '' && !in_array($next['workgroup'], array_column($settings['workgroups'], 'code'), true)) throw new InvalidArgumentException('Choose a known workgroup.');
            if ($current['status'] === 'Resolved' && $changes && $next['status'] !== 'Open') throw new InvalidArgumentException('Reopen this ticket before changing its routing or priority.');
            $kind = 'updated';
            if (isset($changes['status'])) {
                if (in_array($next['status'], ['Escalated', 'Resolved'], true) || $current['status'] === 'Resolved') {
                    if ($note === '') throw new InvalidArgumentException('Add a reason for the escalation, resolution or reopening.');
                }
                $kind = match ($next['status']) { 'Escalated' => 'escalated', 'Resolved' => 'resolved', default => $current['status'] === 'Resolved' ? 'reopened' : 'updated' };
                if ($next['status'] === 'Escalated') $next['escalation_reason'] = $note;
            }
            if ($next['status'] === 'Escalated' && ($next['workgroup'] === '' || !in_array($next['workgroup'], array_column($settings['workgroups'], 'code'), true))) throw new InvalidArgumentException('Select a current workgroup for the escalation.');
            if (!$changes && $note === '') throw new InvalidArgumentException('Change a field or add a note before saving.');
            if (!$changes) $kind = 'comment';
            $next['revision']++; $next['updated_at'] = gmdate('c');
            $q = $this->db->prepare('UPDATE ticket_workflow SET status=?, assignee=?, workgroup=?, priority=?, revision=?, updated_at=?, escalation_reason=? WHERE workspace=? AND ticket_id=?');
            $q->execute([$next['status'], $next['assignee'], $next['workgroup'], $next['priority'], $next['revision'], $next['updated_at'], $next['escalation_reason'], $workspace, $id]);
            $this->event($workspace, $id, $kind, $note, $changes);
            $this->db->exec('COMMIT'); return $next;
        } catch (Throwable $error) { $this->db->exec('ROLLBACK'); throw $error; }
    }

    public function sampleState(string $workspace, string $id, array $fixture, string $time): void
    {
        $q = $this->db->prepare('UPDATE ticket_workflow SET status=?, assignee=?, updated_at=?, escalation_reason=? WHERE workspace=? AND ticket_id=?');
        $q->execute([$fixture['status'], $fixture['assignee'], $time, $fixture['status'] === 'Escalated' ? $fixture['note'] : '', $workspace, $id]);
        $this->event($workspace, $id, 'sample', $fixture['note'], ['status' => ['from' => 'Open', 'to' => $fixture['status']]], $time);
    }

    public function seeded(string $workspace): bool
    {
        $q = $this->db->prepare('SELECT 1 FROM demo_seeds WHERE workspace=?'); $q->execute([$workspace]); return (bool)$q->fetchColumn();
    }

    public function markSeeded(string $workspace): void
    {
        $q = $this->db->prepare('INSERT INTO demo_seeds VALUES (?, ?)'); $q->execute([$workspace, gmdate('c')]);
    }
}

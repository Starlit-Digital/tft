<?php
declare(strict_types=1);

final class DemoLimit extends RuntimeException
{
    public function __construct(string $message, public int $status = 429) { parent::__construct($message); }
}

/** Bounds for the anonymous, fictional showcase. No raw client addresses are stored. */
final class PublicDemo
{
    public const TTL = 86400;
    public const TICKETS = 50;
    public const EVENTS = 400;
    public const BYTES = 1048576;

    public function __construct(private PDO $db)
    {
        new SettingsStore($db);
        $db->exec('CREATE TABLE IF NOT EXISTS demo_workspaces (workspace TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)');
        $db->exec('CREATE TABLE IF NOT EXISTS demo_rate_limits (bucket TEXT PRIMARY KEY, minute INTEGER NOT NULL, hits INTEGER NOT NULL)');
    }

    public function admit(string $workspace, string $address, string $method, string $action, int $incoming): int
    {
        $secret = getenv('TFT_RATE_SECRET') ?: '';
        if (strlen($secret) < 32) throw new RuntimeException('Public demo rate policy is not configured.');
        $now = time(); $minute = intdiv($now, 60);
        $this->db->exec('BEGIN IMMEDIATE');
        try {
            $q = $this->db->prepare('SELECT workspace FROM demo_workspaces WHERE expires_at <= ? LIMIT 100'); $q->execute([$now]);
            foreach ($q->fetchAll(PDO::FETCH_COLUMN) as $expired) {
                foreach (['ticket_events', 'ticket_workflow', 'tickets', 'demo_seeds'] as $table) {
                    $delete = $this->db->prepare('DELETE FROM ' . $table . ' WHERE workspace=?'); $delete->execute([$expired]);
                }
                $delete = $this->db->prepare('DELETE FROM settings WHERE scope=?'); $delete->execute(['user:' . $expired]);
                $delete = $this->db->prepare('DELETE FROM demo_workspaces WHERE workspace=?'); $delete->execute([$expired]);
            }
            $q = $this->db->prepare('DELETE FROM demo_rate_limits WHERE minute < ?'); $q->execute([$minute - 2]);
            $buckets = ['ip:' . hash_hmac('sha256', $address, $secret) => 180];
            if ($method === 'POST') $buckets['write:' . $workspace] = 40;
            foreach ($buckets as $bucket => $limit) {
                $q = $this->db->prepare('INSERT INTO demo_rate_limits VALUES (?, ?, 1) ON CONFLICT(bucket) DO UPDATE SET minute=excluded.minute, hits=CASE WHEN demo_rate_limits.minute=excluded.minute THEN demo_rate_limits.hits+1 ELSE 1 END'); $q->execute([$bucket, $minute]);
                $q = $this->db->prepare('SELECT hits FROM demo_rate_limits WHERE bucket=?'); $q->execute([$bucket]);
                if ((int)$q->fetchColumn() > $limit) throw new DemoLimit('The demo is receiving too many requests. Please wait a minute and try again.');
            }
            $q = $this->db->prepare('SELECT expires_at FROM demo_workspaces WHERE workspace=?'); $q->execute([$workspace]); $expires = $q->fetchColumn();
            if (!$expires) {
                if ((int)$this->db->query('SELECT COUNT(*) FROM demo_workspaces')->fetchColumn() >= 200) throw new DemoLimit('The demo is at capacity. Please try again later.', 503);
                $expires = $now + self::TTL;
                $q = $this->db->prepare('INSERT INTO demo_workspaces VALUES (?, ?)'); $q->execute([$workspace, $expires]);
            }
            $this->db->exec('COMMIT');
        } catch (Throwable $error) { $this->db->exec('ROLLBACK'); throw $error; }
        if ($method === 'POST' && in_array($action, ['tickets','seed','update','settings'], true)) {
            $q = $this->db->prepare('SELECT COUNT(*) FROM tickets WHERE workspace=?'); $q->execute([$workspace]); $tickets = (int)$q->fetchColumn();
            $q = $this->db->prepare('SELECT 1 FROM demo_seeds WHERE workspace=?'); $q->execute([$workspace]);
            if ($action === 'seed' && $q->fetchColumn()) return (int)$expires;
            if (($action === 'tickets' && $tickets >= self::TICKETS) || ($action === 'seed' && $tickets > self::TICKETS - 10)) throw new DemoLimit('This demo workspace has reached its 50 ticket limit.');
            $q = $this->db->prepare('SELECT COUNT(*) FROM ticket_events WHERE workspace=?'); $q->execute([$workspace]);
            if ((int)$q->fetchColumn() + ($action === 'seed' ? 20 : ($action === 'settings' ? 0 : 1)) > self::EVENTS) throw new DemoLimit('This workspace has reached its demo history limit.');
            $q = $this->db->prepare('SELECT COALESCE(SUM(length(CAST(payload AS BLOB))+length(CAST(formatted AS BLOB))+COALESCE(length(CAST(spec AS BLOB)),0)),0) FROM tickets WHERE workspace=?'); $q->execute([$workspace]); $size = (int)$q->fetchColumn();
            $q = $this->db->prepare('SELECT COALESCE(SUM(length(CAST(note AS BLOB))+length(CAST(changes AS BLOB))),0) FROM ticket_events WHERE workspace=?'); $q->execute([$workspace]); $size += (int)$q->fetchColumn();
            $q = $this->db->prepare('SELECT length(CAST(document AS BLOB)) FROM settings WHERE scope=?'); $q->execute(['user:' . $workspace]); $size += (int)$q->fetchColumn();
            if ($size + $incoming > self::BYTES) throw new DemoLimit('This workspace has reached its demo storage limit. Export your work before the session expires.');
        }
        return (int)$expires;
    }
}

<?php
declare(strict_types=1);
require __DIR__ . '/../src/Tickets.php';
function check(bool $value, string $message): void { if (!$value) throw new RuntimeException($message); }
function fails(callable $fn, string $type): void { try { $fn(); } catch (Throwable $error) { if ($error instanceof $type) return; throw $error; } throw new RuntimeException('Expected rejection.'); }
$s = new TicketStore(':memory:'); $config = defaultSettings();
check($s->seed('a')['added'] === 10, 'Demo fixtures should load.');
check($s->seed('a')['added'] === 0 && count($s->list('a')) === 10, 'Loading demo data twice must not duplicate records.');
check($s->list('b') === [] && !$s->overview('b')['seeded'], 'Fixtures and seed markers must stay scoped.');
$open = $s->queue('a', ['status' => 'Open'])['tickets'][0]; $id = $open['id'];
check($s->queue('a',['q'=>'%'])['matched'] === 0, 'Search wildcard characters must remain literal.');
check($s->queue('a',['assignee'=>'__unassigned'])['matched'] === 2, 'Unassigned filter should use live metadata.');
fails(fn() => $s->get('b',$id,$config), TicketNotFound::class);
fails(fn() => $s->workflow()->update('b',['id'=>$id,'revision'=>1,'note'=>'x'],$config), TicketNotFound::class);
fails(fn() => $s->workflow()->update('a',['id'=>$id,'revision'=>1,'status'=>'Escalated'],$config), InvalidArgumentException::class);
$state = $s->workflow()->update('a',['id'=>$id,'revision'=>1,'status'=>'Escalated','workgroup'=>'NET-03','assignee'=>'sam','note'=>'Requires specialist review.'],$config);
check($state['revision'] === 2 && $state['status'] === 'Escalated', 'Escalation changes should be atomic.');
$detail = $s->get('a',$id,$config);
check(str_contains($detail['handoff'],'NET-03 / Network support') && str_contains($detail['handoff'],'Requires specialist review.'), 'Current handoff must use operative routing and escalation context.');
check($detail['formatted'] === $open['formatted'] && $detail['ticket'] === $open['ticket'], 'Workflow updates must preserve original capture and formatting.');
check($detail['events'][0]['kind'] === 'escalated' && isset($detail['events'][0]['changes']['workgroup']), 'Escalation must record its changes.');
fails(fn() => $s->workflow()->update('a',['id'=>$id,'revision'=>1,'note'=>'Stale update'],$config), TicketConflict::class);
fails(fn() => $s->workflow()->update('a',['id'=>$id,'revision'=>2,'status'=>'Open'],$config), InvalidArgumentException::class);
fails(fn() => $s->workflow()->update('a',['id'=>$id,'revision'=>2,'assignee'=>'unknown'],$config), InvalidArgumentException::class);
fails(fn() => $s->workflow()->update('a',['id'=>$id,'revision'=>2,'priority'=>'Invalid'],$config), InvalidArgumentException::class);
fails(fn() => $s->workflow()->update('a',['id'=>$id,'revision'=>2,'workgroup'=>'UNKNOWN'],$config), InvalidArgumentException::class);
check($s->workflow()->state('a',$id)['revision'] === 2, 'Rejected mutations must roll back.');
$s->workflow()->update('a',['id'=>$id,'revision'=>2,'note'=>'A specialist is reviewing the logs.'],$config);
check($s->get('a',$id,$config)['events'][0]['kind'] === 'comment', 'Standalone note must be captured.');
$s->workflow()->update('a',['id'=>$id,'revision'=>3,'status'=>'Resolved','note'=>'Confirmed service restored.'],$config);
fails(fn() => $s->workflow()->update('a',['id'=>$id,'revision'=>4,'priority'=>'Low'],$config), InvalidArgumentException::class);
fails(fn() => $s->workflow()->update('a',['id'=>$id,'revision'=>4,'status'=>'Open'],$config), InvalidArgumentException::class);
$s->workflow()->update('a',['id'=>$id,'revision'=>4,'status'=>'Open','note'=>'The reported issue returned.'],$config);
check($s->get('a',$id,$config)['events'][0]['kind'] === 'reopened', 'Reopening needs a recorded reason.');
check($s->overview('a')['total'] === 10 && $s->overview('a')['counts']['Open'] === 2, 'Queue changes must not create extra tickets.');
// Simulate a pre-workflow installation and verify migration preserves its stored bytes.
$path = sys_get_temp_dir() . '/tft-upgrade-' . bin2hex(random_bytes(5)) . '.sqlite';
try {
    $old = new PDO('sqlite:' . $path); $old->exec('CREATE TABLE tickets (id TEXT PRIMARY KEY, workspace TEXT NOT NULL, created_at TEXT NOT NULL, payload TEXT NOT NULL, formatted TEXT NOT NULL)');
    $old->prepare('INSERT INTO tickets VALUES (?, ?, ?, ?, ?)')->execute(['OLD-1','legacy','2020-01-01T00:00:00+00:00',json_encode(['summary'=>'Legacy example','requester'=>'Demo','category'=>'access','workgroup'=>'HELP-01']),'Original output, unchanged.']);
    $upgraded = new TicketStore($path); $record = $upgraded->get('legacy','OLD-1',$config);
    check($record['formatted'] === 'Original output, unchanged.' && $record['spec'] === null && $record['workflow']['status'] === 'Open', 'Upgrade must preserve legacy records.');
    new TicketStore($path); check(count($upgraded->workflow()->events('legacy','OLD-1')) === 1, 'Repeated migrations must not duplicate history.');
} finally { if (is_file($path)) unlink($path); }
echo "PASS queue search, seeded isolation, escalation, assignment, notes, resolution, reopening, conflict rollback and non-destructive legacy upgrade\n";

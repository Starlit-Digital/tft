<?php
declare(strict_types=1);
require __DIR__ . '/../src/Tickets.php';
function check(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
function rejects(callable $fn): void { try { $fn(); } catch (InvalidArgumentException) { return; } throw new RuntimeException('Invalid settings accepted.'); }
$config = validateSettings(defaultSettings());
$store = new TicketStore(':memory:'); $settings = $store->settings();
$a = $settings->get('a', 'user'); $b = $settings->get('b', 'user');
check($a['inherited'] && $b['inherited'], 'New workspaces inherit shared settings.');
$config['fields'][] = ['id'=>'reference','label'=>'Reference','type'=>'text','required'=>false,'span'=>1,'options'=>[]];
$config['formats'][0]['body'] = "  {{reference}}\n{{workgroup.code}} / {{workgroup.name}}\n{{summary}}  ";
$saved = $settings->save('a','user',['config'=>$config,'revision'=>0,'systemRevision'=>0]);
check(!$saved['inherited'] && count($settings->get('b','user')['config']['fields']) === 7, 'Personal field definitions remain private to the workspace.');
$ticket = validateTicket(['requester'=>'Alex Example','summary'=>'Test','category'=>'network','workgroup'=>'NET-03','reference'=>'REF-1'], $saved['config']);
$record = $store->save('a',$ticket,$saved['config'],'standard');
check($record['formatted'] === "  REF-1\nNET-03 / Network support\nTest  ", 'Formatting must preserve layout whitespace and resolve workgroup tags.');
check($record['spec']['config'] === $saved['config'], 'Saved tickets retain a settings snapshot.');
$system = defaultSettings(); $system['formats'][0]['name'] = 'Shared format';
$settings->save('a','system',['config'=>$system,'revision'=>0,'systemRevision'=>0]);
check($settings->get('b','user')['config']['formats'][0]['name'] === 'Shared format', 'Inherited workspace follows shared settings.');
check($settings->get('a','user')['config']['formats'][0]['name'] !== 'Shared format', 'Personal override remains stable.');
check($store->list('a')[0]['formatted'] === $record['formatted'], 'Existing tickets must not be reformatted after settings changes.');
try { $settings->save('a','user',['config'=>$config,'revision'=>1,'systemRevision'=>0]); throw new RuntimeException('Stale settings overwritten.'); }
catch (SettingsConflict) {}
$reset = $settings->save('a','user',['revision'=>1,'systemRevision'=>1],true);
check($reset['inherited'] && $reset['revision'] === 2, 'Reset resumes inheritance without resetting the revision counter.');
$bad = defaultSettings(); $bad['formats'][0]['body'] = '{{secret}}'; rejects(fn()=>validateSettings($bad));
$bad['formats'][0]['body'] = '{{summary'; rejects(fn()=>validateSettings($bad));
$bad = defaultSettings(); array_shift($bad['fields']); rejects(fn()=>validateSettings($bad));
$bad = defaultSettings(); $bad['fields'][0]['type'] = 'html'; rejects(fn()=>validateSettings($bad));
$bad = defaultSettings(); $bad['workgroups'][] = $bad['workgroups'][0]; rejects(fn()=>validateSettings($bad));
rejects(fn()=>validateTicket(['requester'=>'Example','summary'=>'Test','category'=>'access','workgroup'=>'UNKNOWN']));
rejects(fn()=>validateTicket(['requester'=>'Example','summary'=>'Test','category'=>'access','answers'=>['unknown'=>'x']]));
echo "PASS field validation, workgroup tags, settings inheritance, isolation, revision conflicts and saved output snapshots\n";

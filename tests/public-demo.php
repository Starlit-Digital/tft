<?php
declare(strict_types=1);
require __DIR__ . '/../src/Tickets.php';
putenv('TFT_RATE_SECRET=' . str_repeat('x', 64));
function check(bool $value, string $message): void { if (!$value) throw new RuntimeException($message); }
$s = new TicketStore(':memory:'); $guard = $s->publicDemo();
$expires = $guard->admit('a','127.0.0.1','GET','bootstrap',0);
check($expires > time() && $expires <= time()+86400, 'Public workspace gets a fixed expiry.');
for ($i=0;$i<40;$i++) $guard->admit('a','127.0.0.1','POST','validate',0);
try { $guard->admit('a','127.0.0.1','POST','validate',0); throw new RuntimeException('Write rate was not bounded.'); } catch (DemoLimit $e) { check($e->status===429, 'Rate limit returns 429.'); }
$guard->admit('b','127.0.0.2','GET','bootstrap',0);
try { $guard->admit('b','127.0.0.2','POST','settings',PublicDemo::BYTES+1); throw new RuntimeException('Storage budget was not bounded.'); } catch (DemoLimit) {}
// Force expiry in an isolated file to test cascading retention without waiting.
$path=sys_get_temp_dir().'/tft-public-'.bin2hex(random_bytes(5)).'.sqlite';
try {
    $store=new TicketStore($path);$policy=$store->publicDemo();$policy->admit('expired','127.0.0.3','GET','bootstrap',0);$store->seed('expired');
    $settings=$store->settings();$settings->save('expired','user',['config'=>defaultSettings(),'revision'=>0,'systemRevision'=>0]);
    $db=new PDO('sqlite:'.$path);$db->exec("UPDATE demo_workspaces SET expires_at=1 WHERE workspace='expired'");
    $policy->admit('fresh','127.0.0.4','GET','bootstrap',0);
    check($store->list('expired')===[] && $store->workflow()->events('expired')===[], 'Expired records and history are removed.');
    check($settings->get('expired','user')['inherited'], 'Expired personal settings are removed.');
    check(!$store->overview('expired')['seeded'], 'Expired seed marker is removed.');
} finally { if(is_file($path))unlink($path); }
echo "PASS public demo write rates, storage budget, fixed expiry and scoped retention cleanup\n";

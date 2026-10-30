/** DOM interactions against a fresh PHP backend, without controlling a browser. */
import {JSDOM} from 'jsdom';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)), temp=mkdtempSync(join(tmpdir(),'tft-ui-'));
const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
const base=`http://127.0.0.1:${port}/`, nativeFetch=globalThis.fetch;
const server=spawn('php',['-S',`127.0.0.1:${port}`,'-t','public'],{cwd:root,env:{...process.env,TFT_DEMO_ENABLED:'1',TFT_DB_PATH:join(temp,'tickets.sqlite')},stdio:'ignore'});
let cookie='',dom;
globalThis.fetch=async(url,options={})=>{
  const headers=new Headers(options.headers||{});if(cookie)headers.set('Cookie',cookie);
  const response=await nativeFetch(new URL(url,base),{...options,headers});const saved=response.headers.getSetCookie();if(saved.length)cookie=saved.map(value=>value.split(';')[0]).join('; ');return response;
};
function page(name){
  dom?.window.close();dom=new JSDOM(readFileSync(join(root,'public',name),'utf8'),{url:base+name});
  globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.Option=dom.window.Option;
  Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
  // jsdom does not implement native dialog presentation, layout or focus trapping.
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  dom.window.HTMLDialogElement.prototype.close=function(value=''){this.returnValue=value;this.open=false;this.dispatchEvent(new window.Event('close'));};
}
const $=id=>document.getElementById(id);
function input(id,value,type='input'){const node=$(id);node.value=value;node.dispatchEvent(new window.Event(type,{bubbles:true}));}
async function until(fn,description){for(let i=0;i<120;i++){if(fn())return;await new Promise(resolve=>setTimeout(resolve,25));}throw new Error(`${description}: ${$('detail-status')?.textContent} / ${$('status')?.textContent}`);}
try{
  for(let i=0;i<100;i++){try{await nativeFetch(base);break;}catch{await new Promise(resolve=>setTimeout(resolve,30));}}
  page('index.html');
  const style=document.createElement('style');style.textContent=readFileSync(join(root,'public/assets/app.css'),'utf8');document.head.append(style);
  assert(style.sheet && style.sheet.cssRules.length>0,'Application stylesheet parses.');
  await import('../public/assets/app.js');
  assert.equal($('tab-total').textContent,'10');assert.equal($('tab-escalations').textContent,'2');
  assert.equal(document.querySelectorAll('#metrics .metric').length,4);
  assert.equal(document.querySelectorAll('#escalation-list .escalation-card').length,2);
  input('filter-status','Open','change');await until(()=>$('queue-count').textContent==='2 tickets','Open queue');
  assert.equal(document.querySelectorAll('#ticket-list .ticket-row').length,2);
  document.querySelector('#ticket-list .ticket-title').click();await until(()=>$('ticket-detail').open,'Ticket drawer');
  const ticketId=$('detail-id').textContent;
  $('escalate-ticket').click();input('detail-workgroup','NET-03','change');input('detail-assignee','sam','change');input('detail-note','DOM test escalation with fictional details.');
  $('workflow-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
  await until(()=>$('detail-revision').textContent==='Revision 2','Escalation saved');
  await until(()=>$('tab-escalations').textContent==='3','Escalation queue refresh');
  assert($('handoff-output').value.includes('Network support'));
  assert($('ticket-history').textContent.includes('DOM test escalation'));
  $('resolve-ticket').click();input('detail-note','The demo issue is resolved.');
  $('workflow-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
  await until(()=>$('detail-revision').textContent==='Revision 3','Resolution saved');
  await until(()=>$('tab-escalations').textContent==='2','Resolved ticket leaves escalation queue');
  $('close-detail').click();await until(()=>!$('ticket-detail').open,'Drawer close');
  assert(document.activeElement?.matches('[data-route]')||document.activeElement?.matches('.ticket-title'),'Focus returns to a usable location.');
  window.location.hash='compose';await until(()=>!$('view-compose').hidden,'Compose navigation');
  $('example').click();$('ticket').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
  await until(()=>$('tab-total').textContent==='11','New ticket queue');
  await until(()=>!$('view-tickets').hidden,'Navigation after save');
  // A second bootstrap in the same session must not duplicate the fictional fixtures.
  const overview=await (await fetch('api.php?action=overview')).json();assert.equal(overview.total,11);
  page('settings.html');await import('../public/assets/settings.js');
  input('new-field-tag','reference');$('add-field').click();
  input('template','{{summary}}\nReference: {{reference}}\nRoute: {{workgroup.code}}');
  $('save-settings').click();await until(()=>$('status').textContent.startsWith('Settings saved.'),'Settings persistence');
  const boot=await (await fetch('api.php?action=bootstrap')).json();
  assert(boot.settings.config.fields.some(field=>field.id==='reference'));
  assert.equal(boot.settings.inherited,false);
  // Mount a fresh composer with the saved definition, without remounting the shell.
  page('index.html');const {mountComposer}=await import('../public/assets/composer.js');
  mountComposer({boot,onSaved:async()=>{}});$('example').click();
  const field=document.querySelector('[name=reference]');field.value='DEMO-REF';field.dispatchEvent(new window.Event('input',{bubbles:true}));
  assert($('preview').value.includes('Reference: DEMO-REF'));
  $('export-text').click();$('review-import').click();
  await until(()=>$('status').textContent.startsWith('Import validated.'),'Staged tagged import');
  assert.equal($('apply-import').disabled,false);$('apply-import').click();assert.equal(field.value,'DEMO-REF');
  assert.equal((await (await fetch('api.php?action=overview')).json()).total,11,'Import review and apply must not create a record.');
  console.log('PASS DOM application: demo seeding, navigation, queue filters, escalation, resolution, history, new ticket, scoped field editor and staged transfer');
}finally{
  dom?.window.close();server.kill();await new Promise(resolve=>server.once('exit',resolve));rmSync(temp,{recursive:true,force:true});globalThis.fetch=nativeFetch;
}

import {exportTicket,sampleTicket} from './model.js';
import {$,element,announce,api,download} from './common.js';
import {mountComposer} from './composer.js';
import {mountNavigation} from './navigation.js';
import {mountTicketDetails} from './details.js';
import {badge,ticketList,eventList,emptyState,groupName,agentName,timestamp} from './views.js';

const navigation=mountNavigation();
let boot,details,queueRequest=0,queueAbort,loading=false,searchTimer;
function filters(){return {q:$('search').value.trim(),status:$('filter-status').value,workgroup:$('filter-workgroup').value,priority:$('filter-priority').value,assignee:$('filter-assignee').value};}
function openTicket(id,source){details.show(id,source).catch(error=>announce(error.message));}
function queueView(data){
  $('queue-count').textContent=`${data.matched} ${data.matched===1?'ticket':'tickets'}${data.matched>data.limit?` · showing the latest ${data.limit}`:''}`;
  $('ticket-list').replaceChildren(data.tickets.length?ticketList(data.tickets,{onOpen:openTicket,agents:boot.operations.agents,config:boot.settings.config}):emptyState('A clear queue.','No tickets match these filters. Try another search or create a new ticket.',element('a','Create a ticket',{href:'#compose',class:'button'})));
}
async function refreshQueue(){
  queueAbort?.abort();queueAbort=new AbortController();const version=++queueRequest;$('ticket-list').setAttribute('aria-busy','true');
  try{const data=await api('tickets',{query:filters(),signal:queueAbort.signal});if(version===queueRequest)queueView(data);}
  catch(error){if(error.name!=='AbortError')announce(error.message);}
  finally{if(version===queueRequest)$('ticket-list').removeAttribute('aria-busy');}
}
function renderOverview(data){
  $('tab-total').textContent=data.total;$('tab-escalations').textContent=data.counts.Escalated;
  const metrics=[['Active tickets',data.active,'Across the workspace','active'],['Escalated',data.counts.Escalated,'Ready for specialist review','escalated'],['Waiting',data.counts.Waiting,'Awaiting the next step','waiting'],['Resolved',data.counts.Resolved,'A completed handoff','resolved']];
  $('metrics').replaceChildren();
  for(const [name,count,note,tone] of metrics){
    const card=element('div',null,{class:`metric ${tone}`});card.append(element('p',name,{class:'metric-label'}),element('strong',String(count),{class:'metric-number'}),element('p',note,{class:'metric-note'}));$('metrics').append(card);
  }
  $('recent-tickets').replaceChildren(data.recent.length?ticketList(data.recent,{onOpen:openTicket,agents:boot.operations.agents,config:boot.settings.config,compact:true}):emptyState('Ready for the first request.','Create a ticket or load the fictional sample workspace.'));
  const attention=element('div',null,{class:'attention-count'});attention.append(element('strong',String(data.unassigned)),element('span','active tickets need an owner'));
  const followup=element('p',`${data.counts.Escalated} escalated · ${data.counts.Waiting} waiting`,{class:'muted'});
  const unassigned=element('button','Find unassigned tickets →',{type:'button',class:'text-button'});unassigned.onclick=()=>{$('filter-assignee').value='__unassigned';refreshQueue();navigation.go('tickets');};
  $('attention').replaceChildren(attention,followup,unassigned);
  $('workload').replaceChildren();
  for(const group of data.workgroups){
    const row=element('div',null,{class:'workload-row'}),label=element('div',null,{class:'section-head'});
    label.append(element('span',groupName(group.workgroup,boot.settings.config)),element('strong',String(group.count)));
    const bar=element('progress',null,{max:String(Math.max(data.active,1)),value:String(group.count),'aria-label':`${group.workgroup||'Unrouted'} active tickets`});
    row.append(label,bar);$('workload').append(row);
  }
  if(!data.workgroups.length)$('workload').append(emptyState('No active work.','New tickets will appear here once they are created.'));
  $('seed-demo').disabled=data.seeded;$('seed-demo').textContent=data.seeded?'Sample workspace loaded':'Load sample tickets';
}
function renderEscalations(data){
  $('escalation-list').replaceChildren();
  for(const record of data.tickets){
    const card=element('article',null,{class:'panel escalation-card'}),head=element('div',null,{class:'section-head'});
    head.append(element('span',record.id,{class:'ticket-code'}),badge(record.workflow.priority));
    const title=element('h2',record.ticket.summary),reason=element('blockquote',record.workflow.escalation_reason||'Review the ticket history for escalation context.');
    const route=element('p',`${record.workflow.workgroup} · ${groupName(record.workflow.workgroup,boot.settings.config,record)}`,{class:'route-label'});
    const foot=element('div',null,{class:'section-head'}),button=element('button','Open escalation ↗',{type:'button'});button.onclick=()=>openTicket(record.id,button);
    foot.append(element('span',agentName(record.workflow.assignee,boot.operations.agents),{class:'muted'}),timestamp(record.workflow.updated_at));
    card.append(head,title,reason,route,foot,button);$('escalation-list').append(card);
  }
  if(!data.tickets.length)$('escalation-list').append(emptyState('No escalations waiting.','Open a ticket and choose Escalate ticket when it needs specialist attention.'));
}
async function refresh(){
  const [overview,escalations,activity]=await Promise.all([api('overview'),api('tickets',{query:{status:'Escalated'}}),api('activity')]);
  renderOverview(overview);renderEscalations(escalations);
  $('activity-list').replaceChildren(activity.events.length?eventList(activity.events,{onOpen:openTicket}):emptyState('The next chapter starts here.','Create or update a ticket to record its first activity.'));
  $('recent-activity').replaceChildren(activity.events.length?eventList(activity.events.slice(0,4),{onOpen:openTicket,small:true}):emptyState('No changes yet.','Ticket activity will appear here.'));
  await refreshQueue();
}
$('queue-filters').onsubmit=event=>event.preventDefault();
$('search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(refreshQueue,220);};
for(const id of ['filter-status','filter-workgroup','filter-priority','filter-assignee'])$(id).onchange=refreshQueue;
$('clear-filters').onclick=()=>{for(const id of ['search','filter-status','filter-workgroup','filter-priority','filter-assignee'])$(id).value='';clearTimeout(searchTimer);refreshQueue();};
$('refresh').onclick=async()=>{if(loading)return;loading=true;$('refresh').disabled=true;try{await refresh();announce('Workspace refreshed.');}catch(error){announce(error.message);}finally{loading=false;$('refresh').disabled=false;}};
$('seed-demo').onclick=async()=>{if(loading)return;loading=true;$('seed-demo').disabled=true;try{const result=await api('seed',{body:{confirm:true},csrf:boot.csrf});await refresh();announce(result.added?`${result.added} fictional sample tickets added. Existing records were preserved.`:'The sample workspace is already loaded.');}catch(error){$('seed-demo').disabled=false;announce(error.message);}finally{loading=false;}};
try{
  boot=await api('bootstrap');
  $('download-sample').disabled=false;$('download-sample').onclick=()=>download(exportTicket(sampleTicket(boot.settings.config)),'tft-sample-ticket.json','application/json');
  if(boot.publicDemo)$('workspace-policy').textContent='Session sandbox · expires within 24 hours';
  details=mountTicketDetails({boot,onChanged:refresh});
  for(const value of boot.operations.statuses)$('filter-status').append(new Option(value,value));
  for(const group of boot.settings.config.workgroups)$('filter-workgroup').append(new Option(group.name,group.code));
  for(const value of boot.operations.priorities)$('filter-priority').append(new Option(value,value));
  for(const agent of boot.operations.agents)$('filter-assignee').append(new Option(agent.name,agent.id));
  mountComposer({boot,onSaved:async record=>{await refresh();navigation.go('tickets');announce(`Created ${record.id}. Open it to assign, escalate or resolve the request.`);}});
  const overview=await api('overview');
  if(overview.total===0&&!overview.seeded)await api('seed',{body:{confirm:true},csrf:boot.csrf});
  await refresh();$('refresh').disabled=false;
  announce(boot.publicDemo?'Demonstration ready. This workspace expires within 24 hours. Use fictional information only.':'Ready. Fictional demo data stays in this session. Agent assignment is a simulation.');
}catch(error){announce(error.message);}

import {element} from './common.js';

const tones = {'Open':'open','In progress':'progress','Waiting':'waiting','Escalated':'escalated','Resolved':'resolved','High':'high','Normal':'normal','Low':'low'};
export function badge(value) { return element('span',value,{class:`status-badge ${tones[value] || 'normal'}`}); }
export function timeLabel(value, now=Date.now()) {
  const minutes=Math.max(0,Math.floor((now-new Date(value).getTime())/60000));
  if(!Number.isFinite(minutes)) return 'Unknown time';
  if(minutes<1)return 'Just now'; if(minutes<60)return `${minutes}m ago`; if(minutes<1440)return `${Math.floor(minutes/60)}h ago`;return `${Math.floor(minutes/1440)}d ago`;
}
export function timestamp(value) {
  return element('time',timeLabel(value),{datetime:value,title:new Date(value).toLocaleString()});
}
export function agentName(id, agents) { return agents.find(agent=>agent.id===id)?.name || 'Unassigned'; }
export function groupName(code, config, record) { return config.workgroups.find(group=>group.code===code)?.name || record?.spec?.config.workgroups.find(group=>group.code===code)?.name || code || 'Not routed'; }
export function emptyState(title, body, action) {
  const box=element('div',null,{class:'empty-state'});box.append(element('span','◇',{class:'empty-symbol','aria-hidden':'true'}),element('h3',title),element('p',body));if(action)box.append(action);return box;
}
export function ticketList(records,{onOpen,agents,config,compact=false}) {
  const list=element('ul',null,{class:compact?'ticket-list compact-list':'ticket-list'});
  for(const record of records){
    const item=element('li',null,{class:'ticket-row'}),main=element('div',null,{class:'ticket-main'}),button=element('button',record.ticket.summary,{type:'button',class:'ticket-title'});
    button.onclick=()=>onOpen(record.id,button);
    const id=element('span',record.id,{class:'ticket-code'}),meta=element('p',`${record.ticket.requester} · ${groupName(record.workflow.workgroup,config,record)}`,{class:'ticket-meta'});
    main.append(id,button,meta);
    const state=element('div',null,{class:'ticket-state'});state.append(badge(record.workflow.status));
    const priority=element('div',null,{class:'ticket-priority'});priority.append(element('span','Priority: ',{class:'sr-only'}),badge(record.workflow.priority));
    const assignee=element('div',null,{class:'ticket-assignee'});assignee.append(element('span','Assigned to ',{class:'sr-only'}),element('span',agentName(record.workflow.assignee,agents)));
    const time=element('div',null,{class:'ticket-time'});time.append(timestamp(record.workflow.updated_at));
    item.append(main,priority,assignee,state,time);list.append(item);
  }
  return list;
}
export function eventList(events,{onOpen,small=false}) {
  const list=element('ol',null,{class:'event-list'});
  const names={created:'Created',updated:'Updated',comment:'Note added',escalated:'Escalated',resolved:'Resolved',reopened:'Reopened',sample:'Demo scenario'};
  for(const event of events){
    const item=element('li',null,{class:'event-item'}),body=element('div',null),heading=element('div',null,{class:'event-heading'});
    heading.append(element('strong',names[event.kind]||'Updated'),timestamp(event.created_at));body.append(heading);
    if(onOpen){const link=element('button',event.summary,{type:'button',class:'text-button'});link.onclick=()=>onOpen(event.ticket_id,link);body.append(link);}
    if(event.note)body.append(element('p',event.note,{class:'event-note'}));
    if(!small){
      for(const [key,change] of Object.entries(event.changes)){
        body.append(element('p',`${key}: ${change.from || 'Unassigned'} → ${change.to || 'Unassigned'}`,{class:'change-line'}));
      }
      body.append(element('span',event.actor,{class:'event-actor'}));
    }
    item.append(element('span','',{class:`event-dot ${event.kind}`,'aria-hidden':'true'}),body);list.append(item);
  }
  return list;
}

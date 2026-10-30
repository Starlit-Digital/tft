import {$,element,api,download,copy} from './common.js';
import {exportTicket} from './model.js';
import {eventList} from './views.js';

export function mountTicketDetails({boot,onChanged}) {
  const dialog=$('ticket-detail'),config=boot.settings.config,ops=boot.operations;
  let record=null,dirty=false,busy=false,trigger=null,request=0;
  const message=text=>$('detail-status').textContent=text;
  async function discard(){
    if(!dirty)return true;
    const prompt=$('discard-ticket');prompt.returnValue='keep';prompt.showModal();
    return new Promise(resolve=>{ $('keep-ticket').onclick=()=>prompt.close('keep');$('discard-changes').onclick=()=>prompt.close('discard');prompt.onclose=()=>resolve(prompt.returnValue==='discard'); });
  }
  function choices(id,options,value){
    const select=$(id);select.replaceChildren();for(const [key,label] of options)select.append(new Option(label,key));select.value=value;
  }
  function noteRequirement(){
    const next=$('detail-state').value;
    const needed=next!==record.workflow.status && (['Escalated','Resolved'].includes(next)||record.workflow.status==='Resolved');
    $('detail-note').required=needed;
    $('note-hint').textContent=needed?'Add a reason before saving this escalation, resolution or reopening.':'Add a note, update the routing or move the ticket forward.';
  }
  function render(){
    const state=record.workflow;
    $('detail-id').textContent=record.id;$('detail-title').textContent=record.ticket.summary;
    $('detail-requester').textContent=`Requested by ${record.ticket.requester} · Created ${new Date(record.created_at).toLocaleString()}`;
    choices('detail-state',[state.status,...ops.transitions[state.status]].map(value=>[value,value]),state.status);
    choices('detail-priority',ops.priorities.map(value=>[value,value]),state.priority);
    choices('detail-assignee',[['','Unassigned'],...ops.agents.map(agent=>[agent.id,agent.name])],state.assignee);
    const groups=config.workgroups.map(group=>[group.code,`${group.code} · ${group.name}`]);
    if(state.workgroup&&!groups.some(([code])=>code===state.workgroup))groups.push([state.workgroup,`${state.workgroup} · Saved routing`]);
    choices('detail-workgroup',[['','Not routed'],...groups],state.workgroup);
    $('escalate-ticket').disabled=!ops.transitions[state.status].includes('Escalated');
    $('resolve-ticket').disabled=!ops.transitions[state.status].includes('Resolved');
    $('detail-note').value='';$('detail-revision').textContent=`Revision ${state.revision}`;
    $('handoff-output').value=record.handoff;
    $('ticket-history').replaceChildren(eventList(record.events,{small:false}));
    dirty=false;noteRequirement();message('Current ticket loaded. Changes stay in this demo workspace.');
  }
  async function show(id,source,{force=false}={}){
    if(busy)return;
    if(!force&&dialog.open&&!(await discard()))return;
    const version=++request;
    try{
      const next=await api('ticket',{query:{id}});if(version!==request)return;
      record=next;trigger=source||trigger;render();
      if(!dialog.open)dialog.showModal();
      $('detail-state').focus();
    }catch(error){if(dialog.open)message(error.message);else throw error;}
  }
  async function close(){
    if(busy||!(await discard()))return;dirty=false;dialog.close();
    if(trigger?.isConnected)trigger.focus();else document.querySelector('[data-route][aria-current=page]')?.focus();
  }
  $('close-detail').onclick=close;
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  $('workflow-form').addEventListener('input',()=>{dirty=true;noteRequirement();});
  $('detail-state').addEventListener('change',()=>{dirty=true;noteRequirement();});
  function transition(status){$('detail-state').value=status;dirty=true;noteRequirement();$('detail-note').focus();message(status==='Escalated'?'Choose a destination and explain the escalation.':'Add a resolution note, then save.');}
  $('escalate-ticket').onclick=()=>transition('Escalated');$('resolve-ticket').onclick=()=>transition('Resolved');
  $('reload-ticket').onclick=async()=>{if(await discard()){try{await show(record.id,trigger,{force:true});}catch(error){message(error.message);}}};
  $('workflow-form').onsubmit=async event=>{
    event.preventDefault();if(busy||!record)return;
    if(!$('workflow-form').reportValidity())return;
    const body={id:record.id,revision:record.workflow.revision,status:$('detail-state').value,priority:$('detail-priority').value,workgroup:$('detail-workgroup').value,assignee:$('detail-assignee').value,note:$('detail-note').value};
    busy=true;$('workflow-fields').disabled=true;$('close-detail').disabled=true;
    try{
      record=await api('update',{body,csrf:boot.csrf});render();message('Changes saved to the ticket history.');
      try{await onChanged();}catch{message('Changes saved. Refresh the workspace to update the queue.');}
    }catch(error){message(error.message);}
    finally{busy=false;$('workflow-fields').disabled=false;$('close-detail').disabled=false;}
  };
  $('copy-handoff').onclick=async()=>{const copied=await copy($('handoff-output').value,$('handoff-output'));message(copied?'Handoff copied.':'The handoff text is selected. Use your keyboard copy command.');};
  $('export-saved').onclick=()=>download(exportTicket(record.ticket),`${record.id}.json`,'application/json');
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  return {show};
}

import {$,element,announce,api,download,copy} from './common.js';
import {renderTemplate,exportTicket,importTicket,sampleTicket} from './model.js';

export function mountComposer({boot,onSaved}) {
const config=boot.settings.config;
let activeCategory = '', pending = null, dirty = false;
const drafts = {};
const toolIds=['example','export-json','export-text','review-import','import-file','copy','copy-transfer','download-output'];
for(const id of toolIds) $(id).disabled=true;
function ticket() {
  return {...Object.fromEntries(config.fields.map(field=>[field.id,($('ticket').elements.namedItem(field.id)?.value || '').trim()])),category:$('category').value,answers:Object.fromEntries([...$('questions').querySelectorAll('textarea')].map(input=>[input.dataset.key,input.value.trim()]))};
}
function preview() {
  try { $('preview').value = renderTemplate(ticket(),config,boot.categories,$('output-format').value); }
  catch(error) { announce(error.message); }
}
function questionnaire(save = true) {
  if (save && activeCategory) drafts[activeCategory] = ticket().answers;
  activeCategory = $('category').value;
  $('questions').replaceChildren(element('legend','Issue questionnaire'));
  for (const [key,text] of Object.entries(boot.categories[activeCategory].questions)) {
    const label = element('label',text), input = element('textarea',null,{rows:'2',maxlength:'2000',name:`answer_${key}`});
    input.dataset.key = key; input.value = drafts[activeCategory]?.[key] || ''; label.append(input); $('questions').append(label);
  }
  preview();
}
function buildFields() {
  for (const field of config.fields) {
    const label = element('label',field.label + (field.required ? ' *' : '')), input = element(field.type === 'textarea' ? 'textarea' : ['select','workgroup'].includes(field.type) ? 'select' : 'input',null,{name:field.id});
    if (field.required) input.required = true;
    if (input.tagName === 'SELECT') {
      input.append(new Option('Choose…',''));
      const options = field.type === 'workgroup' ? config.workgroups.map(group=>[`${group.code} · ${group.name}`,group.code]) : field.options.map(value=>[value,value]);
      for (const [text,value] of options) input.append(new Option(text,value));
      if (field.id === 'priority' && field.options.includes('Normal')) input.value = 'Normal';
    } else { input.maxLength = ({summary:200,requester:120,location:200,asset:100})[field.id] || (field.type === 'textarea' ? 4000 : 500); if (field.type === 'textarea') input.rows = 5; }
    label.className = `span-${field.span}`; label.append(input); $('dynamic-fields').append(label);
  }
}
function loadTicket(value) {
  for (const field of config.fields) $('ticket').elements.namedItem(field.id).value = value[field.id] || '';
  $('category').value = value.category;
  drafts[value.category] = value.answers || {}; questionnaire(false); dirty = true; preview();
}
function submission(value) { return {ticket:value,formatId:$('output-format').value,settingsRevision:boot.settings.revision,systemRevision:boot.settings.systemRevision}; }
$('category').addEventListener('change',()=>{questionnaire(); dirty=true;});
$('ticket').addEventListener('input',()=>{preview();dirty=true;});
$('output-format').addEventListener('change',preview);
$('ticket').addEventListener('submit',async event=>{
  event.preventDefault(); $('save').disabled = true;
  try {
    const record = await api('tickets',{body:submission(ticket()),csrf:boot.csrf});
    $('ticket').reset();
    for(const key of Object.keys(drafts))delete drafts[key];
    for(const field of config.fields){const input=$('ticket').elements.namedItem(field.id);input.value=field.id==='priority'&&field.options.includes('Normal')?'Normal':'';}
    $('output-format').value=config.defaultFormat;questionnaire(false);
    pending=null;$('apply-import').disabled=true;dirty=false;announce(`Saved ${record.id}.`);
    try { await onSaved(record); } catch { announce(`Saved ${record.id}. Refresh the queue to see the latest list.`); }
  } catch(error) { announce(error.message); }
  finally { $('save').disabled = false; }
});
$('copy').onclick = ()=>copy($('preview').value,$('preview'));
$('example').onclick = ()=>{loadTicket(sampleTicket(config));announce('Fictional example loaded.');};
$('export-json').onclick = ()=>download(exportTicket(ticket()),'tft-ticket.json','application/json');
$('export-text').onclick = ()=>{ $('transfer').value=exportTicket(ticket(),'tags'); announce('Tagged text is ready below. Copy it or download it for a round trip.'); };
$('copy-transfer').onclick = ()=>copy($('transfer').value,$('transfer'));
$('download-output').onclick = ()=>download($('preview').value,'ticket-output.txt');
$('import-file').onchange = async event=>{
  const file=event.target.files[0]; if (!file) return;
  if (file.size > 131072) { announce('Use a ticket file under 128 KB.'); return; }
  $('transfer').value = await file.text(); pending=null; $('apply-import').disabled=true; announce('File loaded. Review the import before applying it.');
};
$('transfer').oninput=()=>{pending=null;$('apply-import').disabled=true;};
$('review-import').onclick = async()=>{
  pending=null;$('apply-import').disabled=true;
  try {
    const parsed=importTicket($('transfer').value,config,boot.categories);
    const result=await api('validate',{body:submission(parsed),csrf:boot.csrf});
    pending=result.ticket; $('import-preview').textContent=result.formatted; $('apply-import').disabled=false;
    announce('Import validated. Review the preview, then choose Replace draft with import. No ticket has been saved.');
  } catch(error) { $('import-preview').textContent='';announce(error.message); }
};
$('apply-import').onclick=()=>{if(pending){loadTicket(pending);pending=null;$('apply-import').disabled=true;announce('Imported values replaced the draft. Review them before saving.');}};
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
for(const [key,value] of Object.entries(boot.categories)) $('category').append(new Option(value.label,key));
for(const format of config.formats) $('output-format').append(new Option(format.name,format.id));
$('output-format').value=config.defaultFormat;
buildFields();$('fields').disabled=false;for(const id of toolIds) $(id).disabled=false;
questionnaire(false);
return {hasDraft:()=>dirty};
}

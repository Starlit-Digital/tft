import {$,element,announce,api} from './common.js';
import {clone,tagsFor,renderTemplate,templateErrors,sampleTicket} from './model.js';
let boot, state, draft, selected, formatId, dirty=false, busy=false, scope='user', history=[];
const currentField=()=>draft.fields.find(field=>field.id===selected);
const currentFormat=()=>draft.formats.find(format=>format.id===formatId);
function mark(){dirty=true;$('dirty-state').textContent='Unsaved changes';}
function remember(){history.push(clone(draft));if(history.length>40)history.shift();$('undo').disabled=false;mark();}
function syncState(){ $('dirty-state').textContent=dirty?'Unsaved changes':state.inherited?'Using system defaults':'Saved';$('undo').disabled=!history.length;$('inherit').disabled=scope!=='user'||state.inherited||busy; }
async function discard(message){
  if(!dirty)return true;
  $('confirm-text').textContent=message;const dialog=$('confirm-dialog');dialog.returnValue='keep';dialog.showModal();
  return new Promise(resolve=>{
    $('keep-editing').onclick=()=>dialog.close('keep');$('discard').onclick=()=>dialog.close('discard');
    dialog.onclose=()=>resolve(dialog.returnValue==='discard');
  });
}
function parseGroups(){
  const lines=$('workgroups').value.trim().split(/\r?\n/).filter(Boolean), groups=[];
  for(const line of lines){const parts=line.split('|');if(parts.length!==2||!parts[0].trim()||!parts[1].trim())throw new Error('Use CODE | Workgroup name on every directory line.');groups.push({code:parts[0].trim(),name:parts[1].trim()});}
  return groups;
}
function unique(prefix,ids){let i=1;while(ids.includes(`${prefix}_${i}`))i++;return `${prefix}_${i}`;}
function fieldList(){
  $('field-list').replaceChildren();
  for(const field of draft.fields){
    const button=element('button',null,{type:'button','aria-pressed':String(selected===field.id)});
    button.append(element('strong',field.label),element('code',`{{${field.id}}}`));
    button.onclick=()=>{selected=field.id;fieldList();properties();};$('field-list').append(button);
  }
}
function properties(){
  const field=currentField();$('properties').replaceChildren();if(!field)return;
  $('properties').append(element('code',`{{${field.id}}}`));
  function property(labelText,node){const label=element('label',labelText);label.append(node);$('properties').append(label);return node;}
  const label=property('Display label',element('input',null,{value:field.label,maxlength:'80',required:''}));
  label.oninput=()=>{remember();field.label=label.value;fieldList();formPreview();};
  const type=property('Field type',element('select',null));
  const types=field.id==='workgroup'?['workgroup']:['text','textarea','select'];
  for(const value of types)type.append(new Option(({text:'Single line',textarea:'Multiple lines',select:'Dropdown',workgroup:'Workgroup lookup'})[value],value));
  type.value=field.type;type.disabled=['summary','requester'].includes(field.id);
  type.onchange=()=>{remember();field.type=type.value;if(field.type==='select'&&!field.options.length)field.options=['Option one','Option two'];properties();formPreview();};
  const span=property('Form width',element('select',null));span.append(new Option('One column','1'),new Option('Full width','2'));span.value=field.span;
  span.onchange=()=>{remember();field.span=Number(span.value);formPreview();};
  const required=property('Required field',element('input',null,{type:'checkbox'}));required.checked=field.required;required.disabled=['summary','requester'].includes(field.id);
  required.onchange=()=>{remember();field.required=required.checked;formPreview();};
  if(field.type==='select'){
    const options=property('Choices, one per line',element('textarea',null,{rows:'5',maxlength:'5000'}));options.value=field.options.join('\n');
    options.oninput=()=>{remember();field.options=options.value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);formPreview();};
  }
  const actions=element('div',null,{class:'actions'}), up=element('button','Move up',{type:'button'}),down=element('button','Move down',{type:'button'}),remove=element('button','Remove field',{type:'button'});
  up.disabled=draft.fields.indexOf(field)===0;down.disabled=draft.fields.indexOf(field)===draft.fields.length-1;remove.disabled=['summary','requester'].includes(field.id);
  function move(delta){remember();const index=draft.fields.indexOf(field);[draft.fields[index],draft.fields[index+delta]]=[draft.fields[index+delta],draft.fields[index]];fieldList();properties();formPreview();announce(`${field.label} moved.`);}
  up.onclick=()=>move(-1);down.onclick=()=>move(1);
  remove.onclick=()=>{
    const pattern=new RegExp('\\{\\{\\s*'+field.id+'\\s*\\}\\}');
    if(draft.formats.some(format=>pattern.test(format.body))){announce('Remove this field tag from output templates before deleting its field.');return;}
    remember();draft.fields=draft.fields.filter(item=>item!==field);selected=draft.fields[0].id;render();
  };
  actions.append(up,down,remove);$('properties').append(actions);
}
function formPreview(){
  const sample=sampleTicket(draft);$('form-preview').replaceChildren();
  for(const field of draft.fields){
    const label=element('div',null,{class:`preview-field span-${field.span}`});label.append(element('span',field.label+(field.required?' *':'')),element('div',sample[field.id]||(['select','workgroup'].includes(field.type)?'Choose…':'Example value'),{class:field.type==='textarea'?'preview-value multiline':'preview-value'}));$('form-preview').append(label);
  }
  outputPreview();
}
function outputPreview(){
  const format=currentFormat();if(!format)return;
  const errors=templateErrors(format.body,draft,boot.categories);$('template-errors').textContent=errors.join(' ');
  try{$('output-preview').textContent=renderTemplate(sampleTicket(draft),draft,boot.categories,formatId);}catch{$('output-preview').textContent='Fix the template tags to see the output.';}
  $('tags').replaceChildren();
  for(const tag of tagsFor(draft,boot.categories)){
    const button=element('button',`{{${tag}}}`,{type:'button'});button.onclick=()=>{
      remember();const input=$('template'),start=input.selectionStart,end=input.selectionEnd,token=`{{${tag}}}`;input.setRangeText(token,start,end,'end');currentFormat().body=input.value;input.focus();outputPreview();
    };$('tags').append(button);
  }
}
function formats(){
  for(const id of ['format-select','default-format']){
    $(id).replaceChildren();for(const format of draft.formats)$(id).append(new Option(format.name,format.id));
  }
  $('format-select').value=formatId;$('default-format').value=draft.defaultFormat;
  $('format-name').value=currentFormat().name;$('template').value=currentFormat().body;
  $('remove-format').disabled=draft.formats.length===1;outputPreview();
}
function render(){
  fieldList();properties();formPreview();formats();$('workgroups').value=draft.workgroups.map(group=>`${group.code} | ${group.name}`).join('\n');syncState();
}
async function load(nextScope){
  state=await api('settings',{scope:nextScope});scope=nextScope;$('scope').value=scope;draft=clone(state.config);selected=draft.fields[0].id;formatId=draft.defaultFormat;dirty=false;history=[];
  $('admin-access').hidden=scope!=='system';
  $('scope-note').textContent=scope==='system'?'Shared defaults for workspaces without personal overrides.':'An independent copy for this demo session. Use system defaults to resume inheritance.';
  $('editor').disabled=false;$('save-settings').disabled=false;$('reload').disabled=false;render();
}
$('editor-form').onsubmit=event=>event.preventDefault();
$('scope').onchange=async()=>{const next=$('scope').value;$('scope').value=scope;if(await discard('Switching scope replaces this unsaved draft.')){try{await load(next);announce('Settings loaded.');}catch(error){announce(error.message);}}};
$('add-field').onclick=()=>{
  const id=$('new-field-tag').value.trim();
  if(!/^[a-z][a-z0-9_]{0,39}$/.test(id)||['category','answers','constructor','prototype'].includes(id)||draft.fields.some(field=>field.id===id)){announce('Choose a unique lowercase field tag, such as reference.');return;}
  if(draft.fields.length>=40){announce('Use up to 40 fields.');return;}
  remember();draft.fields.push({id,label:id.replaceAll('_',' '),type:id==='workgroup'?'workgroup':'text',required:false,span:1,options:[]});selected=id;$('new-field-tag').value='';render();announce('Field added to the draft.');
};
$('workgroups').oninput=()=>{mark();try{const groups=parseGroups();remember();draft.workgroups=groups;formPreview();}catch(error){announce(error.message);}};
$('format-select').onchange=()=>{formatId=$('format-select').value;formats();};
$('default-format').onchange=()=>{remember();draft.defaultFormat=$('default-format').value;};
$('format-name').oninput=()=>{remember();currentFormat().name=$('format-name').value;for(const id of ['format-select','default-format']){const option=[...$(id).options].find(option=>option.value===formatId);if(option)option.textContent=currentFormat().name;}};
$('template').oninput=()=>{remember();currentFormat().body=$('template').value;outputPreview();};
$('new-format').onclick=()=>{if(draft.formats.length>=20){announce('Use up to 20 formats.');return;}remember();const id=unique('format',draft.formats.map(item=>item.id));draft.formats.push({id,name:'New format',body:'{{summary}}\n{{requester}}'});formatId=id;formats();};
$('duplicate-format').onclick=()=>{if(draft.formats.length>=20){announce('Use up to 20 formats.');return;}remember();const source=clone(currentFormat());source.id=unique('format',draft.formats.map(item=>item.id));source.name+=' copy';draft.formats.push(source);formatId=source.id;formats();};
$('remove-format').onclick=()=>{if(draft.formats.length===1)return;remember();draft.formats=draft.formats.filter(item=>item.id!==formatId);if(draft.defaultFormat===formatId)draft.defaultFormat=draft.formats[0].id;formatId=draft.formats[0].id;formats();};
$('undo').onclick=()=>{if(history.length){draft=history.pop();selected=draft.fields.some(field=>field.id===selected)?selected:draft.fields[0].id;formatId=draft.formats.some(format=>format.id===formatId)?formatId:draft.defaultFormat;mark();render();}};
$('reload').onclick=async()=>{if(await discard('Reloading replaces this draft with the latest saved settings.')){try{await load(scope);announce('Latest saved settings loaded.');}catch(error){announce(error.message);}}};
async function save(reset=false){
  if(busy)return;
  if(!reset&&!$('editor-form').reportValidity())return;
  try{
    if(!reset){draft.workgroups=parseGroups();for(const format of draft.formats){const errors=templateErrors(format.body,draft,boot.categories);if(errors.length)throw new Error(`${format.name}: ${errors.join(' ')}`);}}
    busy=true;$('save-settings').disabled=true;$('editor').disabled=true;$('scope').disabled=true;$('inherit').disabled=true;$('undo').disabled=true;$('reload').disabled=true;
    const result=await api(reset?'reset':'settings',{scope,csrf:boot.csrf,admin:scope==='system'?$('admin-token').value:undefined,body:{config:draft,revision:state.revision,systemRevision:state.systemRevision}});
    state=result;draft=clone(state.config);dirty=false;history=[];selected=draft.fields[0].id;formatId=draft.defaultFormat;render();announce(reset?'Personal override removed. System defaults are active.':'Settings saved. The ticket workspace will use them on its next load.');
  }catch(error){announce(error.message);}
  finally{busy=false;$('save-settings').disabled=false;$('editor').disabled=false;$('scope').disabled=false;$('reload').disabled=false;syncState();}
}
$('save-settings').onclick=()=>save();
$('inherit').onclick=async()=>{if(await discard('Using system defaults discards this unsaved draft.')){if(!state.inherited)await save(true);}};
$('desktop').onclick=()=>{$('form-preview').classList.remove('phone');$('desktop').setAttribute('aria-pressed','true');$('phone').setAttribute('aria-pressed','false');};
$('phone').onclick=()=>{$('form-preview').classList.add('phone');$('desktop').setAttribute('aria-pressed','false');$('phone').setAttribute('aria-pressed','true');};
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
try{boot=await api('bootstrap');$('admin-note').textContent=boot.publicDemo?'System defaults are read only in this public demonstration. Use My workspace to try the editor.':boot.adminConfigured?'A server token is configured. Enter it to save system defaults.':'System saving is locked until the host configures an administrator token. You can still design a draft here.';await load('user');announce('Ready. Edit fields and formats, then save your settings.');}catch(error){announce(error.message);}

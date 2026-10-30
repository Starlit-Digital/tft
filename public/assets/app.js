import {formatTicket} from './format.js';
const $ = id => document.getElementById(id);
let categories = {}, csrf = '';
const drafts = {};
let activeCategory = '';
function status(message) { $('status').textContent = message; }
function ticket() {
  const data = Object.fromEntries(new FormData($('ticket')));
  return {...Object.fromEntries(['requester','summary','priority','location','asset','troubleshooting','category'].map(key=>[key,(data[key] || '').trim()])), answers:Object.fromEntries([...$('questions').querySelectorAll('textarea')].map(el=>[el.dataset.key,el.value.trim()]))};
}
function preview() { $('preview').value = formatTicket(ticket(),categories); }
function questionnaire() {
  if (activeCategory) drafts[activeCategory] = ticket().answers;
  activeCategory = $('category').value;
  $('questions').replaceChildren(Object.assign(document.createElement('legend'),{textContent:'Issue questionnaire'}));
  for (const [key,text] of Object.entries(categories[activeCategory].questions)) {
    const label = document.createElement('label'); label.append(document.createTextNode(text));
    const input = document.createElement('textarea'); input.rows = 2; input.maxLength = 2000; input.name = `answer_${key}`; input.dataset.key = key; input.value = drafts[activeCategory]?.[key] || ''; label.append(input); $('questions').append(label);
  }
  preview();
}
async function api(url,options) {
  const response = await fetch(url,options); const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to complete the request.');
  return data;
}
async function refresh() {
  const data = await api('api.php'); $('saved').replaceChildren();
  if (!data.tickets.length) $('saved').textContent = 'No tickets saved yet. Compose your first demo ticket above.';
  for (const record of data.tickets) {
    const item = document.createElement('details'), summary = document.createElement('summary'), body = document.createElement('pre');
    summary.textContent = `${record.id} · ${record.ticket.summary} · ${record.ticket.priority} · ${record.created_at}`;
    body.textContent = record.formatted; item.append(summary,body); $('saved').append(item);
  }
}
$('category').addEventListener('change',questionnaire);
$('ticket').addEventListener('input',preview);
$('ticket').addEventListener('submit',async event=>{
  event.preventDefault(); $('save').disabled = true;
  try {
    const record = await api('api.php',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(ticket())});
    status(`Saved ${record.id}.`);
    try { await refresh(); } catch { status(`Saved ${record.id}. The ticket list could not refresh. Use Refresh tickets.`); }
  } catch(error) { status(error.message); }
  finally { $('save').disabled = false; }
});
$('copy').addEventListener('click',async()=>{
  try { await navigator.clipboard.writeText($('preview').value); status('Ticket copied.'); }
  catch { $('preview').focus(); $('preview').select(); status('Copy permission unavailable. The text is selected. Use your keyboard copy command.'); }
});
$('example').addEventListener('click',()=>{
  const form = $('ticket');
  for (const [key,value] of Object.entries({requester:'Alex Example',summary:'Unable to open the team calendar',priority:'Normal',location:'Demo office',asset:'DEMO-001',troubleshooting:'Restarted the application. The issue remains.'})) form.elements[key].value = value;
  preview(); status('Fictional example loaded. Add questionnaire answers before saving.');
});
$('refresh').addEventListener('click',()=>refresh().then(()=>status('Ticket list refreshed.')).catch(error=>status(error.message)));
try {
  const data = await api('api.php?action=bootstrap'); categories = data.categories; csrf = data.csrf;
  for (const [key,value] of Object.entries(categories)) $('category').append(new Option(value.label,key));
  $('fields').disabled = false; questionnaire(); await refresh(); status('Ready. Use fictional information only.');
} catch(error) { status(error.message); }

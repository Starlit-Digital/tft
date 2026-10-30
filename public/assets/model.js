export const clone = value => JSON.parse(JSON.stringify(value));
export function tagsFor(config, categories) {
  return [...new Set([...config.fields.map(field => field.id), 'category', 'category.label', 'workgroup.code', 'workgroup.name', 'answers', ...Object.values(categories).flatMap(category => Object.keys(category.questions).map(key => `answers.${key}`))])];
}
export function templateErrors(body, config, categories) {
  const allowed = tagsFor(config, categories), errors = [];
  for (const match of body.matchAll(/\{\{(.*?)\}\}/gs)) if (!allowed.includes(match[1].trim())) errors.push(`Unknown tag: ${match[1].trim()}`);
  if (/\{\{|\}\}/.test(body.replace(/\{\{.*?\}\}/gs, ''))) errors.push('Close every tag with two braces.');
  return errors;
}
export function renderTemplate(ticket, config, categories, formatId) {
  const format = config.formats.find(format => format.id === formatId);
  if (!format) throw new Error('Choose an output format.');
  const errors = templateErrors(format.body,config,categories); if (errors.length) throw new Error(errors.join(' '));
  const values = Object.fromEntries(config.fields.map(field => [field.id,ticket[field.id] || '']));
  values.category = ticket.category || '';
  values['category.label'] = categories[ticket.category]?.label || '';
  values['workgroup.code'] = ticket.workgroup || '';
  values['workgroup.name'] = config.workgroups.find(group => group.code === ticket.workgroup)?.name || '';
  values.answers = Object.entries(categories[ticket.category]?.questions || {}).map(([key,label]) => {
    values[`answers.${key}`] = ticket.answers?.[key] || '';
    return `${label}\n${values[`answers.${key}`] || 'Not provided'}`;
  }).join('\n');
  return format.body.replace(/\{\{(.*?)\}\}/gs, (_,tag) => Object.hasOwn(values,tag.trim()) ? values[tag.trim()] : '');
}
export function exportTicket(ticket, kind = 'json') {
  if (kind === 'json') return JSON.stringify({version:1,ticket},null,2);
  return ['TFT-TAGS/1',...Object.entries(ticket).map(([key,value]) => `${key}: ${JSON.stringify(value)}`)].join('\n');
}
export function importTicket(source, config, categories) {
  if (new TextEncoder().encode(source).length > 131072) throw new Error('Use a ticket file under 128 KB.');
  let ticket;
  if (source.trimStart().startsWith('{')) {
    const envelope = JSON.parse(source);
    if (envelope.version !== 1 || !envelope.ticket || typeof envelope.ticket !== 'object' || Array.isArray(envelope.ticket)) throw new Error('Use a tft version 1 ticket export.');
    ticket = envelope.ticket;
  } else {
    const lines = source.trim().split(/\r?\n/);
    if (lines.shift() !== 'TFT-TAGS/1') throw new Error('Use JSON or TFT-TAGS/1 input. Select tagged text when exporting for a pasteable round trip.');
    ticket = Object.create(null);
    for (const line of lines) {
      const match = /^([a-z][a-z0-9_]*): (.*)$/.exec(line);
      if (!match || Object.hasOwn(ticket,match[1])) throw new Error('Check tagged input for malformed or duplicate fields.');
      ticket[match[1]] = JSON.parse(match[2]);
    }
  }
  const allowed = [...config.fields.map(field => field.id),'category','answers'];
  const unknown = Object.keys(ticket).filter(key => !allowed.includes(key));
  if (unknown.length) throw new Error(`Unrecognized fields: ${unknown.join(', ')}. Update field settings before importing.`);
  if (!Object.hasOwn(categories,ticket.category)) throw new Error('Choose a known issue category in the imported ticket.');
  for (const key of allowed.filter(key => key !== 'answers')) if (ticket[key] !== undefined && typeof ticket[key] !== 'string') throw new Error(`${key} must be text.`);
  if (ticket.answers !== undefined && (!ticket.answers || typeof ticket.answers !== 'object' || Array.isArray(ticket.answers))) throw new Error('Questionnaire answers must be an object.');
  const questionKeys = Object.keys(categories[ticket.category].questions);
  for (const [key,value] of Object.entries(ticket.answers || {})) {
    if (!questionKeys.includes(key) || typeof value !== 'string') throw new Error(`Unrecognized or invalid answer: ${key}`);
  }
  for (const field of config.fields) {
    const value = ticket[field.id] || '';
    const max = ({summary:200,requester:120,location:200,asset:100})[field.id] || (field.type === 'textarea' ? 4000 : 500);
    if (new TextEncoder().encode(value).length > max || value.includes('\0')) throw new Error(`Check ${field.label} and its length.`);
    if (value && field.type === 'select' && !field.options.includes(value)) throw new Error(`Choose a valid ${field.label}.`);
    if (value && field.type === 'workgroup' && !config.workgroups.some(group => group.code === value)) throw new Error('Choose a known workgroup code.');
  }
  for (const value of Object.values(ticket.answers || {})) if (new TextEncoder().encode(value).length > 2000 || value.includes('\0')) throw new Error('Check answer length.');
  return ticket;
}
export function sampleTicket(config) {
  const examples = {summary:'Unable to open the team calendar',requester:'Alex Example',location:'Demo office',asset:'DEMO-001',troubleshooting:'Restarted the application. The issue remains.'};
  return {...Object.fromEntries(config.fields.map(field => [field.id,examples[field.id] || (field.type === 'select' ? field.options[0] || '' : field.type === 'workgroup' ? config.workgroups[0]?.code || '' : '')])),category:'application',answers:{application:'Example Calendar 1.0',steps:'Open the calendar tab.',expected:'The team calendar should open.'}};
}

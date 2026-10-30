export const $ = id => document.getElementById(id);
export function element(tag, text, attributes = {}) {
  const node = document.createElement(tag); if (text !== null) node.textContent = text;
  for (const [key,value] of Object.entries(attributes)) node.setAttribute(key,value);
  return node;
}
export function announce(message) { $('status').textContent = message; }
export async function api(action = 'tickets', {body, csrf, scope, admin} = {}) {
  const query = new URLSearchParams({action}); if (scope) query.set('scope',scope);
  const response = await fetch(`api.php?${query}`, body === undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf || '',...(admin ? {'X-TFT-Admin':admin} : {})},body:JSON.stringify(body)});
  const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to complete the request.'); return data;
}
export function download(text, name, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text],{type})), link = element('a',null,{href:url,download:name});
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url),1000);
}
export async function copy(text, fallback) {
  try { await navigator.clipboard.writeText(text); announce('Copied to the clipboard.'); }
  catch { fallback.focus(); fallback.select(); announce('The text is selected. Use your keyboard copy command.'); }
}

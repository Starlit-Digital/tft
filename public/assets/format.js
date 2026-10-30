export function formatTicket(ticket, categories) {
  const category = categories[ticket.category];
  if (!category) return '';
  const lines = [ticket.summary.toUpperCase(), `Category: ${category.label}`];
  for (const [key, label] of Object.entries({requester:'Requester', priority:'Priority', location:'Location', asset:'Asset'})) lines.push(`${label}: ${ticket[key] || 'Not provided'}`);
  lines.push('');
  for (const [key,label] of Object.entries(category.questions)) lines.push(`${label}\n${ticket.answers[key] || 'Not provided'}`);
  lines.push(`\nTroubleshooting:\n${ticket.troubleshooting || 'Not provided'}`);
  return lines.join('\n');
}

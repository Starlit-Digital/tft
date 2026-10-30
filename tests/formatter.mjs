import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {formatTicket} from '../public/assets/format.js';
const categories = JSON.parse(readFileSync(new URL('../config/categories.json',import.meta.url)));
for (const category of Object.keys(categories)) {
  const input = {category,requester:'Alex Example',summary:'Example issue',priority:'Normal',location:'',asset:'DEMO-1',troubleshooting:'Checked twice.\nStill unavailable.',answers:Object.fromEntries(Object.keys(categories[category].questions).map(key=>[key,'Example answer']))};
  const php = execFileSync('php',['-r',"require 'src/Tickets.php'; echo formatTicket(validateTicket(json_decode(stream_get_contents(STDIN),true)));"],{input:JSON.stringify(input),encoding:'utf8'});
  assert.equal(formatTicket(input,categories),php,`${category}: browser and saved format must agree`);
}
console.log('PASS browser and server formatter parity for all categories');

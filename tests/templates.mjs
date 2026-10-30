import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {renderTemplate,importTicket,exportTicket,templateErrors,sampleTicket,clone} from '../public/assets/model.js';
const config=JSON.parse(readFileSync('config/settings.json')), categories=JSON.parse(readFileSync('config/categories.json'));
config.fields.push({id:'reference',label:'Reference',type:'textarea',span:2,required:false,options:[]});
config.formats.push({id:'custom',name:'Custom',body:'  {{summary}}\n{{reference}}\n{{workgroup.code}} / {{workgroup.name}}\n{{answers.steps}}\n{{answers}}  '});
for(const category of Object.keys(categories)){
  const ticket={...sampleTicket(config),category,reference:'An emoji 🧭\nA second line: "quoted"\n{{summary}}',answers:Object.fromEntries(Object.keys(categories[category].questions).map(key=>[key,key===Object.keys(categories[category].questions)[0]?'0':'<script>text only</script>\nNext line']))};
  for(const format of config.formats){
    const php=execFileSync('php',['-r',"require 'src/Tickets.php'; $d=json_decode(stream_get_contents(STDIN),true); echo renderTicket(validateTicket($d['ticket'],$d['config']),validateSettings($d['config']),$d['format']);"],{input:JSON.stringify({ticket,config,format:format.id}),encoding:'utf8'});
    assert.equal(renderTemplate(ticket,config,categories,format.id),php,`${category}/${format.id}`);
  }
  for(const kind of ['json','tags']) assert.deepEqual({...importTicket(exportTicket(ticket,kind),config,categories)},ticket,`${kind} must round trip multiline text and answers`);
}
const ticket=sampleTicket(config), unknown={...ticket,unknown:'value'};
assert.throws(()=>importTicket(exportTicket(unknown),config,categories),/Unrecognized/);
assert.throws(()=>importTicket('TFT-TAGS/1\ncategory: "access"\ncategory: "network"',config,categories),/duplicate/);
assert.throws(()=>importTicket(exportTicket({...ticket,workgroup:'SECRET'}),config,categories),/workgroup/);
assert.throws(()=>importTicket(exportTicket({...ticket,answers:{unexpected:'x'}}),config,categories),/answer/);
assert.throws(()=>importTicket('arbitrary formatted prose',config,categories),/TFT-TAGS/);
assert.equal(templateErrors('{{unknown}}',config,categories).length,1);
assert.equal(templateErrors('{{summary',config,categories).length,1);
assert.equal(templateErrors('{{summary}}',config,categories).length,0);
console.log('PASS all template renderers agree, import/export round trips, unknown fields and invalid tags rejected');

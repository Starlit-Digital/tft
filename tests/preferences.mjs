import assert from 'node:assert/strict';
import {defaults,palette,contrast,validate} from '../public/assets/accessibility/shared/preferences.js';
for(let brightness=0;brightness<32;brightness++){
  for(const mode of ['standard','high']){
    const colors=palette({...defaults,brightness,contrast:mode});
    for(const foreground of ['text','muted','accent','secondary','line'])for(const surface of ['page','panel']){
      assert(contrast(colors[foreground],colors[surface])>=5,`Shade ${brightness}, ${mode}, ${foreground}/${surface}`);
    }
  }
}
for(const font of ['sans','serif','mono'])assert.equal(validate({...defaults,font}).font,font,'Explicit visitor font preference is preserved.');
console.log('PASS 32 shade palettes, normal and high contrast pairs, and explicit visitor font preferences');

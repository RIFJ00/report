global.window={};
require('../animators.js');
const a=window.ANIMATORS||[];
function assert(ok,msg){if(!ok)throw new Error(msg)}
assert(a.length===40,`expected 40 animator references, got ${a.length}`);
assert(new Set(a.map(x=>x.id)).size===a.length,'duplicate animator id');
assert(new Set(a.map(x=>x.name)).size===a.length,'duplicate animator name');
for(const x of a){
 assert(x.id&&x.name&&x.region&&x.genre&&x.traits,`missing field: ${JSON.stringify(x)}`);
 assert(['国内','海外'].includes(x.region),`bad region: ${x.name}`);
 assert(x.traits.length>=10,`traits too short: ${x.name}`);
}
assert(a.filter(x=>x.region==='国内').length===20,'domestic count must be 20');
assert(a.filter(x=>x.region==='海外').length===20,'overseas count must be 20');
console.log('animator registry tests passed');

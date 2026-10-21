'use strict';
const fs=require('fs');
const path=require('path');
function assert(ok,msg){if(!ok)throw new Error(msg)}
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
assert(/<select id="duration"><option>約3分<\/option><option>約4分<\/option><option>約5分<\/option><\/select>/.test(html),'duration default must be about 3 minutes');
assert(html.includes('約3分・12場面を基本に'),'welcome copy must describe 3-minute default');
const clearCount=(html.match(/class="[^"]*clear-all[^"]*"/g)||[]).length;
assert(clearCount>=3,`expected clear-all controls on settings/review/result, got ${clearCount}`);
assert(app.includes('function clearAll()'),'clearAll function missing');
assert(app.includes("customTemplates.splice(0)"),'custom templates must be cleared');
assert(app.includes("$('output').value=''"),'generated prompt must be cleared');
assert(app.includes('confirmed=null'),'confirmed state must be cleared');
assert(app.includes("show('settings')"),'clear should return to settings');
console.log('ui default / clear-all tests passed');

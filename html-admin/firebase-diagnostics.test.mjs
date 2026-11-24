import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnosePublicFirebase,explainConnectionError} from './firebase-diagnostics.mjs';
test('disabled configuration is not queried',async()=>{
 let touched=false;
 const r=await diagnosePublicFirebase({loadOptions:async()=>({enabled:false}),initializeAndQuery:async()=>{touched=true}});
 assert.equal(r.stage,'disabled');assert.equal(touched,false);assert.equal(r.ok,false);
});
test('enabled public query uses injected reader without writes',async()=>{
 const r=await diagnosePublicFirebase({
  loadOptions:async()=>({enabled:true,collection:'ministryArticles',firebaseConfig:{projectId:'html-viewer-703b6'}}),
  initializeAndQuery:async o=>{assert.equal(o.collection,'ministryArticles');return {sampleCount:1}}
 });
 assert.equal(r.ok,true);assert.equal(r.sampleCount,1);
});
test('permission denied has understandable message',async()=>{
 const r=await diagnosePublicFirebase({
  loadOptions:async()=>({enabled:true,collection:'ministryArticles',firebaseConfig:{projectId:'html-viewer-703b6'}}),
  initializeAndQuery:async()=>{throw Object.assign(new Error('denied'),{code:'permission-denied'})}
 });
 assert.equal(r.ok,false);assert.equal(r.code,'permission-denied');
 assert.match(r.message,/セキュリティルール/);
});
test('malformed config reports failure without connecting',async()=>{
 const r=await diagnosePublicFirebase({loadOptions:async()=>{throw Error('invalid')}});
 assert.equal(r.stage,'configuration');assert.equal(r.ok,false);
});

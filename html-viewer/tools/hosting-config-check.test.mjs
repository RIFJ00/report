import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inspectHostingConfig} from './hosting-config-check.mjs';

async function fixture(fn){
 const temp=await mkdtemp(join(tmpdir(),'rifj-hosting-'));
 const merged=join(temp,'merged');
 await mkdir(merged);
 const routes=['','blog','blogimport','xpost','sales_strategy','html-viewer','html-admin'];
 for(const route of routes){
  const dir=join(merged,route);await mkdir(dir,{recursive:true});
  await writeFile(join(dir,'index.html'),'<h1>test</h1>');
 }
 const configPath=join(temp,'firebase.json');
 async function config(hosting){await writeFile(configPath,JSON.stringify({hosting}))}
 try{await fn({merged,configPath,config})} finally{await rm(temp,{recursive:true,force:true})}
}
test('verified Hosting site and full bundle pass read-only preflight',async()=>{
 await fixture(async({merged,configPath,config})=>{
  await config([{site:'rifj-staging',public:'other'},{site:'rifj-site',public:'merged'}]);
  const report=await inspectHostingConfig(configPath,'rifj-site',merged);
  assert.equal(report.success,true);
  assert.equal(report.hostingSite,'rifj-site');
  assert.equal(report.matchingPublicDir,true);
  assert.equal(report.requiredRoutesChecked.length,7);
 });
});
test('rejects wrong site ID instead of selecting an arbitrary Hosting site',async()=>{
 await fixture(async({merged,configPath,config})=>{
  await config({site:'rifj-site',public:'merged'});
  await assert.rejects(inspectHostingConfig(configPath,'unverified-site',merged),/Exactly one Hosting entry/);
 });
});
test('rejects missing existing production route',async()=>{
 await fixture(async({merged,configPath,config})=>{
  await config({site:'rifj-site',public:'merged'});
  await rm(join(merged,'blog','index.html'));
  await assert.rejects(inspectHostingConfig(configPath,'rifj-site',merged),/Required existing or new routes missing/);
 });
});
test('rejects mismatched Hosting public directory',async()=>{
 await fixture(async({merged,configPath,config})=>{
  await config({site:'rifj-site',public:'dist'});
  await assert.rejects(inspectHostingConfig(configPath,'rifj-site',merged),/public path does not match/);
 });
});
test('reports broad catch-all rewrites as requiring manual review',async()=>{
 await fixture(async({merged,configPath,config})=>{
  await config({site:'rifj-site',public:'merged',rewrites:[{source:'**',destination:'/index.html'}]});
  const result=await inspectHostingConfig(configPath,'rifj-site',merged);
  assert.equal(result.wildcardRuleReviewRequired,true);
  assert.equal(result.wildcardRules.length,1);
 });
});
test('refuses ambiguous multiple entries pointing to same target',async()=>{
 await fixture(async({merged,configPath,config})=>{
  await config([{target:'rifj-site',public:'merged'},{target:'rifj-site',public:'merged'}]);
  await assert.rejects(inspectHostingConfig(configPath,'rifj-site',merged),/Exactly one Hosting entry/);
 });
});

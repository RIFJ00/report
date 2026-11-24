import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,lstat,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareOverlay} from './prepare-overlay.mjs';

async function fixture(fn){
 const directory=await mkdtemp(join(tmpdir(),'rifj-overlay-'));
 const baseline=join(directory,'baseline');
 const output=join(directory,'output');
 const sourceRoot=join(directory,'source');
 await mkdir(baseline);
 await mkdir(sourceRoot);
 await mkdir(join(sourceRoot,'html-viewer'),{recursive:true});
 await mkdir(join(sourceRoot,'html-admin'),{recursive:true});
 await writeFile(join(baseline,'index.html'),'<h1>Existing RIFJ home</h1>');
 await mkdir(join(baseline,'blog'));
 await writeFile(join(baseline,'blog','index.html'),'<h1>Existing blog</h1>');
 await mkdir(join(baseline,'xpost'));
 await writeFile(join(baseline,'xpost','index.html'),'<h1>Existing X</h1>');
 const required={
  'html-viewer':['index.html','articles.json','article-utils.mjs','html-import.mjs','firebase-data.mjs','firebase-options.mjs','firebase-config.json'],
  'html-admin':['index.html','firebase-admin.mjs']
 };
 for(const [folder,names] of Object.entries(required)){
  for(const name of names){
   const body=name==='firebase-config.json'?JSON.stringify({enabled:false,firebaseConfig:null}):name==='articles.json'?'[]':'/* runtime */';
   await writeFile(join(sourceRoot,folder,name),body);
  }
 }
 try{await fn({baseline,output,sourceRoot,directory})}
 finally{await rm(directory,{recursive:true,force:true})}
}

test('overlay preserves every existing route and adds only approved runtime files',async()=>{
 await fixture(async({baseline,output,sourceRoot})=>{
  const report=await prepareOverlay(baseline,output,{sourceRoot});
  assert.equal(report.existingSiteUnchanged,true);
  assert.equal(report.baselineFiles,3);
  assert.equal(report.addedFiles,9);
  assert.equal(await readFile(join(output,'index.html'),'utf8'),'<h1>Existing RIFJ home</h1>');
  assert.equal(await readFile(join(output,'blog','index.html'),'utf8'),'<h1>Existing blog</h1>');
  assert.equal(await readFile(join(output,'xpost','index.html'),'utf8'),'<h1>Existing X</h1>');
  assert.equal((await lstat(join(output,'html-viewer','index.html'))).isFile(),true);
  const audit=JSON.parse(await readFile(join(output,'overlay-audit.json'),'utf8'));
  assert.equal(audit.existingSiteUnchanged,true);
  assert.equal(audit.files.length,12);
 });
});
test('rejects baseline when viewer path already exists',async()=>{
 await fixture(async({baseline,output,sourceRoot})=>{
  await mkdir(join(baseline,'html-viewer'));
  await writeFile(join(baseline,'html-viewer','index.html'),'legacy');
  await assert.rejects(prepareOverlay(baseline,output,{sourceRoot}),/already contains/);
 });
});
test('rejects missing index.html baseline',async()=>{
 await fixture(async({baseline,output,sourceRoot})=>{
  await rm(join(baseline,'index.html'));
  await assert.rejects(prepareOverlay(baseline,output,{sourceRoot}),/missing root index.html/);
 });
});
test('rejects symlinks in source baseline',async()=>{
 await fixture(async({baseline,output,sourceRoot})=>{
  await symlink(join(baseline,'index.html'),join(baseline,'linked.html'));
  await assert.rejects(prepareOverlay(baseline,output,{sourceRoot}),/Symbolic link/);
 });
});
test('rejects Firebase-enabled preview and draft data',async()=>{
 await fixture(async({baseline,output,sourceRoot})=>{
  await writeFile(join(sourceRoot,'html-viewer','firebase-config.json'),JSON.stringify({enabled:true,firebaseConfig:{projectId:'real'}}));
  await assert.rejects(prepareOverlay(baseline,output,{sourceRoot}),/disabled/);
  await writeFile(join(sourceRoot,'html-viewer','firebase-config.json'),JSON.stringify({enabled:false,firebaseConfig:null}));
  await writeFile(join(sourceRoot,'html-viewer','articles.json'),JSON.stringify([{status:'draft',title:'secret'}]));
  await assert.rejects(prepareOverlay(baseline,output,{sourceRoot}),/draft or private/);
 });
});
test('never deletes a pre-existing output folder',async()=>{
 await fixture(async({baseline,output,sourceRoot})=>{
  await mkdir(output);
  await writeFile(join(output,'important.txt'),'retain');
  await assert.rejects(prepareOverlay(baseline,output,{sourceRoot}),/already exists/);
  assert.equal(await readFile(join(output,'important.txt'),'utf8'),'retain');
 });
});
test('rejects backup files inside runtime folders',async()=>{
 await fixture(async({baseline,output,sourceRoot})=>{
  await writeFile(join(sourceRoot,'html-viewer','my-backup.json'),'[]');
  await assert.rejects(prepareOverlay(baseline,output,{sourceRoot}),/Backup in public artifact/);
 });
});

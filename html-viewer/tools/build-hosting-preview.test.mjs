import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,cp,mkdir,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildPreview} from './build-hosting-preview.mjs';

const root=resolve(fileURLToPath(new URL('../../',import.meta.url)));
async function withScratch(fn){
 const base=await mkdtemp(join(tmpdir(),'rifj-hosting-preview-'));
 const dest=join(base,'generated');
 try{await fn({base,dest})}
 finally{await rm(base,{recursive:true,force:true})}
}
test('packages only isolated viewer/admin runtime into new standalone preview',async()=>{
 await withScratch(async({dest})=>{
  const result=await buildPreview(dest);
  assert.equal(result.site,'html-viewer-703b6');
  assert.equal(result.firebaseEnabled,false);
  assert.equal(result.totalRuntimeFiles,11);
  const config=JSON.parse(await readFile(join(dest,'firebase.json'),'utf8'));
  assert.equal(config.hosting.site,'html-viewer-703b6');
  assert.equal(config.hosting.public,'public');
  assert.equal(config.hosting.rewrites,undefined);
  const preview=JSON.parse(await readFile(join(dest,'public','html-viewer','firebase-config.json'),'utf8'));
  assert.equal(preview.enabled,false);
  assert.equal(preview.firebaseConfig,null);
  assert.equal((await stat(join(dest,'public','html-admin','save-review.mjs'))).isFile(),true);
  await assert.rejects(stat(join(dest,'public','blog','index.html')),{code:'ENOENT'});
 });
});
test('cannot overwrite existing output or deploy root from preview preparation',async()=>{
 await withScratch(async({dest})=>{
  await mkdir(dest);
  await writeFile(join(dest,'important-file.txt'),'must stay');
  await assert.rejects(buildPreview(dest),/already exists/);
  assert.equal(await readFile(join(dest,'important-file.txt'),'utf8'),'must stay');
  await assert.rejects(buildPreview(root),/outside the repository source tree/);
 });
});
test('rejects a live Firebase config before generating output',async()=>{
 await withScratch(async({base,dest})=>{
  const copyRoot=join(base,'source');
  await mkdir(join(copyRoot,'html-viewer'),{recursive:true});
  await cp(join(root,'html-viewer','firebase-config.json'),join(copyRoot,'html-viewer','firebase-config.json'));
  await cp(join(root,'html-viewer','articles.json'),join(copyRoot,'html-viewer','articles.json'));
  await writeFile(join(copyRoot,'html-viewer','firebase-config.json'),JSON.stringify({enabled:true,collection:'ministryArticles',firebaseConfig:{projectId:'html-viewer-703b6'}}));
  await assert.rejects(buildPreview(dest,{sourceRoot:copyRoot}),/disabled Firebase/);
  await assert.rejects(stat(dest),{code:'ENOENT'});
 });
});
test('rejects unpublished static articles before generating output',async()=>{
 await withScratch(async({base,dest})=>{
  const copyRoot=join(base,'source');
  await mkdir(join(copyRoot,'html-viewer'),{recursive:true});
  await cp(join(root,'html-viewer','firebase-config.json'),join(copyRoot,'html-viewer','firebase-config.json'));
  await writeFile(join(copyRoot,'html-viewer','articles.json'),JSON.stringify([{title:'private',status:'private'}]));
  await assert.rejects(buildPreview(dest,{sourceRoot:copyRoot}),/draft or private articles/);
  await assert.rejects(stat(dest),{code:'ENOENT'});
 });
});

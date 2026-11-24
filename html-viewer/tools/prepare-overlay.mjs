#!/usr/bin/env node
/**
 * Prepare an additive static Hosting preview from an EXACT baseline snapshot.
 * Never contacts Firebase, never deploys and never changes the baseline.
 * Usage: node html-viewer/tools/prepare-overlay.mjs BASELINE_DIR OUTPUT_DIR
 */
import {cp,mkdir,readdir,lstat,readFile,writeFile,access} from 'node:fs/promises';
import {resolve,relative,join,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const allowedFolders=['html-viewer','html-admin'];
const required={
  'html-viewer':['index.html','articles.json','article-utils.mjs','html-import.mjs','firebase-data.mjs','firebase-config.json'],
  'html-admin':['index.html','firebase-admin.mjs']
};
function must(ok,message){if(!ok)throw Error(message)}
async function files(base,prefix='',skipNonRuntime=false){
 const out=[];
 for(const item of await readdir(join(base,prefix),{withFileTypes:true})){
  const relativePath=join(prefix,item.name);
  const full=join(base,relativePath);
  if(skipNonRuntime && item.isDirectory() && ['html-viewer/tests','html-viewer/tools'].includes(relativePath.replaceAll('\\','/')))continue;
  const stat=await lstat(full);
  must(!stat.isSymbolicLink(),'Symbolic link is not allowed: '+relativePath);
  if(stat.isDirectory())out.push(...await files(base,relativePath,skipNonRuntime));
  else {must(stat.isFile(),'Unsupported entry in baseline: '+relativePath);out.push(relativePath)}
 }
 return out;
}
async function hash(file){return createHash('sha256').update(await readFile(file)).digest('hex')}
function under(base,path){return path===base||path.startsWith(base+sep)}
export async function prepareOverlay(baseline,output,{sourceRoot=root}={}){
 const src=resolve(sourceRoot),base=resolve(baseline),out=resolve(output);
 must(base!==out && !under(base,out) && !under(out,base),'Baseline and output must not overlap');
 must(!under(src,out) && !under(src,base),'Preview directories must be outside the source repository');
 let outputExists=false;try{await access(out);outputExists=true}catch{};
 must(!outputExists,'Output directory already exists; choose a fresh destination');
 const baselineFiles=await files(base);
 must(baselineFiles.includes('index.html'),'Baseline snapshot is missing root index.html');
 const baselineHashes=new Map();
 for(const p of baselineFiles)baselineHashes.set(p,await hash(join(base,p)));
 const priorFiles=baselineFiles.filter(p=>allowedFolders.some(folder=>p===folder||p.startsWith(folder+sep)));
 must(priorFiles.length===0,'Existing baseline already contains html-viewer or html-admin: manual migration review is required');
 const config=JSON.parse(await readFile(join(src,'html-viewer/firebase-config.json'),'utf8'));
 must(config.enabled===false && config.firebaseConfig===null,'Firebase integration must remain disabled for static preview');
 const articles=JSON.parse(await readFile(join(src,'html-viewer/articles.json'),'utf8'));
 must(Array.isArray(articles),'articles.json must be an array');
 must(articles.every(a=>a.status==='published'),'Static feed contains draft or private articles');
 const manifest=[];
 for(const folder of allowedFolders){
  for(const name of required[folder])must((await lstat(join(src,folder,name))).isFile(),'Required file missing: '+folder+'/'+name);
  for(const file of await files(src,folder,true)){
   // Exclude tests/tools, README, local backup, undeployed rules and staging-only content.
   if(file.startsWith(folder+sep+'tests'+sep)||file.startsWith(folder+sep+'tools'+sep))continue;
   if(file.includes('PRIVATE')||file.toLowerCase().includes('backup'))throw Error('Backup in public artifact: '+file);
  }
 }
 // Only copy approved browser runtime files.
 await mkdir(out,{recursive:true});
 for(const p of baselineFiles){const target=join(out,p);await mkdir(dirname(target),{recursive:true});await cp(join(base,p),target)}
 for(const [folder,names] of Object.entries(required)){
  for(const name of names){const target=join(out,folder,name);await mkdir(dirname(target),{recursive:true});await cp(join(src,folder,name),target)}
 }
 for(const [p,digest] of baselineHashes)must(await hash(join(out,p))===digest,'Existing site asset modified: '+p);
 for(const p of [...baselineFiles,...Object.entries(required).flatMap(([folder,names])=>names.map(name=>join(folder,name)))]){
  manifest.push({path:p.replaceAll('\\','/'),sha256:await hash(join(out,p))});
 }
 const report={baselineFiles:baselineFiles.length,addedFiles:manifest.length-baselineFiles.length,existingSiteUnchanged:true,firebaseEnabled:false,warning:'PREVIEW ONLY. Baseline must be obtained from the actual current Hosting deployment before any production release.',files:manifest};
 await writeFile(join(out,'overlay-audit.json'),JSON.stringify(report,null,2)+'\n');
 return report;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [baseline,output]=process.argv.slice(2);
 if(!baseline||!output){console.error('Usage: node prepare-overlay.mjs BASELINE_DIR OUTPUT_DIR');process.exitCode=2}
 else try{const r=await prepareOverlay(baseline,output);console.log(JSON.stringify({baselineFiles:r.baselineFiles,addedFiles:r.addedFiles,existingSiteUnchanged:r.existingSiteUnchanged}))}
 catch(e){console.error('Preview overlay rejected: '+e.message);process.exitCode=1}
}

#!/usr/bin/env node
/**
 * Build a standalone static Firebase Hosting preview for HTML Viewer only.
 * This builds files but NEVER deploys. No firebase.json/.firebaserc in repository root.
 */
import {copyFile,mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {validateFirebaseOptions} from '../firebase-options.mjs';
const defaultRoot=resolve(fileURLToPath(new URL('../../',import.meta.url)));
const files={
 'html-viewer':['index.html','articles.json','article-utils.mjs','html-import.mjs','firebase-data.mjs','firebase-options.mjs','firebase-config.json'],
 'html-admin':['index.html','firebase-admin.mjs','firebase-diagnostics.mjs','save-review.mjs']
};
function assert(ok,msg){if(!ok)throw Error(msg)}
export async function buildPreview(destination,{sourceRoot=defaultRoot}={}){
 const out=resolve(destination);
 const src=resolve(sourceRoot);
 assert(out!==src && !out.startsWith(src+'/'),'Output must be outside the repository source tree');
 try{await access(out);throw Error('Output directory already exists; choose a fresh location')}
 catch(error){if(error.code!=='ENOENT')throw error}
 const configuration=JSON.parse(await readFile(join(src,'html-viewer','firebase-config.json'),'utf8'));
 assert(configuration.enabled===false,'Preview packaging requires disabled Firebase to avoid live writes');
 assert(configuration.firebaseConfig===null,'Preview must not embed a live Firebase configuration');
 const feed=JSON.parse(await readFile(join(src,'html-viewer','articles.json'),'utf8'));
 assert(Array.isArray(feed),'Public article feed must be an array');
 assert(feed.every(x=>x.status==='published'),'Public feed contains draft or private articles');
 // Always fail before making the output folder on invalid source configuration.
 const destinationRoot=join(out,'public');
 for(const [dir,names] of Object.entries(files)){
  await mkdir(join(destinationRoot,dir),{recursive:true});
  for(const filename of names)await copyFile(join(src,dir,filename),join(destinationRoot,dir,filename));
 }
 const firebaseJson={
  hosting:{
   site:'html-viewer-703b6',
   public:'public',
   ignore:['firebase.json','**/.*','**/node_modules/**'],
   headers:[
    {source:'/**',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'}]}
   ]
  }
 };
 await writeFile(join(out,'firebase.json'),JSON.stringify(firebaseJson,null,2)+'\n');
 const index='<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HTML Viewer 検証環境</title><body><h1>HTML Viewer 検証環境</h1><p>Firebase連携は無効です。ステージング専用。</p><p><a href="/html-viewer/">省庁記事閲覧</a></p><p><a href="/html-admin/">記事管理</a></p></body></html>';
 await writeFile(join(destinationRoot,'index.html'),index);
 return {output:out,site:'html-viewer-703b6',folders:Object.keys(files),totalRuntimeFiles:Object.values(files).reduce((sum,a)=>sum+a.length,0),firebaseEnabled:false};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const out=process.argv[2];
 if(!out){console.error('Usage: node build-hosting-preview.mjs /absolute/new/output');process.exitCode=2}
 else try{console.log(JSON.stringify(await buildPreview(out),null,2))}
 catch(e){console.error(e.message);process.exitCode=1}
}

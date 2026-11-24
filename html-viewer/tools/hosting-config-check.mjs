#!/usr/bin/env node
/**
 * Read-only Firebase Hosting configuration preflight.
 * Usage:
 *   node html-viewer/tools/hosting-config-check.mjs path/to/firebase.json expected-site-id merged-output-dir
 * Does not deploy, create a channel, authenticate or mutate firebase.json.
 */
import {readFile,stat,access} from 'node:fs/promises';
import {resolve,join,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';

const critical=['/','/blog/','/blogimport/','/xpost/','/sales_strategy/','/html-viewer/','/html-admin/'];
function assert(ok,msg){if(!ok)throw Error(msg)}
function hostingDefinitions(config){
 assert(config && typeof config==='object' && config.hosting,'Missing Firebase Hosting configuration');
 return Array.isArray(config.hosting)?config.hosting:[config.hosting];
}
function selectSite(definitions,expectedSiteId){
 assert(typeof expectedSiteId==='string' && /^[a-z0-9-]{3,63}$/.test(expectedSiteId),'Expected Hosting site ID is required');
 const selected=definitions.filter(h=>h.site===expectedSiteId || h.target===expectedSiteId);
 assert(selected.length===1,'Exactly one Hosting entry must explicitly match the verified site ID / target');
 return selected[0];
}
function normalized(p){return p.replace(/\/+/g,'/').replace(/\/$/,'')||'/'}
function absoluteFromRoot(root,p){
 assert(typeof p==='string'&&p.length>0,'Missing public directory');
 return resolve(root,p);
}
export async function inspectHostingConfig(configPath,expectedSiteId,mergedDir,{requirePublicPathMatch=true}={}){
 const configFile=resolve(configPath),root=resolve(configFile,'..');
 const config=JSON.parse(await readFile(configFile,'utf8'));
 const definitions=hostingDefinitions(config);
 const hosting=selectSite(definitions,expectedSiteId);
 const publicDir=absoluteFromRoot(root,hosting.public);
 const merged=resolve(mergedDir);
 assert(publicDir===merged || !requirePublicPathMatch,
   'Hosting public path does not match the inspected additive deployment bundle');
 assert(!hosting.source,'Hosting source-based deployment is unsupported by the static overlay preflight');
 const allRules=[...(hosting.rewrites||[]),...(hosting.redirects||[])];
 const dangerous=allRules.filter(rule=>{
   const pattern=rule.source??rule.regex??'';
   return typeof pattern==='string' && (pattern==='**'||pattern==='/**'||pattern==='/*'||pattern==='(.*)'||pattern==='^/.*');
 });
 const missing=[];
 for(const path of critical){
  const file=join(merged,path.replace(/^\/|\/$/g,''),'index.html');
  try{const f=await stat(file);if(!f.isFile())missing.push(path)}
  catch{missing.push(path)}
 }
 assert(missing.length===0,'Required existing or new routes missing: '+missing.join(', '));
 const configSummary={
  expectedSiteId,
  hostingSite:hosting.site??null,
  hostingTarget:hosting.target??null,
  publicDir,
  matchingPublicDir:publicDir===merged,
  requiredRoutesChecked:critical,
  wildcardRules:dangerous,
  wildcardRuleReviewRequired:dangerous.length>0,
  success:true,
  warning:'No DNS, domain ownership, remote deployment, redirects or rewrite behavior can be validated by this offline tool. Manual review of real Hosting settings remains mandatory.'
 };
 return configSummary;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const [config,site,merged]=process.argv.slice(2);
 if(!config||!site||!merged){console.error('Usage: node hosting-config-check.mjs firebase.json VERIFIED_SITE_ID MERGED_DIR');process.exitCode=2}
 else try{console.log(JSON.stringify(await inspectHostingConfig(config,site,merged),null,2))}
 catch(e){console.error('Hosting config preflight rejected: '+e.message);process.exitCode=1}
}

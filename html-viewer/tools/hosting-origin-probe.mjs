#!/usr/bin/env node
/* Public read-only Pages-origin fingerprint. Never writes to remote services. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const target='https://report.rifj.jp/';
const local='index.html';
function sha(buf){return createHash('sha256').update(buf).digest('hex')}
async function run(){
 const out={checkedUrl:target,localPath:local,check:'read-only',htmlExactMatch:false,dnsCname:null,pagesLikely:false,notes:[]};
 const localBytes=readFileSync(local);
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch(target,{redirect:'follow',signal:controller.signal,headers:{'User-Agent':'RIFJ-HTML-Viewer-Hosting-Preflight/1.0'}});
  out.httpStatus=response.status;
  out.responseFinalUrl=response.url;
  out.contentType=response.headers.get('content-type')||'';
  if(!response.ok)throw Error('HTTP '+response.status);
  const bytes=Buffer.from(await response.arrayBuffer());
  out.htmlExactMatch=sha(localBytes)===sha(bytes);
  out.homepageTitleMatch=/<title[^>]*>[\s\S]*?政策リサーチ[\s\S]*?<\/title>/i.test(bytes.toString('utf8'));
  out.bytes=bytes.length;
  if(out.htmlExactMatch)out.notes.push('Current homepage response exactly matches main/index.html bytes at this revision');
  else out.notes.push('Public homepage differs byte-for-byte from main/index.html; verify GitHub Pages source and caching');
 }catch(e){out.notes.push('HTTP check unavailable: '+e.message)}
 finally{clearTimeout(timeout)}
 try{
  const c=execFileSync('dig',['+short','CNAME','report.rifj.jp'],{encoding:'utf8',timeout:6000}).trim();
  out.dnsCname=c||null;
  if(!c)out.notes.push('CNAME not present or not observable in DNS response');
 }catch(e){out.notes.push('DNS check unavailable: '+e.message)}
 out.pagesLikely=out.htmlExactMatch && (out.dnsCname?.toLowerCase().includes('github.io')??false);
 if(out.pagesLikely)out.notes.push('Both exact content match and GitHub Pages DNS target support Pages hosting');
 else out.notes.push('Actual Pages publishing settings remain unverified until Settings > Pages is inspected');
 const report=JSON.stringify(out,null,2)+'\n';
 writeFileSync(process.argv[2]||'hosting-origin-report.json',report);
 console.log(report);
 // Read-only diagnostics never block other security tests on transient public-site errors.
}
run().catch(e=>{console.error(e);process.exitCode=1});

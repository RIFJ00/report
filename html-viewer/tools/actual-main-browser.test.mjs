import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../tests/package.json',import.meta.url));
const {chromium}=require('playwright');

const root=process.env.RIFJ_PAGES_CANDIDATE?resolve(process.env.RIFJ_PAGES_CANDIDATE):'';
test('actual main snapshot plus two new routes works without touching Firebase',async t=>{
 if(!root){t.skip('Only run when RIFJ_PAGES_CANDIDATE is provided');return}
 assert.equal((await readFile(root+'/CNAME','utf8')).trim(),'report.rifj.jp');
 const auditFile=root+'/overlay-audit.json';
 const audit=JSON.parse(await readFile(auditFile,'utf8'));
 assert.equal(audit.existingSiteUnchanged,true);
 assert.equal(audit.addedFiles,11);
 assert.ok(audit.baselineFiles>5);
 const safeMime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css','.js':'text/javascript'};
 const server=createServer(async(req,res)=>{
  try{
   const raw=new URL(req.url,'http://127.0.0.1').pathname;
   const decoded=decodeURIComponent(raw);
   const name=decoded.endsWith('/')?decoded+'index.html':decoded;
   const full=resolve(root,'.'+name);
   if(!full.startsWith(root+sep))throw Error('outside root');
   if(!(await stat(full)).isFile())throw Error('not file');
   const body=await readFile(full);
   res.writeHead(200,{'content-type':safeMime[extname(full)]||'application/octet-stream'});res.end(body);
  }catch{res.writeHead(404);res.end('Not found')}
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 let browser;
 try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage();
  const rootUrl='http://127.0.0.1:'+server.address().port;
  const required=[
   ['/','政策リサーチ'],
   ['/blog/',null],
   ['/blogimport/',null],
   ['/xpost/',null],
   ['/sales_strategy/',null],
   ['/html-viewer/','省庁記事ビューワー'],
   ['/html-admin/','省庁記事データ編集']
  ];
  for(const [path,heading] of required){
   const response=await page.goto(rootUrl+path);
   assert.equal(response.status(),200,'Page should load: '+path);
   if(heading)assert.match(await page.title(),new RegExp(heading),'Title at '+path);
  }
  await page.goto(rootUrl+'/html-viewer/');
  await page.locator('#count').getByText('0件').waitFor();
  assert.equal(await page.locator('.item').count(),0);
  await page.goto(rootUrl+'/html-admin/');
  await page.locator('#firebaseDiagnose').click();
  await page.waitForFunction(()=>document.querySelector('#firebaseDiagnosis')?.textContent.includes('Firebaseは初期設定で無効'));
  assert.equal(await page.locator('#firebaseSave').isDisabled(),true);
  const settings=JSON.parse((await (await page.request.get(rootUrl+'/html-viewer/firebase-config.json')).body()).toString());
  assert.equal(settings.enabled,false);
  assert.equal(settings.firebaseConfig,null);
  await page.close();
 }finally{
  await browser?.close();
  await new Promise(ok=>server.close(ok));
 }
});

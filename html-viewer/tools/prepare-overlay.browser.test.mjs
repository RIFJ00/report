import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../tests/package.json',import.meta.url));
const {chromium}=require('playwright');
import {prepareOverlay} from './prepare-overlay.mjs';

test('追加統合後も既存サイトと省庁記事の2画面が同じ配信元で動く',async()=>{
 const workspace=await mkdtemp(join(tmpdir(),'rifj-overlay-e2e-'));
 const baseline=join(workspace,'baseline');
 const merged=join(workspace,'merged');
 let browser,server;
 try{
  await mkdir(baseline);
  const legacy={
   'index.html':'<!doctype html><html lang="ja"><title>既存トップページ</title><h1>既存トップページ</h1></html>',
   'blog/index.html':'<!doctype html><html lang="ja"><title>既存ブログ</title><h1>既存ブログ</h1></html>',
   'blogimport/index.html':'<!doctype html><html lang="ja"><title>既存コラム管理</title><h1>既存コラム管理</h1></html>',
   'xpost/index.html':'<!doctype html><html lang="ja"><title>既存X管理</title><h1>既存X管理</h1></html>',
   'sales_strategy/index.html':'<!doctype html><html lang="ja"><title>既存営業管理</title><h1>既存営業管理</h1></html>'
  };
  for(const [path,body] of Object.entries(legacy)){
   const parts=path.split('/');
   if(parts.length>1)await mkdir(join(baseline,...parts.slice(0,-1)),{recursive:true});
   await writeFile(join(baseline,path),body);
  }
  const audit=await prepareOverlay(baseline,merged);
  assert.equal(audit.baselineFiles,Object.keys(legacy).length);
  assert.equal(audit.addedFiles,11);
  for(const [path,body] of Object.entries(legacy)){
    assert.equal(await readFile(join(merged,path),'utf8'),body);
  }
  server=createServer(async(req,res)=>{
   try{
    const pathname=new URL(req.url,'http://localhost').pathname;
    const path=pathname.endsWith('/')?pathname+'index.html':pathname;
    const filename=resolve(merged,'.'+path);
    if(!filename.startsWith(merged+sep))throw Error('Access denied');
    const mime={'.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.mjs':'text/javascript; charset=utf-8'};
    const content=await readFile(filename);
    res.writeHead(200,{'content-type':mime[extname(filename)]||'text/plain'});
    res.end(content);
   }catch{res.writeHead(404);res.end('Not found')}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage();
  const origin='http://127.0.0.1:'+server.address().port;
  for(const [path,title] of [['/','既存トップページ'],['/blog/','既存ブログ'],['/blogimport/','既存コラム管理'],['/xpost/','既存X管理'],['/sales_strategy/','既存営業管理']]){
   const resp=await page.goto(origin+path);
   assert.equal(resp.status(),200,'HTTP status for '+path);
   assert.equal(await page.locator('h1').innerText(),title);
  }
  await page.goto(origin+'/html-viewer/');
  assert.match(await page.locator('h1').innerText(),/省庁記事ビューワー/);
  await page.locator('#count').getByText('0件').waitFor();
  await page.goto(origin+'/html-admin/');
  assert.match(await page.locator('h1').innerText(),/省庁記事データ編集/);
  assert.equal(await page.locator('#firebaseSave').isDisabled(),true);
  assert.equal((await page.request.get(origin+'/html-viewer/firebase-config.json')).status(),200);
  await page.close();
 }finally{
  await browser?.close();
  if(server)await new Promise(resolve=>server.close(resolve));
  await rm(workspace,{recursive:true,force:true});
 }
});

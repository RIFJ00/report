import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';

const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const feed=[
 {id:'article-a',title:'文部科学省 教育政策の公表',sourceUrl:'https://www.mext.go.jp/a.html',ministry:'文部科学省',category:'教育',publishedAt:'2026-11-20',publishedAtSource:'source',text:'教育政策の本文を確認',html:'<html><body><h1>教育政策の本文</h1><script>window.parent.testLeak=true</script></body></html>',status:'published'},
 {id:'article-b',title:'環境省 気候変動政策',sourceUrl:'https://www.env.go.jp/b.html',ministry:'環境省',category:'環境',publishedAt:'2026-11-22',publishedAtSource:'source',text:'温暖化対策の内容',status:'published'},
 {id:'draft',title:'未公開の政策案',sourceUrl:'https://www.mext.go.jp/c.html',ministry:'文部科学省',category:'教育',publishedAt:'2026-11-23',status:'draft'},
 {id:'private',title:'非公開の資料',sourceUrl:'https://www.env.go.jp/d.html',ministry:'環境省',category:'環境',publishedAt:'2026-11-23',status:'private'}
];
let server,browser,origin;
before(async()=>{
 server=createServer(async(req,res)=>{
  try{
   const path=new URL(req.url,'http://localhost').pathname;
   if(path==='/html-viewer/articles.json'){
    res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
    res.end(JSON.stringify(feed));return;
   }
   const mapped=path.endsWith('/')?path+'index.html':path;
   const full=resolve(root,'.'+mapped);
   if(!full.startsWith(root+sep))throw Error('outside root');
   const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8'};
   const content=await readFile(full);
   res.writeHead(200,{'content-type':mime[extname(full)]||'application/octet-stream','cache-control':'no-store'});
   res.end(content);
  }catch(e){res.writeHead(404);res.end('Not found')}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true});
});
after(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve))});
async function page(){
 const context=await browser.newContext();
 const tab=await context.newPage();
 return {context,tab};
}
test('公開記事のみ一覧表示され、下書きと非公開記事は表示しない',async()=>{
 const {context,tab}=await page();
 try{
  await tab.goto(origin+'/html-viewer/');
  await assert.equal(await tab.locator('.item').count(),2);
  assert.equal(await tab.locator('#count').innerText(),'2件');
  assert.equal(await tab.getByText('未公開の政策案').count(),0);
  assert.equal(await tab.getByText('非公開の資料').count(),0);
 }finally{await context.close()}
});
test('検索と省庁・分野の絞り込み、公開日並べ替え',async()=>{
 const {context,tab}=await page();
 try{
  await tab.goto(origin+'/html-viewer/');
  await assert.equal(await tab.locator('.item').count(),2);
  assert.match(await tab.locator('.item').first().innerText(),/環境省/);
  await tab.locator('#sort').selectOption('date-asc');
  assert.match(await tab.locator('.item').first().innerText(),/文部科学省/);
  await tab.locator('#ministry').selectOption('環境省');
  assert.equal(await tab.locator('.item').count(),1);
  await tab.locator('#ministry').selectOption('');
  await tab.locator('#category').selectOption('教育');
  assert.equal(await tab.locator('.item').count(),1);
  await tab.locator('#category').selectOption('');
  await tab.locator('#search').fill('温暖化');
  assert.equal(await tab.locator('.item').count(),1);
  assert.match(await tab.locator('.item').first().innerText(),/環境省/);
 }finally{await context.close()}
});
test('個別記事選択とサンドボックスプレビュー',async()=>{
 const {context,tab}=await page();
 try{
  await tab.goto(origin+'/html-viewer/?id=article-a');
  await tab.locator('#preview h2').waitFor();
  assert.match(await tab.locator('#preview h2').innerText(),/教育政策/);
  assert.match(await tab.locator('#preview iframe').getAttribute('sandbox')??'',/^$/);
  assert.equal(await tab.locator('#preview iframe').getAttribute('referrerpolicy'),'no-referrer');
  assert.equal(new URL(tab.url()).searchParams.get('id'),'article-a');
  await tab.locator('.item').filter({hasText:'環境省'}).click();
  assert.equal(new URL(tab.url()).searchParams.get('id'),'article-b');
 }finally{await context.close()}
});
test('Firebase未設定時、管理ページは書き込み不可',async()=>{
 const {context,tab}=await page();
 try{
  await tab.goto(origin+'/html-admin/');
  await tab.locator('#firebaseLogin').click();
  await tab.waitForFunction(()=>document.querySelector('#firebaseStatus').textContent.includes('Firebase連携は無効'));
  assert.equal(await tab.locator('#firebaseSave').isDisabled(),true);
 }finally{await context.close()}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {dateFrom,normalizeArticle,mergeArticles,validateFeed} from './article-utils.mjs';

const example = {title:'文部科学省からのお知らせ',sourceUrl:'https://www.mext.go.jp/example',publishedAt:'2026-11-20',ministry:'文部科学省',status:'published'};
test('元ページ公開日を優先する',()=>{
 const r=normalizeArticle(example,{uploadDate:'2026-11-24'});
 assert.equal(r.publishedAt,'2026-11-20');
 assert.equal(r.publishedAtSource,'source');
});
test('公開日不明なら登録日を使う',()=>{
 const r=normalizeArticle({...example,publishedAt:''},{uploadDate:'2026-11-24'});
 assert.equal(r.publishedAt,'2026-11-24');
 assert.equal(r.publishedAtSource,'upload');
});
test('無効な日付を認めない',()=>{assert.equal(dateFrom('2026-02-30'),'');assert.equal(dateFrom('2026-11-20'),'2026-11-20')});
test('URLの末尾スラッシュが異なっても重複更新',()=>{
 const initial=normalizeArticle({...example,id:'preserved-id',sourceUrl:'https://www.mext.go.jp/example/'},{uploadDate:'2026-11-24'});
 const {articles,stats}=mergeArticles([initial],[{...example,sourceUrl:'https://www.mext.go.jp/example',title:'更新後'}],{uploadDate:'2026-11-24'});
 assert.equal(articles.length,1);assert.equal(articles[0].id,'preserved-id');assert.equal(articles[0].title,'更新後');assert.equal(stats.updated,1);
});
test('既存の元ページ公開日を登録日のフォールバックで上書きしない',()=>{
 const existing=normalizeArticle({...example,id:'1'},{uploadDate:'2026-11-24'});
 const {articles}=mergeArticles([existing],[{...example,publishedAt:''}],{uploadDate:'2026-11-24'});
 assert.equal(articles[0].publishedAt,'2026-11-20');assert.equal(articles[0].publishedAtSource,'source');
});
test('出典URL重複とID重複を検出',()=>{
 const first={...example,id:'same'};
 const second={...example,id:'same'};
 assert.ok(validateFeed([first,second]).length>=2);
});
test('不正なスキームは拒否',()=>{
 assert.throws(()=>normalizeArticle({...example,sourceUrl:'javascript:alert(1)'},{uploadDate:'2026-11-24'}));
});
test('異常行があっても有効行を処理する',()=>{
 const {articles,stats}=mergeArticles([],[{...example},{title:'invalid'}],{uploadDate:'2026-11-24'});
 assert.equal(articles.length,1);assert.equal(stats.errors.length,1);
});

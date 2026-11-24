import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {extractArticleFromHTML} from '../html-import.mjs';

globalThis.DOMParser = new JSDOM('').window.DOMParser;
const sourceUrl='https://www.mext.go.jp/a_menu/example/index.html';
const uploadDate='2026-11-24';

test('元記事の公開日時を更新日時より優先する',()=>{
 const html=`<!doctype html><html><head>
  <meta property="og:title" content="教育政策の公表">
  <meta property="article:published_time" content="2026-11-20T09:30:00+09:00">
  <meta property="article:modified_time" content="2026-11-24T12:00:00+09:00">
  <meta property="og:image" content="/assets/key.jpg">
 </head><body><article><h1>教育政策の公表</h1><p>本文はこちら</p></article></body></html>`;
 const a=extractArticleFromHTML(html,{sourceUrl,uploadDate,ministry:'文部科学省'});
 assert.equal(a.publishedAt,'2026-11-20');
 assert.equal(a.publishedAtSource,'source');
 assert.equal(a.imageUrl,'https://www.mext.go.jp/assets/key.jpg');
 assert.match(a.text,/本文はこちら/);
});
test('JSON-LDの日付（和暦）を読み取れる',()=>{
 const html=`<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"NewsArticle","datePublished":"令和8年11月21日"}</script></head><body><main><h1>発表</h1></main></body></html>`;
 const a=extractArticleFromHTML(html,{sourceUrl,uploadDate});
 assert.equal(a.publishedAt,'2026-11-21');
});
test('公表日不明時は登録日を採用し、更新日を流用しない',()=>{
 const html=`<html><head><meta property="article:modified_time" content="2026-10-09"></head><body><article><h1>公表日なし</h1></article></body></html>`;
 const a=extractArticleFromHTML(html,{sourceUrl,uploadDate});
 assert.equal(a.publishedAt,uploadDate);
 assert.equal(a.publishedAtSource,'upload');
});
test('危険なHTML構造と属性をプレビュー用本文から取り除く',()=>{
 const html=`<html><head><title>安全性検証</title></head><body><article><h1>安全性検証</h1>
  <script>alert(1)</script><iframe src="https://evil.example/frame"></iframe>
  <form><input value="test"></form><link rel="stylesheet" href="https://evil.example/a.css">
  <p id="test" style="background:url(https://evil.example/a)" onclick="alert(2)">安全な本文
   <a href="javascript:alert(3)" onmouseover="alert(4)">不正URL</a>
   <a href="/a_menu/test.html">元記事へのリンク</a>
   <img src="https://www.mext.go.jp/image.jpg" srcset="https://evil.example/x.jpg 2x" onerror="alert(5)">
  </p></article></body></html>`;
 const a=extractArticleFromHTML(html,{sourceUrl,uploadDate});
 assert.doesNotMatch(a.html,/<script|<iframe|<form|<link/i);
 assert.doesNotMatch(a.html,/onclick=|onmouseover=|onerror=|srcset=|javascript:|background:url/i);
 assert.match(a.html,/href="https:\/\/www\.mext\.go\.jp\/a_menu\/test\.html"/);
 assert.match(a.html,/安全な本文/);
});
test('出典URLが不正なら登録を拒否する',()=>{
 assert.throws(()=>extractArticleFromHTML('<article><h1>test</h1></article>',{sourceUrl:'javascript:alert(1)',uploadDate}));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSaveReview,planSaveChanges} from './save-review.mjs';
const a={id:'a',sourceUrl:'https://www.mext.go.jp/example',title:'会議資料',publishedAt:'2026-11-20',publishedAtSource:'source',status:'draft'};
test('separates new and updated article counts and publication transitions',()=>{
 const old=[a,{...a,id:'b',sourceUrl:'https://www.env.go.jp/old',status:'published'}];
 const current=[{...a,status:'published'},{...old[1],status:'private'}, {...a,id:'c',sourceUrl:'https://www.meti.go.jp/new',status:'published'}];
 const r=buildSaveReview(current,old);
 assert.equal(r.ok,true);assert.equal(r.added,1);assert.equal(r.updated,2);
 assert.equal(r.published,2);assert.equal(r.unpublished,1);
});
test('returns no-change when article data has not changed',()=>{
 const r=buildSaveReview([a],[a]);assert.equal(r.unchanged,1);assert.equal(r.added,0);assert.equal(r.updated,0);
});
test('rejects invalid or duplicate article data before saving',()=>{
 const r=buildSaveReview([{...a,id:''}],[]);
 assert.equal(r.ok,false);
 assert.ok(r.issues.some(s=>s.includes('ID')));
});

test('only changed or newly added articles are sent for saving',()=>{
 const remote=[a,{...a,id:'b',sourceUrl:'https://www.env.go.jp/keep',status:'published'}];
 const local=[{...a,status:'published'},remote[1],{...a,id:'c',sourceUrl:'https://www.meti.go.jp/new'}];
 const review=planSaveChanges(local,remote);
 assert.equal(review.ok,true);
 assert.equal(review.changes.length,2);
 assert.deepEqual(review.changes.map(x=>x.id),['a','c']);
 assert.equal(review.unchanged,1);
});

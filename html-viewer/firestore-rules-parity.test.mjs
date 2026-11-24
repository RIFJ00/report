import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const example=readFileSync(new URL('./firestore.rules.example',import.meta.url),'utf8');
const tested=readFileSync(new URL('./tests/firestore.rules',import.meta.url),'utf8');
function ruleBlock(text){
 const marker='match /ministryArticles/{articleId} {';
 const start=text.indexOf(marker);
 assert.ok(start>=0,'ministryArticles rule not found');
 let depth=0,inside=false;
 // Start after the document wildcard {articleId}, at the match block opening brace.
 for(let i=start+marker.length-1;i<text.length;i++){
  if(text[i]==='{'){depth++;inside=true}
  if(text[i]==='}'&&inside){depth--;if(depth===0)return text.slice(start,i+1)}
 }
 throw Error('Unclosed match block');
}
function canonical(s){return s.replace(/\/\/[^\n]*/g,'').replace(/\s+/g,' ').trim()}
test('本番導入用Firestoreルール案とEmulator検証ルールは同一',()=>{
 assert.equal(canonical(ruleBlock(example)),canonical(ruleBlock(tested)));
});
test('公開記事だけを一般読者に許可し、書き込みは管理者に限定',()=>{
 const block=canonical(ruleBlock(example));
 assert.match(block,/resource\.data\.status == 'published'/);
 assert.match(block,/request\.auth\.token\.rifjAdmin == true/);
 assert.match(block,/allow create, update: if isEditor\(\) && validArticle\(\)/);
});

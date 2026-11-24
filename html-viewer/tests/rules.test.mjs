import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,collection,query,where,getDoc,getDocs,setDoc,deleteDoc} from 'firebase/firestore';

let env;
const base={title:'政策会議について',sourceUrl:'https://www.mext.go.jp/example',publishedAt:'2026-11-24'};
before(async()=>{
 env=await initializeTestEnvironment({
   projectId:'demo-rifj-html',
   firestore:{rules:readFileSync(new URL('./firestore.rules',import.meta.url),'utf8'),host:'127.0.0.1',port:8080}
 });
 await env.withSecurityRulesDisabled(async context=>{
  const db=context.firestore();
  await setDoc(doc(db,'ministryArticles','public-1'),{...base,status:'published'});
  await setDoc(doc(db,'ministryArticles','draft-1'),{...base,status:'draft'});
  await setDoc(doc(db,'ministryArticles','private-1'),{...base,status:'private'});
 });
});
after(async()=>{if(env)await env.cleanup()});

test('anonymous readers can get only published documents',async()=>{
 const db=env.unauthenticatedContext().firestore();
 await assertSucceeds(getDoc(doc(db,'ministryArticles','public-1')));
 await assertFails(getDoc(doc(db,'ministryArticles','draft-1')));
 await assertFails(getDoc(doc(db,'ministryArticles','private-1')));
});
test('anonymous filtered list works, unfiltered list is rejected',async()=>{
 const db=env.unauthenticatedContext().firestore();
 const snapshot=await assertSucceeds(getDocs(query(collection(db,'ministryArticles'),where('status','==','published'))));
 assert.equal(snapshot.size,1);
 await assertFails(getDocs(collection(db,'ministryArticles')));
});
test('non-admin users may not create or update articles',async()=>{
 const db=env.authenticatedContext('staff-user').firestore();
 await assertFails(setDoc(doc(db,'ministryArticles','new-1'),{...base,status:'published'}));
 await assertFails(setDoc(doc(db,'ministryArticles','public-1'),{...base,status:'draft'}));
 await assertFails(deleteDoc(doc(db,'ministryArticles','public-1')));
});
test('admin claim can read draft, write valid articles and delete',async()=>{
 const db=env.authenticatedContext('admin-user',{rifjAdmin:true}).firestore();
 await assertSucceeds(getDoc(doc(db,'ministryArticles','draft-1')));
 await assertSucceeds(setDoc(doc(db,'ministryArticles','new-2'),{...base,status:'draft'}));
 await assertSucceeds(setDoc(doc(db,'ministryArticles','new-2'),{...base,status:'published'}));
 await assertSucceeds(deleteDoc(doc(db,'ministryArticles','new-2')));
});
test('admin cannot write invalid article status',async()=>{
 const db=env.authenticatedContext('admin-user',{rifjAdmin:true}).firestore();
 await assertFails(setDoc(doc(db,'ministryArticles','invalid-1'),{...base,status:'unknown'}));
});
test('other existing collections are not implicitly made public by isolated test rule',async()=>{
 const db=env.unauthenticatedContext().firestore();
 await assertFails(getDoc(doc(db,'posts','sensitive')));
});

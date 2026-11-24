import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFirebaseOptions,EXPECTED_PROJECT_ID} from './firebase-options.mjs';
const options={
 enabled:true,collection:'ministryArticles',
 firebaseConfig:{
  apiKey:'AIza'+ 'x'.repeat(35),
  authDomain:'html-viewer-703b6.firebaseapp.com',
  projectId:'html-viewer-703b6',
  storageBucket:'html-viewer-703b6.firebasestorage.app',
  messagingSenderId:'676217106371',
  appId:'1:676217106371:web:c0da9377b0859f2dbe9776'
 }
};
test('disabled config never connects, even if Firebase config absent',()=>{
 assert.deepEqual(validateFirebaseOptions({enabled:false,collection:'ministryArticles',firebaseConfig:null}),{enabled:false});
});
test('verified staging identity is accepted without network connection',()=>{
 const result=validateFirebaseOptions(options);
 assert.equal(result.enabled,true);
 assert.equal(result.firebaseConfig.projectId,EXPECTED_PROJECT_ID);
});
test('rejects other Firebase projects, including Mirai and Blog Viewer',()=>{
 for(const id of ['mirai-850a5','blog-viewer-f83bc']){
  assert.throws(()=>validateFirebaseOptions({...options,firebaseConfig:{...options.firebaseConfig,projectId:id}}),/想定外/);
 }
});
test('rejects mismatched authDomain and storageBucket',()=>{
 assert.throws(()=>validateFirebaseOptions({...options,firebaseConfig:{...options.firebaseConfig,authDomain:'mirai-850a5.firebaseapp.com'}}),/認証ドメイン/);
 assert.throws(()=>validateFirebaseOptions({...options,firebaseConfig:{...options.firebaseConfig,storageBucket:'blog-viewer-f83bc.firebasestorage.app'}}),/Storage/);
});
test('rejects wrong app identity and wrong collection',()=>{
 assert.throws(()=>validateFirebaseOptions({...options,collection:'posts'}),/専用コレクション/);
 assert.throws(()=>validateFirebaseOptions({...options,firebaseConfig:{...options.firebaseConfig,appId:'1:wrong:web:wrong'}}),/アプリID/);
});
test('rejects placeholder or missing API key on opt-in',()=>{
 assert.throws(()=>validateFirebaseOptions({...options,firebaseConfig:{...options.firebaseConfig,apiKey:'PASTE_EXACT_API_KEY_FROM_FIREBASE_CONSOLE'}}),/APIキー/);
});
test('requires boolean enabled flag',()=>{
 assert.throws(()=>validateFirebaseOptions({...options,enabled:'true'}),/enabled/);
});

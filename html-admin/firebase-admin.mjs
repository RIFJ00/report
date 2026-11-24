/* Optional admin-only Firestore connector. Never grants roles from client code.
 * Firebase Auth custom claim rifjAdmin must be provisioned by trusted server-side admin.
 */
import {canonicalUrl,validateFeed} from '../html-viewer/article-utils.mjs';
import {loadFirebaseOptions} from '../html-viewer/firebase-data.mjs';
const APP='https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
const AUTH='https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
const DB='https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
let session;
export async function signInMinistryAdmin(){
 const options=await loadFirebaseOptions('../html-viewer/firebase-config.json');
 if(!options.enabled)throw Error('Firebase連携は無効です。設定確認後に有効化してください');
 const [{initializeApp,getApps},{getAuth,GoogleAuthProvider,signInWithPopup,getIdTokenResult,signOut},{getFirestore}]=
 await Promise.all([import(APP),import(AUTH),import(DB)]);
 const app=getApps().find(a=>a.name==='ministry-admin')||initializeApp(options.firebaseConfig,'ministry-admin');
 const auth=getAuth(app);
 const credential=await signInWithPopup(auth,new GoogleAuthProvider());
 const claims=await getIdTokenResult(credential.user,true);
 if(claims.claims.rifjAdmin!==true){
  await signOut(auth);
  throw Error('管理者権限（rifjAdmin）がありません。権限はサーバー側で付与してください');
 }
 session={auth,user:credential.user,db:getFirestore(app),options};
 return {email:credential.user.email};
}
export async function signOutMinistryAdmin(){
 if(session){const {signOut}=await import(AUTH);await signOut(session.auth);session=undefined}
}
async function requireAdmin(){
 if(!session)throw Error('管理者ログインが必要です');
 const {getIdTokenResult}=await import(AUTH);
 const info=await getIdTokenResult(session.user,true);
 if(info.claims.rifjAdmin!==true)throw Error('管理者権限が確認できません');
 return session;
}
export async function readMinistryAdminArticles(){
 const {db,options}=await requireAdmin();
 const {getDocs,collection}=await import(DB);
 const snapshot=await getDocs(collection(db,options.collection));
 return snapshot.docs.map(d=>({id:d.id,...d.data()}));
}
export async function saveMinistryAdminArticles(articles){
 const {db,options}=await requireAdmin();
 if(!Array.isArray(articles)||articles.length<1)throw Error('保存する記事がありません');
 const issues=validateFeed(articles);
 if(issues.length)throw Error(issues.join(' / '));
 const {getDocs,collection,doc,writeBatch}=await import(DB);
 const existing=await getDocs(collection(db,options.collection));
 const urls=new Map(existing.docs.map(d=>[canonicalUrl(d.data().sourceUrl),d.id]));
 let batch=writeBatch(db),pending=0,updated=0,added=0;
 for(const article of articles){
  const url=canonicalUrl(article.sourceUrl);
  let id=urls.get(url);
  if(!id){
   const bytes=new TextEncoder().encode(url);const hash=await crypto.subtle.digest('SHA-256',bytes);
   id='src-'+Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');
   urls.set(url,id);added++;
  } else updated++;
  const {id:_ignored,extraction:_ignoreExtraction,...data}=article;
  // Firestore document limit is 1 MiB, leave room for indexes/metadata.
  if(new TextEncoder().encode(JSON.stringify(data)).length>650000)throw Error('大きすぎる記事: '+data.title+'。本文を分割保存してください');
  batch.set(doc(db,options.collection,id),{...data,sourceUrl:url},{merge:true});
  pending++;
  if(pending===350){await batch.commit();batch=writeBatch(db);pending=0}
 }
 if(pending)await batch.commit();
 return {added,updated,total:articles.length};
}

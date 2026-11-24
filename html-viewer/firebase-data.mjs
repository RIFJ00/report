/* Firebase integration is opt-in: disabled config never connects. */
const FIREBASE_APP='https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
const FIREBASE_DB='https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
export async function loadFirebaseOptions(url='./firebase-config.json'){
 const res=await fetch(url,{cache:'no-store'});
 if(!res.ok)throw Error('Firebase設定ファイルの取得に失敗: '+res.status);
 const options=await res.json();
 if(!options || options.enabled!==true)return {enabled:false};
 const config=options.firebaseConfig;
 if(!config || !config.projectId || !config.appId || !config.apiKey)throw Error('Firebase設定に必要な項目がありません');
 if(options.collection!=='ministryArticles')throw Error('省庁記事専用コレクション以外は使用できません');
 return {enabled:true,collection:options.collection,firebaseConfig:config};
}
export async function fetchPublishedArticles(options){
 if(!options?.enabled)throw Error('Firebase連携が無効です');
 const [{initializeApp,getApps,getApp},{getFirestore,collection,query,where,getDocs}]=
 await Promise.all([import(FIREBASE_APP),import(FIREBASE_DB)]);
 const app=getApps().find(a=>a.name==='ministry-viewer')||initializeApp(options.firebaseConfig,'ministry-viewer');
 const db=getFirestore(app);
 // A query filter is essential: rules must not treat a collection read as an all-access scan.
 const snapshot=await getDocs(query(collection(db,options.collection),where('status','==','published')));
 return snapshot.docs.map(d=>({id:d.id,...d.data()}));
}

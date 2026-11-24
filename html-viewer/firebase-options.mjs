/* Restrict the HTML viewer to its designated Firebase project.
 * Client-side checks are defense-in-depth, not authorization.
 * Firestore/Storage security rules and server-managed admin claims remain essential.
 */
export const EXPECTED_PROJECT_ID='html-viewer-703b6';
export const EXPECTED_COLLECTION='ministryArticles';
export function validateFirebaseOptions(options,{allowDisabled=true}={}){
 if(!options||typeof options!=='object'||Array.isArray(options))
  throw Error('Firebase設定はJSONオブジェクトである必要があります');
 if(options.enabled!==true){
  if(!allowDisabled||options.enabled!==false)throw Error('Firebase enabled の値は true または false です');
  return {enabled:false};
 }
 if(options.collection!==EXPECTED_COLLECTION)throw Error('省庁記事専用コレクション以外は使用できません');
 const config=options.firebaseConfig;
 if(!config||typeof config!=='object'||Array.isArray(config))throw Error('Firebase設定に必要な項目がありません');
 if(config.projectId!==EXPECTED_PROJECT_ID)throw Error('Firebase接続先が想定外です: '+String(config.projectId??'未指定'));
 if(config.authDomain!==EXPECTED_PROJECT_ID+'.firebaseapp.com')throw Error('認証ドメインがHTML Viewerのものではありません');
 if(config.storageBucket!==EXPECTED_PROJECT_ID+'.firebasestorage.app')throw Error('Storageの接続先がHTML Viewerではありません');
 if(config.messagingSenderId!=='676217106371')throw Error('Firebase送信者IDが一致しません');
 if(config.appId!=='1:676217106371:web:c0da9377b0859f2dbe9776')throw Error('FirebaseウェブアプリIDが一致しません');
 if(typeof config.apiKey!=='string'||!/^AIza[0-9A-Za-z_-]{20,}$/.test(config.apiKey))throw Error('FirebaseのAPIキーが未設定または不正です');
 return {enabled:true,collection:options.collection,firebaseConfig:{...config}};
}

/* Read-only diagnostics: does not sign in, change Firebase config, or write data. */
import {loadFirebaseOptions} from '../html-viewer/firebase-data.mjs';
const APP='https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
const DB='https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

export function explainConnectionError(error){
 const code=String(error?.code||'');
 if(code==='permission-denied')return 'Firestoreの公開記事の読み取りが拒否されました。適用中のセキュリティルールを確認してください。';
 if(code==='failed-precondition')return 'Firestoreのインデックスまたはデータベースの設定を確認してください。';
 if(code==='unavailable'||code==='deadline-exceeded')return 'Firebaseへ接続できません。ネットワークまたはサービス状態を確認してください。';
 if(code.startsWith('auth/')||code==='invalid-argument')return 'Firebaseの認証設定またはSDK設定を確認してください。';
 return '接続診断に失敗しました。詳細はブラウザの開発者ツールで確認してください。';
}
export async function diagnosePublicFirebase({
 loadOptions=()=>loadFirebaseOptions('../html-viewer/firebase-config.json'),
 initializeAndQuery=async options=>{
  const [{initializeApp,getApps},{getFirestore,collection,query,where,limit,getDocs}]=
   await Promise.all([import(APP),import(DB)]);
  const app=getApps().find(a=>a.name==='ministry-diagnostic')||
   initializeApp(options.firebaseConfig,'ministry-diagnostic');
  const snapshot=await getDocs(query(collection(getFirestore(app),options.collection),
    where('status','==','published'),limit(1)));
  return {sampleCount:snapshot.size};
 }
}={}){
 let options;
 try{options=await loadOptions()}catch(error){
  return {stage:'configuration',ok:false,message:'Firebaseの設定を読み込めません。'+String(error.message||''),projectId:null};
 }
 if(!options.enabled){
  return {stage:'disabled',ok:false,message:'Firebaseは初期設定で無効です。実環境への接続は行っていません。',projectId:null};
 }
 try{
  const result=await initializeAndQuery(options);
  return {stage:'read',ok:true,message:'公開記事の読み取りに成功しました。データ変更は行っていません。',
   projectId:options.firebaseConfig.projectId,sampleCount:result.sampleCount};
 }catch(error){
  return {stage:'read',ok:false,message:explainConnectionError(error),
   projectId:options.firebaseConfig.projectId,code:String(error?.code||'unknown')};
 }
}

import {initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {getAuth,signInWithEmailAndPassword,signOut,onAuthStateChanged,setPersistence,browserSessionPersistence} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {getFirestore,collection,getDocs,doc,setDoc,deleteDoc,onSnapshot,writeBatch} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
const firebaseConfig = {
  apiKey: "AIzaSyCqKP__GE4aOBn58DIeh8Si_i2MtWAWhoU",
  authDomain: "sales-3d63b.firebaseapp.com",
  projectId: "sales-3d63b",
  storageBucket: "sales-3d63b.firebasestorage.app",
  messagingSenderId: "52523493312",
  appId: "1:52523493312:web:1cff0726b58bf8b7b60a25",
  measurementId: "G-MYYS0S2KSC"
};
const app=initializeApp(firebaseConfig);
const auth=getAuth(app),db=getFirestore(app);
const gate=document.getElementById("rifj-auth-gate"), form=document.getElementById("rifj-login-form");
const errorEl=document.getElementById("rifj-auth-error"),status=document.getElementById("firebaseStatus");
const signout=document.getElementById("rifj-signout");
let stopProgress=null,started=false;
function err(message){errorEl.textContent=message;}
function setStatus(message){status.textContent=message;}
function docId(name){return encodeURIComponent(name);}
async function script(src){await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=src;s.onload=resolve;s.onerror=reject;document.body.appendChild(s);});}
function unlock(){document.body.classList.remove("auth-locked");gate.hidden=true;signout.hidden=false;}
function lock(){document.body.classList.add("auth-locked");gate.hidden=false;signout.hidden=true;}
async function start(user){
  if(started)return;started=true;
  try{
    err("");setStatus("企業マスタを読み込んでいます…");
    const token=await user.getIdTokenResult();
    if(token.claims.salesAccess!==true) throw new Error("営業管理への利用権限がありません。管理者にアクセス許可を依頼してください。");
    const snapshot=await getDocs(collection(db,"companies"));
    const companies=snapshot.docs.map(x=>x.data()).sort((a,b)=>(a.company||"").localeCompare(b.company||"","ja"));
    if(!companies.length) throw new Error("企業マスタが未登録です。管理者用インポートを先に実行してください。");
    window.COMPANY_DATA=companies;
    await script("app.js?v=1.59.0-20261109");
    window.salesCloud={
      save:async(company,data)=>setDoc(doc(db,"sales_progress",docId(company)),{...data,company,updated_by:user.uid}),
      remove:async(company)=>deleteDoc(doc(db,"sales_progress",docId(company)))
    };
    stopProgress=onSnapshot(collection(db,"sales_progress"), snap=>{
      const result={};
      snap.forEach(d=>{const v=d.data();if(v.company)result[v.company]=v;});
      window.applyCloudProgressStore?.(result);
      setStatus(`Firebase接続中：${companies.length}社｜営業進捗 ${snap.size}件｜${user.email}`);
    },e=>setStatus("進捗の受信に失敗: "+e.message));
    unlock();document.getElementById("firebaseMigrateLocal").disabled=false;
  }catch(e){started=false;err("起動できません: "+e.message);setStatus("接続に失敗しました");lock();}
}
form.addEventListener("submit",async e=>{
  e.preventDefault();err("");
  const email=document.getElementById("rifj-email").value.trim();
  const password=document.getElementById("rifj-password").value;
  try{await setPersistence(auth,browserSessionPersistence);await signInWithEmailAndPassword(auth,email,password);document.getElementById("rifj-password").value="";}
  catch(e){err("ログインできません。メールアドレス・パスワードとFirebase Authenticationの設定をご確認ください。");}
});
signout.addEventListener("click",async()=>{await signOut(auth);location.reload();});
onAuthStateChanged(auth,user=>{if(user){start(user);}else{stopProgress?.();stopProgress=null;lock();started=false;window.salesCloud=null;}});
document.getElementById("firebaseMigrateLocal").addEventListener("click",async()=>{
  if(!auth.currentUser||!window.salesCloud)return;
  let local={};try{local=JSON.parse(localStorage.getItem("rifj_policy_sales_progress_v1")||"{}");}catch(e){alert("旧版のデータを読み込めません。");return;}
  const rows=Object.entries(local).filter(([name,v])=>name&&v&&typeof v==="object");
  if(!rows.length){alert("この端末に旧版の営業履歴はありません。");return;}
  if(!confirm(`${rows.length}件の旧版営業履歴をFirebaseへ移行します。既存データがある企業は更新日時が新しいものだけを採用します。続行しますか？`))return;
  try{
    const snapshot=await getDocs(collection(db,"sales_progress"));
    const remote=new Map(snapshot.docs.map(d=>[d.id,d.data()]));
    let count=0;
    for(let i=0;i<rows.length;i+=200){
      const batch=writeBatch(db);let n=0;
      for(const [name,record] of rows.slice(i,i+200)){
        const id=docId(name),old=remote.get(id);
        if(old && (Date.parse(old.updated_at)||0)>=(Date.parse(record.updated_at)||0))continue;
        batch.set(doc(db,"sales_progress",id),{...record,company:name,updated_by:auth.currentUser.uid});n++;count++;
      }
      if(n)await batch.commit();
    }
    alert(`${count}件をFirebaseへ移行しました。元の端末内データは保管されています。`);
  }catch(e){alert("移行エラー: "+e.message);}
});

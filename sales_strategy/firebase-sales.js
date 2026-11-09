import {initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {getAuth,signInWithEmailAndPassword,signOut,onAuthStateChanged,setPersistence,browserSessionPersistence} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {getFirestore,collection,getDocs,doc,setDoc,deleteDoc,onSnapshot,runTransaction} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
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
let stopProgress=null,stopMaster=null,started=false;
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
    // Keep the original 1-company / bulk / sales-talk UI, backed by Firestore.
    // Install the cloud adapter BEFORE starting app.js so its initial handlers
    // cannot mistake the page for a local-only/offline version.
    const valid=companies.filter(c=>typeof c.company==="string" && c.company.trim());
    if(valid.length!==companies.length)throw new Error("企業マスタに企業名のないレコードがあります。");
    window.COMPANY_DATA=valid;
    window.salesCloud={
      save:async(company,data)=>setDoc(doc(db,"sales_progress",docId(company)),{...data,company,updated_by:user.uid}),
      remove:async(company)=>deleteDoc(doc(db,"sales_progress",docId(company)))
    };
    await script("app.js?v=1.65.0-20261109");
    if(typeof window.applyCloudProgressStore!=="function")throw new Error("営業管理画面の起動に失敗しました。app.js の公開状態を確認してください。");
    // Admin controls are visible only with a fresh custom claim. Firestore rules enforce permissions.
    if(token.claims.companyAdmin===true){
      await script("company-admin.js?v=1.65.0-20261109");
      if(typeof window.setupCompanyAdmin!=="function")throw new Error("企業管理画面を読み込めませんでした。");
      window.setupCompanyAdmin({db,user,claims:token.claims,collection,getDocs,doc,runTransaction});
    }
    stopMaster=onSnapshot(collection(db,"companies"),snap=>{
      const latest=snap.docs.map(x=>x.data()).filter(x=>x&&typeof x.company==="string");
      latest.sort((a,b)=>a.company.localeCompare(b.company,"ja"));
      window.applyCloudCompanyStore?.(latest);
      setStatus("共有中：企業マスタ "+latest.length+"社｜"+user.email);
    },e=>setStatus("企業マスタの同期に失敗："+e.message));
    stopProgress=onSnapshot(collection(db,"sales_progress"), snap=>{
      const result={};
      snap.forEach(d=>{const v=d.data();if(v.company)result[v.company]=v;});
      window.applyCloudProgressStore?.(result);
      setStatus(`Firebase接続中：${companies.length}社｜営業進捗 ${snap.size}件｜${user.email}`);
    },e=>setStatus("進捗の受信に失敗: "+e.message));
    unlock();
  }catch(e){started=false;err("起動できません: "+e.message);setStatus("接続に失敗しました");window.salesCloud=null;lock();}
}
form.addEventListener("submit",async e=>{
  e.preventDefault();err("");
  const email=document.getElementById("rifj-email").value.trim();
  const password=document.getElementById("rifj-password").value;
  try{await setPersistence(auth,browserSessionPersistence);await signInWithEmailAndPassword(auth,email,password);document.getElementById("rifj-password").value="";}
  catch(e){err("ログインできません。メールアドレス・パスワードとFirebase Authenticationの設定をご確認ください。");}
});
signout.addEventListener("click",async()=>{await signOut(auth);location.reload();});
onAuthStateChanged(auth,user=>{if(user){start(user);}else{stopProgress?.();stopMaster?.();stopProgress=null;stopMaster=null;lock();started=false;window.salesCloud=null;}});

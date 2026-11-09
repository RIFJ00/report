// Company master administration for an authenticated custom-claim companyAdmin user.
// This script contains no company data, secrets, or privileged credentials.
(function(){
"use strict";
const $=id=>document.getElementById(id);
const FIELDS=[
 ["企業名","company"],["営業優先スコア","priority_score"],["営業優先ランク","priority_rank"],
 ["公開連絡先","contact"],["会社の電話番号","contact"],["営業区分","sales_group"],
 ["主業種・戦略分野","industry"],["業種・戦略分野","industry"],
 ["検索用分野タグ","search_tags"],["副テーマ","secondary"],
 ["会員名簿判定","membership_state"],["優先表示プラン（有料優先）","membership_priority_plan"],
 ["現在ステータス上のプラン","membership_current_plan"],["利用開始日（登録日）","membership_start_date"],
 ["会員名簿プラン履歴（有料優先）","membership_plan_history"],
 ["有効件数","membership_valid_rows"],["無効件数","membership_invalid_rows"],
 ["判定根拠","membership_basis"],["照合ルール","membership_match_rule"],
 ["ランク理由","priority_reason"],["営業可否","sales_allowed"],
 ["上場・企業区分","listing_status"],["証券コード","ticker"],["名簿区分","master_segment"],
 ["第1営業先部署","dept1"],["第2営業先部署","dept2"],["公開キーパーソン","person"],
 ["公開役職・接点","role"],["連絡先種別","contact_type"],["連絡先確認","contact_level"],
 ["企業公式URL","official_url"],["連絡先・根拠URL","contact_url"],
 ["推奨初回接触ルート","route"],["確認済み担当部署／推奨営業先","contact_department_verified"],
 ["連絡先調査日","contact_checked_date"],["公式再確認日","contact_recheck_date"],
 ["公式再確認状況","contact_recheck_status"],["公式再確認対象","contact_recheck_scope"],
 ["公式再確認情報源","contact_recheck_source"],
 ["最初に刺すテーマ","sales_theme"],["企業説明","company_description"],
 ["直近政策トリガー","policy_trigger"],["15分デモ内容","demo"],
 ["15分デモで見せる内容","demo"],
 ["過去プラン・履歴","plan_history"],["販売チャネル","sales_channel"],
 ["正式法人名確認","official_name_check"],["旧表示名","legacy_company_name"],
 ["旧縁あり","legacy_connection"],["旧縁判定元","legacy_connection_source"]
];
const MAP=Object.fromEntries(FIELDS);
const VALID_FIELDS=new Set(FIELDS.map(x=>x[1]));
const norm=s=>String(s||"").normalize("NFKC").toLowerCase()
 .replace(/（[^）]*）|\([^)]*\)/g,"")
 .replace(/^(株式会社|有限会社|合同会社|一般社団法人|一般財団法人|公益社団法人|公益財団法人)/g,"")
 .replace(/(株式会社|有限会社|合同会社)$/g,"")
 .replace(/[\s\u3000・.,，。、－‐―ー_\-()（）]/g,"");
const docID=name=>encodeURIComponent(name);
function aliases(c){
 return [c.company,c.legacy_company_name].filter(Boolean).map(norm).filter(Boolean);
}
function tags(v){
 if(Array.isArray(v))return v.map(x=>String(x).trim()).filter(Boolean);
 if(!v)return [];
 return String(v).split(/[、,，;；|｜\r\n]+/u).map(x=>x.trim()).filter(Boolean);
}
function bool(v){return v===true || v===1 || /^(true|1|yes|はい|有|あり|○|〇)$/iu.test(String(v||"").trim());}
function fieldValue(v,k){
 if(k==="search_tags")return tags(v);
 if(k==="sales_group")return ({"現在利用中":"現在利用","利用後退会":"過去有料利用"}[String(v).trim()]||v);
 if(k==="legacy_connection")return bool(v);
 if(["priority_score","membership_valid_rows","membership_invalid_rows"].includes(k) && v!==""){
   const n=Number(v);return Number.isFinite(n)?n:v;
 }
 return typeof v==="string"?v.trim():v;
}
function toRecord(row){
 if(!row || typeof row!=="object" || Array.isArray(row))return null;
 const obj={};
 for(const [k,v] of Object.entries(row)){
   const key=MAP[k]||k;
   // Disallow importing shared progress records as company master fields.
   if(["progress","auto_progress","initial_contact_date","updated_by","updated_at"].includes(key))continue;
   if(!VALID_FIELDS.has(key) && !/^[a-z][a-z0-9_]*$/i.test(key))continue;
   if(key==="company" && obj.company)continue;
   if(v!==undefined && v!==null)obj[key]=fieldValue(v,key);
 }
 obj.company=String(obj.company||"").trim();
 if(!obj.company || obj.company.length>300 || !norm(obj.company))return null;
 if(!obj.sales_group)obj.sales_group="完全新規";
 if(!obj.priority_rank)obj.priority_rank="B";
 if(!obj.search_tags)obj.search_tags=[];
 if(!Array.isArray(obj.search_tags))obj.search_tags=tags(obj.search_tags);
 return obj;
}
function parseCsv(txt){
 const rows=[];let row=[],cell="",quoted=false;
 const text=String(txt||"").replace(/^\uFEFF/,"");
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(quoted){
   if(ch==='"' && text[i+1]==='"'){cell+='"';i++;}
   else if(ch==='"')quoted=false;
   else cell+=ch;
  }else if(ch==='"'){quoted=true;}
  else if(ch===','){row.push(cell);cell="";}
  else if(ch==='\n'||ch==='\r'){
   if(ch==='\r'&&text[i+1]==='\n')i++;
   row.push(cell);cell="";
   if(row.some(v=>String(v).trim()))rows.push(row);
   row=[];
  }else cell+=ch;
 }
 if(quoted)throw Error("CSVの引用符が閉じていません。");
 if(cell||row.length){row.push(cell);rows.push(row);}
 if(rows.length<2)throw Error("CSVに見出し行とデータ行がありません。");
 return rows.slice(1).map(row=>Object.fromEntries(rows[0].map((key,i)=>[String(key||"").trim(),row[i]??""])));
}
function message(s){$("adminCompanyStatus").textContent=s;}
function importMessage(s){$("adminImportResult").textContent=s;}
window.setupCompanyAdmin=function(config){
 const {db,user,claims,collection,getDocs,doc,runTransaction}=config;
 const panel=$("companyAdminPanel");
 if(!panel)return;
 panel.hidden=false;
 const allowed=claims.companyAdmin===true;
 $("companyAdminControls").disabled=!allowed;
 $("companyAdminAccessNotice").textContent=allowed
  ? "管理者としてログイン中です。企業の登録・修正・削除およびファイル取込が利用できます。"
  : "管理者権限が未設定です。下の入力欄は操作できません。Firebaseの companyAdmin=true と管理者用Firestoreルールを設定し、再ログインしてください。";
 $("companyAdminAccessNotice").hidden=false;
 let currentName="",pending=[],busy=false;
 const companies=()=>Array.isArray(window.COMPANY_DATA)?window.COMPANY_DATA:[];
 const duplicateIndex=(rows,ignore="")=>{
   const keys=new Set();
   for(const c of rows)if(c.company!==ignore)for(const alias of aliases(c))keys.add(alias);
   return keys;
 };
 const inputs={
   company:"adminCompanyName",industry:"adminIndustry",sales_theme:"adminSalesTheme",
   demo:"adminDemo",company_description:"adminDescription",contact:"adminContact",
   dept1:"adminDepartment",search_tags:"adminTags",sales_group:"adminSalesGroup",
   legacy_connection:"adminLegacy"
 };
 function collect(){
   const out={};
   for(const [key,id] of Object.entries(inputs)){
     const el=$(id);
     out[key]=key==="legacy_connection"?el.checked:key==="search_tags"?tags(el.value):el.value.trim();
   }
   out.company=String(out.company||"").trim();
   if(!out.company || out.company.length>300 || !norm(out.company))throw Error("有効な企業名（300文字以内）を入力してください。");
   if(out.contact.length>1000 || out.company_description.length>30000 || out.demo.length>20000)throw Error("入力内容が長すぎます。");
   return out;
 }
 function newForm(){
   currentName="";$("adminCompanySelect").value="";
   for(const [key,id] of Object.entries(inputs)){
     if(key==="legacy_connection")$(id).checked=false;
     else if(key==="sales_group")$(id).value="完全新規";
     else $(id).value="";
   }
   $("adminCompanyName").readOnly=false;
   message("新規企業の入力画面です。");
 }
 function loadForm(name){
   const c=companies().find(x=>x.company===name);
   if(!c){newForm();return;}
   currentName=name;
   for(const [key,id] of Object.entries(inputs)){
     if(key==="legacy_connection")$(id).checked=!!c[key];
     else if(key==="search_tags")$(id).value=tags(c[key]).join("、");
     else $(id).value=c[key]??(key==="sales_group"?"完全新規":"");
   }
   $("adminCompanyName").readOnly=true;
   message("既存レコードの編集です。企業名は識別IDのため固定です。名称変更は新規登録・旧名の削除として実施してください。");
 }
 function refreshAdmin(){
   const sel=$("adminCompanySelect"),value=currentName||sel.value;
   sel.innerHTML='<option value="">新規企業を登録</option>';
   const frag=document.createDocumentFragment();
   companies().slice().sort((a,b)=>a.company.localeCompare(b.company,"ja")).forEach(c=>{
     const o=document.createElement("option");o.value=c.company;o.textContent=c.company;frag.appendChild(o);
   });
   sel.appendChild(frag);
   if(value && companies().some(c=>c.company===value))sel.value=value;
 }
 window.refreshCompanyAdmin=refreshAdmin;
 refreshAdmin();
 if(!allowed){message("管理者権限がないため閲覧専用です。");return;}
 $("adminCompanySelect").addEventListener("change",e=>{if(e.target.value)loadForm(e.target.value);else newForm();});
 $("adminCompanyNew").addEventListener("click",newForm);
 async function freshRows(){
   const snapshot=await getDocs(collection(db,"companies"));
   return snapshot.docs.map(x=>x.data()).filter(c=>c&&c.company);
 }
 async function register(row,skipDupCheck=false){
   const ref=doc(db,"companies",docID(row.company));
   await runTransaction(db,async tx=>{
     const snap=await tx.get(ref);
     if(snap.exists())throw Error("既に同じ企業名のレコードがあります。");
     tx.set(ref,row);
   });
 }
 $("adminCompanySave").addEventListener("click",async()=>{
   if(busy)return;
   busy=true;$("adminCompanySave").disabled=true;
   try{
     const incoming=collect();
     const rows=await freshRows();
     const exists=rows.find(c=>c.company===currentName);
     if(currentName&&!exists)throw Error("対象の企業が見つかりません。最新データを読み込み直してください。");
     const duplicates=duplicateIndex(rows,currentName);
     if(duplicates.has(norm(incoming.company)))throw Error("既存企業との重複候補です。追加・更新を取り消しました。");
     if(!currentName){
       const record={...incoming,priority_rank:"B",sales_allowed:"新規営業対象"};
       await register(record);
       currentName=incoming.company;
       $("adminCompanyName").readOnly=true;
       message("企業を新規登録しました。別端末にも反映されます。");
     }else{
       const ref=doc(db,"companies",docID(currentName));
       await runTransaction(db,async tx=>{
         const snap=await tx.get(ref);
         if(!snap.exists())throw Error("企業が既に削除されています。");
         tx.set(ref,{...snap.data(),...incoming,company:currentName});
       });
       message("企業情報を更新しました。旧来の詳細項目は保持しています。");
     }
     $("adminImportCommit").disabled=true;pending=[];
   }catch(e){message("登録・更新失敗：" +e.message);}
   finally{busy=false;$("adminCompanySave").disabled=false;}
 });
 $("adminCompanyDelete").addEventListener("click",async()=>{
   if(!currentName){message("削除する企業を先に選択してください。");return;}
   if(busy)return;
   const name=currentName;
   if(!confirm(name+" を企業マスタから削除しますか？\n営業進捗履歴は削除せず保持されます。"))return;
   busy=true;$("adminCompanyDelete").disabled=true;
   try{
     const ref=doc(db,"companies",docID(name));
     await runTransaction(db,async tx=>{
       const snap=await tx.get(ref);
       if(!snap.exists())throw Error("対象の企業は既に削除されています。");
       tx.delete(ref);
     });
     newForm();message(name+" を削除しました。営業進捗履歴は保持されます。");
   }catch(e){message("削除失敗："+e.message);}
   finally{busy=false;$("adminCompanyDelete").disabled=false;}
 });
 async function readFile(file){
   const lower=file.name.toLowerCase();
   if(lower.endsWith(".json")){
     const parsed=JSON.parse(await file.text());
     const rows=Array.isArray(parsed)?parsed:(parsed&&Array.isArray(parsed.companies)?parsed.companies:null);
     if(!rows)throw Error("JSONは企業オブジェクトの配列、または companies 配列が必要です。");
     return rows;
   }
   if(lower.endsWith(".csv"))return parseCsv(await file.text());
   if(lower.endsWith(".xlsx")||lower.endsWith(".xls")){
     const XLSX=await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs");
     const wb=XLSX.read(new Uint8Array(await file.arrayBuffer()),{type:"array"});
     const sheet=wb.Sheets[wb.SheetNames[0]];
     if(!sheet)throw Error("Excelの最初のシートが見つかりません。");
     return XLSX.utils.sheet_to_json(sheet,{defval:"",raw:false});
   }
   throw Error("CSV・Excel（.xlsx/.xls）・JSONを選択してください。");
 }
 async function preview(){
   pending=[];$("adminImportCommit").disabled=true;
   const file=$("adminImportFile").files[0];
   if(!file)throw Error("取り込むファイルを選択してください。");
   if(file.size>15*1024*1024)throw Error("15MB以下のファイルを選択してください。");
   const source=await readFile(file);
   const existing=await freshRows();
   const known=duplicateIndex(existing);
   let dup=0,invalid=0;
   const additions=[];
   for(const raw of source){
     const row=toRecord(raw);
     if(!row){invalid++;continue;}
     const key=norm(row.company);
     if(known.has(key)){dup++;continue;}
     known.add(key);additions.push(row);
   }
   pending=additions;
   importMessage("読込 "+source.length+"社／登録済みと重複またはファイル内重複 "+dup+"社／企業名不備 "+invalid+"社／新規登録候補 "+additions.length+"社\n新規候補："+additions.slice(0,8).map(x=>x.company).join("、")+(additions.length>8?" ほか":""));
   $("adminImportCommit").disabled=additions.length===0;
 }
 $("adminImportPreview").addEventListener("click",async()=>{
   try{await preview();}
   catch(e){pending=[];$("adminImportCommit").disabled=true;importMessage("確認できません："+e.message);}
 });
 $("adminImportFile").addEventListener("change",()=>{pending=[];$("adminImportCommit").disabled=true;importMessage("ファイルが変更されました。再度、重複チェックを実行してください。");});
 $("adminImportCommit").addEventListener("click",async()=>{
   if(busy||!pending.length)return;
   if(!confirm(pending.length+"社を新規登録しますか？既存企業は上書きしません。"))return;
   busy=true;$("adminImportCommit").disabled=true;
   let created=0,skipped=0,errors=[];
   try{
     const fresh=await freshRows(),known=duplicateIndex(fresh);
     const queue=[];
     for(const row of pending){
       if(known.has(norm(row.company))){skipped++;continue;}
       // Reserve normalized names inside this import batch before parallel writes.
       known.add(norm(row.company));queue.push(row);
     }
     let cursor=0;
     const workers=Array.from({length:Math.min(5,queue.length)},async()=>{
       while(cursor<queue.length){
         const row=queue[cursor++];
         try{
           await register(row);created++;
         }catch(e){
           if(String(e.message).includes("既に同じ企業名"))skipped++;
           else errors.push(row.company+"："+e.message);
         }
         if((created+skipped+errors.length)%20===0)importMessage("登録処理中："+(created+skipped+errors.length)+"件");
       }
     });
     await Promise.all(workers);
     importMessage("新規登録 "+created+"社／重複スキップ "+skipped+"社／エラー "+errors.length+"社"+(errors.length?"\n"+errors.slice(0,8).join("\n"):""));
     pending=[];
   }catch(e){importMessage("登録中にエラーが発生しました："+e.message);}
   finally{busy=false;}
 });
 message("管理者としてログインしています。個別登録と重複確認付き一括登録を利用できます。");
};
})();
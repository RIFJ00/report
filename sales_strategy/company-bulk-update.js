/* RIFJ bulk master import: preview, preserve existing data, authenticated admin only. */
import {collection,getDocs,doc,runTransaction} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
const FIELDS={
"企業名":"company","固定企業ID":"firebase_company_id","営業優先スコア":"priority_score","営業優先ランク":"priority_rank",
"公開連絡先":"contact","会社の電話番号":"contact","営業区分":"sales_group","主業種・戦略分野":"industry",
"業種・戦略分野":"industry","検索用分野タグ":"search_tags","副テーマ":"secondary","会員名簿判定":"membership_state",
"優先表示プラン（有料優先）":"membership_priority_plan","現在ステータス上のプラン":"membership_current_plan",
"利用開始日（登録日）":"membership_start_date","会員名簿プラン履歴（有料優先）":"membership_plan_history",
"有効件数":"membership_valid_rows","無効件数":"membership_invalid_rows","判定根拠":"membership_basis",
"照合ルール":"membership_match_rule","ランク理由":"priority_reason","営業可否":"sales_allowed",
"上場・企業区分":"listing_status","証券コード":"ticker","名簿区分":"master_segment",
"第1営業先部署":"dept1","第2営業先部署":"dept2","公開キーパーソン":"person",
"公開役職・接点":"role","連絡先種別":"contact_type","連絡先確認":"contact_level",
"企業公式URL":"official_url","連絡先・根拠URL":"contact_url","推奨初回接触ルート":"route",
"確認済み担当部署／推奨営業先":"contact_department_verified","連絡先調査日":"contact_checked_date",
"公式再確認日":"contact_recheck_date","公式再確認状況":"contact_recheck_status",
"公式再確認対象":"contact_recheck_scope","公式再確認情報源":"contact_recheck_source",
"最初に刺すテーマ":"sales_theme","企業説明":"company_description","直近政策トリガー":"policy_trigger",
"15分デモ内容":"demo","15分デモで見せる内容":"demo","過去プラン・履歴":"plan_history",
"販売チャネル":"sales_channel","正式法人名確認":"official_name_check",
"旧表示名":"legacy_company_name","旧縁あり":"legacy_connection",
"旧縁判定元":"legacy_connection_source"};
const VALID=new Set([...Object.values(FIELDS),"firebase_company_id","department_verification_status","sales_contact_approved","contact_status","source_master_version","master_verification"]);
const DENY=new Set(["progress","auto_progress","initial_contact_date","updated_by","updated_at","created_at","営業進捗","初回アプローチ日","最終返信日","オンライン会議日","申込完了日","拒否日","営業メモ・履歴"]);
const norm=s=>String(s||"").normalize("NFKC").toLowerCase().replace(/^(株式会社|有限会社|合同会社)/,"").replace(/(株式会社|有限会社|合同会社)$/,"").replace(/[\s\u3000・.,，。、－‐―ー_\-()（）]/g,"");
const sid=s=>/^C\d{6}$/.test(String(s||""))?String(s):"";
const diff=(a,b)=>JSON.stringify(a)!==JSON.stringify(b);
function convert(raw){
 const out={},other={};
 for(const [k,v] of Object.entries(raw||{})){
  if(DENY.has(k)||v===null||v===undefined)continue;
  const key=FIELDS[k]||k;
  if(DENY.has(key))continue;
  if(VALID.has(key)){
   if(key==="firebase_company_id"){if(sid(v))out[key]=sid(v);}
   else if(key==="search_tags")out[key]=Array.isArray(v)?v:String(v||"").split(/[、,，;；|\n]+/).map(x=>x.trim()).filter(Boolean);
   else if(key==="legacy_connection")out[key]=v===true||["true","1","○","〇","あり"].includes(String(v).toLowerCase());
   else out[key]=v;
  }else if(/[\u3040-\u30ff\u3400-\u9fff]/.test(k))other[k]=v;
 }
 if(Object.keys(other).length)out.import_master_fields=other;
 out.company=String(out.company||"").trim();
 return out;
}
async function readFile(file){
 if(file.size>20*1024*1024)throw Error("ファイルは20MB以下にしてください");
 const n=file.name.toLowerCase();
 if(n.endsWith(".json")){
  const data=JSON.parse(await file.text());
  const rows=Array.isArray(data)?data:(data.records||data.companies);
  if(!Array.isArray(rows))throw Error("JSONにrecordsまたはcompanies配列が必要です");
  return rows.map(x=>{const v=x.master||x.data||x;return convert({...x.webView_v157,...v,company:x.name||x.company||v.company||v["企業名"],firebase_company_id:x.companyId||v.firebase_company_id||v["固定企業ID"],master_verification:x.verification});});
 }
 if(n.endsWith(".xlsx")||n.endsWith(".xls")){
  const XLSX=await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs");
  const w=XLSX.read(new Uint8Array(await file.arrayBuffer()),{type:"array"});
  const tab=w.SheetNames.find(s=>/企業マスタ|企業一覧/.test(s))||w.SheetNames[0];
  return XLSX.utils.sheet_to_json(w.Sheets[tab],{defval:"",raw:false}).map(convert);
 }
 if(n.endsWith(".csv")){
  const XLSX=await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs");
  const w=XLSX.read(await file.text(),{type:"string"});
  return XLSX.utils.sheet_to_json(w.Sheets[w.SheetNames[0]],{defval:"",raw:false}).map(convert);
 }
 throw Error("JSON、CSV、Excel形式のみ対応");
}
export function setupCompanyBulkUpdate({db,claims}){
 const panel=document.getElementById("companyAdminPanel");
 if(!panel||document.getElementById("bulkMasterUpdate"))return;
 const el=document.createElement("section");
 el.id="bulkMasterUpdate";el.style.cssText="margin:20px 0;padding:16px;border:1px solid #9eafc2;border-radius:10px";
 el.innerHTML='<h3>企業マスタの一括修正・差分反映</h3>'+
 '<p class="help">既存の一括新規登録とは独立しています。固定企業ID・企業名を照合し、変更部分だけを更新します。空欄で既存値を消しません。営業進捗は更新対象外です。</p>'+
 '<input type="file" id="bulkMasterFile" accept=".json,.csv,.xlsx,.xls" aria-label="更新する企業マスタ">'+
 '<div class="actions"><button type="button" id="bulkMasterPreview">差分を確認</button><button type="button" id="bulkMasterCommit" disabled>差分を反映</button></div>'+
 '<pre id="bulkMasterResult" role="status" style="white-space:pre-wrap;max-height:280px;overflow:auto"></pre>';
 (document.getElementById("adminImportResult")?.parentElement||panel).appendChild(el);
 const $=id=>document.getElementById(id),output=$("bulkMasterResult"),commit=$("bulkMasterCommit");
 $("bulkMasterFile").disabled=claims.companyAdmin!==true;$("bulkMasterPreview").disabled=claims.companyAdmin!==true;
 if(claims.companyAdmin!==true){output.textContent="管理者権限が必要です。";return;}
 let pending=null,busy=false;
 async function preview(){
  const f=$("bulkMasterFile").files[0];if(!f)throw Error("ファイルを指定してください");
  const rows=await readFile(f),snap=await getDocs(collection(db,"companies"));
  const existing=snap.docs.map(d=>({id:d.id,data:d.data()}));
  const ids=new Map(existing.map(x=>[x.id,x])),byId=new Map(),byName=new Map();
  for(const x of existing){
   const id=sid(x.data.firebase_company_id||x.data.companyId);
   if(id){if(!byId.has(id))byId.set(id,[]);byId.get(id).push(x);}
   const n=norm(x.data.company);
   if(n){if(!byName.has(n))byName.set(n,[]);byName.get(n).push(x);}
  }
  const jobs=[],issues=[],seenId=new Set(),seenName=new Set();
  for(const row of rows){
   const id=sid(row.firebase_company_id),n=norm(row.company);
   if(!n){issues.push("企業名不備");continue;}
   if(seenName.has(n)||(id&&seenId.has(id))){issues.push(row.company+"：取込ファイル内の重複");continue;}
   seenName.add(n);if(id)seenId.add(id);
   const matches=new Map();
   for(const x of [...(id?[ids.get(id),...(byId.get(id)||[])]:[]),...(byName.get(n)||[])].filter(Boolean))matches.set(x.id,x);
   if(matches.size>1){issues.push(row.company+"：IDと社名の照合先が複数");continue;}
   const old=[...matches.values()][0];
   if(old&&norm(old.data.company)!==n){issues.push(row.company+"：固定IDの会社名が不一致");continue;}
   if(old&&id&&sid(old.data.firebase_company_id)&&sid(old.data.firebase_company_id)!==id){issues.push(row.company+"：既存の固定企業IDと不一致");continue;}
   if(!old&&!id){issues.push(row.company+"：新規には固定IDが必要");continue;}
   if(!old&&ids.has(id)){issues.push(row.company+"：ID競合");continue;}
   const changes={};
   if(old&&id&&!sid(old.data.firebase_company_id))changes.firebase_company_id=id;
   for(const [k,v] of Object.entries(row)){
    if(["company","firebase_company_id"].includes(k)||v===""||v===null)continue;
    if(k==="import_master_fields"){
     const base=old?.data?.import_master_fields||{};
     const patch=Object.fromEntries(Object.entries(v).filter(([name,value])=>value!==""&&diff(value,base[name])));
     if(Object.keys(patch).length)changes[k]={...base,...patch};
    }else if(diff(v,old?.data?.[k]))changes[k]=v;
   }
   if(!old)jobs.push({type:"new",id,name:row.company,data:{...changes,company:row.company,firebase_company_id:id},count:Object.keys(changes).length});
   else if(Object.keys(changes).length)jobs.push({type:"update",id:old.id,name:row.company,data:changes,count:Object.keys(changes).length});
  }
  return {jobs,issues,total:rows.length,file:f.name};
 }
 $("bulkMasterPreview").addEventListener("click",async()=>{
  commit.disabled=true;pending=null;output.textContent="照合中…";
  try{
   pending=await preview();const p=pending,updates=p.jobs.filter(x=>x.type==="update"),news=p.jobs.filter(x=>x.type==="new");
   output.textContent="読込 "+p.total+"社／更新 "+updates.length+"社／新規 "+news.length+"社／スキップ・保留 "+(p.total-p.jobs.length)+"社\n"+
    "差分例："+updates.slice(0,12).map(x=>x.name+" "+x.count+"項目").join("、")+"\n"+
    (p.issues.length?"要確認："+p.issues.slice(0,20).join("／"):"");
   commit.disabled=p.jobs.length===0;
  }catch(e){output.textContent="差分確認失敗："+e.message;}
 });
 $("bulkMasterFile").addEventListener("change",()=>{pending=null;commit.disabled=true;output.textContent="ファイルが変更されました。再度差分を確認してください。";});
 commit.addEventListener("click",async()=>{
  if(busy||!pending)return;
  const jobs=pending.jobs;
  if(!confirm(jobs.length+"社の差分をFirestoreへ登録しますか？\n営業進捗は変更しません。"))return;
  busy=true;commit.disabled=true;let count=0,errors=[];
  for(const job of jobs){
   try{
    const ref=doc(db,"companies",job.id);
    await runTransaction(db,async tx=>{
     const s=await tx.get(ref);
     if(job.type==="new"){
      if(s.exists())throw Error("既に登録されています");
      tx.set(ref,job.data);
     }else{
      if(!s.exists()||norm(s.data().company)!==norm(job.name))throw Error("登録後に企業が変更・削除されました");
      tx.update(ref,job.data);
     }
    });count++;
   }catch(e){errors.push(job.name+"："+e.message);}
   if((count+errors.length)%20===0)output.textContent="処理中 "+(count+errors.length)+"/"+jobs.length;
  }
  output.textContent="反映成功 "+count+"社／失敗 "+errors.length+"社\n"+errors.slice(0,30).join("\n")+"\n共有状況を更新して確認してください。";
  pending=null;busy=false;
 });
}

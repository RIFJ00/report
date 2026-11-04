
const $ = id => document.getElementById(id);
const SIGNATURE = `◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇
一般社団法人日本みらい研事務局
東京都千代田区平河町2-16-6 jeＶビル７F
代表理事　高松重雄
TEL 03(5215)6071　FAX 03(5215)6072
Mail s-takamatsu@rifj.jp

一般社団法人日本みらい研 https://www.rifj.jp/
政策リサーチのご案内 https://report.rifj.jp/pr/
◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇◇`;

let BULK_SELECTED = new Set();
let LAST_BATCH_DOCS = [];
const PROGRESS_STORAGE_KEY = "rifj_policy_sales_progress_v1";
const PROGRESS_DB_NAME = "rifj_policy_sales_db_v1";
const PROGRESS_DB_STORE = "kv";
let PROGRESS_CACHE = (()=>{try{return JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY)||"{}")||{};}catch(e){return {};}})();
let PROGRESS_DB = null;
let STORAGE_PERSISTED = false;
let noteSaveTimer = null;

function esc(s){ return (s??"").toString().trim(); }
function honorific(s){ return s ? s.replace(/様$/,"")+"様" : "御社"; }
function companyByName(name){ return COMPANY_DATA.find(c=>c.company===name) || null; }
function companyTags(c){
  if(!c) return [];
  if(Array.isArray(c.search_tags) && c.search_tags.length) return c.search_tags;
  return c.industry ? [c.industry] : ["その他・複合"];
}
function companyHasTag(c,tag){ return !!tag && companyTags(c).includes(tag); }

let APP_MODE = "single";

function init(){
  renderCompanyDropdown();
  renderDirectCompanyControls();
  $("showApproachedCompanies").addEventListener("change", ()=>{
    renderCompanyDropdown();
    renderDirectCompanyControls();
  });
  $("companySearchText").addEventListener("input", renderDirectCompanyControls);
  $("companySearchResults").addEventListener("change", ()=>{
    if($("companySearchResults").value) selectCompanyDirect($("companySearchResults").value);
  });
  $("companyAllSelect").addEventListener("change", ()=>{
    if($("companyAllSelect").value) selectCompanyDirect($("companyAllSelect").value);
  });
  $("singleModeBtn").addEventListener("click",()=>setAppMode("single"));
  $("bulkModeBtn").addEventListener("click",()=>setAppMode("bulk"));
  $("progressModeBtn").addEventListener("click",()=>setAppMode("progress"));
  $("industry").innerHTML = `<option value="">業種／戦略分野を選択</option>` + Object.keys(INDUSTRY_DEFAULTS).map(x=>`<option value="${xmlEscape(x)}">${xmlEscape(x)}</option>`).join("");
  $("companyInput").addEventListener("change", applyCompany);
    $("industry").addEventListener("change", applyIndustry);
  $("generateBtn").addEventListener("click", generate);
  $("clearCompanyBtn").addEventListener("click", clearCompanySelection);
  $("resetBtn").addEventListener("click", resetForm);
  $("downloadTxtBtn").addEventListener("click", downloadAll);
  $("downloadDocxBtn").addEventListener("click", downloadDocx);
  $("printPdfBtn").addEventListener("click", printPdf);
  $("exportSelectedCsvBtn").addEventListener("click", exportSelectedCsv);
  $("exportAllCsvBtn").addEventListener("click", exportAllCsv);
  $("exportAllJsonBtn").addEventListener("click", exportAllJson);
  $("applyBulkFilterBtn").addEventListener("click", renderBulkCompanies);
  $("excludeApproachedBulk").addEventListener("change", renderBulkCompanies);
  $("selectVisibleBtn").addEventListener("click", selectVisibleCompanies);
  $("clearBulkSelectionBtn").addEventListener("click", clearBulkSelection);
  $("clearBulkFiltersBtn").addEventListener("click", clearBulkFilters);
  $("bulkGenerateBtn").addEventListener("click", generateBulkDocuments);
  $("bulkDocxBtn").addEventListener("click", downloadBatchDocx);
  $("bulkPdfBtn").addEventListener("click", printBatchPdf);
  $("bulkCsvBtn").addEventListener("click", exportBatchCsv);
  $("stampBulkApproachBtn").addEventListener("click", stampBulkApproachToday);
  $("saveProgressBtn").addEventListener("click", saveProgressFromForm);
  $("clearProgressBtn").addEventListener("click", clearCurrentProgress);
  document.querySelectorAll(".stamp-today").forEach(btn=>btn.addEventListener("click",()=>stampToday(btn.dataset.field)));
  $("progressViewFilter").addEventListener("change", renderProgressList);
  $("progressSearch").addEventListener("input", renderProgressList);
  $("refreshProgressBtn").addEventListener("click", renderProgressList);
  $("exportVisibleProgressBtn").addEventListener("click",()=>exportProgressCsv(filteredProgressRows(),"政策リサーチ_営業進捗_表示中.csv"));
  $("exportApproachedBtn").addEventListener("click",()=>exportProgressCsv(progressRows().filter(r=>r.progress.approach_date),"政策リサーチ_アプローチ済み一覧.csv"));
  $("exportCurrentUsersBtn").addEventListener("click",()=>exportProgressCsv(progressRows().filter(r=>r.usage==="現在利用中"),"政策リサーチ_現在利用中企業一覧.csv"));
  $("exportIncompleteBtn").addEventListener("click",()=>exportProgressCsv(progressRows().filter(r=>r.auto.incomplete),"政策リサーチ_未了一覧.csv"));
  $("exportProgressJsonBtn").addEventListener("click", exportProgressJson);
  $("importProgressJsonBtn").addEventListener("click",()=>$("importProgressJsonFile").click());
  $("importProgressJsonFile").addEventListener("change", importProgressJson);
  ["progressApproachDate","progressReplyDate","progressMeetingDate","progressAppliedDate","progressRejectedDate"].forEach(id=>{
    $(id).addEventListener("change",()=>{ if(companyByName($("companyInput").value)) saveProgressFromForm(true); });
  });
  $("progressNote").addEventListener("input",()=>{
    clearTimeout(noteSaveTimer);
    noteSaveTimer=setTimeout(()=>{ if(companyByName($("companyInput").value)) saveProgressFromForm(true); },500);
  });
  initPersistentStorage();
  renderBulkFilters();
  applyIndustry(); generate();
  setAppMode("single");
}



function setAppMode(mode){
  APP_MODE=mode;
  const single=mode==="single", bulk=mode==="bulk", progress=mode==="progress";
  $("singleModeArea").style.display=single?"block":"none";
  $("bulkModeArea").style.display=bulk?"block":"none";
  $("progressModeArea").style.display=progress?"block":"none";

  [["singleModeBtn",single],["bulkModeBtn",bulk],["progressModeBtn",progress]].forEach(([id,on])=>{
    $(id).classList.toggle("active",on);
    $(id).classList.toggle("secondary",!on);
  });

  $("modeDescription").textContent=single
    ? "1社モード：企業マスタから選んだ1社だけの企業情報・営業進捗・文面を表示します。"
    : bulk
    ? "複数企業モード：業種・利用状況で絞り込み、複数社の文面作成とアプローチ日一括記録ができます。"
    : "営業進捗一覧：アプローチ済み、現在利用中、未了、オンライン会議、申込完了、拒否を一覧表示・出力します。";

  if(single){
    $("bulkOutput").value="";
    renderCompanyDropdown();
    renderDirectCompanyControls();
  }else if(bulk){
    renderBulkCompanies();
  }else{
    renderProgressList();
  }
  window.scrollTo({top:0,behavior:"smooth"});
}


function loadProgressStore(){
  return PROGRESS_CACHE||{};
}
function saveProgressStore(store){
  PROGRESS_CACHE=store||{};
  try{
    localStorage.setItem(PROGRESS_STORAGE_KEY,JSON.stringify(PROGRESS_CACHE));
  }catch(e){
    updateStorageStatus("ローカル保存に失敗しました", "error");
  }
  idbPutProgress(PROGRESS_CACHE);
}
function updateStorageStatus(message,type="ok"){
  const el=$("storageStatusText");
  if(!el) return;
  el.textContent=message;
  el.classList.remove("storage-ok","storage-warn","storage-error");
  el.classList.add(type==="error"?"storage-error":type==="warn"?"storage-warn":"storage-ok");
}
function openProgressDB(){
  return new Promise((resolve,reject)=>{
    if(PROGRESS_DB){ resolve(PROGRESS_DB); return; }
    if(!("indexedDB" in window)){ reject(new Error("IndexedDB unsupported")); return; }
    const req=indexedDB.open(PROGRESS_DB_NAME,1);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(PROGRESS_DB_STORE)) db.createObjectStore(PROGRESS_DB_STORE);
    };
    req.onsuccess=()=>{ PROGRESS_DB=req.result; resolve(PROGRESS_DB); };
    req.onerror=()=>reject(req.error||new Error("IndexedDB open failed"));
  });
}
async function idbPutProgress(store){
  try{
    const db=await openProgressDB();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(PROGRESS_DB_STORE,"readwrite");
      tx.objectStore(PROGRESS_DB_STORE).put(store,"progress");
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error);
    });
    updateStorageStatus(STORAGE_PERSISTED?"端末に永続保存済み":"端末に保存済み");
  }catch(e){
    updateStorageStatus("localStorageには保存済み（IndexedDBは利用不可）","warn");
  }
}
async function idbGetProgress(){
  const db=await openProgressDB();
  return await new Promise((resolve,reject)=>{
    const tx=db.transaction(PROGRESS_DB_STORE,"readonly");
    const req=tx.objectStore(PROGRESS_DB_STORE).get("progress");
    req.onsuccess=()=>resolve(req.result||{});
    req.onerror=()=>reject(req.error);
  });
}
function mergeProgressStores(a,b){
  const out={...(a||{})};
  Object.entries(b||{}).forEach(([company,rec])=>{
    const old=out[company];
    if(!old){out[company]=rec;return;}
    const ot=Date.parse(old.updated_at||"1970-01-01")||0;
    const nt=Date.parse(rec.updated_at||"1970-01-01")||0;
    out[company]=nt>=ot?{...old,...rec}:{...rec,...old};
  });
  return out;
}
async function initPersistentStorage(){
  updateStorageStatus("端末保存を初期化中…","warn");
  try{
    if(navigator.storage && navigator.storage.persist){
      STORAGE_PERSISTED=await navigator.storage.persist();
    }
  }catch(e){ STORAGE_PERSISTED=false; }

  try{
    const fromDb=await idbGetProgress();
    PROGRESS_CACHE=mergeProgressStores(PROGRESS_CACHE,fromDb);
    try{ localStorage.setItem(PROGRESS_STORAGE_KEY,JSON.stringify(PROGRESS_CACHE)); }catch(e){}
    await idbPutProgress(PROGRESS_CACHE);
    renderCompanyDropdown();
    renderDirectCompanyControls();
    if(APP_MODE==="progress") renderProgressList();
    const selected=companyByName($("companyInput").value);
    if(selected) loadProgressIntoForm(selected.company);
    updateStorageStatus(STORAGE_PERSISTED?"端末に永続保存済み":"端末に保存済み");
  }catch(e){
    updateStorageStatus("端末に保存済み（localStorage）","warn");
  }
}
function getProgress(company){
  const store=loadProgressStore();
  return store[company]||{approach_date:"",reply_date:"",meeting_date:"",applied_date:"",rejected_date:"",note:"",updated_at:""};
}
function setProgress(company,data){
  if(!company) return;
  const store=loadProgressStore();
  store[company]={...getProgress(company),...data,updated_at:new Date().toISOString()};
  saveProgressStore(store);
}
function deleteProgress(company){
  const store=loadProgressStore(); delete store[company]; saveProgressStore(store);
}
function todayISO(){
  const d=new Date(), y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function dateToLocal(s){
  if(!s) return null;
  const p=s.split("-").map(Number); return new Date(p[0],p[1]-1,p[2]);
}
function daysSince(s){
  const d=dateToLocal(s); if(!d) return "";
  const t=dateToLocal(todayISO()); return Math.floor((t-d)/86400000);
}
function progressAuto(company){
  const p=getProgress(company);
  let status="未アプローチ";
  if(p.applied_date) status="申込完了";
  else if(p.rejected_date) status="拒否";
  else if(p.meeting_date){
    const md=dateToLocal(p.meeting_date), td=dateToLocal(todayISO());
    status=md&&md>td?"オンライン会議予定":"オンライン会議済";
  }else if(p.reply_date) status="返信あり";
  else if(p.approach_date) status="アプローチ済み（返信待ち）";

  let incomplete="";
  const elapsed=daysSince(p.approach_date);
  if(p.approach_date && !p.reply_date && !p.meeting_date && !p.applied_date && !p.rejected_date){
    if(elapsed>=30) incomplete="未了（1ヶ月）";
    else if(elapsed>=14) incomplete="未了（2週間）";
  }
  return {status,incomplete,elapsed:elapsed===""?"":elapsed};
}
function stampToday(fieldId){
  if(!companyByName($("companyInput").value)){alert("企業マスタから企業を選択してください。");return;}
  $(fieldId).value=todayISO(); saveProgressFromForm();
}
function loadProgressIntoForm(company){
  const p=getProgress(company);
  $("progressApproachDate").value=p.approach_date||"";
  $("progressReplyDate").value=p.reply_date||"";
  $("progressMeetingDate").value=p.meeting_date||"";
  $("progressAppliedDate").value=p.applied_date||"";
  $("progressRejectedDate").value=p.rejected_date||"";
  $("progressNote").value=p.note||"";
  renderCurrentProgressStatus();
}
function saveProgressFromForm(silent=false){
  const c=companyByName($("companyInput").value);
  if(!c){alert("進捗を保存するには企業マスタから企業を選択してください。");return;}
  const data={
    approach_date:$("progressApproachDate").value,
    reply_date:$("progressReplyDate").value,
    meeting_date:$("progressMeetingDate").value,
    applied_date:$("progressAppliedDate").value,
    rejected_date:$("progressRejectedDate").value,
    note:$("progressNote").value||""
  };
  if(data.applied_date) data.rejected_date="";
  else if(data.rejected_date) data.applied_date="";
  setProgress(c.company,data);
  $("progressAppliedDate").value=data.applied_date;
  $("progressRejectedDate").value=data.rejected_date;
  renderCurrentProgressStatus();
  renderCompanyDropdown();
  renderDirectCompanyControls();
  render(c);
  if(!silent) updateStorageStatus(STORAGE_PERSISTED?"端末に永続保存済み":"端末に保存済み");
}
function clearCurrentProgress(){
  const c=companyByName($("companyInput").value);
  if(!c){alert("企業マスタから企業を選択してください。");return;}
  if(!confirm(`${c.company} の営業進捗記録をクリアしますか？`)) return;
  deleteProgress(c.company); loadProgressIntoForm(c.company); renderCompanyDropdown(); renderDirectCompanyControls(); render(c);
}
function renderCurrentProgressStatus(){
  const c=companyByName($("companyInput").value);
  if(!c){$("progressStatusText").textContent="未記録";$("progressIncompleteText").textContent="—";return;}
  const a=progressAuto(c.company);
  $("progressStatusText").textContent=a.status;
  $("progressIncompleteText").textContent=a.incomplete||"—";
}
function stampBulkApproachToday(){
  if(APP_MODE!=="bulk") return;
  if(!BULK_SELECTED.size){alert("対象企業を1社以上選択してください。");return;}
  const today=todayISO();
  BULK_SELECTED.forEach(name=>setProgress(name,{approach_date:today}));
  alert(`${BULK_SELECTED.size}社に初回アプローチ日 ${today} を記録しました。`);
  renderCompanyDropdown();
  renderDirectCompanyControls();
  renderBulkCompanies();
}
function progressRows(){
  return COMPANY_DATA.map(c=>{
    const p=getProgress(c.company), auto=progressAuto(c.company);
    return {company:c.company,rank:c.priority_rank||"B",industry:companyTags(c).join("・"),usage:usageStatus(c),contact:c.contact||"",progress:p,auto};
  });
}
function filteredProgressRows(){
  const mode=$("progressViewFilter").value, q=($("progressSearch").value||"").trim().toLowerCase();
  return progressRows().filter(r=>{
    if(q && !r.company.toLowerCase().includes(q)) return false;
    if(mode==="approached") return !!r.progress.approach_date;
    if(mode==="current") return r.usage==="現在利用中";
    if(mode==="incomplete") return !!r.auto.incomplete;
    if(mode==="incomplete14") return r.auto.incomplete==="未了（2週間）";
    if(mode==="incomplete30") return r.auto.incomplete==="未了（1ヶ月）";
    if(mode==="meeting") return !!r.progress.meeting_date;
    if(mode==="applied") return !!r.progress.applied_date;
    if(mode==="rejected") return !!r.progress.rejected_date;
    return true;
  });
}
function renderProgressList(){
  if(APP_MODE!=="progress") return;
  const all=progressRows(), rows=filteredProgressRows();
  $("kpiApproached").textContent=all.filter(r=>r.progress.approach_date).length;
  $("kpiCurrent").textContent=all.filter(r=>r.usage==="現在利用中").length;
  $("kpiIncomplete14").textContent=all.filter(r=>r.auto.incomplete==="未了（2週間）").length;
  $("kpiIncomplete30").textContent=all.filter(r=>r.auto.incomplete==="未了（1ヶ月）").length;
  $("kpiApplied").textContent=all.filter(r=>r.progress.applied_date).length;
  $("kpiRejected").textContent=all.filter(r=>r.progress.rejected_date).length;
  $("progressVisibleCount").textContent=rows.length;
  $("progressTableBody").innerHTML=rows.map(r=>{
    const cls=r.auto.incomplete==="未了（1ヶ月）"?"incomplete30":r.auto.incomplete==="未了（2週間）"?"incomplete14":r.progress.applied_date?"applied":r.progress.rejected_date?"rejected":"";
    return `<tr class="${cls}">
      <td>${xmlEscape(r.rank)}</td><td>${xmlEscape(r.company)}</td><td>${xmlEscape(r.industry)}</td><td>${xmlEscape(r.usage)}</td>
      <td>${r.progress.approach_date||""}</td><td>${r.progress.reply_date||""}</td><td>${r.progress.meeting_date||""}</td>
      <td>${r.progress.applied_date||""}</td><td>${r.progress.rejected_date||""}</td>
      <td>${xmlEscape(r.progress.note||"")}</td>
      <td>${xmlEscape(r.auto.status)}</td><td>${xmlEscape(r.auto.incomplete||"")}</td><td>${r.auto.elapsed}</td>
    </tr>`;
  }).join("");
}
function progressCsvRows(rows){
  const header=["優先ランク","企業名","主業種・戦略分野","利用状況","公開連絡先","初回アプローチ日","最終返信日","オンライン会議日","申込完了日","拒否日","営業メモ・履歴","営業進捗","未了判定","経過日数"];
  const vals=rows.map(r=>[r.rank,r.company,r.industry,r.usage,r.contact,r.progress.approach_date,r.progress.reply_date,r.progress.meeting_date,r.progress.applied_date,r.progress.rejected_date,r.progress.note||"",r.auto.status,r.auto.incomplete,r.auto.elapsed]);
  return [header,...vals];
}
function exportProgressCsv(rows,filename){
  const csv="\ufeff"+progressCsvRows(rows).map(r=>r.map(csvEscape).join(",")).join("\r\n");
  saveBlob(new Blob([csv],{type:"text/csv;charset=utf-8"}),filename);
}
function exportProgressJson(){
  const payload={exported_at:new Date().toISOString(),progress:loadProgressStore()};
  saveBlob(new Blob([JSON.stringify(payload,null,2)],{type:"application/json;charset=utf-8"}),"政策リサーチ_営業進捗バックアップ.json");
}
async function importProgressJson(ev){
  const file=ev.target.files && ev.target.files[0];
  if(!file) return;
  try{
    const text=await file.text();
    const obj=JSON.parse(text);
    const incoming=(obj && obj.progress) ? obj.progress : obj;
    if(!incoming || typeof incoming!=="object" || Array.isArray(incoming)) throw new Error("形式が不正です");
    PROGRESS_CACHE=mergeProgressStores(PROGRESS_CACHE,incoming);
    saveProgressStore(PROGRESS_CACHE);
    renderCompanyDropdown();
    renderDirectCompanyControls();
    if(APP_MODE==="progress") renderProgressList();
    const selected=companyByName($("companyInput").value);
    if(selected) loadProgressIntoForm(selected.company);
    updateStorageStatus("バックアップを復元し、端末に保存しました");
    alert("営業進捗バックアップを復元しました。");
  }catch(e){
    alert("JSONバックアップを復元できませんでした。ファイル内容をご確認ください。");
  }finally{
    ev.target.value="";
  }
}

function usageStatus(c){
  if(c.sales_group==="現在利用") return "現在利用中";
  if(c.sales_group==="過去有料利用") return "利用後退会";
  if(c.sales_group==="トライアルのみ") return "トライアルのみ";
  if(c.sales_group==="完全新規") return "完全新規";
  return "その他";
}
function selectedValues(containerId){
  return [...document.querySelectorAll(`#${containerId} input[type="checkbox"]:checked`)].map(x=>x.value);
}
function renderBulkFilters(){
  const inds=[...new Set(COMPANY_DATA.map(c=>c.industry).filter(Boolean))].sort();
  $("industryFilters").innerHTML=inds.map(x=>`<label><input type="checkbox" value="${xmlEscape(x)}">${xmlEscape(x)}</label>`).join("");
  const statuses=["現在利用中","利用後退会","トライアルのみ","完全新規"];
  $("usageFilters").innerHTML=statuses.map(x=>`<label><input type="checkbox" value="${x}">${x}</label>`).join("");
}
function filteredBulkCompanies(){
  const inds=selectedValues("industryFilters"), sts=selectedValues("usageFilters");
  const excludeApproached=$("excludeApproachedBulk") ? $("excludeApproachedBulk").checked : true;
  if(!inds.length && !sts.length) return [];
  return COMPANY_DATA.filter(c=>{
    const indOk=!inds.length || inds.some(ind=>companyHasTag(c,ind));
    const stOk=!sts.length || sts.includes(usageStatus(c));
    const approachOk=!excludeApproached || !getProgress(c.company).approach_date;
    return indOk && stOk && approachOk;
  });
}
function renderBulkCompanies(){
  if(APP_MODE!=="bulk") return;
  const list=filteredBulkCompanies();
  $("visibleCompanyCount").textContent=list.length;
  if(!list.length){
    $("bulkCompanyList").innerHTML='<div class="help" style="padding:12px">業種または利用状況を1つ以上選び、「条件で企業を表示」を押してください。</div>';
    $("selectedCompanyCount").textContent=BULK_SELECTED.size;
    return;
  }
  $("bulkCompanyList").innerHTML=list.map(c=>{
    const checked=BULK_SELECTED.has(c.company)?"checked":"";
    const contact=c.contact||"連絡先未確認";
    const p=getProgress(c.company);
    const approachMark=p.approach_date ? ` ／ アプローチ済 ${p.approach_date}` : "";
    return `<label class="company-check-item">
      <input class="bulk-company-check" type="checkbox" value="${xmlEscape(c.company)}" ${checked}>
      <span><strong>[${xmlEscape(c.priority_rank||"B")}] ${xmlEscape(c.company)}</strong>
      <div class="meta">${xmlEscape(companyTags(c).join("・"))} ／ ${usageStatus(c)} ／ ${xmlEscape(contact)}${xmlEscape(approachMark)}</div></span>
    </label>`;
  }).join("");
  document.querySelectorAll(".bulk-company-check").forEach(el=>el.addEventListener("change",()=>{
    if(el.checked) BULK_SELECTED.add(el.value); else BULK_SELECTED.delete(el.value);
    $("selectedCompanyCount").textContent=BULK_SELECTED.size;
  }));
  $("selectedCompanyCount").textContent=BULK_SELECTED.size;
}
function selectVisibleCompanies(){
  if(APP_MODE!=="bulk") return;
  filteredBulkCompanies().forEach(c=>BULK_SELECTED.add(c.company));
  renderBulkCompanies();
}
function clearBulkSelection(){
  if(APP_MODE!=="bulk") return;
  BULK_SELECTED.clear(); renderBulkCompanies(); $("bulkOutput").value=""; LAST_BATCH_DOCS=[];
}
function clearBulkFilters(){
  if(APP_MODE!=="bulk") return;
  document.querySelectorAll("#industryFilters input,#usageFilters input").forEach(x=>x.checked=false);
  BULK_SELECTED.clear(); LAST_BATCH_DOCS=[]; $("bulkOutput").value="";
  renderBulkCompanies();
}
function batchOpening(c){
  const st=usageStatus(c);
  if(st==="現在利用中") return "いつも政策リサーチをご利用いただき、ありがとうございます。";
  if(st==="利用後退会") return "以前、政策リサーチをご利用いただき、ありがとうございました。";
  if(st==="トライアルのみ") return "以前、政策リサーチをお試しいただき、ありがとうございました。";
  return "突然のご連絡失礼いたします。一般社団法人日本みらい研の髙松と申します。";
}
function batchSubject(c,stage,theme){
  const st=usageStatus(c);
  if(stage==="利用者"){
    if(st==="現在利用中") return `【政策リサーチ】ご利用状況と「${theme}」の最新政策について`;
    if(st==="利用後退会") return `【政策リサーチ】以前のご利用御礼と「${theme}」の最新動向`;
    if(st==="トライアルのみ") return `【政策リサーチ】以前のトライアル御礼と「${theme}」の最新動向`;
  }
  if(stage==="電話後メール") return `【先ほどのお電話の件】${c.company}様の「${theme}」に関する政策資料`;
  if(stage==="15分商談") return `【政策リサーチ】${c.company}様向け15分デモのご案内`;
  if(stage==="10日間トライアル") return `【政策リサーチ】10日間無料トライアルのご案内`;
  return `【政策リサーチ】${c.company}様に関係する「${theme}」の政策情報`;
}
function batchBody(c,stage,theme,note){
  const st=usageStatus(c), trigger=c.policy_trigger||"直近の政府会議・予算・制度動向";
  const dept=c.dept1||"政策渉外・経営企画等のご担当部門";
  const demo=c.demo||"関連する政府会議・予算・制度資料を横断してご説明";
  if(stage==="利用者"){
    if(st==="現在利用中"){
      return `${batchOpening(c)}

現在、御社では政策リサーチをご利用いただいておりますが、最近の「${theme}」に関する政策動向も踏まえ、より活用いただける余地があるのではと思いご連絡しました。

直近では「${trigger}」も動いています。検索だけでなく、当日解説、週2回の政策レポート、アラート等を組み合わせることで、情報収集から社内共有まで効率化できます。

15分ほど、現在のご利用状況を伺いながら、①利用促進、②関連テーマの追加、③他部署での活用、のいずれが有効か整理してご案内できます。${note?`\n\n${note}`:""}

${SIGNATURE}`;
    }
    if(st==="利用後退会"){
      return `${batchOpening(c)}

その後、政策リサーチは当日解説、AI解析、週2回の政策レポート等を拡充しています。また、御社に関係する「${theme}」でも新しい政策動向が続いています。

直近の「${trigger}」を含め、現在のサービスでどのように把握できるか、15分程度で改めてご説明できます。以前ご利用いただいた時点との違いも含めてご覧いただければと思います。${note?`\n\n${note}`:""}

${SIGNATURE}`;
    }
    if(st==="トライアルのみ"){
      return `${batchOpening(c)}

現在は、当日解説、AI解析、政策レポートなどを拡充しており、以前お試しいただいた時点からサービス内容も進化しています。

特に「${theme}」では「${trigger}」など新しい動きがあり、御社に関係する資料を使って15分程度で現在の活用方法をご説明できます。${note?`\n\n${note}`:""}

${SIGNATURE}`;
    }
    return `【注意】${c.company}は完全新規のため、「利用者」接触段階は通常適しません。\n\n${batchOpening(c)}\n\n「${theme}」に関係する政策動向について、${dept}のご担当者様へご案内したくご連絡しました。\n\n${SIGNATURE}`;
  }
  if(stage==="初回電話"){
    return `【代表受付・ファーストコンタクト】
突然のお電話で失礼いたします。一般社団法人日本みらい研の髙松と申します。
御社の「${theme}」との関係が深いことから、政府関連情報の有効な活用方法についてお話しいたしたくご連絡しました。
${dept}で政策動向を担当されるご責任者または実務責任者の方にご案内したく、おつなぎいただけますでしょうか。

【担当者との電話】
お時間をいただきありがとうございます。最初に、お名前を確認させていただいてもよろしいでしょうか。

日本みらい研では、政府・省庁・国会などの政策情報を収集・整理する法人向けサービス「政策リサーチ」を10年以上運営しております。現在、大手企業だけでも約100社に継続的に利用いただいており、大手企業に限っても累計400社超のご利用実績があります。

御社では「${theme}」が特に関係すると考えており、一般的なシステムの説明をするより、御社に関係する政府関連資料を2～3件お見せする方が早いと思い、ご連絡をさせていただきました。

まずは、本日のお電話を踏まえて、政策リサーチの概要と関連する資料をメールでお送りします。資料をご覧いただいた後に、可能であれば15分程度、オンラインで説明の機会をいただければと思います。メール内容をご確認の上、ご検討の程、よろしくお願いします。

最後に、メールの送り先として、部署名・お名前とメールアドレスを教えていただけますでしょうか。

【電話後メール】
${batchOpening(c)}
先ほどはお電話でお時間をいただき、ありがとうございました。
御社に関係する「${theme}」について、「${trigger}」を含む政府会議・予算・制度資料を横断して確認できます。
15分ほどで「${demo}」という形で実際の資料を2～3件ご説明できます。${note?`\n\n${note}`:""}

${SIGNATURE}`;
  }
  if(stage==="10日間トライアル"){
    return `${batchOpening(c)}
御社の「${theme}」から3～5テーマに絞り、10日間無料で政策リサーチを実際にお使いいただけます。
必要情報を拾えるか、情報収集時間が減るか、社内共有に使えるかの3点をご確認いただければ十分です。${note?`\n\n${note}`:""}

${SIGNATURE}`;
  }
  if(stage==="15分商談"){
    return `${batchOpening(c)}
御社に関係する「${theme}」について、15分で実際の政府資料を使ってご説明します。
「${demo}」という流れで、政策形成段階から情報を追える点をご覧いただきます。${note?`\n\n${note}`:""}

${SIGNATURE}`;
  }
  return `${batchOpening(c)}
御社に関係する「${theme}」について、直近の「${trigger}」を含む政策情報をご案内します。
必要に応じて15分程度で実際の資料をご説明できます。${note?`\n\n${note}`:""}

${SIGNATURE}`;
}
function generateBulkDocuments(){
  if(APP_MODE!=="bulk") return;
  if(!BULK_SELECTED.size){ alert("対象企業を1社以上選択してください。"); return; }
  const stage=$("bulkStage").value, commonTheme=esc($("bulkCommonTheme").value), note=esc($("bulkCommonNote").value);
  const companies=COMPANY_DATA.filter(c=>BULK_SELECTED.has(c.company));
  LAST_BATCH_DOCS=companies.map(c=>{
    const theme=commonTheme||c.sales_theme||c.secondary||c.industry||"政府政策・予算・制度動向";
    return {company:c.company,status:usageStatus(c),industry:c.industry||"",contact:c.contact||"",subject:batchSubject(c,stage,theme),body:batchBody(c,stage,theme,note)};
  });
  const newCompanies=LAST_BATCH_DOCS.filter(d=>d.status==="完全新規").length;
  if(stage==="利用者" && newCompanies){
    $("bulkWarning").style.display="block";
    $("bulkWarning").textContent=`「利用者」段階ですが、完全新規企業が${newCompanies}社含まれています。該当文面には注意表示を入れています。`;
  }else{
    $("bulkWarning").style.display="none";
  }
  $("bulkOutput").value=LAST_BATCH_DOCS.map(d=>`＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
【${d.company}】 ${d.status} ／ ${d.industry}
件名：${d.subject}

${d.body}`).join("\n\n");
}
function exportBatchCsv(){
  if(APP_MODE!=="bulk") return;
  if(!LAST_BATCH_DOCS.length) generateBulkDocuments();
  if(!LAST_BATCH_DOCS.length) return;
  const rows=[["企業名","利用状況","業種","公開連絡先","件名","本文"],...LAST_BATCH_DOCS.map(d=>[d.company,d.status,d.industry,d.contact,d.subject,d.body])];
  const csv="\ufeff"+rows.map(r=>r.map(csvEscape).join(",")).join("\r\n");
  saveBlob(new Blob([csv],{type:"text/csv;charset=utf-8"}),`政策リサーチ_一括送付準備_${LAST_BATCH_DOCS.length}社.csv`);
}
function downloadBatchDocx(){
  if(APP_MODE!=="bulk") return;
  if(!LAST_BATCH_DOCS.length) generateBulkDocuments();
  if(!LAST_BATCH_DOCS.length) return;
  const paras=[];
  paras.push({text:"政策リサーチ 一括送付文面",bold:true,size:32});
  paras.push({text:`対象企業：${LAST_BATCH_DOCS.length}社`});
  LAST_BATCH_DOCS.forEach((d,i)=>{
    if(i>0) paras.push({pageBreak:true});
    paras.push({text:d.company,bold:true,size:28});
    paras.push({text:`利用状況：${d.status}　業種：${d.industry}`});
    paras.push({text:`件名：${d.subject}`,bold:true});
    d.body.split(/\n/).forEach(line=>paras.push({text:line}));
  });
  const body=paras.map(p=>{
    if(p.pageBreak) return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
    const rpr=(p.bold||p.size)?`<w:rPr>${p.bold?'<w:b/>':''}${p.size?`<w:sz w:val="${p.size}"/><w:szCs w:val="${p.size}"/>`:''}<w:rFonts w:eastAsia="Yu Gothic" w:ascii="Arial"/></w:rPr>`:'<w:rPr><w:rFonts w:eastAsia="Yu Gothic" w:ascii="Arial"/></w:rPr>';
    return `<w:p><w:r>${rpr}<w:t xml:space="preserve">${xmlEscape(p.text||"")}</w:t></w:r></w:p>`;
  }).join("");
  const documentXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`;
  const files=[
    {name:"[Content_Types].xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`},
    {name:"_rels/.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`},
    {name:"word/document.xml",data:documentXml}
  ];
  saveBlob(new Blob([makeZip(files)],{type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}),`政策リサーチ_一括文面_${LAST_BATCH_DOCS.length}社.docx`);
}
function printBatchPdf(){
  if(APP_MODE!=="bulk") return;
  if(!LAST_BATCH_DOCS.length) generateBulkDocuments();
  if(!LAST_BATCH_DOCS.length) return;
  const win=window.open("","_blank");
  if(!win){ alert("ポップアップを許可してください。"); return; }
  const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>政策リサーチ 一括送付文面</title>
  <style>@page{size:A4;margin:18mm}body{font-family:"Yu Gothic","Hiragino Kaku Gothic ProN",Meiryo,sans-serif;color:#222;line-height:1.65;font-size:10.5pt}
  h1{font-size:18pt;color:#17365D}.company{page-break-before:always}.company:first-of-type{page-break-before:auto}h2{font-size:15pt;color:#17365D;border-bottom:2px solid #17365D}pre{white-space:pre-wrap;font-family:inherit}</style>
  </head><body><h1>政策リサーチ 一括送付文面（${LAST_BATCH_DOCS.length}社）</h1>
  ${LAST_BATCH_DOCS.map(d=>`<section class="company"><h2>${xmlEscape(d.company)}</h2><p>利用状況：${xmlEscape(d.status)} ／ 業種：${xmlEscape(d.industry)}</p><p><strong>件名：${xmlEscape(d.subject)}</strong></p><pre>${xmlEscape(d.body)}</pre></section>`).join("")}
  <script>window.onload=()=>setTimeout(()=>window.print(),250);<\/script></body></html>`;
  win.document.open();win.document.write(html);win.document.close();
}




function salesPriorityRank(c){
  const order={"S":1,"A":2,"B":3,"C":4};
  return order[c && c.priority_rank] || 9;
}
const COMPANY_NAME_COLLATOR = new Intl.Collator("ja",{
  usage:"sort",
  sensitivity:"base",
  numeric:true,
  ignorePunctuation:true
});
function compareCompanyPriorityName(a,b){
  const pd=salesPriorityRank(a)-salesPriorityRank(b);
  if(pd!==0) return pd;
  return COMPANY_NAME_COLLATOR.compare(a.company||"",b.company||"");
}

function normalizeCompanySearch(s){
  return (s||"").normalize("NFKC").toLowerCase().replace(/\s+/g,"");
}
function directCompanyRows(){
  const showApproached=$("showApproachedCompanies") && $("showApproachedCompanies").checked;
  return COMPANY_DATA
    .filter(c=>showApproached || !getProgress(c.company).approach_date)
    .slice()
    .sort(compareCompanyPriorityName);
}
function companyOptionText(c){
  const p=getProgress(c.company);
  const base=`[${c.priority_rank||"B"}] ${c.company}`;
  return p.approach_date ? `${base}（アプローチ済 ${p.approach_date}）` : base;
}
function renderDirectCompanyControls(){
  const allSelect=$("companyAllSelect");
  const resultSelect=$("companySearchResults");
  if(!allSelect || !resultSelect) return;

  const rows=directCompanyRows();
  const current=companyByName($("companyInput").value);
  const currentName=current ? current.company : "";

  allSelect.innerHTML='<option value="">会社名から選択</option>' +
    rows.map(c=>`<option value="${xmlEscape(c.company)}">${xmlEscape(companyOptionText(c))}</option>`).join("");
  if(rows.some(c=>c.company===currentName)) allSelect.value=currentName;

  const q=normalizeCompanySearch($("companySearchText").value);
  const matched=q ? rows.filter(c=>normalizeCompanySearch(c.company).includes(q)) : rows;
  resultSelect.innerHTML = matched.length
    ? matched.map(c=>`<option value="${xmlEscape(c.company)}">${xmlEscape(companyOptionText(c))}</option>`).join("")
    : '<option value="">該当する企業がありません</option>';
  if(matched.some(c=>c.company===currentName)) resultSelect.value=currentName;

  const approachedCount=COMPANY_DATA.filter(c=>getProgress(c.company).approach_date).length;
  $("directCompanyNote").textContent =
    `${q ? `検索結果 ${matched.length}社` : `一覧 ${rows.length}社`}。` +
    ($("showApproachedCompanies").checked
      ? `アプローチ済み ${approachedCount}社も表示しています。`
      : `アプローチ済み ${approachedCount}社は除外しています。`);
}
function selectCompanyDirect(name){
  const c=companyByName(name);
  if(!c) return;

  const currentTag=$("industry").value;
  const tag=(currentTag && companyHasTag(c,currentTag))
    ? currentTag
    : (companyTags(c)[0] || c.industry || "");

  if(tag && [...$("industry").options].some(o=>o.value===tag)){
    $("industry").value=tag;
  }

  renderCompanyDropdown();
  $("companyInput").value=c.company;
  $("companyAllSelect").value=c.company;
  renderDirectCompanyControls();
  $("companySearchResults").value=c.company;
  applyCompany();
}

function renderCompanyDropdown(){
  const select=$("companyInput");
  const selectedIndustry=$("industry").value;
  const showApproached=$("showApproachedCompanies") && $("showApproachedCompanies").checked;
  const current=select.value;

  if(!selectedIndustry){
    select.innerHTML='<option value="">先に業種／戦略分野を選択してください</option>';
    select.disabled=true;
    $("companyListNote").textContent="業種／戦略分野を選ぶと、その分野の企業だけを表示します。";
    return;
  }

  const rows=COMPANY_DATA.filter(c=>
    companyHasTag(c,selectedIndustry) &&
    (showApproached || !getProgress(c.company).approach_date)
  ).slice().sort(compareCompanyPriorityName);

  select.disabled=false;
  select.innerHTML='<option value="">企業を選択してください</option>' + rows.map(c=>{
    const p=getProgress(c.company);
    const text=p.approach_date
      ? `${c.company}（アプローチ済 ${p.approach_date}）`
      : c.company;
    return `<option value="${xmlEscape(c.company)}">${xmlEscape(text)}</option>`;
  }).join("");

  if(rows.some(c=>c.company===current)) select.value=current;

  const approachedInIndustry=COMPANY_DATA.filter(c=>
    companyHasTag(c,selectedIndustry) && getProgress(c.company).approach_date
  ).length;

  $("companyListNote").textContent=showApproached
    ? `${selectedIndustry}：${rows.length}社を表示。アプローチ済みは社名の後ろに日付を表示します。`
    : `${selectedIndustry}：未アプローチ ${rows.length}社を表示。アプローチ済み ${approachedInIndustry}社は除外しています。`;
}

function applyCompany(){
  if(APP_MODE!=="single") setAppMode("single");
  const c=companyByName($("companyInput").value);
  if(!c) return;
  $("companyCustom").value="";
  if(!$("industry").value || !companyHasTag(c,$("industry").value)){
    const fallback=companyTags(c)[0]||c.industry;
    if([...$("industry").options].some(o=>o.value===fallback)){
      $("industry").value=fallback; renderCompanyDropdown(); $("companyInput").value=c.company;
    }
  }
  $("dept").value=c.dept1||"";
  $("person").value=c.person||"";
  $("role").value=c.role||"";
  $("theme").value=c.sales_theme||"";
  $("trigger").value=c.policy_trigger||"";
  $("demo").value=c.demo||"";
  loadProgressIntoForm(c.company);
  if($("companyAllSelect")) $("companyAllSelect").value=c.company;
  if($("companySearchResults")) $("companySearchResults").value=c.company;
  generate();
}
function applyIndustry(){
  const selectedIndustry=$("industry").value;
  const current=companyByName($("companyInput").value);

  if(current && !companyHasTag(current,selectedIndustry)){
    $("companyInput").value="";
    $("companyCustom").value="";
    ["dept","person","role","theme","trigger","demo"].forEach(id=>$(id).value="");
    $("contactDisplay").value="";
    $("contactTypeDisplay").value="";
    $("routeDisplay").value="";
    $("officialUrlDisplay").value="";
    $("sourceUrlDisplay").value="";
    $("historyDisplay").value="";
    $("summaryTags").innerHTML="";
  resetSelectedCompanySidePanel();
  }

  renderCompanyDropdown();

  const d=INDUSTRY_DEFAULTS[selectedIndustry];
  if(!d) return;
  if(!companyByName($("companyInput").value)){
    $("dept").value=d.dept||"";
    $("theme").value=d.theme||"";
    $("demo").value=d.demo||"";
  }
}

function ctx(){
  const preset=companyByName($("companyInput").value)||{};
  const company=esc($("companyCustom").value)||esc(preset.company)||"対象企業";
  const industry=esc($("industry").value)||esc(preset.industry)||"その他・複合";
  const d=INDUSTRY_DEFAULTS[industry]||INDUSTRY_DEFAULTS["その他・複合"];
  return {
    company,industry,preset,
    salesGroup:esc(preset.sales_group)||"完全新規",
    salesAllowed:esc(preset.sales_allowed)||"新規営業対象",
    dept:esc($("dept").value)||esc(preset.dept1)||d.dept,
    person:esc($("person").value)||esc(preset.person),
    role:esc($("role").value)||esc(preset.role),
    theme:esc($("theme").value)||esc(preset.sales_theme)||d.theme,
    trigger:esc($("trigger").value)||esc(preset.policy_trigger),
    demo:esc($("demo").value)||esc(preset.demo)||d.demo,
    contactPerson:esc($("contactPerson").value),
    callNotes:esc($("callNotes").value),
    proposedTimes:esc($("proposedTimes").value), confirmedTime:esc($("confirmedTime").value),
    contact:esc(preset.contact), contactType:esc(preset.contact_type),
    contactLevel:esc(preset.contact_level), route:esc(preset.route),
    contactDeptVerified:esc(preset.contact_department_verified)||esc(preset.dept1),
    contactCheckedDate:esc(preset.contact_checked_date),
    contactRecheckDate:esc(preset.contact_recheck_date),
    contactRecheckStatus:esc(preset.contact_recheck_status),
    contactRecheckScope:esc(preset.contact_recheck_scope),
    contactRecheckSource:esc(preset.contact_recheck_source),
    companyResearch:esc(preset.company_research),
    companyResearchSource:esc(preset.company_research_source)||esc(preset.contact_url)||esc(preset.official_url),
    priorityRank:esc(preset.priority_rank)||"C",
    priorityReason:esc(preset.priority_reason),
    officialUrl:esc(preset.official_url), contactUrl:esc(preset.contact_url),
    planHistory:esc(preset.plan_history), salesChannel:esc(preset.sales_channel),
    usageStatus:esc($("usageStatus").value), additionalTheme:esc($("additionalTheme").value),
    currentDept:esc($("currentDept").value), targetDept:esc($("targetDept").value)
  };
}

function opening(c){
  if(c.salesGroup==="過去有料利用"){
    return `以前「政策リサーチ」をご利用いただいた経緯があり、その後のサービス拡充と、御社に関係する「${c.theme}」の政策動向について改めてご案内したくご連絡しました。`;
  }
  if(c.salesGroup==="トライアルのみ"){
    return `以前「政策リサーチ」をお試しいただいた経緯があり、現在は当時から機能・解説コンテンツを拡充しております。御社に関係する「${c.theme}」の動きもあり、改めてご案内したくご連絡しました。`;
  }
  if(c.salesGroup==="現在利用"){
    return `御社は現在「政策リサーチ」をご利用中です。新規営業ではなく、利用テーマの追加や社内展開のご相談として扱います。`;
  }
  return `日本みらい研では、政府・省庁・国会などの政策情報を収集・整理する法人向けサービス「政策リサーチ」を10年以上運営しております。現在、大手企業だけでも約100社に継続的に利用いただいており、大手企業に限っても累計400社超のご利用実績があります。`;
}

function contactMemo(c){
  if(c.contact) return `公開連絡先：${c.contact}\n推奨ルート：${c.route||c.dept}`;
  return `公開連絡先：未確認\n推奨ルート：${c.route||"公式サイト／代表窓口から"+c.dept+"へ取次ぎ依頼"}`;
}

function contactResearchSummary(c){
  const person=[c.person,c.role].filter(Boolean).join(" ／ ") || "公開担当者名は未確認";
  const dept=c.contactDeptVerified||c.dept||"経営企画・政策渉外等（要確認）";
  const checked=c.contactCheckedDate ? `（確認日 ${c.contactCheckedDate}）` : "";
  return `【選択企業・営業連絡先】
企業名：${c.company}
営業優先ランク：${c.priorityRank}
代表電話／公開窓口：${c.contact||"未登録・要確認"}
担当部署／推奨営業先：${dept}
公開担当者・役職：${person}
連絡先確認：${c.contactLevel||"要確認"}${checked}
公式再確認：${c.contactRecheckStatus||"未実施"}${c.contactRecheckDate ? `（${c.contactRecheckDate}）` : ""}`;
}

function generate(){
  const c=ctx();
  const isUserStage = $("stage").value==="利用者";
  const tr=c.trigger||"直近の政府会議・予算・制度動向";
  const cp=c.contactPerson ? c.contactPerson+" " : "ご担当者様";
  const notes=c.callNotes ? `お電話では「${c.callNotes}」と伺いました。` : "お電話で伺った御社の関心テーマを踏まえ、";
  const blocked=c.salesGroup==="現在利用";

  $("outReception").value = blocked ?
`【既存顧客】${c.company}様は現在利用中です。新規営業電話は行わず、利用状況確認・テーマ追加・他部署展開の連絡として扱ってください。

${contactMemo(c)}` :
`突然のお電話で失礼いたします。一般社団法人日本みらい研の髙松と申します。

${opening(c)}

${honorific(c.company)}の場合、特に「${c.theme}」との関係が深いことから、政府関連情報の有効な活用方法についてお話しいたしたくご連絡しました。${c.trigger?`

直近では「${c.trigger}」も動いています。`:""}

${c.dept}で政府政策・予算・制度動向を担当されるご責任者、もしくは実務責任者の方に一度ご案内したいのですが、おつなぎいただけますでしょうか。

【連絡先メモ】
${contactMemo(c)}`;

  $("outConnected").value =
`お時間をいただきありがとうございます。日本みらい研の代表理事をしている髙松と申します。

最初に、お名前を確認させていただいてもよろしいでしょうか。

日本みらい研では、政府・省庁・国会などの政策情報を収集・整理する法人向けサービス「政策リサーチ」を10年以上運営しております。現在、大手企業だけでも約100社に継続的に利用いただいており、大手企業に限っても累計400社超のご利用実績があります。

${honorific(c.company)}では、「${c.theme}」が特に関係すると考えており、一般的なシステムの説明をするより、御社に関係する政府関連資料を2～3件お見せする方が早いと思い、ご連絡をさせていただきました。${c.trigger?`直近では「${c.trigger}」も動いています。`:""}

まずは、本日のお電話を踏まえて、政策リサーチの概要と関連する資料をメールでお送りします。資料をご覧いただいた後に、可能であれば15分程度、オンラインで説明の機会をいただければと思います。メール内容をご確認の上、ご検討の程、よろしくお願いします。

最後に、メールの送り先として、部署名・お名前とメールアドレスを教えていただけますでしょうか。`;

  const subject=c.salesGroup==="過去有料利用" ?
    `【政策リサーチ】以前のご利用御礼と、${c.theme}に関する最新政策のご案内` :
    c.salesGroup==="トライアルのみ" ?
    `【政策リサーチ】以前のトライアル御礼と、${c.theme}に関するご案内` :
    `【先ほどのお電話の件】${c.company}様の${c.theme}に関する政策資料のご案内`;

  $("outEmailFollow").value =
`【電話後に送るメール】

件名：${subject}

${c.contactPerson ? c.contactPerson+"様" : "ご担当者様"}

先ほどはお電話でお時間をいただき、ありがとうございました。
${notes}

御社の「${c.theme}」に関係する政府会議・予算・制度などに関して簡単にまとめた資料を添付にてお送りします。こちらは、政策リサーチ上で確認できる資料をベースに作成したものです。政策リサーチのサービス内容は、以下のURLをご参照ください。

https://report.rifj.jp/pr/

その上で、可能であれば15分程度のオンラインでの説明の機会をいただければと思います。

ご都合のよい日時がございましたら、ご連絡いただければ幸いです。日時はできれば2、3候補を挙げていただければ幸いです。お手数をおかけしますが、よろしくお願いします。

${SIGNATURE}

────────────────────────
【返信・反応がない場合：2～3営業日後の再フォロー電話】

「先日お電話でお話しし、${c.theme}に関する資料をお送りした日本みらい研の髙松です。資料はご覧いただけましたでしょうか。お電話でお話ししたように、可能であれば15分程度、オンラインでご説明できればと思っています。ご都合のよい日時を2、3候補いただければ、その中で調整いたします。」`;

  $("outScheduleReply").value =
`件名：Re: 【政策リサーチ】オンライン説明の日程について

${c.contactPerson ? c.contactPerson+"様" : "ご担当者様"}

ご返信ありがとうございます。

${c.proposedTimes ? `ご提示いただいた候補日時（${c.proposedTimes}）の中から、` : "ご提示いただいた候補日時の中から、"}${c.confirmedTime ? `「${c.confirmedTime}」でお願いできればと思います。` : "【確定日時を入力してください】でお願いできればと思います。"}

当日は15分程度、オンラインでご説明させていただきます。

Zoom URL：
https://us06web.zoom.us/j/81782664122?pwd=YXRmUnBjdEZPbGpST2pPSmFrakI2dz09

それでは、当日はどうぞよろしくお願いいたします。

${SIGNATURE}`;

  $("outMeeting").value =
`【0:00–1:30｜実績・位置づけ】
「本日はありがとうございます。政策リサーチは10年以上運営しており、現在、大手企業だけでも約100社に継続的に利用いただいており、大手企業に限っても累計400社超のご利用実績があります。政策リサーチでは、このような企業の皆様が、政府関連情報を探したり分析をする際にご活用いただいております。」

【1:30–3:00｜先日のお電話内容を確認】
「先日のお電話では、${c.callNotes||"御社で現在追っておられる政策テーマや情報収集の状況"}についてお話を伺いました。今日は、その点に関係する政策情報を実際の資料でご覧いただきます。」

【3:00–5:00｜なぜ御社に関係するのか】
「御社では『${c.theme}』が特に関係すると考えています。政策は、発表された後に知るのではなく、審議会や予算要求、制度設計の段階から把握できると、事業計画や投資判断、規制対応の準備を早く始めることができます。」

【5:00–9:00｜御社に関係する“今動いている政策”を実資料で確認】
「ここからは、御社に直接関係する資料を3つの視点で見てみます。
1つ目は『何を政府が課題と認識しているか』。
2つ目は『どの省庁・会議で同じ方向の議論が進んでいるか』。
3つ目は『予算・制度として実際に何が動き始めているか』です。」

${c.demo ? `まず「${c.demo}」という流れで、複数省庁・会議体・予算・制度を横断して確認します。` : "複数省庁・会議体・予算・制度を同じテーマで横断して確認します。"}

「ポイントは、1件の資料を読むことではなく、バラバラに出てくる政策情報をつなげて『政府がどちらへ動いているのか』を早い段階で掴むことです。」

【9:00–11:30｜“御社にとって何が変わるか”まで落とし込む】
「この動きが進んだ場合、御社では、①新しい事業機会、②規制や対応負担、③予算・補助制度、④競合や取引先への影響のうち、どこが一番大きそうでしょうか。」

「政策リサーチでは、資料を探して終わりではなく、この政策変化が自社に何を意味するのかを考える材料まで短時間で揃えることを目的にしています。」

※ 相手の回答に応じて、その場で関連資料・当日解説・政策レポートを見せる。

【11:30–13:00｜社内で“使える情報”にする】
「政策情報は、担当者が見つけても、経営や事業部門へ共有できなければ活用されません。政策リサーチでは、原資料、要点、解説を一緒に確認できるため、経営企画、事業部門、法務・規制対応、研究開発などへ共有する際の下準備を短縮できます。」

【13:00–14:15｜10日間で御社自身に検証していただく】
「ここまでの説明だけで判断いただく必要はありません。御社で本当に追いたいテーマを3～5件だけ決めていただき、10日間、実際の政策情報でお試しください。

確認いただきたいのは、
①必要な情報を早く拾えるか
②調査・整理時間を減らせるか
③社内の判断材料として使えるか
の3点です。」

【14:15–15:00｜次の一歩を具体化】
「もし御社で試すとすれば、最初に追うべきテーマは何がよいでしょうか。今日ご覧いただいた『${c.theme}』を含め、3～5件を一緒に決めて、10日間の無料トライアルから確認していただくのが一番分かりやすいと思います。いかがでしょうか。」`;

  $("outTrial").value =
`御社の関心テーマを3～5件に絞り、10日間無料で実際にお使いいただくのが一番分かりやすいと思います。

候補は「${c.theme}」です。

確認いただくのは、
1. 必要な政策情報を見落とさず拾えるか
2. 情報収集・整理の時間が減るか
3. 社内共有に使いやすいか
の3点です。

検索、閲覧、当日解説、アラート、週2回の政策レポートなど、通常サービスをそのままご確認いただけます。`;

  $("outClosing").value =
`10日間のご利用を踏まえ、御社では「${c.theme}」の情報収集と社内共有に活用余地があると考えています。

正式導入をご検討いただく場合、次の4点を確認させてください。
1. 最初に利用する部署
2. 必要なID数
3. 導入希望時期
4. 社内の決裁フロー

保留の場合は、価格を急いで調整するのではなく、次に検討しやすい予算時期または政策イベントを決め、その時点で改めてご連絡します。`;


  $("outUsage").value =
`【電話】
いつも政策リサーチをご利用いただきありがとうございます。日本みらい研の髙松です。

${c.usageStatus ? `現在は「${c.usageStatus}」というご利用状況と伺っています。` : "現在のご利用状況を確認し、より活用いただける余地があるのではと思いご連絡しました。"}

御社で重点的に追っている「${c.theme}」に合わせて、検索だけでなく、当日解説、週2回の政策レポート、アラートなどを組み合わせると、さらに効率よくご利用いただけます。

${c.trigger ? `ちょうど「${c.trigger}」も動いていますので、` : ""}御社の実際のテーマを使って15分ほど活用方法を整理してご案内できます。

【メール】
件名：【政策リサーチ】ご利用状況の確認と活用方法のご案内

いつも政策リサーチをご利用いただき、ありがとうございます。

${c.usageStatus ? `現在のご利用状況として「${c.usageStatus}」と伺っております。` : "現在のご利用状況を踏まえ、より効率的にご活用いただける方法をご案内したくご連絡しました。"}

特に「${c.theme}」については、検索に加えて当日解説、政策レポート、アラートを組み合わせることで、情報収集から社内共有までの負担を減らせます。

${c.trigger ? `直近の「${c.trigger}」も含め、` : ""}御社向けに15分程度で具体的な使い方をご説明できます。必要であれば、現在の業務に合わせて設定も一緒に確認いたします。

${SIGNATURE}`;

  $("outThemeAdd").value =
`【電話】
いつも政策リサーチをご利用いただきありがとうございます。

現在追っていただいている「${c.theme}」に加えて、${c.additionalTheme ? `「${c.additionalTheme}」` : "新たな関連テーマ"}も御社事業との関係が深くなっていると考えています。

${c.trigger ? `直近では「${c.trigger}」も動いており、` : ""}既存テーマと新しいテーマを一緒に追うことで、政策のつながりが見えやすくなります。

まず関連資料を2～3件だけお見せし、追加監視する価値があるかご確認いただければと思います。

【メール】
件名：【政策リサーチ】追加でご覧いただきたい${c.additionalTheme ? `「${c.additionalTheme}」` : "政策テーマ"}について

いつも政策リサーチをご利用いただき、ありがとうございます。

現在ご利用いただいている「${c.theme}」に関連して、${c.additionalTheme ? `「${c.additionalTheme}」` : "新しい政策テーマ"}でも御社事業に関係する動きが増えています。

${c.trigger ? `特に「${c.trigger}」は関連性が高く、` : ""}政策リサーチ上で既存テーマと横断して追うことで、政策の背景や今後の方向性を把握しやすくなります。

まず2～3件の資料をご覧いただき、継続的に監視するテーマとして追加する価値があるか、一緒に確認できればと思います。

${SIGNATURE}`;

  $("outDeptExpand").value =
`【電話】
いつも政策リサーチをご利用いただきありがとうございます。

現在${c.currentDept ? `「${c.currentDept}」` : "現在のご利用部署"}でお使いいただいていますが、「${c.theme}」は${c.targetDept ? `「${c.targetDept}」` : "他の関連部署"}にも関係が深いと考えています。

新しいサービスを別途導入するというより、すでに御社で使っている政策情報基盤を社内で共有する形です。

${c.targetDept ? `「${c.targetDept}」` : "候補部署"}向けに、その部署に関係する実際の政策資料を2～3件だけ使い、10分程度でご説明できます。まず現在のご担当者様からご紹介いただく形がよいと思います。

【メール】
件名：【政策リサーチ】${c.targetDept ? `「${c.targetDept}」` : "他部署"}での活用について

いつも政策リサーチをご利用いただき、ありがとうございます。

現在${c.currentDept ? `「${c.currentDept}」` : "現在のご利用部署"}でご利用いただいている政策リサーチについて、「${c.theme}」は${c.targetDept ? `「${c.targetDept}」` : "他の関連部署"}でも活用余地があると考えています。

新たな情報サービスを追加するのではなく、既に御社で利用している政策情報基盤を、必要な部署へ広げる考え方です。

候補部署に関係する政策資料を2～3件だけ使い、10分程度でご説明できます。もし適切なご担当者様がいらっしゃれば、ご紹介いただけますと幸いです。

${SIGNATURE}`;


  if(isUserStage){
    const st = c.salesGroup==="現在利用" ? "現在利用中" : c.salesGroup==="過去有料利用" ? "利用後退会" : c.salesGroup==="トライアルのみ" ? "トライアルのみ" : "完全新規";
    if(st==="現在利用中"){
      $("outConnected").value=`いつも政策リサーチをご利用いただきありがとうございます。現在のご利用状況と、最近重点的に追っておられる政策テーマを確認したくご連絡しました。\n\n「${c.theme}」に関連する最新動向も踏まえ、利用促進、テーマ追加、他部署展開のうち、御社で有効な使い方を15分ほどで整理してご案内できます。`;
      $("outEmailFollow").value=`件名：【政策リサーチ】ご利用状況と「${c.theme}」の最新政策について\n\nいつも政策リサーチをご利用いただき、ありがとうございます。\n\n現在のご利用状況を踏まえ、より活用いただける方法をご案内したくご連絡しました。特に「${c.theme}」については、当日解説、政策レポート、アラート等を組み合わせることで、情報収集から社内共有まで効率化できます。\n\n15分ほど、現在のご利用状況を伺いながら、利用促進・テーマ追加・他部署展開の可能性を整理してご案内できます。\n\n${SIGNATURE}`;
    }else if(st==="利用後退会"){
      $("outConnected").value=`以前、政策リサーチをご利用いただきありがとうございました。その後、当日解説、AI解析、週2回の政策レポート等を拡充しています。\n\n御社に関係する「${c.theme}」でも新しい政策動向が続いており、以前のご利用時点との違いを15分ほどでご説明できます。`;
      $("outEmailFollow").value=`件名：【政策リサーチ】以前のご利用御礼と「${c.theme}」の最新動向\n\n以前、政策リサーチをご利用いただき、ありがとうございました。\n\nその後、サービス内容を拡充しており、現在は当日解説、AI解析、週2回の政策レポート等もご利用いただけます。\n\n御社に関係する「${c.theme}」の最新政策を使って、以前との違いを15分程度でご説明できます。\n\n${SIGNATURE}`;
    }else if(st==="トライアルのみ"){
      $("outConnected").value=`以前、政策リサーチをお試しいただきありがとうございました。現在は当時から機能・解説コンテンツを拡充しています。\n\n「${c.theme}」の直近政策を使って、現在のサービスを15分ほどで改めてご覧いただけます。`;
      $("outEmailFollow").value=`件名：【政策リサーチ】以前のトライアル御礼と「${c.theme}」の最新動向\n\n以前、政策リサーチをお試しいただき、ありがとうございました。\n\n現在は当日解説、AI解析、政策レポート等を拡充しています。「${c.theme}」の最近の政策動向を使って、現在のサービスを15分程度で改めてご説明できます。\n\n${SIGNATURE}`;
    }else{
      $("outConnected").value=`【注意】この企業は完全新規のため、「利用者」接触段階は通常適しません。初回電話または電話後メールをご利用ください。`;
      $("outEmailFollow").value=`【注意】この企業は完全新規です。「利用者」向け文面ではなく、新規営業文面を使用してください。`;
    }
  }

  render(c);
}

function usageHistorySummary(preset){
  if(!preset || !preset.company) return "利用履歴はありません。";
  if(preset.membership_state==="現在利用中"){
    return `会員名簿では現在利用中です。登録日 ${preset.membership_start_date||"不明"} からの利用履歴があり、現在プランは「${preset.membership_current_plan||"不明"}」です。新規営業ではなく、利用促進・テーマ追加・他部署展開を優先します。`;
  }
  if(preset.membership_state==="退会・現在未利用"){
    const kind=preset.membership_paid_history ? "過去に有料利用" : (preset.membership_trial_history ? "過去にトライアル利用" : "過去に利用");
    return `会員名簿では現在は利用していません。${kind}の履歴があり、初回登録日は ${preset.membership_start_date||"不明"} です。再アプローチでは、当時との機能差分と現在の政策テーマを軸に提案します。`;
  }
  const st=usageStatus(preset);
  if(st==="現在利用中") return "現在、政策リサーチをご利用中です。新規営業ではなく、利用促進・テーマ追加・他部署展開の対象です。";
  if(st==="利用後退会") return "過去に政策リサーチを有料利用した履歴があります。再アプローチでは、当時との機能差分と現在の政策テーマを軸に提案します。";
  if(st==="トライアルのみ") return "過去に政策リサーチのトライアル利用履歴があります。現在の機能拡充と新しい政策テーマを軸に再提案します。";
  return "政策リサーチの利用履歴は確認されていません。完全新規の営業対象です。";
}
function renderSelectedCompanySidePanel(c){
  const preset=c && c.preset ? c.preset : companyByName(c && c.company ? c.company : "") || null;
  const name=(c && c.company) || (preset && preset.company) || "企業を選択してください";
  const rank=(preset && preset.priority_rank) || "B";
  const usage=preset ? usageStatus(preset) : "—";
  const auto=preset ? progressAuto(preset.company) : {status:"未記録"};

  $("selectedCompanyName").textContent=name;
  $("selectedCompanyRank").textContent=preset ? `${rank}ランク` : "—";
  $("selectedCompanyRank").className=`company-badge rank-badge rank-${rank.toLowerCase()}`;
  $("selectedCompanyUsage").textContent=usage;
  $("selectedCompanyIndustry").textContent=(preset && preset.industry) || (c && c.industry) || "—";
  $("selectedCompanyTags").textContent=preset ? companyTags(preset).join("・") : "—";
  $("selectedCompanyProgress").textContent=auto.status || "未記録";
  $("selectedCompanyPhone").textContent=(preset && preset.contact) || "未登録・要確認";
  $("selectedCompanyDept").textContent=(preset && (preset.contact_department_verified||preset.dept1)) || "要確認";
  $("selectedCompanyPerson").textContent=preset
    ? ([preset.person,preset.role].filter(Boolean).join(" ／ ") || "公開担当者名は未確認")
    : "—";
  $("selectedCompanyContactCheck").textContent=preset
    ? ([preset.contact_level,preset.contact_checked_date ? `確認日 ${preset.contact_checked_date}` : ""].filter(Boolean).join(" ／ ") || "要確認")
    : "—";
  $("selectedCompanyRecheck").textContent=preset
    ? ([preset.contact_recheck_status,preset.contact_recheck_date].filter(Boolean).join(" ／ ") || "未実施")
    : "—";
  $("selectedCompanyResearch").textContent=preset
    ? `${preset.company_research||"企業詳細は既存マスタ情報を参照してください。"}\n\n営業観点：${preset.priority_reason||"—"}\n情報源：${preset.company_research_source||preset.contact_url||preset.official_url||"—"}`
    : "—";
  $("selectedCompanyHistory").textContent=preset ? usageHistorySummary(preset) : "企業を選択すると、利用履歴を表示します。";
  $("selectedMembershipStart").textContent=(preset && preset.membership_start_date) || "—";
  $("selectedMembershipState").textContent=(preset && preset.membership_state) || "—";
  $("selectedMembershipPlan").textContent=(preset && preset.membership_current_plan) || "—";
  $("selectedMembershipRows").textContent=preset && preset.membership_rows
    ? `有効 ${preset.membership_valid_rows||0} / 無効 ${preset.membership_invalid_rows||0}`
    : "—";
  $("selectedMembershipBasis").textContent=(preset && preset.membership_basis)
    ? `${preset.membership_basis}。登録日を利用開始日として判定。`
    : "会員名簿の一致データはありません。";

  const history=(preset && preset.membership_plan_history)
    ? `会員名簿プラン履歴：${preset.membership_plan_history}${preset.membership_related_history ? "\n関連・旧名履歴：\n"+preset.membership_related_history : ""}`
    : ((preset && preset.plan_history) ? preset.plan_history : "");
  const merged=(preset && preset.legacy_history_source) ? `\n旧登録名・部門：${preset.legacy_history_source}` : "";
  $("selectedCompanyPlanHistory").textContent=history ? `${history}${merged}` : (merged.trim() || "具体的な過去プラン・登録履歴は未登録です。");

  $("selectedCompanyRankReason").textContent=(preset && preset.priority_reason) || "—";
}


function resetSelectedCompanySidePanel(){
  $("selectedCompanyName").textContent="企業を選択してください";
  $("selectedCompanyRank").textContent="—";
  $("selectedCompanyRank").className="company-badge rank-badge";
  $("selectedCompanyUsage").textContent="—";
  $("selectedCompanyIndustry").textContent="—";
  $("selectedCompanyTags").textContent="—";
  $("selectedCompanyProgress").textContent="—";
  $("selectedCompanyPhone").textContent="—";
  $("selectedCompanyDept").textContent="—";
  $("selectedCompanyPerson").textContent="—";
  $("selectedCompanyContactCheck").textContent="—";
  $("selectedCompanyRecheck").textContent="—";
  $("selectedCompanyResearch").textContent="—";
  $("selectedCompanyHistory").textContent="企業を選択すると、利用履歴を表示します。";
  $("selectedMembershipStart").textContent="—";
  $("selectedMembershipState").textContent="—";
  $("selectedMembershipPlan").textContent="—";
  $("selectedMembershipRows").textContent="—";
  $("selectedMembershipBasis").textContent="—";
  $("selectedCompanyPlanHistory").textContent="—";
  $("selectedCompanyRankReason").textContent="—";
}
function render(c){
 renderSelectedCompanySidePanel(c);
 const auto=companyByName(c.company)?progressAuto(c.company):{status:"未記録",incomplete:""};
 const tags=[`優先ランク：${c.preset?.priority_rank||"B"}`,`企業：${c.company}`,`営業区分：${c.salesGroup}`,`営業可否：${c.salesAllowed}`,`選択分野：${c.industry}`,`検索分野：${companyTags(c.preset).join("・")}`,`部署：${c.dept}`,`進捗：${auto.status}`];
 if(auto.incomplete) tags.push(`未了：${auto.incomplete}`);
 $("summaryTags").innerHTML=tags.map(t=>`<span class="tag">${t}</span>`).join("");
 $("contactDisplay").value=c.contact||"未登録／要確認";
 $("contactTypeDisplay").value=[c.contactType,c.contactLevel].filter(Boolean).join("／")||"未確認";
 $("routeDisplay").value=c.route||"公式サイト／代表窓口を確認";
 $("officialUrlDisplay").value=c.officialUrl||"";
 $("sourceUrlDisplay").value=c.contactUrl||"";
 $("historyDisplay").value=c.planHistory||"";

 $("statusNotice").textContent = c.salesGroup==="現在利用"
  ? "現在利用中：新規営業対象外。利用促進・テーマ追加・他部署展開の提案として扱ってください。"
  : c.salesGroup==="過去有料利用"
  ? "過去有料利用：完全新規ではなく、以前の利用実績を踏まえた再アプローチ文を生成します。"
  : c.salesGroup==="トライアルのみ"
  ? "過去トライアル：以前試した経緯を踏まえ、現在の機能拡充と新しい政策テーマから再提案します。"
  : "完全新規：電話で一次接触し、会話内容を反映したメールを同日送付する基本フローです。";
}

function outputSections(){
  const ids=[
    ["代表受付・ファーストコンタクト","outReception"],
    ["担当者との電話トーク","outConnected"],
    ["電話後メール＋必要時の再フォロー","outEmailFollow"],
    ["日時指定の返信メール","outScheduleReply"],
    ["15分商談トークライン","outMeeting"],
    ["10日間無料トライアル提案","outTrial"],
    ["クロージング","outClosing"],
    ["既存顧客：利用促進","outUsage"],
    ["既存顧客：テーマ追加","outThemeAdd"],
    ["既存顧客：他部署展開","outDeptExpand"]
  ];
  return ids.map(([title,id])=>({title,text:$(id).value||""}));
}

function fullOutputText(){
  const c=ctx();
  const head=`政策リサーチ 営業アプローチ文面\n企業：${c.company}\n営業区分：${c.salesGroup}\n業種：${c.industry}\n\n`;
  return head + contactResearchSummary(c) + "\n\n" + outputSections().map(s=>`■ ${s.title}\n${s.text}`).join("\n\n");
}

function saveBlob(blob, filename){
  const a=document.createElement("a");
  const url=URL.createObjectURL(blob);
  a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),500);
}

function xmlEscape(s){
  return (s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}

// Minimal ZIP writer (STORE/no compression) used to create a true .docx file offline.
function crc32(bytes){
  let table=crc32.table;
  if(!table){
    table=[];
    for(let n=0;n<256;n++){
      let c=n;
      for(let k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);
      table[n]=c>>>0;
    }
    crc32.table=table;
  }
  let crc=0^(-1);
  for(let i=0;i<bytes.length;i++) crc=(crc>>>8)^table[(crc^bytes[i])&0xFF];
  return (crc^(-1))>>>0;
}
function u16(n){ return new Uint8Array([n&255,(n>>>8)&255]); }
function u32(n){ return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]); }
function concatArrays(arrays){
  const len=arrays.reduce((a,b)=>a+b.length,0), out=new Uint8Array(len);
  let p=0; arrays.forEach(a=>{out.set(a,p);p+=a.length;}); return out;
}
function makeZip(files){
  const enc=new TextEncoder(), locals=[], centrals=[];
  let offset=0;
  for(const f of files){
    const name=enc.encode(f.name), data=(f.data instanceof Uint8Array)?f.data:enc.encode(f.data), crc=crc32(data);
    const local=concatArrays([
      u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),
      u16(name.length),u16(0),name,data
    ]);
    locals.push(local);
    const central=concatArrays([
      u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),
      u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name
    ]);
    centrals.push(central); offset+=local.length;
  }
  const centralData=concatArrays(centrals);
  const end=concatArrays([
    u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),
    u32(centralData.length),u32(offset),u16(0)
  ]);
  return concatArrays([...locals,centralData,end]);
}

function downloadDocx(){
  if(APP_MODE!=="single"){ alert("1社モードで使用してください。"); return; }
  const c=ctx();
  const sections=outputSections();
  const paras=[];
  paras.push({text:"政策リサーチ 営業アプローチ文面",bold:true,size:32});
  paras.push({text:`企業：${c.company}`});
  paras.push({text:`営業区分：${c.salesGroup}`});
  paras.push({text:`業種：${c.industry}`});
  paras.push({text:""});
  paras.push({text:"営業連絡先",bold:true,size:26});
  for(const line of contactResearchSummary(c).split(/\n/)) paras.push({text:line});
  paras.push({text:""});
  for(const s of sections){
    paras.push({text:s.title,bold:true,size:26});
    for(const line of s.text.split(/\n/)) paras.push({text:line});
    paras.push({text:""});
  }
  const body=paras.map(p=>{
    const rpr=(p.bold||p.size)?`<w:rPr>${p.bold?'<w:b/>':''}${p.size?`<w:sz w:val="${p.size}"/><w:szCs w:val="${p.size}"/>`:''}<w:rFonts w:eastAsia="Yu Gothic" w:ascii="Arial"/></w:rPr>`:'<w:rPr><w:rFonts w:eastAsia="Yu Gothic" w:ascii="Arial"/></w:rPr>';
    return `<w:p><w:r>${rpr}<w:t xml:space="preserve">${xmlEscape(p.text)}</w:t></w:r></w:p>`;
  }).join("");
  const documentXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>
</w:body></w:document>`;
  const files=[
    {name:"[Content_Types].xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`},
    {name:"_rels/.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`},
    {name:"word/document.xml",data:documentXml}
  ];
  const zip=makeZip(files);
  saveBlob(new Blob([zip],{type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}),`政策リサーチ_営業文面_${c.company}.docx`);
}

function printPdf(){
  if(APP_MODE!=="single"){ alert("1社モードで使用してください。"); return; }
  const c=ctx(), sections=outputSections();
  const win=window.open("","_blank");
  if(!win){ alert("ポップアップがブロックされています。ブラウザでポップアップを許可してください。"); return; }
  const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>政策リサーチ 営業文面 ${xmlEscape(c.company)}</title>
  <style>
  @page{size:A4;margin:18mm} body{font-family:"Yu Gothic","Hiragino Kaku Gothic ProN",Meiryo,sans-serif;color:#222;line-height:1.65;font-size:10.5pt}
  h1{font-size:18pt;color:#17365D;border-bottom:2px solid #17365D;padding-bottom:6px}
  h2{font-size:13pt;color:#17365D;margin-top:20px;border-left:4px solid #245B89;padding-left:8px}
  .meta{background:#eef5fb;padding:10px 12px;border:1px solid #d8e2ec}
  pre{white-space:pre-wrap;font-family:inherit;margin:6px 0 16px}
  </style></head><body>
  <h1>政策リサーチ 営業アプローチ文面</h1>
  <div class="meta">企業：${xmlEscape(c.company)}<br>営業区分：${xmlEscape(c.salesGroup)}<br>業種：${xmlEscape(c.industry)}</div>
  <h2>営業連絡先</h2><pre>${xmlEscape(contactResearchSummary(c))}</pre>
  ${sections.map(s=>`<h2>${xmlEscape(s.title)}</h2><pre>${xmlEscape(s.text)}</pre>`).join("")}
  <script>window.onload=()=>setTimeout(()=>window.print(),250);<\/script>
  </body></html>`;
  win.document.open(); win.document.write(html); win.document.close();
}

function csvEscape(v){
  const s=(v??"").toString().replace(/"/g,'""');
  return `"${s}"`;
}
const COMPANY_EXPORT_FIELDS=[
  ["会員名簿判定","membership_state"],["利用開始日（登録日）","membership_start_date"],["現在プラン","membership_current_plan"],
  ["会員名簿プラン履歴","membership_plan_history"],["有効件数","membership_valid_rows"],["無効件数","membership_invalid_rows"],["判定根拠","membership_basis"],
  ["営業優先ランク","priority_rank"],["営業優先スコア","priority_score"],["ランク理由","priority_reason"],
  ["上場・企業区分","listing_status"],["証券コード","ticker"],["名簿区分","master_segment"],["情報源URL","research_source"],
  ["企業名","company"],["営業区分","sales_group"],["営業可否","sales_allowed"],["主業種・戦略分野","industry"],
  ["検索用分野タグ","search_tags"],
  ["副テーマ","secondary"],["第1営業先部署","dept1"],["第2営業先部署","dept2"],["公開キーパーソン","person"],
  ["公開役職・接点","role"],["公開連絡先","contact"],["連絡先種別","contact_type"],["連絡先確認","contact_level"],
  ["企業公式URL","official_url"],["連絡先・根拠URL","contact_url"],["推奨初回接触ルート","route"],
  ["確認済み担当部署／推奨営業先","contact_department_verified"],["連絡先調査日","contact_checked_date"],
  ["公式再確認日","contact_recheck_date"],["公式再確認状況","contact_recheck_status"],
  ["公式再確認対象","contact_recheck_scope"],["公式再確認情報源","contact_recheck_source"],
  ["企業詳細調査","company_research"],["企業詳細情報源","company_research_source"],
  ["最初に刺すテーマ","sales_theme"],["直近政策トリガー","policy_trigger"],["15分デモ内容","demo"],
  ["過去プラン・履歴","plan_history"],["販売チャネル","sales_channel"]
];
function companyToCsvRows(list){
  const pHeaders=["初回アプローチ日","最終返信日","オンライン会議日","申込完了日","拒否日","営業メモ・履歴","営業進捗","未了判定","経過日数"];
  const header=[...COMPANY_EXPORT_FIELDS.map(x=>x[0]),...pHeaders];
  const rows=list.map(c=>{
    const p=getProgress(c.company), a=progressAuto(c.company);
    return [...COMPANY_EXPORT_FIELDS.map(x=>Array.isArray(c[x[1]])?c[x[1]].join("｜"):(c[x[1]]??"")),p.approach_date,p.reply_date,p.meeting_date,p.applied_date,p.rejected_date,p.note||"",a.status,a.incomplete,a.elapsed];
  });
  return [header,...rows].map(r=>r.map(csvEscape).join(",")).join("\r\n");
}
function exportSelectedCsv(){
  if(APP_MODE!=="single"){ alert("1社モードで使用してください。"); return; }
  const c=companyByName($("companyInput").value);
  if(!c){ alert("登録企業を1社選択してください。"); return; }
  const csv="\ufeff"+companyToCsvRows([c]);
  saveBlob(new Blob([csv],{type:"text/csv;charset=utf-8"}),`政策リサーチ_企業データ_${c.company}.csv`);
}
function exportAllCsv(){
  const csv="\ufeff"+companyToCsvRows(COMPANY_DATA);
  saveBlob(new Blob([csv],{type:"text/csv;charset=utf-8"}),`政策リサーチ_企業マスタ_${COMPANY_DATA.length}社.csv`);
}
function exportAllJson(){
  const merged=COMPANY_DATA.map(c=>({...c,progress:getProgress(c.company),auto_progress:progressAuto(c.company)}));
  saveBlob(new Blob([JSON.stringify(merged,null,2)],{type:"application/json;charset=utf-8"}),`政策リサーチ_企業マスタ_${COMPANY_DATA.length}社.json`);
}

function clearCompanySelection(){
  resetSelectedCompanySidePanel();
  if($("companyAllSelect")) $("companyAllSelect").value="";
  if($("companySearchResults")) $("companySearchResults").value="";
  if($("companySearchText")) $("companySearchText").value="";

  if(APP_MODE!=="single") setAppMode("single");
  $("companyInput").value="";
  $("companyCustom").value="";
  ["dept","person","role","theme","trigger","demo","contactPerson","callNotes","proposedTimes","confirmedTime","usageStatus","additionalTheme","currentDept","targetDept"].forEach(id=>$(id).value="");
  $("contactDisplay").value="";
  $("contactTypeDisplay").value="";
  $("routeDisplay").value="";
  $("officialUrlDisplay").value="";
  $("sourceUrlDisplay").value="";
  $("historyDisplay").value="";
  ["progressApproachDate","progressReplyDate","progressMeetingDate","progressAppliedDate","progressRejectedDate"].forEach(id=>$(id).value="");
  $("progressNote").value="";
  renderCurrentProgressStatus();
  $("statusNotice").textContent="企業選択をクリアしました。新しい企業名を入力してください。";
  $("summaryTags").innerHTML="";
  document.querySelectorAll(".results textarea").forEach(el=>el.value="");
  renderCompanyDropdown();
  $("companyInput").focus();
}

function downloadAll(){
  if(APP_MODE!=="single"){ alert("1社モードで使用してください。"); return; }
  const c=ctx();
  const text=fullOutputText();
  saveBlob(new Blob([text],{type:"text/plain;charset=utf-8"}),`政策リサーチ_営業文面_${c.company}.txt`);
}
function resetForm(){
  setAppMode("single");
 ["companyInput","companyCustom","person","role","contactPerson","trigger","callNotes","proposedTimes","confirmedTime","extra","usageStatus","additionalTheme","currentDept","targetDept"].forEach(id=>$(id).value="");
 $("industry").selectedIndex=0; $("stage").selectedIndex=0;
 $("dept").value=""; $("theme").value=""; $("demo").value=""; applyIndustry(); generate();
}
document.addEventListener("DOMContentLoaded",init);

window.addEventListener("beforeunload",()=>{
  try{ localStorage.setItem(PROGRESS_STORAGE_KEY,JSON.stringify(PROGRESS_CACHE||{})); }catch(e){}
});

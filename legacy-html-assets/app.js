import {prepareArticlePreviewHtml,normalizeArticleFooter,publicationDateClass} from './article-preview-interactions.js?v=v1_10_3';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import {getAuth,signInWithEmailAndPassword,onAuthStateChanged,signOut,setPersistence,browserLocalPersistence,getIdTokenResult} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import {doc, getFirestore, onSnapshot} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';

const $ = id => document.getElementById(id);
const adminMode=document.body.dataset.mode==='admin';
const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
const firestore=getFirestore(app);
const STATE_KEY='rifj-firebase-html-state-'+(adminMode?'admin':'viewer');
const state=(()=>{try{return {...{query:'',kind:'',sort:'date',scope:'all',pageSize:'30',selected:''}, ...JSON.parse(localStorage.getItem(STATE_KEY)||'{}')}}catch{return {query:'',kind:'',sort:'date',scope:'all',pageSize:'30',selected:''}}})();
const saveState=()=>{localStorage.setItem(STATE_KEY,JSON.stringify(state))};
let loggedUser=null,role='viewer',activeId='',items=[],nextCursor='',lastMetadata=null,lastBody='',searchCounter=0,initial=true;
let adminSearchCache=[],adminSearchVisible=30;
let unwatchArticles=null, lastRevision=null, autoRefreshHandle=null;
let latestPendingChange=null;
let viewerAutoSyncBusy=false;
function stopViewerAutoSync(){
  if(unwatchArticles){unwatchArticles();unwatchArticles=null}
  if(autoRefreshHandle){clearTimeout(autoRefreshHandle);autoRefreshHandle=null}
  lastRevision=null;latestPendingChange=null;viewerAutoSyncBusy=false;
}
// A single, metadata-only Firestore document is watched. Full article HTML
// and the search index remain private and are fetched via authenticated API.
function startViewerAutoSync(){
  if(adminMode||unwatchArticles||!loggedUser)return;
  const label=$('realtimeState');
  if(label)label.textContent='自動更新を接続中…';
  unwatchArticles=onSnapshot(doc(firestore,'system','article_revision'), snapshot=>{
    if(snapshot.metadata.fromCache)return; // Avoid treating stale offline cache as a new revision.
    if(label)label.textContent='自動更新中';
    const event=snapshot.exists()?snapshot.data():null;
    if(!event?.revision)return;
    if(event.revision===lastRevision)return;
    lastRevision=event.revision;
    latestPendingChange={article_id:event.article_id||'',action:event.action||'upsert'};
    if(autoRefreshHandle)clearTimeout(autoRefreshHandle);
    // Debounce rapid consecutive edits; keep current filters and open article.
    autoRefreshHandle=setTimeout(async()=>{
      autoRefreshHandle=null;
      if(!loggedUser||adminMode)return;
      if(viewerAutoSyncBusy){
        // A previous refresh is still running; retry after it finishes.
        scheduleViewerAutoSync();return;
      }
      viewerAutoSyncBusy=true;
      try{
        const change=latestPendingChange;
        latestPendingChange=null;
        await loadList(true,{background:true,change});
        if(label)label.textContent='自動更新中';
      }finally{
        viewerAutoSyncBusy=false;
        if(latestPendingChange)scheduleViewerAutoSync();
      }
    },450);
  },error=>{
    if(label)label.textContent='自動更新を確認できません';
    console.warn('Article revision listener failed',error);
    setStatus('自動更新の接続に失敗しました。画面の再読込または再ログインをお試しください。',true);
  });
}
function scheduleViewerAutoSync(){
  if(autoRefreshHandle)clearTimeout(autoRefreshHandle);
  autoRefreshHandle=setTimeout(()=>{
    autoRefreshHandle=null;
    if(viewerAutoSyncBusy){scheduleViewerAutoSync();return}
    viewerAutoSyncBusy=true;
    const change=latestPendingChange;
    latestPendingChange=null;
    loadList(true,{background:true,change}).finally(()=>{
      viewerAutoSyncBusy=false;
      if(latestPendingChange)scheduleViewerAutoSync();
    });
  },600);
}

for(const field of ['query','kind','sort','scope','pageSize']) if($(field))$(field).value=state[field]|| (field==='sort'?'date':field==='scope'?'all':'');
const setStatus=(message,error=false)=>{if(!$('status'))return;$('status').textContent=message||'';$('status').style.color=error?'#992c37':'#607787'};
const doAPI=async (path,options={})=>{
  if(!auth.currentUser) throw new Error('ログインが必要です');
  const token=await auth.currentUser.getIdToken();
  const r=await fetch('https://html-viewer-703b6.web.app/api'+path,{...options,headers:{Authorization:'Bearer '+token,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
  if(options.raw){if(!r.ok){const x=await r.json().catch(()=>({}));throw new Error(x.error||'取得エラー '+r.status)}return r}
  const data=await r.json().catch(()=>({error:'サーバーから正常な応答がありません'}));
  if(!r.ok)throw new Error(data.error||'エラー '+r.status);
  return data;
};
function escapeHTML(text){return String(text??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}
function setBusy(flag){for(const name of ['importURL','importFile','searchButton','more','edit','remove','export']){const el=$(name);if(el)el.disabled=flag}}
function loginView(show){$('login').classList.toggle('hide',!show);$('workspace').classList.toggle('hide',show);$('logout').classList.toggle('hide',show)}
$('logout').onclick=()=>signOut(auth);
$('loginForm').addEventListener('submit',async event=>{
  event.preventDefault();$('loginStatus').textContent='認証中…';
  try{await setPersistence(auth,browserLocalPersistence);await signInWithEmailAndPassword(auth,$('email').value,$('password').value);$('loginStatus').textContent=''}
  catch(e){$('loginStatus').textContent='認証できませんでした。登録済みアカウントか確認してください。'}
});
onAuthStateChanged(auth,async user=>{
  if(!user){stopViewerAutoSync();loggedUser=null;loginView(true);$('who').textContent='';return}
  try{
    const info=await doAPI('/me');
    if(adminMode && info.role!=='admin'){
      loginView(true);$('loginStatus').textContent='このアカウントには管理者権限がありません。閲覧専用画面をご利用ください。';return;
    }
    loggedUser=user;role=info.role;$('who').textContent=info.email||'';
    loginView(false);if(initial){initial=false;await loadList(true)}
    if(!adminMode)startViewerAutoSync();
  }catch(e){loginView(true);$('loginStatus').textContent='認証情報を確認できません: '+e.message}
});
function syncFilters(){for(const f of ['query','kind','sort','scope','pageSize'])state[f]=$(f).value;saveState()}
async function loadList(reset=true,{background=false,change=null}={}){
  const seq=++searchCounter;
  syncFilters();const beginning=performance.now();if(reset){nextCursor='';items=[]}
  if(!background){setBusy(true);setStatus('検索中…')}
  try{
    const params=new URLSearchParams({kind:state.kind,sort:state.sort});
    if(state.query.trim()){params.set('q',state.query.trim());params.set('scope',state.scope)}
    else{params.set('size',state.pageSize||'30');if(nextCursor)params.set('cursor',nextCursor)}
    const result=await doAPI((state.query.trim()?'/search?':'/list?')+params.toString());
    if(seq!==searchCounter)return;
    if(state.query.trim()){
      adminSearchCache=result.items||[];
      if(reset)adminSearchVisible=Number(state.pageSize)||30;
      items=adminSearchCache.slice(0,adminSearchVisible);
      nextCursor='';
    }else{
      adminSearchCache=[];
      nextCursor=result.next_cursor||'';
      items=reset?result.items:[...items,...result.items];
    }
    renderItems();
    const n=result.total??items.length;
    const ms=Math.round(performance.now()-beginning);
    if(!background)setStatus(`${n}件${result.has_more && state.query?'（最大100件表示・絞り込み推奨）':''}／${ms}ms`);
    else setStatus(`最新の記事一覧に自動更新しました（${n}件）`);
    $('more')?.classList.toggle('hide',state.query.trim()?items.length>=adminSearchCache.length:!nextCursor);
    if(reset){
      if(background){
        // Preserve scroll and article selection for unrelated new/updated articles.
        if(change?.article_id===activeId && change?.action==='delete'){
          activeId='';state.selected='';saveState();lastMetadata=null;lastBody='';
          $('preview').srcdoc='';$('previewEmpty').classList.remove('hide');
          $('preview').classList.add('hide');$('export')?.classList.add('hide');
          if(items.length)await loadArticle(items[0].id);
        }else if(change?.article_id===activeId && change?.action==='upsert'){
          await loadArticle(activeId); // Refresh an article that is currently open and was edited.
        }else if(!activeId && items.length){
          await loadArticle(items[0].id);
        }else{
          renderItems(); // Keep the currently open article and its scroll position.
        }
      }else{
        const preferred=state.selected && items.find(x=>x.id===state.selected);
        if(!preferred){activeId='';state.selected='';saveState();lastMetadata=null;lastBody='';$('preview').srcdoc='';$('previewEmpty').classList.remove('hide');$('preview').classList.add('hide');for(const b of ['export','edit','remove'])$(b)?.classList.add('hide');}
        if(items.length)await loadArticle(preferred?preferred.id:items[0].id);
      }
    }
  }catch(e){setStatus((background?'自動更新失敗：':'')+e.message,true)}finally{if(!background)setBusy(false)}
}
function renderItems(){
  $('list').replaceChildren();$('total').textContent=items.length+'件表示';
  if(!items.length){const el=document.createElement('div');el.className='empty';el.textContent='該当する記事がありません。';$('list').append(el);return}
  for(const item of items){
    const b=document.createElement('button');b.className='article-item'+(item.id===activeId?' active':'');
    const title=document.createElement('div');title.className='article-title';title.textContent=item.sidebar_title||item.title||'無題';title.title=item.title;
    const meta=document.createElement('div');meta.className='article-meta';
    const date=document.createElement('time');date.textContent=item.published||'公開日不明';
    if(item.published)date.dateTime=item.published;
    const dateClass=publicationDateClass(item.published);
    if(dateClass)date.classList.add(dateClass);
    meta.append(date,document.createTextNode(' ・ '+({mofa:'外務省',mof:'財務省',mext:'文部科学省',meti:'経産省',kantei:'首相官邸',soumu:'総務省',env:'環境省',mhlw:'厚生労働省',maff:'農林水産省',mlit:'国土交通省',note:'note',ameblo:'アメブロ'}[item.kind]||item.kind)));
    b.append(title,meta);
    if(item.match_excerpt){const p=document.createElement('div');p.className='article-excerpt';p.textContent=item.match_excerpt;b.append(p)}
    b.onclick=()=>loadArticle(item.id);$('list').append(b);
  }
}
async function loadArticle(id){
  activeId=id;state.selected=id;saveState();renderItems();
  $('previewEmpty').classList.add('hide');$('preview').classList.remove('hide');
  $('preview').srcdoc='<p style="font:16px sans-serif;padding:35px;color:#607787">記事を読み込み中…</p>';
  for(const b of ['export','edit','remove'])$(b)?.classList.add('hide');
  try{
    const [r,doc]=await Promise.all([doAPI('/article/'+id),doAPI('/article/'+id+'/html',{raw:true})]);
    if(activeId!==id)return;
    lastMetadata=r.item;lastBody=normalizeArticleFooter(await doc.text());$('preview').srcdoc=prepareArticlePreviewHtml(lastBody,lastMetadata.title||'',lastMetadata.published||'');
    $('export').classList.remove('hide');
    if(adminMode){$('edit').classList.remove('hide');$('remove').classList.remove('hide')}
  }catch(e){setStatus('記事を表示できません: '+e.message,true);$('preview').srcdoc='';$('previewEmpty').classList.remove('hide')}
}
$('searchButton').onclick=()=>loadList(true);
$('query').addEventListener('keydown',e=>{if(e.key==='Enter')loadList(true)});
$('query').addEventListener('input',syncFilters);
for(const x of ['kind','scope','sort','pageSize'])$(x).addEventListener('change',()=>loadList(true));
$('clear').onclick=()=>{for(const f of ['query','kind'])$(f).value='';$('scope').value='all';$('sort').value='date';state.selected='';activeId='';loadList(true)};
$('more').onclick=()=>{
  if(state.query.trim()){
    adminSearchVisible+=(Number(state.pageSize)||30);
    items=adminSearchCache.slice(0,adminSearchVisible);
    renderItems();
    $('more')?.classList.toggle('hide',items.length>=adminSearchCache.length);
  }else loadList(false);
};
$('export').onclick=()=>{
  if(!lastBody||!lastMetadata)return;
  const blob=new Blob([lastBody],{type:'text/html;charset=utf-8'});
  const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=(lastMetadata.kind||'article')+'_'+lastMetadata.id+'.html';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500)
};
if(adminMode){
 $('clearURL').onclick=()=>{ $('url').value=''; $('url').focus(); };
 $('importURL').onclick=async()=>{
   const url=$('url').value.trim();if(!url){setStatus('記事URLを入力してください',true);return}
   setBusy(true);setStatus('元記事を取得・変換中…');
   try{const r=await doAPI('/import-url',{method:'POST',body:JSON.stringify({url})});setStatus('HTMLを保存しました');await loadList(true);await loadArticle(r.item.id)}
   catch(e){setStatus('変換失敗：'+e.message,true)}finally{setBusy(false)}
 };
 $('importFile').onclick=async()=>{
   const f=$('htmlFile').files?.[0],url=$('url').value.trim();if(!f||!url){setStatus('記事URLとHTMLファイルの両方を指定してください',true);return}
   if(f.size>8_000_000){setStatus('HTMLは8MB以下にしてください',true);return}
   setBusy(true);setStatus('HTMLを読み込み中…');
   try{const r=await doAPI('/import-html',{method:'POST',body:JSON.stringify({url,html:await (async()=>{const data=await f.arrayBuffer();const head=new TextDecoder('ascii').decode(data.slice(0,2048));const found=head.match(/charset\s*=[\s'"]*([a-z0-9_\-]+)/i);let encoding=(found?.[1]||'utf-8').toLowerCase();if(encoding==='sjis'||encoding==='shift-jis'||encoding==='windows-31j')encoding='shift_jis';try{return new TextDecoder(encoding).decode(data)}catch{return new TextDecoder('utf-8').decode(data)}})()})});await loadList(true);await loadArticle(r.item.id);setStatus('HTMLを取り込みました')}
   catch(e){setStatus('取込失敗：'+e.message,true)}finally{setBusy(false)}
 };
 const dialog=$('editDialog');$('closeDialog').onclick=()=>dialog.close();
 $('edit').onclick=()=>{
   if(!lastMetadata)return;
   $('editTitle').value=lastMetadata.title||'';
   $('editHeader').value=lastMetadata.header_title_override||'';
   $('editDate').value=lastMetadata.published||'';
   $('editBody').value=lastMetadata.manual_body_html||lastMetadata.source_body_html||'';
   dialog.dataset.original=JSON.stringify({title:$('editTitle').value,header:$('editHeader').value,date:$('editDate').value,body:$('editBody').value});
   dialog.showModal();
 };
 $('editForm').addEventListener('submit',async e=>{
   e.preventDefault();if(!lastMetadata)return;
   const old=JSON.parse(dialog.dataset.original||'{}');const changes={};
   for(const [field,element,previous] of [['manual_title','editTitle','title'],['header_title_override','editHeader','header'],['manual_published','editDate','date'],['manual_body_html','editBody','body']]){
     if($(element).value!==old[previous])changes[field]=$(element).value;
   }
   if(!Object.keys(changes).length){dialog.close();return}
   setBusy(true);
   try{const r=await doAPI('/article/'+activeId+'/edit',{method:'POST',body:JSON.stringify(changes)});dialog.close();await loadList(true);await loadArticle(r.item.id);setStatus('手動修正を保存しました')}
   catch(e){setStatus('編集失敗：'+e.message,true)}finally{setBusy(false)}
 });
 $('remove').onclick=async()=>{
   if(!lastMetadata||!confirm('この記事をデータベースから削除します。よろしいですか？'))return;
   setBusy(true);try{await doAPI('/article/'+activeId+'/delete',{method:'POST',body:'{}'});activeId='';state.selected='';saveState();$('preview').srcdoc='';lastBody='';lastMetadata=null;await loadList(true);setStatus('削除しました')}
   catch(e){setStatus('削除できません：'+e.message,true)}finally{setBusy(false)}
 };
}

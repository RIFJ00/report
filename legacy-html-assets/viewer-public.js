import {prepareArticlePreviewHtml,normalizeArticleFooter,publicationDateClass} from './article-preview-interactions.js?v=v1_10_3';
// RIFJ public article viewer v1.8.
// Article GET is intentionally public; registration / editing / deletion stay admin only.
import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import {getFirestore, doc, onSnapshot} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';

const $=id=>document.getElementById(id);
const app=initializeApp(firebaseConfig);
const db=getFirestore(app);
const COLUMN_VIEW=document.body.dataset.view==='columns';
const STORE=COLUMN_VIEW?'rifj-firebase-html-state-columns':'rifj-firebase-html-state-viewer';
const base={query:'',kind:'',scope:'all',sort:'date',pageSize:'30',selected:'',bookmarksOnly:false};
let state={...base};
try{state={...base,...JSON.parse(localStorage.getItem(STORE)||'{}')}}catch{}
if(!['10','30','50'].includes(String(state.pageSize)))state.pageSize='30';
const ALLOWED_KINDS=COLUMN_VIEW?['note','ameblo']:['kantei','soumu','mofa','mof','mext','mhlw','maff','meti','mlit','env'];
if(state.kind && !ALLOWED_KINDS.includes(state.kind))state.kind='';
// Bookmarks are stored ONLY in the local browser profile, never in Firebase.
// Both public pages use the same key, but their source filters stay separate.
const BOOKMARK_STORE='rifj-firebase-html-local-bookmarks-v1';
function readBookmarks(){
  try{
    const value=JSON.parse(localStorage.getItem(BOOKMARK_STORE)||'{}');
    return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  }catch{return {}}
}
let bookmarks=readBookmarks();
const bookmarkEntries=()=>Object.values(bookmarks).filter(x=>x&&typeof x==='object'&&x.id&&ALLOWED_KINDS.includes(x.kind));
const isBookmarked=id=>Object.prototype.hasOwnProperty.call(bookmarks,String(id||''));
const bookmarkLabel=id=>isBookmarked(id)?'★ ブックマーク解除':'☆ ブックマーク';
function persistBookmarks(){
  try{localStorage.setItem(BOOKMARK_STORE,JSON.stringify(bookmarks));return true}
  catch{
    setStatus('このブラウザではブックマークを保存できません。ブラウザの設定をご確認ください。',true);
    return false;
  }
}
function compactArticle(item){
  return {id:item.id,kind:item.kind,title:item.title||'',sidebar_title:item.sidebar_title||'',
          published:item.published||'',created_at:item.created_at||'',url:item.url||''};
}

const save=()=>{try{localStorage.setItem(STORE,JSON.stringify(state))}catch{}};
for(const key of ['query','kind','scope','sort','pageSize']){
  if($(key))$(key).value=state[key] ?? base[key];
}

let items=[],activeId='',lastBody='',lastMeta=null,nextCursor='';
let fullSearchResults=[],searchTotal=0,visibleSearchCount=Number(state.pageSize);
let currentSearchId=0,lastRevision='',pendingChange=null,pendingTimer=null,watcher=null;
let backgroundBusy=false;
let favoriteResults=[],favoriteVisibleCount=Number(state.pageSize),favoriteTextCache=new Map();
let sourceFeed=null;
const setStatus=(txt,err=false)=>{const x=$('status');x.textContent=txt;x.style.color=err?'#9b3439':'#607787'};
const pageSize=()=>Number(state.pageSize)||30;
function updateBookmarkControls(){
  const current=$('bookmarkCurrent');
  if(current){
    current.classList.toggle('hide',!activeId);
    if(activeId){
      current.textContent=bookmarkLabel(activeId);
      current.setAttribute('aria-pressed',String(isBookmarked(activeId)));
      current.title=isBookmarked(activeId)?'この端末のブックマークから解除':'この端末にブックマークを登録';
    }
  }
  if($('bookmarksOnly'))$('bookmarksOnly').checked=!!state.bookmarksOnly;
  if($('bookmarkCount'))$('bookmarkCount').textContent=String(bookmarkEntries().length);
}
function toggleBookmark(item){
  if(!item||!item.id)return;
  const key=String(item.id),was=isBookmarked(key),previous={...bookmarks};
  if(was)delete bookmarks[key];else bookmarks[key]=compactArticle(item);
  if(!persistBookmarks()){bookmarks=previous;updateBookmarkControls();return}
  updateBookmarkControls();
  if(state.bookmarksOnly){loadList();}
  else renderItems({keepScroll:true});
  setStatus(was?'ブックマークを解除しました':'このブラウザにブックマークを保存しました');
}


async function api(path,{raw=false,signal}={}){
  // Public endpoints intentionally do NOT attach Firebase ID tokens.
  const response=await fetch('/api'+path,{method:'GET',credentials:'omit',cache:'no-store',signal});
  if(!response.ok){
    const data=await response.json().catch(()=>({}));
    throw new Error(data.error||`サーバーエラー: ${response.status}`);
  }
  return raw?response:response.json();
}
function syncFilters(){
  for(const key of ['query','kind','sort','scope','pageSize'])state[key]=$(key).value;
  save();
}
function setMore(hasMore){$('more').classList.toggle('hide',!hasMore)}
function renderItems({keepScroll=false}={}){
  const list=$('list'),oldScroll=keepScroll?list.scrollTop:0;
  list.replaceChildren();
  $('total').textContent=`${items.length}件表示`;
  updateBookmarkControls();
  if(!items.length){
    const e=document.createElement('div');e.className='empty';
    e.textContent=state.bookmarksOnly?'該当するブックマークはありません。':'該当する記事がありません。';
    list.append(e);return;
  }
  const labels={kantei:'首相官邸',mofa:'外務省',mof:'財務省',mext:'文部科学省',meti:'経済産業省',soumu:'総務省',env:'環境省',mhlw:'厚生労働省',maff:'農林水産省',mlit:'国土交通省',note:'note',ameblo:'アメブロ'};
  for(const item of items){
    const wrapper=document.createElement('div');wrapper.className='rifj-bookmark-row'+(item.id===activeId?' active':'');
    const b=document.createElement('button');b.type='button';b.className='article-item rifj-bookmark-article'+(item.id===activeId?' active':'');
    const h=document.createElement('div');h.className='article-title';h.textContent=item.sidebar_title||item.title||'無題';h.title=item.title||'';
    const meta=document.createElement('div');meta.className='article-meta';
    const date=document.createElement('time');date.textContent=item.published||'公開日未確認';
    if(item.published)date.dateTime=item.published;
    const dateClass=publicationDateClass(item.published);
    if(dateClass)date.classList.add(dateClass);
    meta.append(date,document.createTextNode(' ・ '+(labels[item.kind]||item.kind||'その他')));
    b.append(h,meta);
    if(item.match_excerpt){const excerpt=document.createElement('div');excerpt.className='article-excerpt';excerpt.textContent=item.match_excerpt;b.append(excerpt)}
    b.addEventListener('click',()=>loadArticle(item.id));
    const star=document.createElement('button');star.type='button';star.className='rifj-bookmark-toggle';
    star.textContent=isBookmarked(item.id)?'★':'☆';
    star.setAttribute('aria-label',isBookmarked(item.id)?'ブックマーク解除：'+(item.title||'無題'):'ブックマーク登録：'+(item.title||'無題'));
    star.setAttribute('aria-pressed',String(isBookmarked(item.id)));
    star.title=isBookmarked(item.id)?'ブックマーク解除':'ブックマーク登録';
    star.addEventListener('click',()=>toggleBookmark(item));
    wrapper.append(b,star);list.append(wrapper);
  }
  if(keepScroll)list.scrollTop=oldScroll;
}
function preparePreviewHtml(markup){
  // These styles apply only inside the isolated iframe and do not change saved HTML.
  // The article's own brand header stays in place during inner-page scrolling.
  const css='<style id="rifj-viewer-fixed-header">.site-top{position:sticky!important;top:0!important;z-index:200!important}.article-content h2,.article-content h3{scroll-margin-top:75px!important}</style>';
  return /<\/head\s*>/i.test(markup)?markup.replace(/<\/head\s*>/i,css+'</head>'):css+markup;
}
async function loadArticle(id,{preserveScroll=false}={}){
  const changed=id!==activeId;
  const frame=$('preview');
  const prevScroll=preserveScroll&&!changed?(()=>{try{return frame.contentWindow?.scrollY||0}catch{return 0}})():0;
  activeId=id;state.selected=id;save();renderItems({keepScroll:true});
  $('previewEmpty').classList.add('hide');frame.classList.remove('hide');$('export').classList.add('hide');
  if(changed)frame.srcdoc='<p style="padding:30px;font-family:sans-serif">記事を読み込み中…</p>';
  try{
    const [m,r]=await Promise.all([api('/article/'+id),api('/article/'+id+'/html',{raw:true})]);
    const text=await r.text();
    if(activeId!==id)return;
    lastMeta=m.item;lastBody=normalizeArticleFooter(text);
    if(isBookmarked(id)){
      bookmarks[id]=compactArticle(m.item);
      persistBookmarks();
    }
    updateBookmarkControls();
    frame.srcdoc=prepareArticlePreviewHtml(preparePreviewHtml(lastBody),m.item?.title||'',m.item?.published||'');
    $('export').classList.remove('hide');
    // Sandboxed iframe prevents reading inner scroll in some browsers; never relax sandbox.
    // Browsers naturally preserve the scroll position of unrelated articles (no frame reload).
    void prevScroll;
  }catch(e){setStatus('記事を表示できません：'+e.message,true);frame.srcdoc='';$('previewEmpty').classList.remove('hide');$('export').classList.add('hide')}
}
function closeArticle(){
  activeId='';state.selected='';save();lastMeta=null;lastBody='';
  $('preview').srcdoc='';$('preview').classList.add('hide');$('previewEmpty').classList.remove('hide');$('export').classList.add('hide');
  updateBookmarkControls();
}

// Both public pages use server-side kind filtering for EVERY search request.
// The main viewer excludes note/Ameblo, even when fulltext search is used.
// Each view merges its allowed source streams without changing Firestore rules.
function selectedKinds(){
  return ALLOWED_KINDS.includes(state.kind)?[state.kind]:ALLOWED_KINDS;
}
function compareSourceItems(a,b){
  const date=(a,b)=>String(b.published||'').localeCompare(String(a.published||''));
  const id=(a,b)=>String(a.id||'').localeCompare(String(b.id||''));
  if(state.sort==='ministry'){
    return (ALLOWED_KINDS.indexOf(a.kind)-ALLOWED_KINDS.indexOf(b.kind))||date(a,b)||id(a,b);
  }
  if(state.sort==='input'){
    return String(a.created_at||'').localeCompare(String(b.created_at||''))||id(a,b);
  }
  return date(a,b)||id(a,b);
}
function newSourceFeed(){
  return selectedKinds().map(kind=>({kind,buffer:[],cursor:'',done:false}));
}
async function fillSourceBuffers(feed){
  await Promise.all(feed.filter(source=>!source.done&&!source.buffer.length).map(async source=>{
    const params=new URLSearchParams({kind:source.kind,sort:state.sort,size:String(pageSize())});
    if(source.cursor)params.set('cursor',source.cursor);
    const result=await api('/list?'+params.toString());
    source.buffer.push(...(result.items||[]));
    source.cursor=result.next_cursor||'';
    source.done=!source.cursor;
  }));
}
async function takeSourceItems(feed,count){
  const found=[];
  while(found.length<count){
    await fillSourceBuffers(feed);
    const ready=feed.filter(source=>source.buffer.length>0);
    if(!ready.length)break;
    ready.sort((a,b)=>compareSourceItems(a.buffer[0],b.buffer[0]));
    found.push(ready[0].buffer.shift());
  }
  return found;
}
function hasSourceMore(feed){return !!feed?.some(source=>source.buffer.length||!source.done)}
async function searchSelectedSources(params){
  const responses=await Promise.all(selectedKinds().map(kind=>{
    const q=new URLSearchParams(params);q.set('kind',kind);
    return api('/search?'+q.toString());
  }));
  const merged=responses.flatMap(result=>result.items||[]).sort(compareSourceItems);
  return {
    items:merged,
    total:responses.reduce((sum,result)=>sum+Number(result.total??(result.items||[]).length),0),
    has_more:responses.some(result=>result.has_more)
  };
}

function matchingFavoriteMetadata(item,term,scope){
  const title=String(item.title||'')+' '+String(item.sidebar_title||'');
  const url=String(item.url||'');
  return ((scope==='title'||scope==='all')&&title.toLocaleLowerCase().includes(term))||
         (scope==='all'&&url.toLocaleLowerCase().includes(term));
}
async function getFavoriteBody(item){
  if(favoriteTextCache.has(item.id))return favoriteTextCache.get(item.id);
  const response=await api('/article/'+encodeURIComponent(item.id)+'/html',{raw:true});
  const markup=await response.text();
  const doc=new DOMParser().parseFromString(markup,'text/html');
  const content=doc.querySelector('.article-content')||doc.querySelector('article')||doc.body;
  const text=(content?.textContent||'').toLocaleLowerCase();
  favoriteTextCache.set(item.id,text);
  return text;
}
async function filteredFavoriteItems(){
  const records=bookmarkEntries().sort(compareSourceItems);
  const term=state.query.trim().toLocaleLowerCase();
  if(!term)return records;
  const matched=new Set();
  // Bounded concurrency when a body search is required; no HTML is persisted.
  let index=0;
  async function worker(){
    while(index<records.length){
      const item=records[index++];
      if(matchingFavoriteMetadata(item,term,state.scope)){matched.add(item.id);continue}
      if(state.scope==='title')continue;
      try{if((await getFavoriteBody(item)).includes(term))matched.add(item.id)}
      catch(error){console.warn('bookmark body search failed',item.id,error)}
    }
  }
  await Promise.all(Array.from({length:Math.min(4,records.length)},worker));
  return records.filter(item=>matched.has(item.id));
}
async function loadList({background=false,change=null}={}){
  const requestId=++currentSearchId;
  syncFilters();
  const oldActive=activeId,scroll=$('list').scrollTop;
  const params=new URLSearchParams({kind:state.kind,sort:state.sort});
  const searchMode=!!state.query.trim();
  if(searchMode){params.set('q',state.query.trim());params.set('scope',state.scope)}
  else params.set('size',state.pageSize);
  if(!background)setStatus('検索中…');
  const started=performance.now();
  try{
    if(state.bookmarksOnly){
      const all=await filteredFavoriteItems();
      if(requestId!==currentSearchId)return;
      favoriteResults=all;
      favoriteVisibleCount=background?Math.max(pageSize(),items.length):pageSize();
      items=all.slice(0,favoriteVisibleCount);
      sourceFeed=null;fullSearchResults=[];searchTotal=all.length;
      setMore(items.length<all.length);
      renderItems({keepScroll:background});
      if(background)$('list').scrollTop=scroll;
      setStatus(`${all.length}件のブックマーク`);
      if(background){
        if(change?.action==='delete'&&change.article_id===oldActive){
          closeArticle();if(items.length)await loadArticle(items[0].id);
        }else if(change?.action==='upsert'&&change.article_id===oldActive){
          await loadArticle(oldActive,{preserveScroll:true});
        }
        return;
      }
      if(!items.length){closeArticle();return}
      const preferred=state.selected&&items.some(x=>x.id===state.selected)?state.selected:'';
      if(preferred===activeId&&lastMeta){updateBookmarkControls();return}
      await loadArticle(preferred||items[0].id);
      return;
    }
    const feed=!searchMode?newSourceFeed():null;
    const previousCount=background?Math.max(pageSize(),items.length):pageSize();
    const result=feed
      ? {items:await takeSourceItems(feed,previousCount)}
      : await searchSelectedSources(params);
    if(requestId!==currentSearchId)return;
    sourceFeed=feed;
    if(searchMode){
      fullSearchResults=result.items||[];
      searchTotal=result.total??fullSearchResults.length;
      if(!background)visibleSearchCount=pageSize();
      visibleSearchCount=Math.max(pageSize(),visibleSearchCount);
      items=fullSearchResults.slice(0,visibleSearchCount);
      nextCursor='';
      setMore(items.length<fullSearchResults.length);
    }else{
      fullSearchResults=[];searchTotal=0;visibleSearchCount=pageSize();
      items=result.items||[];
      nextCursor=result.next_cursor||'';
      setMore(feed?hasSourceMore(feed):!!nextCursor);
    }
    renderItems({keepScroll:background});
    if(background)$('list').scrollTop=scroll;
    const num=searchMode?searchTotal:(result.total??items.length);
    const elapsed=Math.round(performance.now()-started);
    setStatus(background?`記事一覧を更新しました（${items.length}件表示）`:(!searchMode?`${num}件表示・${elapsed}ms`:`${num}件ヒット・${elapsed}ms${result.has_more?'（検索候補には表示上限があります）':''}`));
    if(background){
      if(change?.article_id===oldActive && change.action==='delete'){
        closeArticle();renderItems({keepScroll:true});
        if(items.length)await loadArticle(items[0].id);
      }else if(change?.article_id===oldActive && change.action==='upsert'){
        await loadArticle(oldActive,{preserveScroll:true});
      }else if(!oldActive && items.length){await loadArticle(items[0].id)}
      // Unrelated updates never reload the currently open article.
      return;
    }
    const preferred=(state.selected&&items.some(x=>x.id===state.selected))?state.selected:'';
    if(!preferred && activeId && items.some(x=>x.id===activeId)){renderItems();return}
    if(!items.length){closeArticle();renderItems();return}
    await loadArticle(preferred||items[0].id);
  }catch(e){setStatus((background?'自動更新に失敗：':'検索失敗：')+e.message,true)}
}
async function showMore(){
  if(state.bookmarksOnly){
    favoriteVisibleCount+=pageSize();
    items=favoriteResults.slice(0,favoriteVisibleCount);
    renderItems({keepScroll:true});setMore(items.length<favoriteResults.length);
    return;
  }
  if(state.query.trim()){
    visibleSearchCount+=pageSize();
    items=fullSearchResults.slice(0,visibleSearchCount);
    renderItems({keepScroll:true});setMore(items.length<fullSearchResults.length);
    return;
  }
  if(!hasSourceMore(sourceFeed))return;
  const sequence=currentSearchId;
  try{
    $('more').disabled=true;
    const extra=await takeSourceItems(sourceFeed,pageSize());
    if(sequence!==currentSearchId)return;
    items=[...items,...extra];
    renderItems({keepScroll:true});setMore(hasSourceMore(sourceFeed));
  }catch(e){setStatus('追加読み込みに失敗：'+e.message,true)}finally{$('more').disabled=false}
}
function queueRefresh(change){
  pendingChange=change||pendingChange;
  if(pendingTimer)clearTimeout(pendingTimer);
  pendingTimer=setTimeout(async()=>{
    pendingTimer=null;
    if(backgroundBusy){queueRefresh(pendingChange);return}
    backgroundBusy=true;
    const c=pendingChange;pendingChange=null;
    try{
      if(c?.article_id&&isBookmarked(c.article_id)){
        if(c.action==='delete'){
          delete bookmarks[c.article_id];persistBookmarks();favoriteTextCache.delete(c.article_id);
        }else{
          favoriteTextCache.delete(c.article_id);
          try{
            const result=await api('/article/'+encodeURIComponent(c.article_id));
            if(result.item){bookmarks[c.article_id]=compactArticle(result.item);persistBookmarks()}
          }catch(error){console.warn('bookmark refresh skipped',error)}
        }
      }
      await loadList({background:true,change:c});
    }finally{backgroundBusy=false;if(pendingChange)queueRefresh(pendingChange)}
  },400);
}
function startRealtime(){
  if(watcher)return;
  watcher=onSnapshot(doc(db,'system','article_revision'),snap=>{
    if(snap.metadata.fromCache)return;
    const data=snap.exists()?snap.data():null;
    if(!data?.revision)return;
    if(!lastRevision){lastRevision=data.revision;return}
    if(data.revision===lastRevision)return;
    lastRevision=data.revision;
    queueRefresh({article_id:data.article_id||'',action:data.action||'upsert'});
  },error=>{
    console.warn('realtime public listener failed',error);
    // Fallback: reload metadata occasionally when a listener cannot connect.
    setInterval(()=>{if(!document.hidden)queueRefresh(null)},60000);
  });
}

$('searchButton').addEventListener('click',()=>loadList());
$('query').addEventListener('input',syncFilters);
$('query').addEventListener('keydown',e=>{if(e.key==='Enter')loadList()});
for(const f of ['kind','scope','sort','pageSize'])$(f).addEventListener('change',()=>loadList());
$('clear').addEventListener('click',()=>{
  for(const f of ['query','kind'])$(f).value='';$('scope').value='all';$('sort').value='date';
  // Keep the selected page size as a display preference.
  activeId='';state.selected='';loadList();
});
$('bookmarksOnly').checked=!!state.bookmarksOnly;
$('bookmarksOnly').addEventListener('change',()=>{
  state.bookmarksOnly=$('bookmarksOnly').checked;save();loadList();
});
$('bookmarkCurrent').addEventListener('click',()=>{
  if(lastMeta&&activeId)toggleBookmark(lastMeta);
});
window.addEventListener('storage',event=>{
  if(event.key!==BOOKMARK_STORE)return;
  bookmarks=readBookmarks();favoriteTextCache.clear();
  if(state.bookmarksOnly)loadList({background:true});
  else{renderItems({keepScroll:true});updateBookmarkControls()}
});
$('more').addEventListener('click',showMore);
updateBookmarkControls();
$('export').addEventListener('click',()=>{
  if(!lastBody||!lastMeta)return;
  const objectURL=URL.createObjectURL(new Blob([lastBody],{type:'text/html;charset=utf-8'}));
  const a=document.createElement('a');a.href=objectURL;a.download=(lastMeta.kind||'article')+'_'+lastMeta.id+'.html';a.click();
  setTimeout(()=>URL.revokeObjectURL(objectURL),1200);
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)queueRefresh(null)});
startRealtime();
loadList();

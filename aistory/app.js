'use strict';
const $=id=>document.getElementById(id),authors=window.AUTHORS;
const screens=['welcome','settings','review','result'];
let confirmed=null;
const formats={video:'ショート動画',short:'短編小説',medium:'中編小説',long:'長編小説',article:'記事・コラム・随筆',book:'ノンフィクション書籍'};
function show(id){screens.forEach(s=>$(s).hidden=s!==id);window.scrollTo({top:0,behavior:'smooth'});const head=$(id).querySelector('h1');if(head){head.tabIndex=-1;head.focus({preventScroll:true});}}
const genres=[...new Set(authors.map(a=>a.genre))];
genres.forEach(g=>$('genre').add(new Option(g,g)));
for(const g of genres){const h=document.createElement('h4');h.textContent=g;const p=document.createElement('p');p.textContent=authors.filter(a=>a.genre===g).map(a=>a.name).join(' ／ ');$('catalogue').append(h,p);}
function renderAuthors(keep){
const old=keep||$('author').value||'a0_0';const q=$('search').value.normalize('NFKC').toLowerCase().replace(/\s/g,'');
const list=authors.filter(a=>(!$('genre').value||a.genre===$('genre').value)&&(!$('region').value||a.region===$('region').value)&&(!q||a.name.normalize('NFKC').toLowerCase().replace(/\s/g,'').includes(q)));
$('author').replaceChildren();
for(const g of genres){const matches=list.filter(a=>a.genre===g);if(!matches.length)continue;const group=document.createElement('optgroup');group.label=g;matches.forEach(a=>group.append(new Option(a.name+' · '+a.region,a.id)));$('author').append(group);}
$('author').add(new Option('作家を指定しない／おまかせ','auto'));
$('author').add(new Option('作家・作風を自由入力','custom'));
$('author').value=list.some(a=>a.id===old)||['auto','custom'].includes(old)?old:list[0]?.id||'custom';
$('authorCount').textContent=list.length+'名';update();
}
function data(){const a=authors.find(x=>x.id===$('author').value);return {format:$('format').value,kind:$('kind').value,length:$('length').value,chapters:$('chapters').value,materials:$('materials').value.trim(),task:$('task').value,source:$('source').value.trim(),topic:$('topic').value,idea:$('idea').value.trim(),authorName:a?.name||($('author').value==='custom'?$('customName').value.trim()||'自由指定':'作家を指定せずおまかせ'),traits:a?.traits||($('author').value==='custom'?$('customTraits').value.trim():'題材に合った読みやすい構成と雰囲気'),tool:document.querySelector('input[name=tool]:checked')?.value||'',duration:$('duration').value,scenes:$('scenes').value,aspect:$('aspect').value,visual:$('visual').value,voice:$('voice').value,ending:$('ending').value,notes:$('notes').value.trim()};}
function pairs(d,full=false){let arr=[['完成形式',formats[d.format]],['作品の種類',d.kind],['作業',{new:'新しい作品を作る',edit:'作成済み作品を修正',prompt:'構成・制作指示の作成'}[d.task]],['題材',d.topic+(d.idea?'／'+d.idea:'')],['作風',d.authorName],['制作ツール',d.tool||'選択してください'],['尺・構成',d.duration+' · '+(d.scenes==='auto'?'場面数おまかせ':d.scenes+'場面')],['画面',d.aspect]];if(d.format!=='video'){arr=arr.filter(x=>!['制作ツール','尺・構成','画面'].includes(x[0]));arr.push(['分量',d.length==='auto'?'形式に合わせておまかせ':d.length],['章・節',d.chapters]);}if(full){arr.push(['作風の特徴',d.traits],['映像表現',d.visual],['ナレーション',d.voice],['結末',d.ending],['追加の希望',d.notes||'なし']);if(d.task!=='new')arr.push(['元作品・変更内容',d.source]);}if(d.format!=='video')arr=arr.filter(x=>!['映像表現','ナレーション'].includes(x[0]));if(full)arr.push(['参考資料・実体験',d.materials||'未指定']);return arr;}
function fill(id,arr){$(id).replaceChildren();for(const [key,value]of arr){const item=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;item.append(dt,dd);$(id).append(item);}}
function update(){const d=data();const video=d.format==='video';$('toolPanel').hidden=!video;$('videoSettings').hidden=!video;$('writingSettings').hidden=video;document.querySelectorAll('input[name=tool]').forEach(el=>el.required=video);$('sourceWrap').hidden=d.task==='new';$('source').required=d.task!=='new';$('customWrap').hidden=$('author').value!=='custom';$('customTraits').required=$('author').value==='custom';$('idea').required=$('topic').value==='自由入力';$('authorInfo').querySelector('strong').textContent=d.authorName;$('authorInfo').querySelector('p').textContent=d.traits||'下の欄で、取り入れたい特徴を入力してください。';fill('liveSummary',pairs(d));}
function validate(){const d=data();let msg='',target='';if(d.format==='video'&&!d.tool){msg='制作ツールはGrokかGoogle Vidsのどちらかを選択してください。';target='';}else if(d.task!=='new'&&!d.source){msg='元の作品や修正したい内容を入力してください。';target='source';}else if(d.topic==='自由入力'&&!d.idea){msg='題材の詳細を入力してください。';target='idea';}else if($('author').value==='custom'&&!d.traits){msg='取り入れたい作風の特徴を入力してください。';target='customTraits';}$('formError').hidden=!msg;$('formError').textContent=msg;if(msg){if(target)$(target).focus();else document.querySelector('input[name=tool]').focus();return false;}return true;}
$('start').onclick=()=>{show('settings');update();};$('home').onclick=e=>{e.preventDefault();show('welcome');};
['genre','region'].forEach(id=>$(id).onchange=()=>renderAuthors());$('search').oninput=()=>renderAuthors();
$('form').addEventListener('input',update);$('form').addEventListener('change',update);
$('form').onsubmit=e=>{e.preventDefault();if(!validate())return;confirmed=data();fill('reviewSummary',pairs(confirmed,true));show('review');};
$('reset').onclick=()=>{$('form').reset();$('genre').value='';$('region').value='';$('search').value='';renderAuthors('a0_0');$('formError').hidden=true;confirmed=null;};
$('back').onclick=$('editSettings').onclick=()=>show('settings');
$('generate').onclick=()=>{if(!confirmed)return;$('output').value=window.buildPrompt(confirmed);$('copyStatus').textContent='';show('result');};
$('copy').onclick=async()=>{try{if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');await navigator.clipboard.writeText($('output').value);$('copyStatus').textContent='コピーしました。プロジェクトのチャットに貼り付けて送信してください。';}catch(e){$('output').focus();$('output').select();$('copyStatus').textContent='依頼文を選択しました。端末の「コピー」を使ってください。';}};
$('download').onclick=()=>{const blob=new Blob(['\ufeff'+$('output').value],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ショート動画＆小説プロジェクト_制作依頼.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);};
renderAuthors('a0_0');

'use strict';
const $=id=>document.getElementById(id),authors=window.AUTHORS,animators=window.ANIMATORS||[];
const screens=['welcome','settings','review','result'];
let confirmed=null;
let customTemplateSerial=0;
const customTemplates=[];
const formats={video:'ショート動画',short:'短編小説',medium:'中編小説',long:'長編小説',article:'記事・コラム・随筆',book:'ノンフィクション書籍'};
const builtInTemplates=(window.TEMPLATE_LIBRARY||[]).map(t=>({...t,custom:false}));
function show(id){screens.forEach(s=>$(s).hidden=s!==id);window.scrollTo({top:0,behavior:'smooth'});const head=$(id).querySelector('h1');if(head){head.tabIndex=-1;head.focus({preventScroll:true});}}
function allTemplates(){return [...builtInTemplates,...customTemplates];}
function selectedTemplate(){return allTemplates().find(t=>t.id===$('wordOutput').value)||null;}
function safeTemplate(t){if(!t)return null;return {id:t.id,label:t.label,filename:t.filename,writing:t.writing,fontSize:t.fontSize,illustration:!!t.illustration,toc:t.toc!==false,chapterBreak:t.chapterBreak!==false,verified:!!t.verified,status:t.status||'',description:t.description||'',rulesKey:t.rulesKey||'generic',custom:!!t.custom,recommendedUse:t.recommendedUse||''};}
function isRecommended(t,d){return (t.recommendedFormats||[]).includes(d.format)&&(t.recommendedKinds||[]).includes(d.kind);}
function chooseTemplate(id){$('wordOutput').value=id;renderTemplateLibrary();update();}
function renderTemplateLibrary(){
 const host=$('templateLibrary');if(!host)return;host.replaceChildren();
 const d={format:$('format')?.value||'short',kind:$('kind')?.value||'フィクション'};
 for(const t of allTemplates()){
  const card=document.createElement('div');card.className='template-card'+($('wordOutput').value===t.id?' selected':'');
  const choose=document.createElement('button');choose.type='button';choose.className='template-select';choose.setAttribute('aria-pressed',$('wordOutput').value===t.id?'true':'false');choose.dataset.templateId=t.id;
  const visual=document.createElement('div');visual.className='template-preview';
  if(t.preview){const img=document.createElement('img');img.src=t.preview;img.alt=t.label+' のプレビュー';img.loading='lazy';visual.append(img);}else{const ph=document.createElement('div');ph.className='template-placeholder';ph.innerHTML='<b>DOCX</b><span>LOCAL TEMPLATE</span>';visual.append(ph);}
  const body=document.createElement('div');body.className='template-card-body';
  const top=document.createElement('div');top.className='template-badges';
  if(isRecommended(t,d)){const b=document.createElement('span');b.className='badge recommend';b.textContent='おすすめ';top.append(b);}
  const s=document.createElement('span');s.className='badge';s.textContent=t.custom?'このセッション':(t.verified?'検証済み':'登録済み');top.append(s);
  const h=document.createElement('strong');h.textContent=t.label;
  const meta=document.createElement('p');meta.className='template-meta';meta.textContent=[t.writing,t.fontSize,t.illustration?'挿絵あり':'挿絵なし'].filter(Boolean).join(' · ');
  const desc=document.createElement('p');desc.className='template-desc';desc.textContent=t.description||t.recommendedUse||'追加したWord原本をそのまま使用します。';
  const file=document.createElement('small');file.textContent=t.filename;
  body.append(top,h,meta,desc,file);choose.append(visual,body);choose.onclick=()=>chooseTemplate(t.id);card.append(choose);
  if(t.custom){const remove=document.createElement('button');remove.type='button';remove.className='remove-template';remove.textContent='この登録を削除';remove.onclick=()=>removeCustomTemplate(t.id);card.append(remove);}
  host.append(card);
 }
 const off=document.createElement('button');off.type='button';off.className='template-off'+($('wordOutput').value==='none'?' selected':'');off.setAttribute('aria-pressed',$('wordOutput').value==='none'?'true':'false');off.innerHTML='<strong>Word成果物を作成しない</strong><small>本文・台本だけを作成する場合</small>';off.onclick=()=>chooseTemplate('none');host.append(off);
}
function removeCustomTemplate(id){const i=customTemplates.findIndex(t=>t.id===id);if(i<0)return;const [t]=customTemplates.splice(i,1);if(t.objectUrl)URL.revokeObjectURL(t.objectUrl);if($('wordOutput').value===id)$('wordOutput').value=builtInTemplates[0]?.id||'none';$('customTemplateStatus').textContent='セッション登録から削除しました。';renderTemplateLibrary();update();}
function addCustomTemplate(){
 const input=$('customTemplateFile'),file=input.files?.[0];
 if(!file){$('customTemplateStatus').textContent='追加するDOCXファイルを選択してください。';input.focus();return;}
 if(!/\.docx$/i.test(file.name)){$('customTemplateStatus').textContent='DOCXファイルを選択してください。';input.focus();return;}
 const objectUrl=URL.createObjectURL(file);const id='custom_'+(++customTemplateSerial);
 const label=$('customTemplateLabel').value.trim()||file.name.replace(/\.docx$/i,'');
 const use=$('customTemplateUse').value.trim();
 customTemplates.push({id,label,filename:file.name,href:objectUrl,objectUrl,preview:'',writing:$('customTemplateWriting').value,fontSize:$('customTemplateFont').value.trim()||'未指定',illustration:$('customTemplateIllustration').value==='true',toc:true,chapterBreak:true,verified:false,status:'セッション登録',recommendedFormats:[],recommendedKinds:[],recommendedUse:use,description:use?`推奨用途：${use}`:'ブラウザから追加したWord原本。書式は原本を優先して使用します。',rulesKey:'generic',custom:true});
 $('customTemplateStatus').textContent=`「${label}」をこのセッションに追加し、選択しました。制作時はこのDOCXもチャットへ添付してください。`;
 $('wordOutput').value=id;input.value='';$('customTemplateLabel').value='';$('customTemplateFont').value='';$('customTemplateUse').value='';renderTemplateLibrary();update();
}
const genres=[...new Set(authors.map(a=>a.genre))];
genres.forEach(g=>$('genre').add(new Option(g,g)));
for(const g of genres){const h=document.createElement('h4');h.textContent=g;const p=document.createElement('p');p.textContent=authors.filter(a=>a.genre===g).map(a=>a.name).join(' ／ ');$('catalogue').append(h,p);}
const animatorGenres=[...new Set(animators.map(a=>a.genre))];
animatorGenres.forEach(g=>$('animatorGenre').add(new Option(g,g)));
for(const g of animatorGenres){const h=document.createElement('h4');h.textContent=g;const p=document.createElement('p');p.textContent=animators.filter(a=>a.genre===g).map(a=>a.name).join(' ／ ');$('animatorCatalogue').append(h,p);}
function renderAuthors(keep){
 const old=keep||$('author').value||'a0_0';const q=$('search').value.normalize('NFKC').toLowerCase().replace(/\s/g,'');
 const list=authors.filter(a=>(!$('genre').value||a.genre===$('genre').value)&&(!$('region').value||a.region===$('region').value)&&(!q||a.name.normalize('NFKC').toLowerCase().replace(/\s/g,'').includes(q)));
 $('author').replaceChildren();
 for(const g of genres){const matches=list.filter(a=>a.genre===g);if(!matches.length)continue;const group=document.createElement('optgroup');group.label=g;matches.forEach(a=>group.append(new Option(a.name+' · '+a.region,a.id)));$('author').append(group);}
 $('author').add(new Option('作家を指定しない／おまかせ','auto'));$('author').add(new Option('作家・作風を自由入力','custom'));
 $('author').value=list.some(a=>a.id===old)||['auto','custom'].includes(old)?old:list[0]?.id||'custom';$('authorCount').textContent=list.length+'名';update();
}
function renderAnimators(keep){
 const old=keep||$('animator').value||'auto';const q=$('animatorSearch').value.normalize('NFKC').toLowerCase().replace(/\s/g,'');
 const list=animators.filter(a=>(!$('animatorGenre').value||a.genre===$('animatorGenre').value)&&(!$('animatorRegion').value||a.region===$('animatorRegion').value)&&(!q||a.name.normalize('NFKC').toLowerCase().replace(/\s/g,'').includes(q)));
 $('animator').replaceChildren();
 $('animator').add(new Option('指定しない／映像表現に合わせておまかせ','auto'));
 for(const g of animatorGenres){const matches=list.filter(a=>a.genre===g);if(!matches.length)continue;const group=document.createElement('optgroup');group.label=g;matches.forEach(a=>group.append(new Option(a.name+' · '+a.region,a.id)));$('animator').append(group);}
 $('animator').add(new Option('アニメーター・表現を自由入力','custom'));
 $('animator').value=list.some(a=>a.id===old)||['auto','custom'].includes(old)?old:'auto';$('animatorCount').textContent=list.length+'名';update();
}
function data(){const a=authors.find(x=>x.id===$('author').value),an=animators.find(x=>x.id===$('animator').value),t=selectedTemplate();return {format:$('format').value,kind:$('kind').value,length:$('length').value,chapters:$('chapters').value,materials:$('materials').value.trim(),task:$('task').value,source:$('source').value.trim(),topic:$('topic').value,idea:$('idea').value.trim(),authorName:a?.name||($('author').value==='custom'?$('customName').value.trim()||'自由指定':'作家を指定せずおまかせ'),traits:a?.traits||($('author').value==='custom'?$('customTraits').value.trim():'題材に合った読みやすい構成と雰囲気'),animatorName:an?.name||($('animator').value==='custom'?$('animatorCustomName').value.trim()||'自由指定':'指定しない／映像表現に合わせておまかせ'),animatorTraits:an?.traits||($('animator').value==='custom'?$('animatorCustomTraits').value.trim():'映像表現と題材に合わせて一般的な視覚特徴を設計する'),tool:document.querySelector('input[name=tool]:checked')?.value||'',duration:$('duration').value,scenes:$('scenes').value,aspect:$('aspect').value,visual:$('visual').value,voice:$('voice').value,ending:$('ending').value,notes:$('notes').value.trim(),wordOutput:$('wordOutput').value,wordTemplate:safeTemplate(t)};}
function pairs(d,full=false){let arr=[['完成形式',formats[d.format]],['作品の種類',d.kind],['作業',{new:'新しい作品を作る',edit:'作成済み作品を修正',prompt:'構成・制作指示の作成'}[d.task]],['題材',d.topic+(d.idea?'／'+d.idea:'')],['作風',d.authorName],['制作ツール',d.tool||'選択してください'],['尺・構成',d.duration+' · '+(d.scenes==='auto'?'場面数おまかせ':d.scenes+'場面')],['画面',d.aspect],['アニメーション参考',d.animatorName||'指定なし']];if(d.format!=='video'){arr=arr.filter(x=>!['制作ツール','尺・構成','画面','アニメーション参考'].includes(x[0]));arr.push(['分量',d.length==='auto'?'形式に合わせておまかせ':d.length],['章・節',d.chapters]);}if(full){arr.push(['作風の特徴',d.traits],['映像表現',d.visual],['映像参考の特徴',d.animatorTraits||'指定なし'],['ナレーション',d.voice],['結末',d.ending],['追加の希望',d.notes||'なし']);if(d.task!=='new')arr.push(['元作品・変更内容',d.source]);}if(d.format!=='video')arr=arr.filter(x=>!['映像表現','映像参考の特徴','ナレーション'].includes(x[0]));if(full)arr.push(['参考資料・実体験',d.materials||'未指定'],['Word成果物',d.format==='video'?'小説用DOCXなし':d.wordOutput==='none'?'作成しない':`${d.wordTemplate?.label||d.wordTemplate?.filename||'選択テンプレート'}で作成`]);return arr;}
function syncTemplateUI(d){
 const video=d.format==='video';$('wordPanel').hidden=video;if(video){$('resultTemplateDownload').hidden=true;return;}
 const disabled=d.wordOutput==='none'||!d.wordTemplate,t=d.wordTemplate;
 $('selectedTemplateInfo').classList.toggle('disabled',disabled);$('selectedTemplateName').textContent=disabled?'Word成果物は作成しません':t.label;
 $('templateNote').textContent=disabled?'本文・台本等のみを制作し、Word原本への流し込みは行いません。':`${t.filename}を直接の原本として使用します。${t.writing||'書式'}・${t.fontSize||'文字サイズ未指定'}${t.illustration?'・挿絵あり':''}。サンプル本文・タイトル・目次・日付・奥付等は残さず、完成作品の内容だけへ置き換えます。`;
 if(!disabled){const actual=allTemplates().find(x=>x.id===d.wordOutput);$('templateDownload').href=actual?.href||'#';$('templateDownload').textContent=`選択中：${t.filename} をダウンロード`;$('templateDownload').hidden=false;$('resultTemplateDownload').href=actual?.href||'#';$('resultTemplateDownload').textContent=`選択中：${t.filename}`;$('resultTemplateDownload').hidden=false;}else{$('templateDownload').hidden=true;$('resultTemplateDownload').hidden=true;}
 $('noWord').textContent=disabled?'テンプレートを使う':'Word成果物を作成しない';
}
function fill(id,arr){$(id).replaceChildren();for(const [key,value]of arr){const item=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;item.append(dt,dd);$(id).append(item);}}
function update(){const d=data();const video=d.format==='video';$('toolPanel').hidden=!video;$('videoSettings').hidden=!video;$('writingSettings').hidden=video;document.querySelectorAll('input[name=tool]').forEach(el=>el.required=video);$('sourceWrap').hidden=d.task==='new';$('source').required=d.task!=='new';$('customWrap').hidden=$('author').value!=='custom';$('customTraits').required=$('author').value==='custom';$('animatorCustomWrap').hidden=$('animator').value!=='custom';$('animatorCustomTraits').required=video&&$('animator').value==='custom';$('idea').required=$('topic').value==='自由入力';$('authorInfo').querySelector('strong').textContent=d.authorName;$('authorInfo').querySelector('p').textContent=d.traits||'下の欄で、取り入れたい特徴を入力してください。';$('animatorInfo').querySelector('strong').textContent=d.animatorName;$('animatorInfo').querySelector('p').textContent=d.animatorTraits||'映像表現に合わせて一般的な特徴を設計します。';renderTemplateLibrary();syncTemplateUI(d);fill('liveSummary',pairs(d));}
function validate(){const d=data();let msg='',target='';if(d.format==='video'&&!d.tool){msg='制作ツールはGrokかGoogle Vidsのどちらかを選択してください。';}else if(d.task!=='new'&&!d.source){msg='元の作品や修正したい内容を入力してください。';target='source';}else if(d.topic==='自由入力'&&!d.idea){msg='題材の詳細を入力してください。';target='idea';}else if($('author').value==='custom'&&!d.traits){msg='取り入れたい作風の特徴を入力してください。';target='customTraits';}else if(d.format==='video'&&$('animator').value==='custom'&&!d.animatorTraits){msg='参考にする一般的な映像特徴を入力してください。';target='animatorCustomTraits';}else if(d.format!=='video'&&d.wordOutput!=='none'&&!d.wordTemplate){msg='使用するWordテンプレートを選択してください。';}$('formError').hidden=!msg;$('formError').textContent=msg;if(msg){if(target)$(target).focus();else if(d.format==='video')document.querySelector('input[name=tool]').focus();return false;}return true;}
$('start').onclick=()=>{show('settings');update();};$('home').onclick=e=>{e.preventDefault();show('welcome');};
['genre','region'].forEach(id=>$(id).onchange=()=>renderAuthors());$('search').oninput=()=>renderAuthors();
['animatorGenre','animatorRegion'].forEach(id=>$(id).onchange=()=>renderAnimators());$('animatorSearch').oninput=()=>renderAnimators();
$('form').addEventListener('input',e=>{if(!['customTemplateFile'].includes(e.target.id))update();});$('form').addEventListener('change',e=>{if(!['customTemplateFile'].includes(e.target.id))update();});
$('addCustomTemplate').onclick=addCustomTemplate;$('noWord').onclick=()=>chooseTemplate($('wordOutput').value==='none'?(builtInTemplates[0]?.id||'none'):'none');
$('form').onsubmit=e=>{e.preventDefault();if(!validate())return;confirmed=data();fill('reviewSummary',pairs(confirmed,true));show('review');};
function clearAll(){
 customTemplates.splice(0).forEach(t=>{if(t.objectUrl)URL.revokeObjectURL(t.objectUrl);});
 customTemplateSerial=0;
 $('form').reset();
 $('genre').value='';$('region').value='';$('search').value='';
 $('animatorGenre').value='';$('animatorRegion').value='';$('animatorSearch').value='';
 $('wordOutput').value=builtInTemplates[0]?.id||'none';
 $('customTemplateFile').value='';$('customTemplateLabel').value='';$('customTemplateFont').value='';$('customTemplateUse').value='';
 $('customTemplateWriting').selectedIndex=0;$('customTemplateIllustration').selectedIndex=0;
 $('formError').hidden=true;$('formError').textContent='';
 $('customTemplateStatus').textContent='';$('copyStatus').textContent='';$('output').value='';
 confirmed=null;
 renderAnimators('auto');renderAuthors('a0_0');renderTemplateLibrary();update();show('settings');
}
document.querySelectorAll('.clear-all').forEach(btn=>btn.addEventListener('click',clearAll));
$('back').onclick=$('editSettings').onclick=()=>show('settings');
$('generate').onclick=()=>{if(!confirmed)return;syncTemplateUI(confirmed);$('output').value=window.buildPrompt(confirmed);$('copyStatus').textContent='';show('result');};
$('copy').onclick=async()=>{try{if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');await navigator.clipboard.writeText($('output').value);$('copyStatus').textContent='コピーしました。プロジェクトのチャットに貼り付けて送信してください。';}catch(e){$('output').focus();$('output').select();$('copyStatus').textContent='依頼文を選択しました。端末の「コピー」を使ってください。';}};
$('download').onclick=()=>{const blob=new Blob(['\ufeff'+$('output').value],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ショート動画＆小説プロジェクト_制作依頼.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);};
renderTemplateLibrary();renderAnimators('auto');renderAuthors('a0_0');

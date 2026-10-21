require('../templates.js');
const {buildPrompt,resolveTemplate}=require('../prompt.js');
const base={format:'short',kind:'フィクション',length:'約2,000字',chapters:'分量に合わせておまかせ',materials:'',task:'new',source:'',topic:'政治・権力',idea:'',authorName:'星新一',traits:'短い構成、意外性、社会風刺',tool:'Grok',duration:'約3分',scenes:'12',aspect:'横長16:9',visual:'映画のような実写調',voice:'落ち着いた女性1名の朗読',ending:'論点を整理し、問いを残す',notes:''};
function assert(ok,msg){if(!ok)throw new Error(msg)}
let t=buildPrompt({...base,wordOutput:'template11'});
assert(t.includes('11point&挿絵.docx'),'11point template name missing');
assert(t.includes('作品内容に合う新しい挿絵'),'illustration replacement rule missing');
assert(t.includes('図形・テキストボックス・罫線'),'11point colophon object cleanup rule missing');
assert(!t.includes('12point原本では'),'wrong template rule leaked');
t=buildPrompt({...base,wordOutput:'template12'});
assert(t.includes('12point.docx'),'12point template name missing');
assert(!t.includes('作品内容に合う新しい挿絵'),'11point illustration rule leaked into 12point');
assert(t.includes('末尾の不要な空白ページ'),'12point blank-page cleanup rule missing');
t=buildPrompt({...base,format:'video',wordOutput:'template11',tool:'Grok',animatorName:'今敏',animatorTraits:'現実と記憶の滑らかな切替、視覚的なマッチカット'});
assert(t.includes('アニメーション表現の参考：今敏'),'animator reference missing');
assert(t.includes('参考にする一般的な映像特徴：現実と記憶の滑らかな切替、視覚的なマッチカット'),'animator traits missing');
assert(t.includes('画像・動画生成用の実プロンプトには原則としてアニメーター名を記載せず'),'animator safety/generalization rule missing');
assert(t.includes('今回は小説用WordテンプレートによるDOCX成果物を作成しない'),'video should disable novel docx');
assert(!t.includes('選択された原本は「11point&挿絵.docx」'),'video must not request novel template');
t=buildPrompt({...base,task:'prompt',wordOutput:'template11'});
assert(t.includes('今回は本文を執筆しないため、小説テンプレートへの流し込みは行わない'),'prompt-only handling missing');
const custom={id:'custom_1',label:'随筆・横書き10.5pt',filename:'essay-template.docx',writing:'横書き',fontSize:'10.5pt',illustration:false,rulesKey:'generic',custom:true};
t=buildPrompt({...base,wordOutput:'custom_1',wordTemplate:custom});
assert(t.includes('essay-template.docx'),'custom template filename missing');
assert(t.includes('ユーザーが追加した原本'),'custom template safety rule missing');
assert(t.includes('横書き'),'custom writing direction missing');
assert(!t.includes('原本のA4縦、縦書き'),'custom template must not force built-in vertical layout');
assert(resolveTemplate({wordOutput:'template12'}).filename==='12point.docx','registry resolve failed');
console.log('prompt tests passed');

// v1.4.1: template content must be fully replaced
{
 const base={format:'short',kind:'フィクション',task:'new',topic:'政治・権力',idea:'',authorName:'星新一',traits:'簡潔な構成',length:'約2,000字',chapters:'おまかせ',ending:'問いを残す',notes:'',materials:'',wordOutput:'template11',wordTemplate:{id:'template11',filename:'11point&挿絵.docx',label:'11point',rulesKey:'template11',writing:'縦書き',fontSize:'11pt',illustration:true}};
 const t=buildPrompt(base);
 assert(t.includes('原本は書式・レイアウト・スタイルの器としてのみ使用する'),'content-only template rule missing');
 assert(t.includes('目次は完成作品の章・節と最終ページ番号から作り直す'),'toc replacement rule missing');
 assert(t.includes('テンプレート由来のサンプル内容は最終成果物に0件'),'zero-sample validation rule missing');
 const g=buildPrompt({...base,wordOutput:'custom1',wordTemplate:{id:'custom1',filename:'custom.docx',label:'custom',rulesKey:'generic',custom:true,writing:'横書き',fontSize:'10.5pt',illustration:false}});
 assert(g.includes('内容要素は、完成作品へそのまま残してはならない'),'generic replacement rule missing');
}

// v1.5 registry and specific template rules
{
 const ids=['shortCompact','mediumChapter','longTocChapter','essay','nonfictionDocumentary','columnReview','horizontalGeneral','photoIllustration'];
 for(const id of ids){
  const tpl=globalThis.TEMPLATE_LIBRARY.find(x=>x.id===id); assert(!!tpl,`missing v1.5 template ${id}`);
  const txt=buildPrompt({...base,wordOutput:id,wordTemplate:tpl}); assert(txt.includes(tpl.filename),`filename missing ${id}`);
  assert(txt.includes('テンプレート由来のサンプル内容は最終成果物に0件'),`replacement rule missing ${id}`);
 }
 const photo=globalThis.TEMPLATE_LIBRARY.find(x=>x.id==='photoIllustration');
 assert(buildPrompt({...base,wordOutput:'photoIllustration',wordTemplate:photo}).includes('空の枠や「画像」等の見本文字を残さない'),'photo template specific rule missing');
}
console.log('v1.5 tests passed');

// v1.5.1 animation reference selector
{
 const v=buildPrompt({...base,format:'video',tool:'Google Vids',wordOutput:'none',animatorName:'チャック・ジョーンズ',animatorTraits:'間を生かしたギャグ、明快な誇張'});
 assert(v.includes('アニメーション表現の参考：チャック・ジョーンズ'),'animation creator name missing');
 assert(v.includes('固有名を生成プロンプトへコピーせず'),'name-to-traits translation rule missing');
 const n=buildPrompt({...base,format:'short',wordOutput:'none',animatorName:'今敏',animatorTraits:'マッチカット'});
 assert(!n.includes('アニメーション表現の参考：今敏'),'animation reference must not leak into prose outputs');
}
console.log('v1.5.1 animator tests passed');

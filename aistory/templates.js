(function(root){
'use strict';
const TEMPLATE_LIBRARY=[
  {
    "id": "template11",
    "label": "小説・縦書き11pt・挿絵あり",
    "filename": "11point&挿絵.docx",
    "href": "templates/11point%26挿絵.docx",
    "preview": "templates/previews/11point-illustration.png",
    "writing": "縦書き",
    "fontSize": "11pt",
    "illustration": true,
    "toc": true,
    "chapterBreak": true,
    "verified": true,
    "status": "実ファイル検証済み",
    "recommendedFormats": [
      "short",
      "medium",
      "long"
    ],
    "recommendedKinds": [
      "フィクション",
      "随筆・エッセイ"
    ],
    "description": "表紙・目次・縦書き本文・章題・ページ番号に加え、挿絵配置を含む本組み用。短編〜長編小説に向く。",
    "rulesKey": "template11"
  },
  {
    "id": "template12",
    "label": "小説・縦書き12pt・本文重視",
    "filename": "12point.docx",
    "href": "templates/12point.docx",
    "preview": "templates/previews/12point.png",
    "writing": "縦書き",
    "fontSize": "12pt",
    "illustration": false,
    "toc": true,
    "chapterBreak": true,
    "verified": true,
    "status": "実ファイル検証済み",
    "recommendedFormats": [
      "short",
      "medium",
      "long",
      "book"
    ],
    "recommendedKinds": [
      "フィクション",
      "ノンフィクション",
      "ドキュメンタリー"
    ],
    "description": "表紙・目次・縦書き本文・章ごとの改ページを備えた本文重視の本組み用。文字をやや大きく見せたい作品向け。",
    "rulesKey": "template12"
  },
  {
    "id": "shortCompact",
    "label": "短編小説向け・コンパクト版",
    "filename": "short-compact.docx",
    "href": "templates/short-compact.docx",
    "preview": "templates/previews/short-compact.png",
    "writing": "縦書き",
    "fontSize": "11pt",
    "illustration": false,
    "toc": false,
    "chapterBreak": false,
    "verified": true,
    "status": "v1.5検証済み",
    "recommendedFormats": [
      "short"
    ],
    "recommendedKinds": [
      "フィクション"
    ],
    "description": "A5縦書き。表紙＋本文＋最小限の奥付で、短い作品をすっきり収める。目次を必須としない。",
    "rulesKey": "shortCompact"
  },
  {
    "id": "mediumChapter",
    "label": "中編小説向け・章構成重視",
    "filename": "medium-chapter.docx",
    "href": "templates/medium-chapter.docx",
    "preview": "templates/previews/medium-chapter.png",
    "writing": "縦書き",
    "fontSize": "11pt",
    "illustration": false,
    "toc": true,
    "chapterBreak": true,
    "verified": true,
    "status": "v1.5検証済み",
    "recommendedFormats": [
      "medium"
    ],
    "recommendedKinds": [
      "フィクション"
    ],
    "description": "A5縦書き。目次と章単位の改ページを重視し、複数章の読みやすさを優先。",
    "rulesKey": "mediumChapter"
  },
  {
    "id": "longTocChapter",
    "label": "長編小説向け・目次／章扉付き",
    "filename": "long-toc-chapter.docx",
    "href": "templates/long-toc-chapter.docx",
    "preview": "templates/previews/long-toc-chapter.png",
    "writing": "縦書き",
    "fontSize": "11pt",
    "illustration": false,
    "toc": true,
    "chapterBreak": true,
    "verified": true,
    "status": "v1.5検証済み",
    "recommendedFormats": [
      "long"
    ],
    "recommendedKinds": [
      "フィクション"
    ],
    "description": "A5縦書き。部・章に対応する目次と章扉を備え、長編の構造を明確に見せる。",
    "rulesKey": "longTocChapter"
  },
  {
    "id": "essay",
    "label": "随筆・エッセイ向け",
    "filename": "essay.docx",
    "href": "templates/essay.docx",
    "preview": "templates/previews/essay.png",
    "writing": "縦書き",
    "fontSize": "11pt",
    "illustration": false,
    "toc": false,
    "chapterBreak": false,
    "verified": true,
    "status": "v1.5検証済み",
    "recommendedFormats": [
      "article",
      "short"
    ],
    "recommendedKinds": [
      "随筆・エッセイ"
    ],
    "description": "A5縦書き。小見出しを柔軟に使い、観察・経験・思索を自然につなぐ余白のある構成。",
    "rulesKey": "essay"
  },
  {
    "id": "nonfictionDocumentary",
    "label": "ノンフィクション／ドキュメンタリー向け",
    "filename": "nonfiction-documentary.docx",
    "href": "templates/nonfiction-documentary.docx",
    "preview": "templates/previews/nonfiction-documentary.png",
    "writing": "横書き",
    "fontSize": "10.5pt",
    "illustration": true,
    "toc": true,
    "chapterBreak": true,
    "verified": true,
    "status": "v1.5検証済み",
    "recommendedFormats": [
      "book",
      "article"
    ],
    "recommendedKinds": [
      "ノンフィクション",
      "ドキュメンタリー"
    ],
    "description": "A4横書き。目次、引用・証言、写真・資料、出典欄を備え、事実と根拠を整理しやすい。",
    "rulesKey": "nonfictionDocumentary"
  },
  {
    "id": "columnReview",
    "label": "コラム・評論向け",
    "filename": "column-review.docx",
    "href": "templates/column-review.docx",
    "preview": "templates/previews/column-review.png",
    "writing": "横書き",
    "fontSize": "10.5pt",
    "illustration": false,
    "toc": false,
    "chapterBreak": false,
    "verified": true,
    "status": "v1.5検証済み",
    "recommendedFormats": [
      "article"
    ],
    "recommendedKinds": [
      "コラム"
    ],
    "description": "A4横書き。タイトル、リード、問題提起、背景、検討、結論を一続きで読ませる記事型。",
    "rulesKey": "columnReview"
  },
  {
    "id": "horizontalGeneral",
    "label": "横書き一般文書型",
    "filename": "horizontal-general.docx",
    "href": "templates/horizontal-general.docx",
    "preview": "templates/previews/horizontal-general.png",
    "writing": "横書き",
    "fontSize": "11pt",
    "illustration": false,
    "toc": true,
    "chapterBreak": true,
    "verified": true,
    "status": "v1.5検証済み",
    "recommendedFormats": [
      "article",
      "book",
      "short",
      "medium"
    ],
    "recommendedKinds": [
      "ノンフィクション",
      "コラム",
      "随筆・エッセイ",
      "フィクション"
    ],
    "description": "A4横書きの汎用型。表紙・目次・階層見出しを備え、小説以外の論考や報告にも使いやすい。",
    "rulesKey": "horizontalGeneral"
  },
  {
    "id": "photoIllustration",
    "label": "写真・挿絵を多用する作品向け",
    "filename": "photo-illustration.docx",
    "href": "templates/photo-illustration.docx",
    "preview": "templates/previews/photo-illustration.png",
    "writing": "横書き",
    "fontSize": "10.5pt",
    "illustration": true,
    "toc": false,
    "chapterBreak": true,
    "verified": true,
    "status": "v1.5検証済み",
    "recommendedFormats": [
      "short",
      "article",
      "book"
    ],
    "recommendedKinds": [
      "フィクション",
      "ドキュメンタリー",
      "ノンフィクション",
      "随筆・エッセイ"
    ],
    "description": "A4横書き。全幅・2点並列・大判など複数の画像領域とキャプションを持つビジュアル重視型。",
    "rulesKey": "photoIllustration"
  }
];
function cloneTemplate(t){return JSON.parse(JSON.stringify(t));}
function getTemplateById(id){const t=TEMPLATE_LIBRARY.find(x=>x.id===id);return t?cloneTemplate(t):null;}
root.TEMPLATE_LIBRARY=TEMPLATE_LIBRARY.map(cloneTemplate);
root.getTemplateById=getTemplateById;
if(typeof module!=='undefined')module.exports={TEMPLATE_LIBRARY:TEMPLATE_LIBRARY.map(cloneTemplate),getTemplateById};
})(typeof window!=='undefined'?window:globalThis);

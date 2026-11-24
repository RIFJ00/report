/* Browser-only converter for HTML files exported by the RIFJ URL-to-HTML generator.
 * It does not fetch remote URLs or publish to Firebase.
 */
import {dateFrom,normalizeArticle} from './article-utils.mjs';
const attr=(root,selector,name='content')=>root.querySelector(selector)?.getAttribute(name)?.trim()||'';
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const resolveHttp=(value,base)=>{
 if(!value)return '';
 try{const url=new URL(value,base);return /^https?:$/.test(url.protocol)?url.href:''}catch{return ''}
};
function findPublishedJsonLd(doc){
 for(const script of doc.querySelectorAll('script[type="application/ld+json"]')){
  try{
   const root=JSON.parse(script.textContent);
   const queue=[root];let count=0;
   while(queue.length&&count++<300){
    const item=queue.shift();if(!item||typeof item!=='object')continue;
    if(Array.isArray(item)){queue.push(...item);continue}
    const t=item['@type'];const types=Array.isArray(t)?t:[t];
    if(types.some(x=>/Article|NewsArticle|BlogPosting|Report|WebPage/i.test(String(x)))){
      const found=dateFrom(item.datePublished);if(found)return found;
    }
    for(const key of ['@graph','mainEntity','itemListElement','hasPart'])if(item[key])queue.push(item[key]);
   }
  }catch{/* Invalid JSON-LD is ignored */}
 }
 return '';
}
export function extractArticleFromHTML(html,{sourceUrl,uploadDate,ministry='',category='',title='',status='draft'}={}){
 if(typeof DOMParser==='undefined')throw Error('HTMLパーサーが利用できません。ブラウザで開いてください');
 if(!/^https?:\/\//i.test(sourceUrl||''))throw Error('元記事URLを入力してください');
 const doc=new DOMParser().parseFromString(String(html),'text/html');
 const headline=clean(title||attr(doc,'meta[property="og:title"]')||attr(doc,'meta[name="twitter:title"]')||doc.querySelector('article h1,main h1,h1')?.textContent||doc.title);
 const dates=[
  attr(doc,'meta[property="article:published_time"]'),
  attr(doc,'meta[name="datePublished"]'),
  attr(doc,'meta[itemprop="datePublished"]'),
  attr(doc,'meta[name="publication_date"]'),
  attr(doc,'meta[name="pubdate"]'),
  attr(doc,'time[datetime]','datetime'),
  findPublishedJsonLd(doc)
 ];
 const publishedAt=dates.map(dateFrom).find(Boolean)||'';
 // Never treat modified_time, dateModified, download timestamps or source filenames as publication date.
 const image=attr(doc,'meta[property="og:image"]')||attr(doc,'meta[name="twitter:image"]')||
   doc.querySelector('article img[src], main img[src]')?.getAttribute('src')||'';
 const content=doc.querySelector('article')||doc.querySelector('main')||doc.body;
 if(!content)throw Error('本文を抽出できません');
 const root=content.cloneNode(true);
 root.querySelectorAll('script,style,iframe,form,object,embed,noscript,svg,button,input,textarea,select,template,base,link').forEach(n=>n.remove());
 root.querySelectorAll('*').forEach(el=>{
  [...el.attributes].forEach(a=>{if(/^on/i.test(a.name)||['srcdoc','integrity','style','srcset','formaction','xlink:href'].includes(a.name.toLowerCase()))el.removeAttribute(a.name)});
  for(const a of ['src','href','poster']){
   const v=el.getAttribute(a);if(v){const safe=resolveHttp(v,sourceUrl);if(safe)el.setAttribute(a,safe);else el.removeAttribute(a)}
  }
 });
 const bodyText=clean(root.textContent).slice(0,250000);
 const safeHtml='<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><style>body{font:16px/1.8 system-ui,sans-serif;color:#22374a;max-width:850px;margin:24px auto;padding:0 16px}img{max-width:100%;height:auto}table{max-width:100%;display:block;overflow:auto}a{color:#1666a0}</style></head><body>'+root.outerHTML+'</body></html>';
 const normalized=normalizeArticle({
  title:headline,sourceUrl,ministry,category,publishedAt,
  imageUrl:resolveHttp(image,sourceUrl),text:bodyText,
  summary:attr(doc,'meta[name="description"]')||attr(doc,'meta[property="og:description"]'),
  html:safeHtml,status
 },{uploadDate});
 return {...normalized,extraction:{publishedAtDetected:Boolean(publishedAt),imageDetected:Boolean(image),bodyTextLength:bodyText.length}};
}

/* Shared import and validation logic. Browser ES module; no Firebase credentials. */
const permittedStatuses = new Set(['published','draft','private']);
const ymd = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const safeHTTP = value => {if (!value) return ''; try {const u = new URL(String(value)); return /^https?:$/.test(u.protocol) ? u.href : ''} catch{return ''}};
export function dateFrom(value) {
 if (!value) return '';
 const s = typeof value === 'string' ? value.trim() : String(value);
 const eraNormalized=s.replace(/^(令和|平成)(\d{1,2}|元)年/,(_,era,n)=>String((era==='令和'?2018:1988)+(n==='元'?1:Number(n)))+'年');
 const m=eraNormalized.match(/^(\d{4})[-.年\\/](\d{1,2})[-.月\\/](\d{1,2})(?=日|$|[T\s])/);
 const d=m?m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0'):'';
 if (!ymd.test(d)) return '';
 const [y,m,day] = d.split('-').map(Number);
 return new Date(Date.UTC(y,m-1,day)).toISOString().slice(0,10) === d ? d : '';
}
export function canonicalUrl(value){
 const u = safeHTTP(value); if(!u) return '';
 const parsed = new URL(u); parsed.hash=''; parsed.hostname=parsed.hostname.toLowerCase();
 if (parsed.pathname !== '/') parsed.pathname=parsed.pathname.replace(/\/+$/,'');
 return parsed.href;
}
export function normalizeArticle(raw,{uploadDate}={}){
 if(!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('記事はオブジェクトで指定してください');
 const title=String(raw.title??'').trim();
 const sourceUrl=canonicalUrl(raw.sourceUrl);
 if(!title) throw Error('タイトルがありません');
 if(!sourceUrl) throw Error('有効な出典URLがありません');
 const date=dateFrom(raw.publishedAt??raw.publicationDate);
 const upload=dateFrom(uploadDate);
 if(!date && !upload) throw Error('元記事の日付がない場合は登録日を指定してください');
 const publishedAt=date||upload;
 const dateOrigin=date ? (raw.publishedAtSource === 'upload' ? 'upload' : 'source') : 'upload';
 const id=String(raw.id??'').trim();
 const status=String(raw.status??'draft').trim();
 if(!permittedStatuses.has(status)) throw Error('公開状態が不正です');
 const imageUrl=safeHTTP(raw.imageUrl);
 const htmlUrl=safeHTTP(raw.htmlUrl);
 return {
  id, title, ministry:String(raw.ministry??'').trim(), category:String(raw.category??'').trim(),
  sourceUrl, publishedAt, publishedAtSource:dateOrigin,
  imageUrl, summary:String(raw.summary??''), text:String(raw.text??''),
  html:String(raw.html??''), htmlUrl, status
 };
}
export function mergeArticles(existing,incoming,{uploadDate}={}){
 const output=Array.isArray(existing)?existing.map(x=>({...x})):[];
 const byUrl=new Map(output.map((a,i)=>[canonicalUrl(a.sourceUrl),i]));
 const stats={added:0,updated:0,errors:[]};
 incoming.forEach((raw,index)=>{
  try {
   const article=normalizeArticle(raw,{uploadDate});
   const i=byUrl.get(article.sourceUrl);
   if(i!==undefined){
    const original=output[i];
    output[i]={...original,...article,id:article.id||original.id,
      publishedAt:article.publishedAtSource==='upload' && original.publishedAtSource==='source' ? original.publishedAt : article.publishedAt,
      publishedAtSource:article.publishedAtSource==='upload' && original.publishedAtSource==='source' ? 'source':article.publishedAtSource
    };
    stats.updated++;
   } else {
    article.id=article.id||'article-'+(output.length+1).toString().padStart(5,'0');
    while(output.some(x=>x.id===article.id)) article.id+='-new';
    byUrl.set(article.sourceUrl,output.length);output.push(article);stats.added++;
   }
  }catch(e){stats.errors.push({row:index+1,message:String(e.message||e)})}
 });
 return {articles:output,stats};
}
export function validateFeed(articles){
 if(!Array.isArray(articles)) throw Error('articles.json は配列である必要があります');
 const issues=[],ids=new Set(),urls=new Set();
 articles.forEach((r,i)=>{
  try{const a=normalizeArticle(r,{uploadDate:r.publishedAt});if(!String(r.id??'').trim())issues.push('行'+(i+1)+': IDが空です');
    if(ids.has(r.id))issues.push('行'+(i+1)+': ID重複');ids.add(r.id);
    if(urls.has(a.sourceUrl))issues.push('行'+(i+1)+': 出典URL重複');urls.add(a.sourceUrl);
  }catch(e){issues.push('行'+(i+1)+': '+e.message)}
 });
 return issues;
}

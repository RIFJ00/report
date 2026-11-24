/**
 * RIFJ article preview v1.8.1 - fragment navigation without iframe scripting.
 *
 * All article-local URLs are rewritten to explicit about:srcdoc#... links.
 * This makes them stay inside the current iframe even when the original article
 * contains target="_blank" or <base target="_blank">. No article scripts run.
 * Thumbnail zoom uses CSS :target inside the iframe; it does not open a page,
 * request login, or need access to parent-window JS. Saved HTML is unchanged.
 */
// Copyright line is presentation-related; never change the source article text.
export const ARTICLE_FOOTER='©政策リサーチ | 一般社団法人日本みらい研';
export const OLD_COLUMN_NOTICE='自社公開記事を元に、一般社団法人日本みらい研がHTMLのレイアウト・目次を加工しました。';
export const NEW_COLUMN_NOTICE='日本みらい研のコラム記事を元に、HTMLのレイアウト・目次を加工しました。原文との照合をお願いします。';
// v1.10.3: Fix a *stored* MHLW article whose hero image is the Adobe Reader aid.
// This runs in the administrator and public viewers and in HTML exports.
const RIFJ_MHLW_FALLBACK='https://html-viewer-703b6.web.app/assets/fallback_mhlw.png';
function repairMhlwReaderThumbnail(markup){
  if(typeof markup!=='string' || !markup.includes('hero-thumb'))return markup;
  // Do not parse every article: the PDF helper has a recognizable URL or label.
  if(!/(?:adobe|acrobat|reader|PDF閲覧|PDFファイルを見るためには)/i.test(markup))return markup;
  const article=new DOMParser().parseFromString(markup,'text/html');
  const source=article.querySelector('link[rel="canonical"]')?.getAttribute('href')||'';
  const ministry=article.querySelector('.hero .meta')?.textContent||'';
  if(!/mhlw\.go\.jp/i.test(source) && !ministry.includes('厚生労働省'))return markup;
  const figure=article.querySelector('figure.hero-thumb');
  const img=figure?.querySelector('img[src]');
  if(!img)return markup;
  const location=[img.getAttribute('src'),img.getAttribute('alt'),img.getAttribute('title'),
    img.closest('a')?.getAttribute('href'),figure.querySelector('figcaption')?.textContent].join(' ');
  if(!/(?:adobe|acrobat|reader|PDF閲覧|PDFファイルを見るためには)/i.test(location))return markup;
  img.setAttribute('src',RIFJ_MHLW_FALLBACK);
  img.setAttribute('alt','厚生労働省の資料（日本みらい研作成の見出し用画像）');
  let caption=figure.querySelector('figcaption');
  if(!caption){caption=article.createElement('figcaption');figure.appendChild(caption)}
  caption.textContent='見出し用画像：日本みらい研作成（原文写真ではありません）';
  // A legacy HTML document can contain an already-built zoom overlay.
  // Rebuild it from the corrected image when prepareArticlePreviewHtml() runs.
  article.querySelector('#rifj-photo-enlargement')?.remove();
  article.documentElement.setAttribute('data-rifj-mhlw-thumbnail-fixed','1');
  return '<!doctype html>\n'+article.documentElement.outerHTML;
}
export function normalizeArticleFooter(markup){
  if(typeof markup!=='string')return '';
  // Presentation-time replacements; the stored HTML source is unchanged.
  return repairMhlwReaderThumbnail(markup.replace(/(<footer\b(?=[^>]*\bsite-footer\b)[^>]*>)[\s\S]*?(<\/footer>)/gi,
      (_match,opening,closing)=>opening+ARTICLE_FOOTER+closing)
    .replace(/(<div\b[^>]*\bclass=["'][^"']*\bsource\b[^"']*["'][^>]*>)[\s\S]*?(<\/div>)/gi,
      block=>block.replace(OLD_COLUMN_NOTICE,NEW_COLUMN_NOTICE)));
}
// Publication dates are interpreted in JST, regardless of the browser's time zone.
export function publicationDateClass(published,now=new Date()){
  const date=String(published||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return '';
  const [year,month,day]=date.split('-').map(Number);
  const utc=Date.UTC(year,month-1,day);
  if(new Date(utc).toISOString().slice(0,10)!==date)return '';
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
    timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(now).map(p=>[p.type,p.value]));
  const todayUTC=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day));
  const days=(todayUTC-utc)/86400000;
  return days===0?'rifj-date-today':days===1?'rifj-date-yesterday':days===2?'rifj-date-two-days':'';
}
const PREVIEW_STYLE = `
html{scroll-padding-top:82px!important}
.site-top .site-title{min-width:0;flex:1;line-height:1.5;letter-spacing:0;overflow-wrap:anywhere;white-space:normal}
[id],a[name]{scroll-margin-top:82px!important}
.site-top{position:sticky!important;top:0!important;z-index:150!important}
.hero-thumb img{cursor:zoom-in!important}
.hero-thumb .rifj-thumb-zoom{display:block;cursor:zoom-in}
.rifj-photo-overlay{display:none!important;position:fixed!important;inset:0!important;z-index:2147483647!important;align-items:center!important;justify-content:center!important;padding:18px!important;box-sizing:border-box!important}
.rifj-photo-overlay:target{display:flex!important}
.rifj-photo-backdrop{position:absolute;inset:0;background:rgba(4,14,24,.9);cursor:zoom-out}
.rifj-photo-dialog{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:10px;max-width:97vw;max-height:93vh}
.rifj-photo-dialog>img{display:block;max-width:94vw;max-height:78vh;width:auto;height:auto;object-fit:contain;border-radius:8px;background:#173041;box-shadow:0 6px 25px #0008}
.rifj-photo-close{position:absolute;right:0;top:-35px;border:1px solid #bcdbe8;border-radius:6px;background:#103a55;color:#fff;padding:6px 12px;text-decoration:none;font-weight:700;cursor:pointer}
.rifj-photo-meta{font-size:12px;color:#fff;text-align:center;overflow-wrap:anywhere}
.rifj-photo-meta a{color:#c9f2ff}
`;
function safeText(value) {return String(value||'').slice(0,400)}
function addFragmentNavigation(document) {
  const ids=new Set([...document.querySelectorAll('[id]')].map(el=>el.id));
  for(const link of document.querySelectorAll('a[href]')){
    const raw=link.getAttribute('href').trim();
    let fragment=null;
    if(raw.startsWith('#'))fragment=raw.slice(1);
    else if(/^about:srcdoc#/i.test(raw))fragment=raw.slice(raw.indexOf('#')+1);
    else {
      // Older imported articles may have already resolved their table of
      // contents against viewer.html instead of the article document.
      try {
        const u=new URL(raw,'https://html-viewer-703b6.web.app/viewer.html');
        if(u.origin==='https://html-viewer-703b6.web.app' &&
            /^\/(?:viewer|admin)\.html$/.test(u.pathname) && u.hash){
          const key=decodeURIComponent(u.hash.slice(1));
          if(ids.has(key))fragment=u.hash.slice(1);
        }
      } catch {} // Retain unknown URLs without rewriting them.
    }
    if(fragment!==null){
      // Explicit about:srcdoc URL changes only the nested document fragment;
      // a plain # would otherwise be based on the parent /viewer.html URL.
      link.setAttribute('href','about:srcdoc#'+fragment);
      link.setAttribute('target','_self');
      link.removeAttribute('download');
    } else if(/^javascript:/i.test(raw)){
      link.removeAttribute('href');
    }
  }
}
function addThumbnailZoom(document) {
  const img=document.querySelector('.hero-thumb img[src]');
  if(!img)return;
  let src=img.getAttribute('src')?.trim()||'';
  if(src.startsWith('//'))src='https:'+src;
  if(!/^https:\/\//i.test(src) && !/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(src))return;
  const hash='about:srcdoc#rifj-photo-enlargement';
  const wrapper=img.closest('a');
  if(wrapper && wrapper.closest('.hero-thumb')){
    wrapper.setAttribute('href',hash);
    wrapper.setAttribute('target','_self');
    wrapper.classList.add('rifj-thumb-zoom');
  }else{
    const link=document.createElement('a');
    link.setAttribute('href',hash);
    link.setAttribute('target','_self');
    link.className='rifj-thumb-zoom';
    link.title='代表画像を拡大表示';
    img.parentNode.insertBefore(link,img);link.appendChild(img);
  }
  // Older saved articles may include an overlay from v3.12. Keep it if it
  // exists; just enforce fragment navigation & visibility with our CSS.
  let overlay=document.getElementById('rifj-photo-enlargement');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='rifj-photo-enlargement';
    overlay.className='rifj-photo-overlay';
    overlay.setAttribute('aria-label','画像の拡大表示');
    const backdrop=document.createElement('a');
    backdrop.className='rifj-photo-backdrop';
    backdrop.href='about:srcdoc#rifj-photo-closed';
    backdrop.setAttribute('aria-label','拡大画像を閉じる');
    const dialog=document.createElement('div');
    dialog.className='rifj-photo-dialog';
    dialog.setAttribute('role','group');
    const close=document.createElement('a');
    close.className='rifj-photo-close';close.href='about:srcdoc#rifj-photo-closed';
    close.textContent='× 閉じる';
    const large=document.createElement('img');
    large.src=src;large.alt=img.alt||'代表画像';
    large.setAttribute('referrerpolicy','no-referrer');
    const meta=document.createElement('div');meta.className='rifj-photo-meta';
    meta.textContent=safeText(img.closest('figure')?.querySelector('figcaption')?.textContent||img.alt||'');
    dialog.append(close,large,meta);overlay.append(backdrop,dialog);
    document.body.appendChild(overlay);
  }
  // Existing overlay from v3.12 may have #close links with target=_blank.
  // The common fragment rewrite above fixes them before this step.
  for(const a of overlay.querySelectorAll('a[href^="#"],a[href^="about:srcdoc#"]')){
    const raw=a.getAttribute('href');
    const fragment=raw.startsWith('#')?raw.slice(1):raw.slice(raw.indexOf('#')+1);
    a.setAttribute('href','about:srcdoc#'+fragment);
    a.setAttribute('target','_self');
  }
}
export function prepareArticlePreviewHtml(markup, selectedTitle = '', published = '') {
  if(typeof markup!=='string')return '';
  if(!markup.trim())return '';
  const document=new DOMParser().parseFromString(normalizeArticleFooter(markup),'text/html');
  // Only the display preview changes; the original stored/downloaded HTML stays intact.
  const displayTitle=String(selectedTitle||'').trim();
  if(displayTitle){
    const headerTitle=document.querySelector('.site-top .site-title');
    if(headerTitle){
      headerTitle.textContent=displayTitle;
      headerTitle.title=displayTitle;
    }
  }
  // Dates in the right preview keep the article's ordinary text color.
  // Publication-date urgency colors are applied only to left-list <time> nodes.
  // Remove a <base> tag which can silently turn any # link into a new
  // viewer.html tab. Article-local fragment references are all explicit.
  for(const base of document.querySelectorAll('base'))base.remove();
  const style=document.createElement('style');
  style.id='rifj-preview-v15';style.textContent=PREVIEW_STYLE;
  document.head.appendChild(style);
  addFragmentNavigation(document);
  addThumbnailZoom(document);
  document.documentElement.setAttribute('data-rifj-preview','1.8.1');
  return '<!doctype html>\n'+document.documentElement.outerHTML;
}

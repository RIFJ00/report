/* Pure, local preflight. No Firebase network call. */
import {canonicalUrl,validateFeed} from '../html-viewer/article-utils.mjs';
export function buildSaveReview(local,remote){
 const issues=validateFeed(local);
 if(issues.length)return {ok:false,issues};
 const map=new Map(remote.map(a=>[canonicalUrl(a.sourceUrl),a]));
 let added=0,updated=0,unchanged=0,published=0,unpublished=0;
 const warnings=[];
 for(const item of local){
  const prev=map.get(canonicalUrl(item.sourceUrl));
  if(!prev){added++; if(item.status==='published')published++;continue;}
  const keys=['title','publishedAt','publishedAtSource','ministry','category','imageUrl','summary','text','html','htmlUrl','status'];
  const different=keys.some(k=>String(item[k]??'')!==String(prev[k]??''));
  if(different)updated++;else unchanged++;
  if(prev.status!=='published'&&item.status==='published')published++;
  if(prev.status==='published'&&item.status!=='published')unpublished++;
 }
 if(published)warnings.push('公開状態に変わる記事: '+published+'件');
 if(unpublished)warnings.push('非公開に変わる記事: '+unpublished+'件');
 if(added+updated>350)warnings.push('複数バッチに分かれるため、部分成功の可能性があります');
 return {ok:true,total:local.length,added,updated,unchanged,published,unpublished,warnings};
}

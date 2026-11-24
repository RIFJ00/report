/* Pure and side-effect-free Firestore save planning. */
import {canonicalUrl,validateFeed} from '../html-viewer/article-utils.mjs';
const COMPARABLE_FIELDS=['title','publishedAt','publishedAtSource','ministry','category','imageUrl','summary','text','html','htmlUrl','status'];
export function planSaveChanges(local,remote){
 if(!Array.isArray(local)||!Array.isArray(remote))throw Error('記事データは配列で指定してください');
 const issues=validateFeed(local);
 if(issues.length)return {ok:false,issues};
 const map=new Map(remote.map(a=>[canonicalUrl(a.sourceUrl),a]));
 let added=0,updated=0,unchanged=0,published=0,unpublished=0;
 const changes=[],warnings=[];
 for(const item of local){
  const url=canonicalUrl(item.sourceUrl);
  const prev=map.get(url);
  if(!prev){
   added++;
   if(item.status==='published')published++;
   changes.push(item);
   continue;
  }
  const different=COMPARABLE_FIELDS.some(k=>String(item[k]??'')!==String(prev[k]??''));
  if(!different){unchanged++;continue}
  updated++;
  if(prev.status!=='published'&&item.status==='published')published++;
  if(prev.status==='published'&&item.status!=='published')unpublished++;
  changes.push(item);
 }
 if(published)warnings.push('公開状態に変わる記事: '+published+'件');
 if(unpublished)warnings.push('非公開に変わる記事: '+unpublished+'件');
 if(changes.length>350)warnings.push('複数バッチに分かれるため、部分成功の可能性があります');
 return {ok:true,total:local.length,added,updated,unchanged,published,unpublished,warnings,changes};
}
export function buildSaveReview(local,remote){
 const {changes,...review}=planSaveChanges(local,remote);
 return review;
}

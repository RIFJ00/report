/* Plan proposed changes without mutating Firestore. */
import {canonicalUrl,validateFeed} from '../html-viewer/article-utils.mjs';
export function summarizeMinistrySave(local,remote){
 if(!Array.isArray(local)||!Array.isArray(remote))throw Error('記事データは配列で指定してください');
 const issues=validateFeed(local);
 if(issues.length)throw Error(issues.join(' / '));
 const remoteByURL=new Map(remote.map(r=>[canonicalUrl(r.sourceUrl),r]));
 const summary={total:local.length,added:0,updated:0,newlyPublished:0,withdrawn:0,publicTotal:0,unchanged:0};
 for(const entry of local){
  const previous=remoteByURL.get(canonicalUrl(entry.sourceUrl));
  if(entry.status==='published')summary.publicTotal++;
  if(!previous)summary.added++;else {
   if(JSON.stringify({...previous,id:undefined})===JSON.stringify({...entry,id:undefined}))summary.unchanged++;else summary.updated++;
  }
  if(entry.status==='published' && previous?.status!=='published')summary.newlyPublished++;
  if(entry.status!=='published' && previous?.status==='published')summary.withdrawn++;
 }
 return summary;
}

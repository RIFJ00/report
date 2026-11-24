#!/usr/bin/env node
/**
 * Firebase Auth admin-claim bootstrap. Designed for trusted local operators ONLY.
 * DEFAULT IS READ-ONLY. Never put service-account JSON or credentials in Git.
 *
 * Google Cloud ADC required, with least-privileged Firebase Auth administration.
 * npm install --no-save firebase-admin
 *
 * node html-viewer/tools/admin-claim.mjs --uid FIREBASE_AUTH_UID
 * node html-viewer/tools/admin-claim.mjs --uid FIREBASE_AUTH_UID --grant --confirm GRANT_RIFJ_ADMIN_HTML_VIEWER_703B6
 */
export const PROJECT_ID='html-viewer-703b6';
export const CONFIRM_GRANT='GRANT_RIFJ_ADMIN_HTML_VIEWER_703B6';
export const CONFIRM_REVOKE='REVOKE_RIFJ_ADMIN_HTML_VIEWER_703B6';
export function parseArgs(args){
 const opts={uid:null,mode:'inspect',confirm:null};
 for(let i=0;i<args.length;i++){
  const a=args[i];
  if(a==='--uid')opts.uid=args[++i];
  else if(a==='--grant'){if(opts.mode!=='inspect')throw Error('Select exactly one operation');opts.mode='grant'}
  else if(a==='--revoke'){if(opts.mode!=='inspect')throw Error('Select exactly one operation');opts.mode='revoke'}
  else if(a==='--confirm')opts.confirm=args[++i];
  else throw Error('Unknown argument: '+a);
 }
 if(typeof opts.uid!=='string'||!opts.uid.trim()||opts.uid.length>128||! /^[A-Za-z0-9:_-]+$/.test(opts.uid))throw Error('Provide a valid Firebase Auth UID using --uid');
 const expected=opts.mode==='grant'?CONFIRM_GRANT:opts.mode==='revoke'?CONFIRM_REVOKE:null;
 if(expected&&opts.confirm!==expected)throw Error('Operation requires exact --confirm '+expected);
 if(!expected&&opts.confirm)throw Error('Unnecessary confirmation for read-only inspection');
 return opts;
}
export function planAdminClaim(user,mode){
 if(!user?.uid)throw Error('Firebase Auth user not found');
 const existing=user.customClaims??{};
 const before=existing.rifjAdmin===true;
 if(mode==='inspect')return {uid:user.uid,email:user.email??null,hasAdminClaim:before,mode,changed:false,nextClaims:null};
 const after=mode==='grant';
 return {
  uid:user.uid,email:user.email??null,hasAdminClaim:before,mode,changed:before!==after,
  nextClaims:{...existing,rifjAdmin:after}
 };
}
export async function execute(options,{getAuth,projectId}){
 if(projectId!==PROJECT_ID)throw Error('Refusing credentials targeting another Firebase project: '+String(projectId));
 const auth=getAuth();
 const user=await auth.getUser(options.uid);
 const plan=planAdminClaim(user,options.mode);
 if(plan.changed){
  await auth.setCustomUserClaims(options.uid,plan.nextClaims);
 }
 return {projectId:PROJECT_ID,...plan,nextClaims:undefined,changed:plan.changed,action:plan.changed?'updated':'no-change'};
}
async function run(){
 const args=parseArgs(process.argv.slice(2));
 const {initializeApp,applicationDefault,getApps}=await import('firebase-admin/app');
 const {getAuth}=await import('firebase-admin/auth');
 const app=getApps().find(a=>a.name==='rifj-admin-claim-tool')??initializeApp({
  credential:applicationDefault(),projectId:PROJECT_ID
 },'rifj-admin-claim-tool');
 // Inspect the project identity before requesting any Auth operation.
 if(app.options.projectId!==PROJECT_ID)throw Error('Wrong Firebase project');
 const result=await execute(args,{getAuth:()=>getAuth(app),projectId:app.options.projectId});
 console.log(JSON.stringify(result,null,2));
 if(args.mode!=='inspect')console.log('User must sign out/in or refresh the ID token for the claim change to take effect.');
}
if(process.argv[1]?.endsWith('admin-claim.mjs'))run().catch(e=>{console.error(e.message);process.exitCode=1});

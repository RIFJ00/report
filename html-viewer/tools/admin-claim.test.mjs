import test from 'node:test';
import assert from 'node:assert/strict';
import {parseArgs,planAdminClaim,execute,PROJECT_ID,CONFIRM_GRANT,CONFIRM_REVOKE} from './admin-claim.mjs';

test('default inspect mode is read only and requires UID',()=>{
 assert.deepEqual(parseArgs(['--uid','firebase-user-1']),{uid:'firebase-user-1',mode:'inspect',confirm:null});
 assert.throws(()=>parseArgs([]),/UID/);
 assert.throws(()=>parseArgs(['--uid','../bad']),/UID/);
});
test('grant and revoke require distinct exact confirmation',()=>{
 assert.throws(()=>parseArgs(['--uid','u','--grant']),/--confirm/);
 assert.throws(()=>parseArgs(['--uid','u','--revoke','--confirm',CONFIRM_GRANT]),/--confirm/);
 assert.equal(parseArgs(['--uid','u','--grant','--confirm',CONFIRM_GRANT]).mode,'grant');
 assert.equal(parseArgs(['--uid','u','--revoke','--confirm',CONFIRM_REVOKE]).mode,'revoke');
 assert.throws(()=>parseArgs(['--uid','u','--grant','--revoke']),/exactly one/);
});
test('merges existing unrelated claims safely',()=>{
 const plan=planAdminClaim({uid:'u',email:'operator@example.org',customClaims:{otherRole:true}},'grant');
 assert.deepEqual(plan.nextClaims,{otherRole:true,rifjAdmin:true});
});
test('inspect never calls privileged setter and wrong project is rejected first',async()=>{
 let got=0,writes=0;
 const auth={getUser:async()=>{got++;return {uid:'u',customClaims:{rifjAdmin:true}}},setCustomUserClaims:async()=>{writes++}};
 await assert.rejects(execute({uid:'u',mode:'inspect'},{getAuth:()=>auth,projectId:'another-project'}),/Refusing/);
 assert.equal(got,0);assert.equal(writes,0);
 const read=await execute({uid:'u',mode:'inspect'},{getAuth:()=>auth,projectId:PROJECT_ID});
 assert.equal(read.hasAdminClaim,true);assert.equal(read.changed,false);
 assert.equal(got,1);assert.equal(writes,0);
});
test('grant and revoke are idempotent and retain existing claims',async()=>{
 let calls=0;
 const user={uid:'u',customClaims:{unrelated:true}};
 const auth={
  getUser:async()=>user,
  setCustomUserClaims:async (_uid,claims)=>{calls++;user.customClaims=claims}
 };
 const deps={getAuth:()=>auth,projectId:PROJECT_ID};
 await execute({uid:'u',mode:'grant'},deps);
 assert.equal(calls,1);assert.deepEqual(user.customClaims,{unrelated:true,rifjAdmin:true});
 await execute({uid:'u',mode:'grant'},deps);
 assert.equal(calls,1);
 await execute({uid:'u',mode:'revoke'},deps);
 assert.equal(calls,2);assert.deepEqual(user.customClaims,{unrelated:true,rifjAdmin:false});
});

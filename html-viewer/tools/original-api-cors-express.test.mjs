import test from 'node:test';
import assert from 'node:assert/strict';
import {originalApiCors,REPORT_ORIGIN} from './original-api-cors-express.example.mjs';

function fake(method,origin){
  const headers={},events=[];
  let nextCount=0;
  const res={
    statusCode:200,
    setHeader(k,v){headers[k.toLowerCase()]=v},
    vary(v){headers.vary=v},
    end(body){events.push({status:this.statusCode,body})}
  };
  originalApiCors({method,headers:origin?{origin}:{}},res,()=>nextCount++);
  return {headers,events,nextCount};
}
test('authorized frontend preflight is answered without authentication',()=>{
 const x=fake('OPTIONS',REPORT_ORIGIN);
 assert.equal(x.events[0].status,204);
 assert.equal(x.nextCount,0);
 assert.equal(x.headers['access-control-allow-origin'],REPORT_ORIGIN);
 assert.match(x.headers['access-control-allow-methods'],/POST/);
 assert.match(x.headers['access-control-allow-headers'],/Authorization/);
 assert.equal(x.headers.vary,'Origin');
});
test('real GET and POST still invoke the original Auth/API middleware',()=>{
 for(const method of ['GET','POST']){
  const x=fake(method,REPORT_ORIGIN);
  assert.equal(x.nextCount,1);
  assert.equal(x.events.length,0);
  assert.equal(x.headers['access-control-allow-origin'],REPORT_ORIGIN);
 }
});
test('wildcard and unknown origins are never permitted',()=>{
 const preflight=fake('OPTIONS','https://attacker.invalid');
 assert.equal(preflight.events[0].status,403);
 assert.equal(preflight.headers['access-control-allow-origin'],undefined);
 const get=fake('GET','https://attacker.invalid');
 assert.equal(get.nextCount,1);
 assert.equal(get.headers['access-control-allow-origin'],undefined);
});
test('same-origin Firebase app continues to invoke original API',()=>{
 assert.equal(fake('POST',null).nextCount,1);
 assert.equal(fake('GET',null).nextCount,1);
});

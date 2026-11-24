import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const yaml=readFileSync(new URL('../../.github/workflows/html-viewer-manual-preview.yml',import.meta.url),'utf8');
test('manual preview deployment has no automatic triggers',()=>{
 assert.match(yaml,/\bon:\s*\n\s*workflow_dispatch:/);
 assert.doesNotMatch(yaml,/^\s+(?:push|pull_request|schedule|repository_dispatch):/m);
});
test('target project and site are fixed and only preview channel deploy is permitted',()=>{
 assert.match(yaml,/firebase hosting:channel:deploy rifj-html-test --project html-viewer-703b6 --expires 7d/);
 assert.doesNotMatch(yaml,/firebase deploy(?:\s|$)|hosting:channel:clone|hosting:sites:delete|firestore:delete/);
 assert.match(yaml,/if\(c\.hosting\.site!=='html-viewer-703b6'/);
 assert.match(yaml,/c\.hosting\.rewrites/);
});
test('requires explicit user input, service account and restricted environment',()=>{
 assert.match(yaml,/PREVIEW_HTML_VIEWER_703B6/);
 assert.match(yaml,/environment: html-viewer-preview/);
 assert.match(yaml,/secrets\.FIREBASE_SERVICE_ACCOUNT_HTML_VIEWER_PREVIEW/);
 assert.match(yaml,/j\.project_id!=='html-viewer-703b6'/);
 assert.match(yaml,/f\.enabled!==false\|\|f\.firebaseConfig!==null/);
});

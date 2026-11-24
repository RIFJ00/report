#!/usr/bin/env python3
"""Read-only CORS preflight for the existing Firebase HTML Viewer API.

Checks response headers only; sends no authentication and no mutations.
A 200/401/403 on GET is acceptable for diagnostic purposes, but any response
must advertise the explicit report.rifj.jp origin to work from GitHub Pages.
"""
import json,sys,urllib.request,urllib.error
API="https://html-viewer-703b6.web.app/api"
ORIGIN="https://report.rifj.jp"
TESTS=[
 ("GET","/list?kind=kantei&limit=1",None),
 ("OPTIONS","/search?query=test","GET"),
 ("OPTIONS","/import-url","POST"),
 ("OPTIONS","/import-html","POST"),
]
def evaluate(origin,allow_methods,allow_headers,request_method=None):
 if origin!=ORIGIN:return False,"Access-Control-Allow-Origin must exactly equal https://report.rifj.jp"
 if request_method is not None:
  methods=[s.strip().upper() for s in (allow_methods or "").split(",")]
  headers=[s.strip().lower() for s in (allow_headers or "").split(",")]
  if request_method.upper() not in methods:return False,"Missing Access-Control-Allow-Methods for "+request_method
  if "authorization" not in headers:return False,"Missing Access-Control-Allow-Headers: Authorization"
  if "content-type" not in headers:return False,"Missing Access-Control-Allow-Headers: Content-Type"
 return True,"CORS headers present for requested operation"
def inspect(method,path,preflight_method=None,opener=urllib.request.urlopen):
 headers={"Origin":ORIGIN,"User-Agent":"RIFJ-Migration-CORS-Preflight/1.0"}
 if method=="OPTIONS":
  headers.update({"Access-Control-Request-Method":preflight_method,"Access-Control-Request-Headers":"authorization,content-type"})
 req=urllib.request.Request(API+path,method=method,headers=headers)
 try:
  with opener(req,timeout=15) as r:
   status=r.status
   h=r.headers
 except urllib.error.HTTPError as exc:
  status=exc.code
  h=exc.headers
 except Exception as exc:
  return {"method":method,"path":path,"status":"unreachable","ready":False,"reason":str(exc)}
 origin=h.get("Access-Control-Allow-Origin")
 allow_methods=h.get("Access-Control-Allow-Methods")
 allow_headers=h.get("Access-Control-Allow-Headers")
 ready,reason=evaluate(origin,allow_methods,allow_headers,preflight_method if method=="OPTIONS" else None)
 if method=="OPTIONS" and not (200<=status<300):ready=False;reason="OPTIONS does not respond 2xx; status "+str(status)
 return {"method":method,"path":path,"status":status,"allowedOrigin":origin,"methods":allow_methods,"headers":allow_headers,"ready":ready,"reason":reason}
def run():
 checks=[inspect(*test) for test in TESTS]
 result={"purpose":"read-only CORS diagnosis (no writes/auth)","api":API,"frontendOrigin":ORIGIN,"checks":checks,"ready":all(c["ready"] for c in checks)}
 print(json.dumps(result,ensure_ascii=False,indent=2))
 if len(sys.argv)>1:
  with open(sys.argv[1],"w",encoding="utf8") as f:json.dump(result,f,ensure_ascii=False,indent=2)
 return 0
if __name__=="__main__":sys.exit(run())

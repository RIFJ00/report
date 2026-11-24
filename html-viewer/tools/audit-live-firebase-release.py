#!/usr/bin/env python3
"""Read-only release audit. Never deploy or mutate live Firebase/GitHub Pages."""
import hashlib,importlib.util,json,pathlib,sys,tempfile,urllib.request,urllib.error
ROOT=pathlib.Path(__file__).resolve().parents[2]
MIRROR=ROOT/"html-viewer/tools/prepare-firebase-ui-mirror.py"
FILES=("html-admin/index.html","html-viewer/index.html","column/index.html",
       "legacy-html-assets/app.css","legacy-html-assets/bookmark-subtle.css",
       "legacy-html-assets/app.js","legacy-html-assets/viewer-public.js",
       "legacy-html-assets/article-preview-interactions.js","legacy-html-assets/firebase-config.js")

def probe(method,url,headers):
    req=urllib.request.Request(url,method=method,headers=headers)
    try:
        with urllib.request.urlopen(req,timeout=25) as res:
            status=res.status;header=res.headers
    except urllib.error.HTTPError as exc:
        status=exc.code;header=exc.headers
    except Exception as exc:
        return {"method":method,"error":str(exc),"passed":False}
    origin=header.get("Access-Control-Allow-Origin","")
    methods=header.get("Access-Control-Allow-Methods","")
    allowed=header.get("Access-Control-Allow-Headers","")
    passed=(200<=status<300 and origin=="https://report.rifj.jp"
            and (method=="GET" or ("POST" in methods.upper() and "authorization" in allowed.lower()
                                    and "content-type" in allowed.lower())))
    return {"method":method,"status":status,"allow_origin":origin,"allow_methods":methods,
            "allow_headers":allowed,"passed":passed}

def main():
    dest=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path("release-readiness.json")
    report={"purpose":"READ_ONLY_GATE_NO_DEPLOY","firebase_functions_private_source_verified":False,
            "firebase_auth_domain_verified":False,"admin_write_flow_verified":False,"release_approved":False}
    try:
        spec=importlib.util.spec_from_file_location("original_mirror",MIRROR)
        mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
        with tempfile.TemporaryDirectory() as tmp:
            target=pathlib.Path(tmp)/"expected"
            mod.build(target)
            results=[]
            for name in FILES:
                staged=(ROOT/name).read_bytes() if (ROOT/name).is_file() else None
                expected=(target/name).read_bytes()
                results.append({"file":name,"exact_match":staged==expected,
                                "staged_sha256":hashlib.sha256(staged).hexdigest() if staged is not None else None,
                                "live_derived_sha256":hashlib.sha256(expected).hexdigest()})
            report["frontend"]=results
            report["frontend_exact_match"]=all(x["exact_match"] for x in results)
        origin={"Origin":"https://report.rifj.jp"}
        report["cors"]=[
            probe("GET","https://html-viewer-703b6.web.app/api/list?kind=kantei&size=1",origin),
            probe("OPTIONS","https://html-viewer-703b6.web.app/api/import-url",
                  {**origin,"Access-Control-Request-Method":"POST",
                   "Access-Control-Request-Headers":"authorization,content-type"})]
        report["cors_passed"]=all(x["passed"] for x in report["cors"])
    except Exception as exc:
        report["audit_error"]=str(exc)
    report["note"]="Even if UI and CORS pass, Firebase Functions deployed Python source, Authentication authorized domain and real administrator flows require separate verification before any merge or deployment."
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print(json.dumps(report,indent=2,ensure_ascii=False))
    # Default to blocked unless all independent gates are genuinely verified.
    return 0 if report["release_approved"] else 1

if __name__=="__main__":sys.exit(main())

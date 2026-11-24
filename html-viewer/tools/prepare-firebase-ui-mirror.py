#!/usr/bin/env python3
"""Mirror the original Firebase UI into a REVIEW-ONLY static directory.

No production changes. The original /api/ backend is NOT available on GitHub
Pages; the package must never be deployed as fully functional until API routing
is resolved and Firebase Authentication domains are tested.
"""
import hashlib,json,pathlib,re,sys,urllib.request,urllib.parse
BASE="https://html-viewer-703b6.web.app/"
ROUTES={
 "admin.html":"html-admin/index.html",
 "viewer.html":"html-viewer/index.html",
 "columns.html":"column/index.html",
}
ASSETS=[
 "app.css","bookmark-subtle.css","app.js","viewer-public.js",
 "article-preview-interactions.js","firebase-config.js"
]
def download(name):
 if not re.fullmatch(r'[A-Za-z0-9_.-]+',name):raise ValueError("Invalid source name")
 req=urllib.request.Request(urllib.parse.urljoin(BASE,name),headers={"User-Agent":"RIFJ-Migration-Asset-Snapshot/1.0"})
 with urllib.request.urlopen(req,timeout=30) as response:
  if response.status!=200:raise ValueError(f"Upstream status {response.status} for {name}")
  return response.read(5_000_000)
def build(outdir):
 out=pathlib.Path(outdir)
 if out.exists():raise ValueError("Output already exists")
 collected={}
 for name in (*ROUTES,*ASSETS):
  content=download(name)
  if not content:raise ValueError(f"Empty {name}")
  collected[name]=content
 # Never make a working admin that silently calls GitHub Pages /api.
 for name in ("app.js","viewer-public.js"):
  content=collected[name].decode("utf-8")
  if "fetch('/api'+path" not in content:
   raise ValueError("Upstream API route changed; revise migration safety checks before building")
  for match in re.findall(r"from\s+['\"](\./[^'\"]+)['\"]",content):
   local=match.split("?",1)[0].removeprefix("./")
   if local not in ASSETS:raise ValueError(f"Unreviewed JS module: {local} from {name}")
 for name,target in ROUTES.items():
  html=collected[name].decode("utf-8")
  for asset in ASSETS:
   if asset.endswith(".js") or asset.endswith(".css"):
    html=html.replace('"/'+asset,'"../legacy-html-assets/'+asset)
    html=html.replace("'/"+asset,"'../legacy-html-assets/"+asset)
  # User-visible origin is report.rifj.jp; do not silently redirect.
  if re.search(r'location\.(?:replace|assign)\(',html):raise ValueError("Unexpected source redirect")
  dest=out/target
  dest.parent.mkdir(parents=True,exist_ok=True)
  dest.write_text(html,encoding="utf-8")
 for name,body in [(name,collected[name]) for name in ASSETS]:
  dest=out/"legacy-html-assets"/name
  dest.parent.mkdir(parents=True,exist_ok=True)
  if name=="article-preview-interactions.js":
   script=body.decode("utf-8")
   old="""        if(u.origin==='https://html-viewer-703b6.web.app' &&
            /^\\/(?:viewer|admin)\\.html$/.test(u.pathname) && u.hash){"""
   new="""        const isLegacyViewer=u.origin==='https://html-viewer-703b6.web.app' &&
            /^\\/(?:viewer|admin)\\.html$/.test(u.pathname);
        const isMigratedViewer=u.origin==='https://report.rifj.jp' &&
            /^\\/(?:html-viewer|html-admin|column)\\/?$/.test(u.pathname);
        if((isLegacyViewer||isMigratedViewer) && u.hash){"""
   if old not in script:raise ValueError("Upstream fragment-link logic changed; review before mirroring")
   body=script.replace(old,new).encode("utf-8")
  if name in ("app.js","viewer-public.js"):
   script=body.decode("utf-8")
   original="fetch('/api'+path"
   replacement="fetch('https://html-viewer-703b6.web.app/api'+path"
   if original not in script:raise ValueError(f"Unexpected API client format: {name}")
   body=script.replace(original,replacement).encode("utf-8")
  dest.write_bytes(body)
 for src,target in ROUTES.items():
  text=(out/target).read_text()
  for old in ("/app.css","/bookmark-subtle.css","/app.js","/viewer-public.js"):
   if f'"{old}' in text or f"'{old}" in text:raise ValueError(f"Unrewritten root asset {old}")
  if "../legacy-html-assets/" not in text:raise ValueError(f"CSS/JS not relocated: {target}")
 report={
  "source":BASE,"routes":ROUTES,"assetCount":len(ASSETS),
  "assets":{name:{"bytes":len(blob),"sha256":hashlib.sha256(blob).hexdigest()} for name,blob in collected.items()},
  "backendStatus":"BLOCKED: client API points to original Firebase origin, but backend currently lacks Access-Control-Allow-Origin and OPTIONS returns 405; restricted CORS required before release",
  "requiresBackendCors":True,"apiBase":"https://html-viewer-703b6.web.app/api","firebaseAuthDomainToVerify":"report.rifj.jp",
  "notProductionReady":True
 }
 (out/"MIGRATION_AUDIT.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 return report
if __name__=="__main__":
 if len(sys.argv)!=2:
  print("Usage: prepare-firebase-ui-mirror.py /new/output/directory",file=sys.stderr);sys.exit(2)
 try:
  result=build(sys.argv[1])
  print(json.dumps({"routes":result["routes"],"assetCount":result["assetCount"],"notProductionReady":True},ensure_ascii=False))
 except Exception as ex:
  print("Migration mirror failed:",str(ex),file=sys.stderr);sys.exit(1)

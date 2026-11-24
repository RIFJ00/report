#!/usr/bin/env python3
"""Inspect DEPLOYED Firebase Function source without writing/deploying it.

Designed to run only inside GitHub Actions with temporary Google OIDC credentials.
Never outputs signed URL, bearer token, or source bytes. Upload only JSON hashes.
"""
import argparse
import hashlib
import io
import json
import os
from pathlib import PurePosixPath, Path
import sys
import urllib.request
import urllib.error
import zipfile

PROJECT="html-viewer-703b6"
REGION="asia-northeast1"
FUNCTION="api"
ARCHIVE_LIMIT=250_000_000
FILE_LIMIT=30_000_000
TOTAL_UNCOMPRESSED_LIMIT=400_000_000

def normalized_source_files(data):
    if len(data)>ARCHIVE_LIMIT:raise ValueError("Function source archive exceeds audited 250 MB limit")
    z=zipfile.ZipFile(io.BytesIO(data))
    entries={}
    total_uncompressed=0
    for item in z.infolist():
        if item.is_dir():continue
        p=PurePosixPath(item.filename)
        if p.is_absolute() or ".." in p.parts:
            raise ValueError("Unsafe archive path")
        # Inspect only first-party root source files. A deployed archive may
        # include huge binaries, dependencies or media that we must never
        # extract or hash. Check candidate path before applying file size cap.
        parts=list(p.parts)
        while parts and parts[0] in ("functions","source","."):
            parts=parts[1:]
        if len(parts)!=1:continue
        name=parts[0]
        if name.startswith(".") or name in ("env","credentials.json","service-account.json"):
            continue
        if not name.endswith((".py",".txt",".css")):continue
        if item.file_size>FILE_LIMIT:raise ValueError("Oversized first-party source file")
        total_uncompressed+=item.file_size
        if total_uncompressed>TOTAL_UNCOMPRESSED_LIMIT:raise ValueError("Oversized first-party uncompressed source")
        if name in entries:raise ValueError("Duplicate source basename")
        content=z.read(item)
        entries[name]=hashlib.sha256(content).hexdigest()
    return entries

def get_live_source(access_token):
    # Google's own API describes this as a signed URL to deployed function source.
    url=f"https://cloudfunctions.googleapis.com/v2/projects/{PROJECT}/locations/{REGION}/functions/{FUNCTION}:generateDownloadUrl"
    req=urllib.request.Request(url,data=b"{}",method="POST",
                               headers={"Authorization":"Bearer "+access_token,
                                        "Content-Type":"application/json"})
    with urllib.request.urlopen(req,timeout=45) as resp:
        info=json.load(resp)
    signed=info.get("downloadUrl")
    if not signed or not signed.startswith("https://"):
        raise ValueError("Google did not return an HTTPS source download URL")
    with urllib.request.urlopen(signed,timeout=60) as resp:
        blob=resp.read(ARCHIVE_LIMIT+1)
    return normalized_source_files(blob)

def audit(candidate, deployed):
    expected=candidate["files"]
    checks=[]
    for name,h in sorted(expected.items()):
        other=deployed.get(name)
        checks.append({"name":name,"candidate_sha256":h,
                       "deployed_sha256":other,"match":h==other})
    extras=sorted(set(deployed)-set(expected))
    return {"project":PROJECT,"region":REGION,"function":FUNCTION,
            "source_download_succeeded":True,
            "candidate_fingerprint_match":all(x["match"] for x in checks) and not extras,
            "compared_files":checks,"deployed_extra_file_names":extras,
            "deployed_file_count":len(deployed),
            "note":"SHA-256 equality only. Do not deploy without runtime permissions, origin, auth and functional checks.",
            "release_approved":False}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--baseline",default="html-viewer/audit/recovered-python-sha256.json")
    parser.add_argument("--output",required=True)
    args=parser.parse_args()
    report={"project":PROJECT,"function":FUNCTION,"source_download_succeeded":False,
            "release_approved":False}
    try:
        token=os.environ.get("GCP_ACCESS_TOKEN","")
        if not token:raise ValueError("Missing temporary Google OIDC access token")
        baseline=json.loads(Path(args.baseline).read_text())
        actual=get_live_source(token)
        report=audit(baseline,actual)
    except Exception as exc:
        # No auth secrets or URLs in failure reports. Underlying exceptions are not logged.
        if isinstance(exc,urllib.error.HTTPError):
            report["error"]="Google source download API responded HTTP "+str(exc.code)+". Check WIF and IAM read permissions."
        elif isinstance(exc,urllib.error.URLError):
            report["error"]="Google source download API network error"
        elif isinstance(exc,ValueError):
            report["error"]=str(exc)
        else:
            report["error"]="Source retrieval or archive inspection failed; review auth/format without logging secrets"
    Path(args.output).parent.mkdir(parents=True,exist_ok=True)
    Path(args.output).write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
    print("Source download successful:",report.get("source_download_succeeded",False))
    if report.get("source_download_succeeded"):
        print("Candidate source fingerprint fully matches:",report.get("candidate_fingerprint_match"))
        print("Files compared:",len(report.get("compared_files",[])))
        print("Matching files:",[x["name"] for x in report["compared_files"] if x["match"]])
        print("Different or missing files:",[x["name"] for x in report["compared_files"] if not x["match"]])
        print("Extra deployed root source files:",report.get("deployed_extra_file_names",[]))
    else:
        print("Blocked:",report.get("error","unknown"))
    return 0 if report.get("source_download_succeeded") else 2

if __name__=="__main__":sys.exit(main())

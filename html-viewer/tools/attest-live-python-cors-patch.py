#!/usr/bin/env python3
"""Prove the minimal CORS patch applies to the DEPLOYED Python main.py.

This is strictly a READ-ONLY production audit: download the signed deployed
source *in memory*, verify original main.py hash, prepare patched code in
memory, and publish ONLY hashes, booleans and file names. Never deploy.
"""
from __future__ import annotations
import argparse
import ast
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path, PurePosixPath
import sys
import urllib.error
import zipfile

HERE=Path(__file__).resolve().parent

def load_module(filename,name):
    spec=importlib.util.spec_from_file_location(name,HERE/filename)
    mod=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

def source_entries(archive: bytes):
    downloader=load_module("audit-deployed-python-source.py","rifj_downloader")
    if len(archive)>downloader.ARCHIVE_LIMIT:
        raise ValueError("Deployed source archive exceeds size limit")
    result={}
    with zipfile.ZipFile(io.BytesIO(archive)) as z:
        for info in z.infolist():
            if info.is_dir():continue
            p=PurePosixPath(info.filename)
            if p.is_absolute() or ".." in p.parts:raise ValueError("Unsafe archive path")
            parts=list(p.parts)
            while parts and parts[0] in ("source","functions","."):
                parts.pop(0)
            if len(parts)!=1:continue
            name=parts[0]
            if not name.endswith((".py",".css",".txt")) or name.startswith("."):continue
            if info.file_size>downloader.FILE_LIMIT:
                raise ValueError("First party source file exceeds size limit")
            if name in result:raise ValueError("Duplicate first party file")
            result[name]=z.read(info)
    return result

def attest(entries,baseline):
    if "main.py" not in entries:
        raise ValueError("Original main.py not found at source root")
    source=entries["main.py"]
    source_hash=hashlib.sha256(source).hexdigest()
    if source_hash != baseline["files"]["main.py"]:
        raise ValueError("DEPLOYED main.py changed: refuse to patch unknown code")
    # preserve raw bytes outside main.py; never substitute reconstructed store.py etc
    patcher=load_module("patch-original-python-api.py","rifj_api_patch")
    patched=patcher.patch(source.decode("utf-8"))
    updated=patched.encode("utf-8")
    ast.parse(patched)
    if patched.count('cors_origins=["https://report.rifj.jp"]')!=1:
        raise ValueError("CORS origin mismatch")
    if patched.count('cors_methods=["get", "post"]')!=1:
        raise ValueError("CORS method mismatch")
    if patched.count("Response(status=204)")!=1:
        raise ValueError("Preflight response not uniquely changed")
    changed=[name for name in sorted(entries) if
             hashlib.sha256(updated if name=="main.py" else entries[name]).digest()
             != hashlib.sha256(entries[name]).digest()]
    if changed!=["main.py"]:
        raise ValueError("Unexpected files changed")
    return {
        "provenance":"downloaded deployed Cloud Functions api source",
        "source_main_matches_original_baseline":True,
        "cors_patch_validated_in_memory":True,
        "would_change_only":["main.py"],
        "unchanged_python_files":[name for name in sorted(entries) if name.endswith(".py") and name!="main.py"],
        "unchanged_python_file_count":sum(name.endswith(".py") and name!="main.py" for name in entries),
        "main_original_sha256":source_hash,
        "main_patched_sha256":hashlib.sha256(updated).hexdigest(),
        "admin_role_and_other_logic_preserved_by_ast_check":True,
        "production_deployed":False,
        "release_approved":False,
        "note":"An in-memory dry run only. This does not verify Firebase SDK runtime CORS headers or replace the production source."
    }

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--baseline",default="html-viewer/audit/recovered-python-sha256.json")
    parser.add_argument("--output",required=True)
    args=parser.parse_args()
    result={"cors_patch_validated_in_memory":False,"production_deployed":False,"release_approved":False}
    try:
        token=os.environ.get("GCP_ACCESS_TOKEN")
        if not token:raise ValueError("Missing temporary Google access token")
        baseline=json.loads(Path(args.baseline).read_text())
        downloader=load_module("audit-deployed-python-source.py","rifj_downloader_live")
        # Reuse the proven authenticated downloader but return the ephemeral
        # signed source archive bytes for in-memory attestation only.
        blob=downloader.download_archive_bytes(token)
        result=attest(source_entries(blob),baseline)
    except Exception as exc:
        if isinstance(exc,urllib.error.HTTPError):
            result["error"]="Google source API returned HTTP "+str(exc.code)
        elif isinstance(exc,(ValueError,UnicodeError,SyntaxError,KeyError,zipfile.BadZipFile)):
            result["error"]=str(exc)[:160]
        else:
            result["error"]="Unable to attest production Python CORS patch"
    Path(args.output).parent.mkdir(parents=True,exist_ok=True)
    Path(args.output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n")
    print("Production original main.py exact match:",result.get("source_main_matches_original_baseline",False))
    print("CORS-only in-memory patch approved:",result.get("cors_patch_validated_in_memory",False))
    if "error" in result:print("Attestation blocked:",result["error"])
    return 0 if result.get("cors_patch_validated_in_memory") else 2

if __name__=="__main__":sys.exit(main())

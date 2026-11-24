#!/usr/bin/env python3
"""Conservatively patch ONLY the on_request decorator and OPTIONS handler.

Input: the operator's ORIGINAL Firebase Functions main.py, not a template.
Output: a NEW main.py in an otherwise untouched COPY of the source directory.

This tool neither reads credentials nor contacts Firebase/Google Cloud.
Never run this directly against the only working directory.
"""
import argparse
import pathlib
import re
import sys
import ast
import difflib

ORIGINAL_DECORATOR='@https_fn.on_request(region="asia-northeast1",memory=options.MemoryOption.MB_512,timeout_sec=120,max_instances=10)'
REPLACEMENT_DECORATOR='''@https_fn.on_request(
    region="asia-northeast1",
    memory=options.MemoryOption.MB_512,
    timeout_sec=120,
    max_instances=10,
    cors=options.CorsOptions(
        cors_origins=["https://report.rifj.jp"],
        cors_methods=["get", "post"],
    ),
)'''
ORIGINAL_OPTIONS='if request.method=="OPTIONS":return send({"error":"Unsupported method"},405)'
REPLACEMENT_OPTIONS='if request.method=="OPTIONS":return Response(status=204)'

def patch(source: str)->str:
    for term in (ORIGINAL_DECORATOR,ORIGINAL_OPTIONS):
        if source.count(term)!=1:
            raise ValueError("Expected exactly one source anchor: "+term)
    if source.count("def api(")!=1:
        raise ValueError("Exactly one api() function required")
    if "from firebase_functions import https_fn,options" not in source:
        raise ValueError("Original Firebase Python imports not found")
    if "from flask import Response,request" not in source:
        raise ValueError("Original Flask imports not found")
    if "auth.verify_id_token(" not in source or 'user.get("role")=="admin"' not in source:
        raise ValueError("Expected original token verification and role=admin permission check not found")
    if "cors=options.CorsOptions(" in source:
        raise ValueError("CORS already configured; refuse to overwrite unknown policy")
    before=ast.parse(source)
    result=source.replace(ORIGINAL_DECORATOR,REPLACEMENT_DECORATOR).replace(ORIGINAL_OPTIONS,REPLACEMENT_OPTIONS)
    after=ast.parse(result)
    def api_function(tree):
        funcs=[n for n in tree.body if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) and n.name=="api"]
        if len(funcs)!=1:raise ValueError("Expected exactly one top-level api function")
        return funcs[0]
    # The decorated function's BODY must remain exactly unchanged except for
    # the OPTIONS response. The other application logic is untouchable.
    def normalized_body(tree):
        func=api_function(tree)
        opts=func.body
        assert len(opts)>=4
        return [ast.dump(node,include_attributes=False) for node in opts]
    a,b=normalized_body(before),normalized_body(after)
    if len(a)!=len(b):
        raise ValueError("Unexpected API body structure change")
    differences=[i for i,(x,y) in enumerate(zip(a,b)) if x!=y]
    if len(differences)!=1:
        raise ValueError("Only the OPTIONS statement may change in the API body")
    if "OPTIONS" not in a[differences[0]] or "OPTIONS" not in b[differences[0]]:
        raise ValueError("Unexpected changed API body statement")
    if result.count('cors_origins=["https://report.rifj.jp"]')!=1:
        raise ValueError("Origin should be narrowly scoped to report.rifj.jp")
    return result

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("source",help="Path to ORIGINAL main.py")
    parser.add_argument("destination",help="NEW output main.py path; must not exist")
    args=parser.parse_args()
    origin=pathlib.Path(args.source).resolve()
    destination=pathlib.Path(args.destination).resolve()
    if not origin.is_file():raise ValueError("Original main.py does not exist")
    if origin==destination:raise ValueError("Refusing in-place editing")
    if destination.exists():raise ValueError("Refusing to overwrite existing destination")
    source=origin.read_text(encoding="utf-8")
    updated=patch(source)
    print("".join(difflib.unified_diff(source.splitlines(keepends=True),updated.splitlines(keepends=True),
                                      fromfile="original/main.py",tofile="patched/main.py")))
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(updated,encoding="utf-8")
    print("PATCH_CREATED",destination)

if __name__=="__main__":
    try:main()
    except (ValueError,SyntaxError,OSError) as exc:
        print("PATCH_REFUSED:",str(exc),file=sys.stderr);sys.exit(1)

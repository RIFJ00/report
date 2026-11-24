#!/usr/bin/env python3
"""Combine independent, read-only Firebase release evidence.

This deliberately cannot approve production deployment: a functional CORS
test and a real browser admin-login test are mandatory human-operated gates.
Only hashes, statuses, and explicit blockers are included in output.
"""
import argparse
import json
from pathlib import Path

def assess(live,patch):
    ui_match=bool(live.get("frontend_exact_match"))
    original_match=bool(patch.get("source_main_matches_original_baseline"))
    safe_patch=bool(patch.get("cors_patch_validated_in_memory"))
    cors=bool(live.get("cors_passed"))
    blockers=[]
    if not ui_match:blockers.append("Frontend migration does not match the live-derived 9-file mirror")
    if not original_match:blockers.append("Deployed original main.py hash is not verified")
    if not safe_patch:blockers.append("In-memory deployed-code CORS-only modification not verified")
    if not cors:blockers.append("Production API GET/OPTIONS CORS preflight is not passing")
    # Values below have no automated evidence; never infer success.
    blockers.extend([
        "Firebase Auth authorized domain report.rifj.jp not independently verified",
        "Actual admin login, CRUD write operations and article preview not verified on target URL",
        "Current deployment settings, rollback artifact and separate deployment approval not verified",
    ])
    return {
        "purpose":"PRE-RELEASE READ-ONLY SAFETY MATRIX; NO DEPLOY",
        "frontend_live_derived_nine_files_match":ui_match,
        "deployed_original_main_sha256_verified":original_match,
        "cors_patch_preserves_existing_deployed_helpers":safe_patch,
        "actual_api_cors_preflight_passed":cors,
        "firebase_auth_domain_verified":False,
        "admin_write_operations_verified":False,
        "rollback_and_deployment_configuration_verified":False,
        "production_deployment_approved":False,
        "main_branch_merge_approved":False,
        "blockers":blockers
    }

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--live",required=True)
    parser.add_argument("--patch",required=True)
    parser.add_argument("--output",required=True)
    args=parser.parse_args()
    try:
        live=json.loads(Path(args.live).read_text())
        patch=json.loads(Path(args.patch).read_text())
        result=assess(live,patch)
    except (OSError,ValueError,KeyError) as exc:
        result={"production_deployment_approved":False,"main_branch_merge_approved":False,
                "blockers":["Read-only evidence could not be parsed: "+type(exc).__name__]}
    output=Path(args.output)
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n")
    print("UI live-derived parity:",result.get("frontend_live_derived_nine_files_match",False))
    print("Deployed API main.py verified:",result.get("deployed_original_main_sha256_verified",False))
    print("CORS-only patch attestation:",result.get("cors_patch_preserves_existing_deployed_helpers",False))
    print("Real API CORS passing:",result.get("actual_api_cors_preflight_passed",False))
    print("Deployment permitted:",False)
    print("Current blockers:")
    for item in result["blockers"]:print(" -",item)
    return 0

if __name__=="__main__":raise SystemExit(main())

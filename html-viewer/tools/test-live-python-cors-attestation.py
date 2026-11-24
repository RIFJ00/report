import hashlib
import importlib.util
import io
import json
from pathlib import Path
import unittest
import zipfile

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("attest",HERE/"attest-live-python-cors-patch.py")
attest=importlib.util.module_from_spec(spec)
spec.loader.exec_module(attest)
pspec=importlib.util.spec_from_file_location("patcher",HERE/"patch-original-python-api.py")
patcher=importlib.util.module_from_spec(pspec)
pspec.loader.exec_module(patcher)

ORIGINAL='''from firebase_functions import https_fn,options
from flask import Response,request
from firebase_admin import auth
def get_identity():
    return auth.verify_id_token("token")
@https_fn.on_request(region="asia-northeast1",memory=options.MemoryOption.MB_512,timeout_sec=120,max_instances=10)
def api(req):
    start=0
    path=request.path
    user=get_identity()
    admin=bool(user and user.get("role")=="admin")
    if request.method=="OPTIONS":return send({"error":"Unsupported method"},405)
    if not user:return send({"error":"login"},401)
    if not admin:return send({"error":"forbidden"},403)
    return send({"ok":True})
'''

def zipbytes(contents):
    buf=io.BytesIO()
    with zipfile.ZipFile(buf,"w") as z:
        for k,v in contents.items():z.writestr(k,v)
    return buf.getvalue()

class VerifyLiveCorsAttestation(unittest.TestCase):
    def setUp(self):
        self.files={"functions/main.py":ORIGINAL.encode("utf-8"),
                    "functions/store.py":b"ACTUAL PRIVATE STORE: DO NOT EXPORT",
                    "functions/converter.py":b"ACTUAL PRIVATE CONVERTER: DO NOT EXPORT"}
        self.baseline={"files":{"main.py":hashlib.sha256(ORIGINAL.encode()).hexdigest()}}
    def test_only_main_changes_while_actual_unmatched_helpers_are_preserved(self):
        entries=attest.source_entries(zipbytes(self.files))
        result=attest.attest(entries,self.baseline)
        self.assertTrue(result["cors_patch_validated_in_memory"])
        self.assertEqual(result["would_change_only"],["main.py"])
        self.assertEqual(result["unchanged_python_file_count"],2)
        self.assertFalse(result["production_deployed"])
        self.assertFalse(result["release_approved"])
        self.assertNotIn("ACTUAL PRIVATE",json.dumps(result))
        self.assertNotEqual(result["main_original_sha256"],result["main_patched_sha256"])
        self.assertEqual(entries["main.py"],ORIGINAL.encode())
    def test_unknown_main_is_refused(self):
        self.baseline["files"]["main.py"]="0"*64
        with self.assertRaisesRegex(ValueError,"DEPLOYED main.py changed"):
            attest.attest(attest.source_entries(zipbytes(self.files)),self.baseline)
    def test_extra_media_ignored(self):
        files={**self.files,"assets/huge.bin":b"A"*400,"other/nested.py":b"no"}
        self.assertEqual(set(attest.source_entries(zipbytes(files))),
                         {"main.py","store.py","converter.py"})
    def test_patch_auth_or_anchor_mismatch_refused(self):
        files=dict(self.files)
        files["functions/main.py"]=ORIGINAL.replace('user.get("role")=="admin"','user.get("isAdmin")').encode()
        self.baseline["files"]["main.py"]=hashlib.sha256(files["functions/main.py"]).hexdigest()
        with self.assertRaises(ValueError):
            attest.attest(attest.source_entries(zipbytes(files)),self.baseline)

if __name__=="__main__":unittest.main()

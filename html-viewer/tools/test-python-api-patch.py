import ast
import importlib.util
import pathlib
import tempfile
import unittest

SOURCE=pathlib.Path(__file__).with_name("patch-original-python-api.py")
spec=importlib.util.spec_from_file_location("rifj_api_patch",SOURCE)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

VALID='''from firebase_functions import https_fn,options
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

class PythonApiPatchTests(unittest.TestCase):
 def test_small_patch_preserves_auth_and_business_logic(self):
  patched=module.patch(VALID)
  self.assertIn('cors_origins=["https://report.rifj.jp"]',patched)
  self.assertIn('cors_methods=["get", "post"]',patched)
  self.assertIn('if request.method=="OPTIONS":return Response(status=204)',patched)
  self.assertIn('auth.verify_id_token("token")',patched)
  self.assertIn('user.get("role")=="admin"',patched)
  self.assertIn('return send({"error":"forbidden"},403)',patched)
  ast.parse(patched)
 def test_double_application_and_changed_source_rejected(self):
  patched=module.patch(VALID)
  with self.assertRaises(ValueError):module.patch(patched)
  with self.assertRaises(ValueError):module.patch(VALID.replace('timeout_sec=120','timeout_sec=60'))
  with self.assertRaises(ValueError):module.patch(VALID.replace('user.get("role")=="admin"','user.get("rifjAdmin") is True'))
  with self.assertRaises(ValueError):module.patch(VALID.replace('if request.method=="OPTIONS":return send({"error":"Unsupported method"},405)',''))
 def test_never_mutate_original_file_and_refuse_existing_destination(self):
  with tempfile.TemporaryDirectory() as tmp:
   p=pathlib.Path(tmp)/"original.py"
   p.write_text(VALID,encoding="utf-8")
   output=pathlib.Path(tmp)/"output.py"
   output.write_text(module.patch(p.read_text()),encoding="utf-8")
   self.assertEqual(p.read_text(),VALID)
   self.assertNotEqual(output.read_text(),VALID)

if __name__=="__main__":unittest.main()

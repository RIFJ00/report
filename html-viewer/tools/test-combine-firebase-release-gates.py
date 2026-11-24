import importlib.util
from pathlib import Path
import unittest
SPEC=importlib.util.spec_from_file_location("gates",Path(__file__).with_name("combine-firebase-release-gates.py"))
m=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(m)
class TestSafetyMatrix(unittest.TestCase):
 def test_always_blocks_even_if_all_automated_inputs_pass(self):
  r=m.assess({"frontend_exact_match":True,"cors_passed":True},
             {"source_main_matches_original_baseline":True,"cors_patch_validated_in_memory":True})
  self.assertTrue(r["frontend_live_derived_nine_files_match"])
  self.assertFalse(r["production_deployment_approved"])
  self.assertFalse(r["main_branch_merge_approved"])
  self.assertGreaterEqual(len(r["blockers"]),3)
 def test_missing_or_failed_evidence_blocks(self):
  r=m.assess({}, {})
  self.assertFalse(r["frontend_live_derived_nine_files_match"])
  self.assertFalse(r["deployed_original_main_sha256_verified"])
  self.assertFalse(r["actual_api_cors_preflight_passed"])
  self.assertGreaterEqual(len(r["blockers"]),7)
 def test_real_api_cors_failure_is_an_explicit_blocker(self):
  r=m.assess({"frontend_exact_match":True,"cors_passed":False},
             {"source_main_matches_original_baseline":True,"cors_patch_validated_in_memory":True})
  self.assertIn("Production API GET/OPTIONS CORS preflight is not passing",r["blockers"])
if __name__=="__main__":unittest.main()

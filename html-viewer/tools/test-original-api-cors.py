import unittest,sys,pathlib,importlib.util
SOURCE=pathlib.Path(__file__).with_name('check-original-api-cors.py')
spec=importlib.util.spec_from_file_location('rifj_cors',SOURCE)
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
class CorsCheckTests(unittest.TestCase):
 def test_explicit_origin_only(self):
  self.assertFalse(mod.evaluate('*','GET,POST','authorization,content-type','POST')[0])
  self.assertFalse(mod.evaluate('https://other.example','GET,POST','authorization,content-type','POST')[0])
  self.assertTrue(mod.evaluate('https://report.rifj.jp','GET,POST,OPTIONS','authorization,content-type','POST')[0])
 def test_preflight_missing_headers(self):
  self.assertFalse(mod.evaluate(mod.ORIGIN,'POST,OPTIONS','content-type','POST')[0])
  self.assertFalse(mod.evaluate(mod.ORIGIN,'GET,OPTIONS','authorization,content-type','POST')[0])
  self.assertFalse(mod.evaluate(mod.ORIGIN,'POST,OPTIONS','authorization','POST')[0])
 def test_readiness_does_not_require_credentials(self):
  self.assertEqual(mod.TESTS[0][0],'GET')
  self.assertTrue(all(x[0] in ('GET','OPTIONS') for x in mod.TESTS))
if __name__=='__main__':unittest.main()

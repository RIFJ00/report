"""Static validation of the original UI mirrored into dedicated report.rifj.jp routes."""
import pathlib,re,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2]
class MigrationTests(unittest.TestCase):
 def test_html_routes_and_assets(self):
  for route in ("html-admin","html-viewer","column"):
   text=(ROOT/route/"index.html").read_text(encoding="utf-8")
   self.assertIn("../legacy-html-assets/app.css",text)
   self.assertNotIn("location.replace(",text)
   self.assertNotIn("http-equiv=\"refresh\"",text)
   for match in re.findall(r"""(?:src|href)=["'](\.\./legacy-html-assets/[^"']+)""",text):
    location=match.split('?',1)[0]
    self.assertTrue((ROOT/route/location).is_file(),location)
 def test_js_imports(self):
  assets=ROOT/"legacy-html-assets"
  for name in ("app.js","viewer-public.js"):
   script=(assets/name).read_text(encoding="utf-8")
   self.assertIn("firebase-config.js",script)
   self.assertIn("article-preview-interactions.js",script)
   for dep in re.findall(r"""from\s+['"](\./[^'"]+)""",script):
    location=dep.split('?',1)[0].removeprefix("./")
    self.assertTrue((assets/location).is_file(),dep)
 def test_legacy_and_new_article_fragment_links_stay_local(self):
  script=(ROOT/"legacy-html-assets"/"article-preview-interactions.js").read_text(encoding="utf-8")
  self.assertIn("const isLegacyViewer=",script)
  self.assertIn("const isMigratedViewer=",script)
  self.assertIn("https://report.rifj.jp",script)
  self.assertIn("html-viewer|html-admin|column",script)
  self.assertIn("isLegacyViewer||isMigratedViewer",script)
 def test_api_blocker_is_not_silently_masked(self):
  # Prevent shipping a broken UI as fully functional until the backend is
  # back-end CORS permissions are explicitly configured for report.rifj.jp.
  scripts=[(ROOT/"legacy-html-assets"/p).read_text(encoding="utf-8") for p in ("app.js","viewer-public.js")]
  for script in scripts:self.assertIn("fetch('https://html-viewer-703b6.web.app/api'+path",script)
  # The test is a safety check only, not an end-to-end production readiness declaration.
if __name__=="__main__":unittest.main()

import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

SCRIPT=Path(__file__).with_name("audit-deployed-python-source.py")
SPEC=importlib.util.spec_from_file_location("rifj_source_audit",SCRIPT)
m=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(m)

def zip_bytes(names):
    stream=io.BytesIO()
    with zipfile.ZipFile(stream,"w") as z:
        for name,content in names.items():
            z.writestr(name,content)
    return stream.getvalue()

class FunctionSourceAuditorTests(unittest.TestCase):
    def test_no_source_export_only_hashes(self):
        files={"functions/main.py":b"print('a')","functions/store.py":b"SECRET-SOURCE-TEST-DO-NOT-PUBLISH","functions/requirements.txt":b"flask"}
        found=m.normalized_source_files(zip_bytes(files))
        self.assertEqual(found["main.py"],hashlib.sha256(b"print('a')").hexdigest())
        self.assertEqual(set(found),{"main.py","store.py","requirements.txt"})
        self.assertNotIn("SECRET-SOURCE",json.dumps(found))
    def test_reject_path_traversal(self):
        with self.assertRaises(ValueError):
            m.normalized_source_files(zip_bytes({"../secret.py":b"no"}))
    def test_reject_ambiguous_duplicates(self):
        with self.assertRaises(ValueError):
            m.normalized_source_files(zip_bytes({"main.py":b"one","functions/main.py":b"two"}))
    def test_baseline_comparison(self):
        data=zip_bytes({"main.py":b"correct","store.py":b"incorrect"})
        actual=m.normalized_source_files(data)
        baseline={"files":{"main.py":hashlib.sha256(b"correct").hexdigest(),
                           "store.py":hashlib.sha256(b"expected").hexdigest()}}
        audit=m.audit(baseline,actual)
        self.assertFalse(audit["candidate_fingerprint_match"])
        self.assertFalse(audit["release_approved"])
        self.assertEqual([x["match"] for x in audit["compared_files"]],[True,False])
        baseline["files"]["store.py"]=actual["store.py"]
        self.assertTrue(m.audit(baseline,actual)["candidate_fingerprint_match"])
        self.assertFalse(m.audit(baseline,actual)["release_approved"])

if __name__=="__main__":unittest.main()

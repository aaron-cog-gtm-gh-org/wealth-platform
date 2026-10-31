import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("qa_workbook", ROOT / "scripts/qa-workbook.py")
WORKBOOK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(WORKBOOK)


class WorkbookTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((ROOT / "qa/cases.json").read_text())

    def test_canonical_cases_and_committed_workbook(self):
        self.assertEqual(WORKBOOK.validate_cases(self.data), [])
        self.assertEqual(
            WORKBOOK.verify_workbook(ROOT / "qa/Wealth-Platform-Manual-QA.xlsx", self.data),
            [],
        )

    def test_invalid_case_manifests(self):
        mutations = {
            "missing case": lambda cases: cases.pop(),
            "duplicate ID": lambda cases: cases[1].update(id=cases[0]["id"]),
            "empty expected result": lambda cases: cases[0]["steps"][0].update(expected=""),
            "wrong Jira URL": lambda cases: cases[0].update(jiraUrl="https://example.org"),
            "missing steps": lambda cases: cases[0].update(steps=[]),
        }
        for name, mutate in mutations.items():
            with self.subTest(name=name):
                data = copy.deepcopy(self.data)
                mutate(data["cases"])
                self.assertTrue(WORKBOOK.validate_cases(data))

    def test_generated_workbook_round_trip(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "cases.xlsx"
            WORKBOOK.generate_workbook(self.data, path)
            self.assertEqual(WORKBOOK.verify_workbook(path, self.data), [])

    def test_invalid_manifest_does_not_write_output(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / "cases.json"
            output = Path(directory) / "cases.xlsx"
            self.data["cases"].pop()
            manifest.write_text(json.dumps(self.data))
            result = subprocess.run(
                [sys.executable, str(ROOT / "scripts/qa-workbook.py"), "generate",
                 "--cases", str(manifest), "--out", str(output)],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("ERROR", result.stderr)
            self.assertFalse(output.exists())

    def test_modified_workbook_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "cases.xlsx"
            WORKBOOK.generate_workbook(self.data, path)
            book = load_workbook(path)
            book["Test Cases"]["A2"] = "WM-TC-999"
            book.save(path)
            book.close()
            self.assertTrue(WORKBOOK.verify_workbook(path, self.data))


if __name__ == "__main__":
    unittest.main()

"""Run with python3 -m unittest discover -s <this directory>."""
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from check_worksheet import check, check_browser_report
import json


class WorksheetCheck(unittest.TestCase):
    def test_each_selected_path_needs_an_observed_pass(self):
        with TemporaryDirectory() as directory:
            folder = Path(directory)
            (folder / 'worksheet.md').write_text(
                '| Journey | Test case |\n|---|---|\n'
                '| J-01 | apps/web/e2e/workflow.spec.ts::safe close |\n'
                '| J-02 | apps/web/e2e/workflow.spec.ts::unsafe close |\n')
            def spec(title):
                return {'file': 'workflow.spec.ts', 'title': title, 'tests': [
                    {'expectedStatus': 'passed', 'status': 'expected', 'results': [{'status': 'passed'}]}]}
            report = folder / 'browser.json'
            data = {'suites': [{'specs': [spec('safe close')]}]}
            report.write_text(json.dumps(data))
            self.assertTrue(any('J-02' in error for error in check_browser_report(folder, report)))
            data['suites'][0]['specs'].append(spec('unsafe close'))
            report.write_text(json.dumps(data))
            self.assertEqual(check_browser_report(folder, report), [])
            data['suites'][0]['specs'][1]['tests'].append(
                {'expectedStatus': 'passed', 'status': 'unexpected', 'results': [{'status': 'failed'}]})
            report.write_text(json.dumps(data))
            self.assertTrue(check_browser_report(folder, report))
            report.write_text('[]')
            with self.assertRaises(ValueError):
                check_browser_report(folder, report)

    def test_coverage_and_completion(self):
        with TemporaryDirectory() as directory:
            folder = Path(directory)
            design = '''| Obligation | Rule references | Acceptance IDs |
|---|---|---|
| W-01.normal | B-01 | A-01 |
```yaml
id: B-01
```
```yaml
id: A-01
```
'''
            design += '\n| Journey | Obligation | Acceptance IDs | Distinct interaction |\n|---|---|---|---|\n'
            worksheet = '''- State: `DONE`
- Latest review: report.md
| Plan | File | Depends on | Status | Review |
|---|---|---|---|---|
| P-01 | 001-result.md | NONE | VERIFIED | report.md |

| Acceptance | Required surfaces |
|---|---|
| A-01 | BROWSER |

| Acceptance | Plan | Surface | Test case | Implementation | Evidence | Review | Result |
|---|---|---|---|---|---|---|---|
| A-01 | P-01 | BROWSER | request.spec.ts::saves and reloads | app.ts:save | green.json | report.md | PASS |
'''
            worksheet = '| Journey | Test case |\n|---|---|\n\n' + worksheet
            (folder / 'design.md').write_text(design)
            (folder / 'worksheet.md').write_text(worksheet)
            plan = '- Acceptance: A-01\n'
            (folder / '001-result.md').write_text(plan)
            (folder / 'report.md').write_text('Evidence')
            snapshot = {'inputs': ['app.ts'], 'fingerprint': '0' * 64}
            green = {'scope': 'command', 'status': 'PASS', 'result': {'exitCode': 0}, 'before': snapshot, 'after': snapshot}
            (folder / 'green.json').write_text(json.dumps(green))
            for changed in [
                {**green, 'status': 'FAIL'},
                {**green, 'result': {'exitCode': 2}},
                {**green, 'after': {**snapshot, 'fingerprint': '1' * 64}},
                {**green, 'scope': 'static'},
            ]:
                (folder / 'green.json').write_text(json.dumps(changed))
                self.assertTrue(check(folder))
            (folder / 'green.json').write_text(json.dumps(green))
            self.assertEqual(check(folder), [])
            pending = worksheet.replace('`DONE`', '`EXECUTE`').replace('| VERIFIED |', '| IN_PROGRESS |').replace('request.spec.ts::saves and reloads', 'PENDING').replace('| PASS |', '| PENDING |')
            for status in ['TODO', 'IN_PROGRESS', 'BLOCKED']:
                (folder / 'worksheet.md').write_text(pending.replace('| IN_PROGRESS |', f'| {status} |'))
                self.assertEqual(check(folder), [])
            for changed in [pending.replace('| IN_PROGRESS |', '| IMPLEMENTED |'),
                            pending.replace('| PENDING |\n', '| PASS |\n')]:
                (folder / 'worksheet.md').write_text(changed)
                self.assertTrue(check(folder))
            dependency_design = design.replace('| W-01.normal | B-01 | A-01 |', '| W-01.normal | B-01 | A-01, A-02 |') + '\nid: A-02\n'
            dependency_sheet = pending.replace('| P-01 | 001-result.md | NONE | IN_PROGRESS |', '| P-01 | 001-result.md | NONE | IMPLEMENTED |').replace('| A-01 | P-01 | BROWSER | PENDING |', '| A-01 | P-01 | BROWSER | request.spec.ts::saves and reloads |')
            dependency_sheet = dependency_sheet.replace('| A-01 | BROWSER |', '| A-01 | BROWSER |\n| A-02 | UNIT |').replace('| P-01 | 001-result.md | NONE | IMPLEMENTED | report.md |', '| P-01 | 001-result.md | NONE | IMPLEMENTED | report.md |\n| P-02 | 002-next.md | P-01 | IN_PROGRESS | PENDING |')
            dependency_sheet += '| A-02 | P-02 | UNIT | PENDING | PENDING | PENDING | PENDING | PENDING |\n'
            (folder / '002-next.md').write_text('- Acceptance: A-02\n')
            (folder / 'design.md').write_text(dependency_design)
            (folder / 'worksheet.md').write_text(dependency_sheet)
            self.assertEqual(check(folder), [])
            (folder / 'worksheet.md').write_text(dependency_sheet.replace('| IMPLEMENTED |', '| IN_PROGRESS |'))
            self.assertTrue(check(folder))
            (folder / 'design.md').write_text(design)
            (folder / 'worksheet.md').write_text(worksheet)
            journey_design = design + '| J-01 | W-01.normal | A-01 | Save and reload |\n'
            journey_worksheet = worksheet.replace('|---|---|\n\n', '|---|---|\n| J-01 | request.spec.ts::saves and reloads |\n\n', 1)
            journey_worksheet += '\n- Browser report: browser.json\n'
            browser = {'suites': [{'specs': [{'file': 'request.spec.ts', 'title': 'saves and reloads', 'tests': [
                {'expectedStatus': 'passed', 'status': 'expected', 'results': [{'status': 'passed'}]}
            ]}]}]}
            report = folder / 'browser.json'
            report.write_text(json.dumps(browser))
            (folder / 'design.md').write_text(journey_design)
            (folder / 'worksheet.md').write_text(journey_worksheet)
            self.assertEqual(check(folder), [])
            unfinished = journey_worksheet.replace('`DONE`', '`EXECUTE`').replace('| VERIFIED |', '| IN_PROGRESS |').replace('request.spec.ts::saves and reloads', 'PENDING').replace('| PASS |', '| PENDING |')
            (folder / 'worksheet.md').write_text(unfinished)
            self.assertEqual(check(folder), [])
            self.assertTrue(check_browser_report(folder, report))
            (folder / 'worksheet.md').write_text(unfinished.replace('`EXECUTE`', '`DONE`'))
            self.assertTrue(check(folder))
            for changed in [
                journey_worksheet.replace('| J-01 | request.spec.ts::saves and reloads |', ''),
                journey_worksheet.replace('| J-01 | request.spec.ts::saves and reloads |', '| J-01 | request.spec.ts::other |'),
            ]:
                (folder / 'worksheet.md').write_text(changed)
                self.assertTrue(check(folder))
            (folder / 'worksheet.md').write_text(journey_worksheet)
            for status in ['failed', 'skipped', 'timedOut', 'interrupted']:
                changed = json.loads(json.dumps(browser))
                changed['suites'][0]['specs'][0]['tests'][0]['results'][0]['status'] = status
                report.write_text(json.dumps(changed))
                self.assertTrue(check(folder), status)
            report.write_text(json.dumps({'suites': []}))
            self.assertTrue(check_browser_report(folder, report))
            changed = json.loads(json.dumps(browser))
            changed['suites'][0]['specs'][0]['tests'][0]['results'].insert(0, {'status': 'failed'})
            report.write_text(json.dumps(changed))
            self.assertTrue(check_browser_report(folder, report))
            report.write_text(json.dumps(browser))
            self.assertEqual(check_browser_report(folder, report), [])
            (folder / 'design.md').write_text(design)
            (folder / 'worksheet.md').write_text(worksheet)
            for broken in [
                worksheet.replace('| PASS |', '| PENDING |'),
                worksheet.replace('| P-01 | BROWSER', '| P-02 | BROWSER'),
                worksheet.replace('| NONE | VERIFIED', '| P-01 | VERIFIED'),
                worksheet.replace('| BROWSER |', '| UNKNOWN |'),
                worksheet.replace('| A-01 | BROWSER |', '| A-01 | API, BROWSER |'),
                worksheet.replace('| report.md | PASS', '| missing.md | PASS'),
            ]:
                (folder / 'worksheet.md').write_text(broken)
                self.assertTrue(check(folder), broken)
            (folder / 'worksheet.md').write_text(worksheet)
            (folder / '001-result.md').write_text('- Acceptance: A-02')
            self.assertTrue(check(folder))
            (folder / '001-result.md').write_text(plan)
            api_row = '| A-01 | P-01 | API | api.spec.ts::stores result | app.ts:save | green.json | report.md | PASS |\n'
            combined = worksheet.replace('| A-01 | BROWSER |', '| A-01 | API, BROWSER |') + api_row
            (folder / 'worksheet.md').write_text(combined)
            self.assertEqual(check(folder), [])
            for broken in [
                combined.replace('| BROWSER | request.spec.ts::saves and reloads', '| API | request.spec.ts::saves and reloads'),
                combined.replace('| API, BROWSER |', '| API |'),
                combined + api_row,
                combined.replace('| P-01 | API |', '| P-02 | API |'),
                combined.replace('| report.md | PASS |\n', '| report.md | PENDING |\n', 1),
            ]:
                (folder / 'worksheet.md').write_text(broken)
                self.assertTrue(check(folder), broken)
            (folder / 'worksheet.md').write_text(combined)
            extra_browser_row = api_row.replace('| API | api.spec.ts::stores result', '| BROWSER | request.spec.ts::filters records')
            (folder / 'worksheet.md').write_text(combined + extra_browser_row)
            self.assertEqual(check(folder), [])
            (folder / 'worksheet.md').write_text(worksheet)
            (folder / '001-result.md').write_text(plan)
            (folder / 'design.md').write_text(design + '\n| Invariant ID | Condition that must remain true |\n|---|---|\n| I-01 | A required invariant |\n')
            self.assertTrue(check(folder))
            (folder / 'design.md').write_text(design.replace('```yaml', '| W-01.return | B-02 | A-02 |\n```yaml'))
            self.assertTrue(check(folder))


if __name__ == '__main__':
    unittest.main()

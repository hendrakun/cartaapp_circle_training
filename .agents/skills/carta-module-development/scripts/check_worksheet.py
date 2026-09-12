#!/usr/bin/env python3
"""Check design coverage and worksheet links; semantic acceptance needs review."""
import argparse
import json
from pathlib import Path
import re


def table(text, columns):
    """Read a Markdown table by its exact header; reject malformed rows."""
    lines = text.splitlines()
    for index, line in enumerate(lines):
        if cells(line) != columns:
            continue
        rows = []
        for line in lines[index + 2:]:
            if not line.strip().startswith('|'):
                break
            values = cells(line)
            if len(values) != len(columns):
                raise ValueError(f'malformed row: {line}')
            rows.append(dict(zip(columns, values)))
        return rows
    raise ValueError(f'missing table: {" / ".join(columns)}')


def cells(line):
    return [part.strip().strip('`') for part in line.strip().strip('|').split('|')]


def ids(value, prefix):
    return set(re.findall(rf'\b{prefix}-\d+\b', value))


def rule_ids(value):
    return set(re.findall(r'\b(?:B|T|I)-\d+\b', value))


def exact_test(value):
    return '::' in value and all(part.strip() for part in value.split('::', 1))


def check(folder):
    errors = []
    design = (folder / 'design.md').read_text()
    worksheet = (folder / 'worksheet.md').read_text()
    inventory = table(design, ['Obligation', 'Rule references', 'Acceptance IDs'])
    journeys = table(design, ['Journey', 'Obligation', 'Acceptance IDs', 'Distinct interaction'])
    journey_tests = table(worksheet, ['Journey', 'Test case'])
    plans = table(worksheet, ['Plan', 'File', 'Depends on', 'Status', 'Review'])
    required = table(worksheet, ['Acceptance', 'Required surfaces'])
    acceptance = table(worksheet, ['Acceptance', 'Plan', 'Surface', 'Test case',
                                   'Implementation', 'Evidence', 'Review', 'Result'])

    def indexed(rows, key):
        result = {}
        for row in rows:
            name = row[key]
            if not name or name in result:
                errors.append(f'empty or duplicate {key}: {name}')
            result[name] = row
        return result

    expected = indexed(inventory, 'Obligation')
    plan_map = indexed(plans, 'Plan')
    requirements = indexed(required, 'Acceptance')
    journey_map = indexed(journeys, 'Journey')
    mapped_journeys = indexed(journey_tests, 'Journey')
    if journey_map.keys() != mapped_journeys.keys():
        errors.append('browser journey mapping differs from design')
    assigned_tests = [row['Test case'] for row in journey_tests if row['Test case'] != 'PENDING']
    if len(set(assigned_tests)) != len(assigned_tests):
        errors.append('each browser journey needs a distinct test case')
    cases = {}
    evidence_keys = set()
    for row in acceptance:
        key = (row['Acceptance'], row['Surface'], row['Test case'])
        if key in evidence_keys:
            errors.append(f'duplicate evidence row: {key}')
        evidence_keys.add(key)
        cases.setdefault(row['Acceptance'], []).append(row)
    declared = re.findall(r'^id:\s*(A-\d+)\s*$', design, re.MULTILINE)
    if len(declared) != len(set(declared)):
        errors.append('duplicate acceptance record IDs in design')
    if not expected or not declared or not plan_map:
        errors.append('design inventory, acceptance records and plans must be nonempty')
    defined_rules = set(re.findall(r'^id:\s*((?:B|T|I)-\d+)\s*$', design, re.MULTILINE))
    for columns in [
        ['Transition ID', 'From state', 'Action', 'Condition', 'To state', 'Effect references'],
        ['Invariant ID', 'Condition that must remain true'],
    ]:
        if any(cells(line) == columns for line in design.splitlines()):
            defined_rules.update(row[columns[0]] for row in table(design, columns))
    referenced_rules = set().union(*(rule_ids(row['Rule references']) for row in inventory))
    if defined_rules != referenced_rules:
        errors.append('defined rules and inventory rule references differ')
    covered = set()
    for name, row in expected.items():
        linked = ids(row['Acceptance IDs'], 'A')
        covered |= linked
        if not linked:
            errors.append(f'{name}: no acceptance cases')
    if any(values != set(declared) for values in [covered, set(cases), set(requirements)]):
        errors.append('design records, inventory links, required evidence and acceptance IDs differ')
    for name, row in requirements.items():
        surfaces = {value.strip() for value in row['Required surfaces'].split(',')}
        if not surfaces <= {'API', 'UNIT', 'BROWSER', 'VISUAL'}:
            errors.append(f'{name}: invalid required surfaces')
        actual_surfaces = {case['Surface'] for case in cases.get(name, [])}
        if surfaces != actual_surfaces:
            errors.append(f'{name}: evidence surfaces differ from required surfaces')
    for name, rows in cases.items():
        if len({row['Plan'] for row in rows}) != 1:
            errors.append(f'{name}: evidence must have one primary plan')

    for name, journey in journey_map.items():
        linked = ids(journey['Acceptance IDs'], 'A')
        obligation = expected.get(journey['Obligation'], {})
        if not re.fullmatch(r'J-\d+', name) or not journey['Distinct interaction'].strip():
            errors.append(f'{name}: invalid journey ID or missing distinct interaction')
        if not linked or not linked <= ids(obligation.get('Acceptance IDs', ''), 'A'):
            errors.append(f'{name}: journey differs from inventory acceptance')
        test = mapped_journeys.get(name, {}).get('Test case', '')
        if test != 'PENDING' and not exact_test(test):
            errors.append(f'{name}: expected file::exact test title')
        for case in linked:
            if not any(row['Surface'] == 'BROWSER' and row['Test case'] == test for row in cases.get(case, [])):
                errors.append(f'{name}/{case}: missing mapped browser evidence')

    def file_link(value, label):
        if not value or not (folder / value).is_file():
            errors.append(f'{label}: missing file {value}')

    dependencies = {}
    for name, row in plan_map.items():
        if not re.fullmatch(r'P-\d+', name):
            errors.append(f'invalid plan ID: {name}')
        if row['Status'] not in {'TODO', 'IN_PROGRESS', 'IMPLEMENTED', 'VERIFIED', 'BLOCKED', 'SUPERSEDED'}:
            errors.append(f'{name}: invalid plan status')
        file_link(row['File'], name)
        plan_file = folder / row['File']
        if plan_file.is_file() and row['Status'] != 'SUPERSEDED':
            declaration = re.search(r'^- Acceptance: (.+)$', plan_file.read_text(), re.MULTILINE)
            declared_cases = ids(declaration[1], 'A') if declaration else set()
            assigned_cases = {case['Acceptance'] for case in acceptance if case['Plan'] == name}
            if not declared_cases or declared_cases != assigned_cases:
                errors.append(f'{name}: plan acceptance differs from worksheet ownership')
        deps = ids(row['Depends on'], 'P')
        dependencies[name] = deps
        if not deps and row['Depends on'] != 'NONE':
            errors.append(f'{name}: dependencies must be plan IDs or NONE')
        if deps - plan_map.keys() or name in deps:
            errors.append(f'{name}: invalid dependency')
        owned = [case for case in acceptance if case['Plan'] == name]
        if row['Status'] != 'SUPERSEDED' and not owned:
            errors.append(f'{name}: no acceptance owner rows')
        if row['Status'] == 'SUPERSEDED' and owned:
            errors.append(f'{name}: superseded plan still owns acceptance')
        if row['Status'] == 'VERIFIED':
            if any(case['Result'] != 'PASS' for case in owned):
                errors.append(f'{name}: verified with incomplete acceptance')
            file_link(row['Review'], f'{name} review')
        if row['Status'] in {'IN_PROGRESS', 'IMPLEMENTED', 'VERIFIED'}:
            for dep in deps & plan_map.keys():
                if plan_map[dep]['Status'] not in {'IMPLEMENTED', 'VERIFIED'}:
                    errors.append(f'{name}: prerequisite {dep} is not implemented')

    def visit(name, path):
        if name in path:
            errors.append(f'dependency cycle: {name}')
            return
        for dep in dependencies.get(name, set()):
            visit(dep, path | {name})
    for name in dependencies:
        visit(name, set())

    for row in acceptance:
        name = f'{row["Acceptance"]}/{row["Surface"]}/{row["Test case"]}'
        if row['Plan'] not in plan_map:
            errors.append(f'{name}: missing primary plan')
        if row['Surface'] not in {'API', 'UNIT', 'BROWSER', 'VISUAL'}:
            errors.append(f'{name}: invalid evidence surface')
        pending = (row['Test case'] == 'PENDING' and row['Result'] in {'PENDING', 'BLOCKED'}
                   and plan_map.get(row['Plan'], {}).get('Status') in {'TODO', 'IN_PROGRESS', 'BLOCKED'})
        if not pending:
            if row['Surface'] != 'VISUAL' and not exact_test(row['Test case']):
                errors.append(f'{name}: expected file::exact test title')
            elif row['Test case'] in {'', 'NONE', 'PENDING'}:
                errors.append(f'{name}: missing visual check')
        if row['Result'] not in {'PENDING', 'PASS', 'FAIL', 'BLOCKED'}:
            errors.append(f'{name}: invalid result')
        if row['Result'] == 'PASS' or plan_map.get(row['Plan'], {}).get('Status') in {'IMPLEMENTED', 'VERIFIED'}:
            if row['Implementation'] in {'', 'NONE', 'PENDING'}:
                errors.append(f'{name}: missing implementation')
            for column in ['Evidence'] + (['Review'] if row['Result'] == 'PASS' else []):
                file_link(row[column], f'{name} {column}')
            if row['Surface'] != 'VISUAL':
                try:
                    report = json.loads((folder / row['Evidence']).read_text())
                    before = report.get('before', {})
                    if (report.get('scope') != 'command' or report.get('status') != 'PASS'
                            or report.get('result', {}).get('exitCode') != 0
                            or not before.get('inputs') or not before.get('fingerprint')
                            or before['fingerprint'] != report.get('after', {}).get('fingerprint')):
                        errors.append(f'{name}: command evidence is not a stable pass')
                except (OSError, ValueError, AttributeError) as error:
                    errors.append(f'{name}: evidence needs recorder JSON: {error}')
    if re.search(r'^- State: `?DONE`?\s*$', worksheet, re.MULTILINE):
        if any(row['Status'] not in {'VERIFIED', 'SUPERSEDED'} for row in plans):
            errors.append('DONE requires all selected plans verified')
        if any(row['Result'] != 'PASS' for row in acceptance):
            errors.append('DONE requires all acceptance passed')
        if journeys:
            report = re.search(r'^- Browser report: (.+)$', worksheet, re.MULTILINE)
            if not report:
                errors.append('DONE requires a browser report')
            else:
                try:
                    errors.extend(check_browser_report(folder, folder / report[1].strip('`')))
                except (OSError, ValueError) as error:
                    errors.append(f'browser report: {error}')
        final = re.search(r'^- Latest review: (.+)$', worksheet, re.MULTILINE)
        file_link(final[1].strip('`') if final else '', 'final review')
    return errors


def check_browser_report(folder, report_path):
    """Match selected journeys to actual Playwright results, not report prose."""
    worksheet = (folder / 'worksheet.md').read_text()
    journeys = table(worksheet, ['Journey', 'Test case'])
    report = json.loads(report_path.read_text())
    errors = []
    if not isinstance(report, dict) or not isinstance(report.get('suites'), list):
        raise ValueError('expected a Playwright JSON report with suites')
    if report.get('errors'):
        errors.append('browser report contains runner errors')
    specs = []

    def visit(suite):
        specs.extend(suite.get('specs', []))
        for child in suite.get('suites', []):
            visit(child)

    visit(report)
    for journey in journeys:
        parts = journey['Test case'].split('::', 1)
        if not exact_test(journey['Test case']):
            errors.append(f"{journey['Journey']}: invalid browser test reference")
            continue
        file, title = parts
        file = file.replace('\\', '/')
        matches = [spec for spec in specs if spec.get('title') == title
                   and (file == spec.get('file', '').replace('\\', '/')
                        or file.endswith('/' + spec.get('file', '').replace('\\', '/')))]
        if len(matches) != 1:
            errors.append(f"{journey['Journey']}: browser case missing or ambiguous: {journey['Test case']}")
            continue
        tests = matches[0].get('tests', [])
        if not tests or any(test.get('expectedStatus') != 'passed'
                            or test.get('status') != 'expected'
                            or not test.get('results')
                            or any(result.get('status') != 'passed' for result in test['results'])
                            for test in tests):
            errors.append(f"{journey['Journey']}: browser case did not pass every attempt/project")
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('folder', type=Path)
    parser.add_argument('--browser-report', type=Path)
    args = parser.parse_args()
    try:
        errors = check(args.folder)
        if args.browser_report:
            errors.extend(check_browser_report(args.folder, args.browser_report))
    except (OSError, ValueError) as error:
        errors = [str(error)]
    for error in errors:
        print(f'FAIL: {error}')
    if not errors:
        print('PASS: structural coverage and links; semantic acceptance not checked')
    return bool(errors)


if __name__ == '__main__':
    raise SystemExit(main())

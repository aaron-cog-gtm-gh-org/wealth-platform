#!/usr/bin/env python3
"""Generate and validate the manual QA workbook from canonical case data."""

from __future__ import annotations

import argparse
import json
import sys
import zipfile
from collections import Counter
from pathlib import Path
from typing import Any
from xml.etree import ElementTree

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

JIRA_BASE = "https://cognition-team-x9dqnayp.atlassian.net/browse/"
REQUIREMENTS = (
    ("KAN-12", "Clients", "Wealth UAT: Manage client suitability and KYC profiles", 1, 8),
    ("KAN-13", "Portfolio", "Wealth UAT: Inspect account holdings and currency-safe valuations", 9, 18),
    ("KAN-14", "Orders", "Wealth UAT: Place and cancel investment orders with reservation controls", 19, 30),
    ("KAN-15", "Move Money", "Wealth UAT: Review and confirm internal cash transfers", 31, 38),
    ("KAN-16", "Rebalance", "Wealth UAT: Maintain model targets and preview portfolio drift", 39, 44),
    ("KAN-17", "Settlements", "Wealth UAT: Assign and resolve settlement exceptions with audit history", 45, 50),
)
PRIORITIES = {"Critical", "High", "Medium", "Low"}
CASE_FIELDS = (
    "id",
    "feature",
    "title",
    "jiraKey",
    "jiraUrl",
    "priority",
    "preconditions",
    "testData",
)
SHEET_NAMES = (
    "Test Cases",
    "Test Steps",
    "Requirements Traceability",
    "Execution Guide",
)
HEADERS = {
    "Test Cases": (
        "Id",
        "Name",
        "Module",
        "Priority",
        "Type",
        "Status",
        "Requirement",
        "Requirement URL",
        "Precondition",
        "Test Data",
        "Step Count",
    ),
    "Test Steps": (
        "Test Case Id",
        "Test Case Name",
        "Step #",
        "Test Step Description",
        "Test Step Expected Result",
        "Requirement",
    ),
    "Requirements Traceability": (
        "Jira Key",
        "Summary",
        "Module",
        "Case Count",
        "Test Case IDs",
        "Jira URL",
    ),
    "Execution Guide": ("Topic", "Guidance"),
}
EXECUTION_GUIDE = (
    (
        "Purpose",
        "Manual UAT cases for the synthetic Wealth Platform connected workspace demo. All clients, accounts, balances and exceptions are fictional sandbox data; no real RBC customer data is used.",
    ),
    (
        "Application URL",
        "Open <base URL>/?screen=workspace&area=<area>, where area is clients, portfolio, orders, money, rebalance or settlements. Each case names the area to start from.",
    ),
    (
        "Reset before every case",
        "Before starting each case, restore the deterministic seed using the controlled test harness reset supplied by the test lead. Do not use any in-app reset control. Then reload the browser so it shows the seeded state.",
    ),
    (
        "Seed: clients",
        "C1001 Eleanor Whitfield, risk Moderate, KYC Current. C1002 James Chen, risk Conservative, KYC Review due.",
    ),
    (
        "Seed: accounts",
        "A1001 Whitfield Investment (C1001), CAD 25,000.00 cash. A1002 Whitfield Savings (C1001), CAD 10,000.00 cash. A1003 Chen USD Investment (C1002), USD 15,000.00 cash.",
    ),
    (
        "Seed: positions",
        "P1001 A1001 RY Royal Bank of Canada 100 @ 140.00 CAD (14,000.00). P1002 A1002 BMO 80 @ 125.00 CAD (10,000.00). P1003 A1003 MSFT 40 @ 420.00 USD (16,800.00).",
    ),
    (
        "Seed: orders and transfers",
        "No orders and no transfers exist at seed. Any order or transfer a case needs is created through the UI inside that case.",
    ),
    (
        "Seed: model targets",
        "Equity 60%, Fixed income 30%, Cash 10%; current allocation equals targets at seed.",
    ),
    (
        "Seed: settlement exceptions",
        "EX1001 A1001 Missing settlement instructions, Open, unassigned. EX1002 A1003 Cash reconciliation, Open, unassigned. Assignable owners: A. Nguyen, S. Patel.",
    ),
    (
        "Executing steps",
        "Perform every step in the browser exactly as written and compare the screen against the expected result for that step. Record Pass or Fail per step; a case passes only if every step passes.",
    ),
    (
        "Invalid input checks",
        "Where a step expects a rejection, confirm that a clear error is shown AND that no record, balance, holding, status or audit entry changed, including after a browser reload.",
    ),
    (
        "Evidence",
        "Capture a screenshot of the final expected state and of any failure. Note the case Id, step number, observed result and timestamp in the defect or run record.",
    ),
    (
        "Traceability",
        "Each case links to its Jira story in the Requirements Traceability sheet and the Requirement column. This workbook follows a qTest-style export layout for review; it is not a certified qTest import file.",
    ),
)

ROOT = Path(__file__).resolve().parent.parent
XML_NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "office_rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "package_rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}


def _workbook_part_path(target: str) -> str:
    if target.startswith("/"):
        return target.lstrip("/")
    return str(Path("xl") / target)


def _requirements_by_case_id() -> dict[str, tuple[str, str, str, int, int]]:
    return {
        f"WM-TC-{case_number:03d}": requirement
        for requirement in REQUIREMENTS
        for case_number in range(requirement[3], requirement[4] + 1)
    }


def validate_cases(data: Any) -> list[str]:
    """Return all detectable input errors; an empty list means the data is valid."""
    errors: list[str] = []
    if not isinstance(data, dict):
        return ["JSON root must be an object containing a cases array."]
    cases = data.get("cases")
    if not isinstance(cases, list):
        return ["cases must be an array."]

    if len(cases) != 50:
        errors.append(f"Expected exactly 50 cases; found {len(cases)}.")

    expected_ids = [f"WM-TC-{number:03d}" for number in range(1, 51)]
    actual_ids: list[Any] = []
    seen_ids: set[str] = set()
    seen_titles: set[str] = set()
    counts: Counter[str] = Counter()
    by_case_id = _requirements_by_case_id()

    for index, case in enumerate(cases, start=1):
        label = f"Case at index {index}"
        if not isinstance(case, dict):
            errors.append(f"{label} must be an object.")
            actual_ids.append(None)
            continue

        for field in CASE_FIELDS:
            value = case.get(field)
            if not isinstance(value, str):
                errors.append(f"{label} field '{field}' must be a string.")
            elif not value.strip():
                errors.append(f"{label} field '{field}' must not be blank.")

        case_id = case.get("id")
        actual_ids.append(case_id)
        if isinstance(case_id, str):
            if case_id in seen_ids:
                errors.append(f"{label} has duplicate id '{case_id}'.")
            seen_ids.add(case_id)
            requirement = by_case_id.get(case_id)
            if requirement is None:
                errors.append(f"{label} id '{case_id}' is outside WM-TC-001..WM-TC-050.")
            else:
                expected_key, expected_feature = requirement[0], requirement[1]
                if case.get("jiraKey") != expected_key:
                    errors.append(
                        f"{label} ({case_id}) jiraKey must be {expected_key}."
                    )
                if case.get("feature") != expected_feature:
                    errors.append(
                        f"{label} ({case_id}) feature must be {expected_feature!r}."
                    )

        title = case.get("title")
        if isinstance(title, str) and title.strip():
            normalized_title = title.strip().casefold()
            if normalized_title in seen_titles:
                errors.append(f"{label} title '{title}' is not unique.")
            seen_titles.add(normalized_title)

        priority = case.get("priority")
        if isinstance(priority, str) and priority not in PRIORITIES:
            errors.append(
                f"{label} priority must be one of {', '.join(sorted(PRIORITIES))}."
            )

        jira_key = case.get("jiraKey")
        if isinstance(jira_key, str):
            if jira_key not in {requirement[0] for requirement in REQUIREMENTS}:
                errors.append(f"{label} jiraKey '{jira_key}' is not a known requirement.")
            else:
                counts[jira_key] += 1

        expected_url = JIRA_BASE + jira_key if isinstance(jira_key, str) else None
        if isinstance(case.get("jiraUrl"), str) and expected_url is not None:
            if case["jiraUrl"] != expected_url:
                errors.append(
                    f"{label} jiraUrl must equal {expected_url!r}."
                )

        steps = case.get("steps")
        if not isinstance(steps, list) or not steps:
            errors.append(f"{label} steps must be a non-empty array.")
            continue
        for step_number, step in enumerate(steps, start=1):
            step_label = f"{label} step {step_number}"
            if not isinstance(step, dict):
                errors.append(f"{step_label} must be an object.")
                continue
            for field in ("action", "expected"):
                value = step.get(field)
                if not isinstance(value, str):
                    errors.append(f"{step_label} field '{field}' must be a string.")
                elif not value.strip():
                    errors.append(f"{step_label} field '{field}' must not be blank.")

    if actual_ids != expected_ids:
        errors.append(
            "Case ids must be exactly WM-TC-001..WM-TC-050 in order, with no gaps."
        )
    for key, _feature, _summary, first, last in REQUIREMENTS:
        expected_count = last - first + 1
        actual_count = counts[key]
        if actual_count != expected_count:
            errors.append(
                f"Requirement {key} must have {expected_count} cases; found {actual_count}."
            )
    return errors


def _add_hyperlink(cell: Any, target: str) -> None:
    cell.hyperlink = target
    cell.style = "Hyperlink"


def _style_sheet(sheet: Any, widths: tuple[float, ...]) -> None:
    header_fill = PatternFill(fill_type="solid", fgColor="005DAA")
    header_font = Font(bold=True, color="FFFFFF")
    thin_grey = Side(style="thin", color="D9E1F2")
    border = Border(left=thin_grey, right=thin_grey, top=thin_grey, bottom=thin_grey)

    for cell in sheet[1]:
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(vertical="top", wrap_text=True)
        cell.border = border
    for row in sheet.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = Alignment(vertical="top", wrap_text=True)
            cell.border = border
    for column_number, width in enumerate(widths, start=1):
        sheet.column_dimensions[get_column_letter(column_number)].width = width

    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = sheet.dimensions
    sheet.print_title_rows = "1:1"
    sheet.page_setup.orientation = "landscape"


def generate_workbook(data: dict[str, Any], output_path: Path) -> None:
    workbook = Workbook()
    test_cases = workbook.active
    test_cases.title = "Test Cases"
    test_steps = workbook.create_sheet("Test Steps")
    traceability = workbook.create_sheet("Requirements Traceability")
    guide = workbook.create_sheet("Execution Guide")

    for sheet in (test_cases, test_steps, traceability, guide):
        sheet.append(HEADERS[sheet.title])

    for case in data["cases"]:
        key = case["jiraKey"]
        url = case["jiraUrl"]
        test_cases.append(
            (
                case["id"],
                case["title"],
                case["feature"],
                case["priority"],
                "Manual",
                "New",
                key,
                url,
                case["preconditions"],
                case["testData"],
                len(case["steps"]),
            )
        )
        _add_hyperlink(test_cases.cell(test_cases.max_row, 7), url)
        _add_hyperlink(test_cases.cell(test_cases.max_row, 8), url)

        for step_number, step in enumerate(case["steps"], start=1):
            test_steps.append(
                (
                    case["id"],
                    case["title"],
                    step_number,
                    step["action"],
                    step["expected"],
                    key,
                )
            )
            _add_hyperlink(test_steps.cell(test_steps.max_row, 6), url)

    for key, feature, summary, _first, _last in REQUIREMENTS:
        requirement_cases = [case for case in data["cases"] if case["jiraKey"] == key]
        url = JIRA_BASE + key
        traceability.append(
            (
                key,
                summary,
                feature,
                len(requirement_cases),
                ", ".join(case["id"] for case in requirement_cases),
                url,
            )
        )
        _add_hyperlink(traceability.cell(traceability.max_row, 1), url)
        _add_hyperlink(traceability.cell(traceability.max_row, 6), url)

    for topic, guidance in EXECUTION_GUIDE:
        guide.append((topic, guidance))

    widths = {
        "Test Cases": (14, 48, 18, 14, 12, 12, 16, 54, 64, 48, 12),
        "Test Steps": (14, 44, 10, 64, 64, 16),
        "Requirements Traceability": (16, 68, 20, 14, 70, 54),
        "Execution Guide": (30, 110),
    }
    for sheet in workbook.worksheets:
        _style_sheet(sheet, widths[sheet.title])

    workbook.properties.title = "Wealth Platform Manual QA"
    workbook.properties.creator = "Wealth Platform QA"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    workbook.save(output_path)


def _verify_openpyxl(path: Path, data: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    try:
        workbook = load_workbook(path, data_only=False)
    except Exception as exc:
        return [f"Could not reopen workbook with openpyxl: {exc}"]

    try:
        if workbook.sheetnames != list(SHEET_NAMES):
            errors.append(
                f"Sheet order/names must be {list(SHEET_NAMES)!r}; found {workbook.sheetnames!r}."
            )

        for sheet_name in SHEET_NAMES:
            if sheet_name not in workbook.sheetnames:
                continue
            sheet = workbook[sheet_name]
            actual_headers = tuple(
                sheet.cell(row=1, column=column).value
                for column in range(1, len(HEADERS[sheet_name]) + 1)
            )
            if actual_headers != HEADERS[sheet_name]:
                errors.append(
                    f"{sheet_name} headers must be {HEADERS[sheet_name]!r}; found {actual_headers!r}."
                )
            if sheet.freeze_panes != "A2":
                errors.append(f"{sheet_name} freeze_panes must be 'A2'.")
            if not sheet.auto_filter.ref:
                errors.append(f"{sheet_name} must have an auto_filter range.")

        if "Test Cases" in workbook.sheetnames:
            sheet = workbook["Test Cases"]
            if sheet.max_row - 1 != len(data["cases"]):
                errors.append(
                    f"Test Cases must have {len(data['cases'])} data rows; found {sheet.max_row - 1}."
                )
            ids = [sheet.cell(row=row, column=1).value for row in range(2, sheet.max_row + 1)]
            expected_ids = [case["id"] for case in data["cases"]]
            if ids != expected_ids:
                errors.append("Test Cases Id values do not match the JSON ids in order.")
            for row, case in enumerate(data["cases"], start=2):
                for column in (7, 8):
                    cell = sheet.cell(row=row, column=column)
                    if cell.hyperlink is None or cell.hyperlink.target != JIRA_BASE + case["jiraKey"]:
                        errors.append(
                            f"Test Cases row {row} hyperlink in column {column} must target {JIRA_BASE + case['jiraKey']}."
                        )

        total_steps = sum(len(case["steps"]) for case in data["cases"])
        if "Test Steps" in workbook.sheetnames:
            sheet = workbook["Test Steps"]
            if sheet.max_row - 1 != total_steps:
                errors.append(
                    f"Test Steps must have {total_steps} data rows; found {sheet.max_row - 1}."
                )
            actual_steps = [
                tuple(sheet.cell(row=row, column=column).value for column in (1, 3, 4, 5))
                for row in range(2, sheet.max_row + 1)
            ]
            expected_steps = [
                (case["id"], step_number, step["action"], step["expected"])
                for case in data["cases"]
                for step_number, step in enumerate(case["steps"], start=1)
            ]
            if actual_steps != expected_steps:
                errors.append(
                    "Test Steps (id, step number, action, expected) do not match the JSON."
                )
            row = 2
            for case in data["cases"]:
                for _step in case["steps"]:
                    hyperlink = sheet.cell(row=row, column=6).hyperlink
                    if hyperlink is None or hyperlink.target != JIRA_BASE + case["jiraKey"]:
                        errors.append(
                            f"Test Steps row {row} Requirement hyperlink does not target the case Jira URL."
                        )
                    row += 1

        if "Requirements Traceability" in workbook.sheetnames:
            sheet = workbook["Requirements Traceability"]
            if sheet.max_row - 1 != len(REQUIREMENTS):
                errors.append(
                    f"Requirements Traceability must have 6 data rows; found {sheet.max_row - 1}."
                )
            for row, (key, feature, summary, _first, _last) in enumerate(REQUIREMENTS, start=2):
                cases = [case for case in data["cases"] if case["jiraKey"] == key]
                expected_values = (
                    summary,
                    feature,
                    len(cases),
                    ", ".join(case["id"] for case in cases),
                    JIRA_BASE + key,
                )
                actual_values = tuple(
                    sheet.cell(row=row, column=column).value for column in range(2, 7)
                )
                if actual_values != expected_values:
                    errors.append(f"Requirements Traceability row {row} does not match {key}.")
                for column in (1, 6):
                    hyperlink = sheet.cell(row=row, column=column).hyperlink
                    if hyperlink is None or hyperlink.target != JIRA_BASE + key:
                        errors.append(
                            f"Requirements Traceability row {row} hyperlink in column {column} must target {JIRA_BASE + key}."
                        )

        if "Execution Guide" in workbook.sheetnames:
            sheet = workbook["Execution Guide"]
            if sheet.max_row - 1 != len(EXECUTION_GUIDE):
                errors.append(
                    f"Execution Guide must have {len(EXECUTION_GUIDE)} data rows; found {sheet.max_row - 1}."
                )
            actual_guide = [
                (sheet.cell(row=row, column=1).value, sheet.cell(row=row, column=2).value)
                for row in range(2, sheet.max_row + 1)
            ]
            if actual_guide != list(EXECUTION_GUIDE):
                errors.append("Execution Guide values do not match the required guidance.")
    finally:
        workbook.close()
    return errors


def _verify_xml(path: Path, data: dict[str, Any]) -> tuple[list[str], dict[str, dict[str, int]]]:
    errors: list[str] = []
    counts: dict[str, dict[str, int]] = {}
    expected_steps = sum(len(case["steps"]) for case in data["cases"])
    expected_hyperlinks = {
        "Test Cases": 100,
        "Test Steps": expected_steps,
        "Requirements Traceability": 12,
        "Execution Guide": 0,
    }
    expected_data_rows = {
        "Test Cases": len(data["cases"]),
        "Test Steps": expected_steps,
        "Requirements Traceability": len(REQUIREMENTS),
        "Execution Guide": len(EXECUTION_GUIDE),
    }
    required_parts = {"[Content_Types].xml", "xl/workbook.xml"}

    try:
        with zipfile.ZipFile(path) as archive:
            corrupt_member = archive.testzip()
            if corrupt_member is not None:
                errors.append(f"Workbook ZIP failed testzip() at {corrupt_member}.")
                return errors, counts
            names = set(archive.namelist())
            for part in required_parts:
                if part not in names:
                    errors.append(f"Workbook ZIP is missing {part}.")
            if errors:
                return errors, counts

            workbook_root = ElementTree.fromstring(archive.read("xl/workbook.xml"))
            relationship_root = ElementTree.fromstring(
                archive.read("xl/_rels/workbook.xml.rels")
            )
            workbook_relationships = {
                relationship.attrib["Id"]: relationship.attrib["Target"]
                for relationship in relationship_root.findall(
                    "package_rel:Relationship", XML_NS
                )
            }
            sheets = workbook_root.findall("main:sheets/main:sheet", XML_NS)
            found_names = [sheet.attrib["name"] for sheet in sheets]
            if found_names != list(SHEET_NAMES):
                errors.append(
                    f"Workbook XML sheet order/names must be {list(SHEET_NAMES)!r}; found {found_names!r}."
                )
            if len(sheets) != 4:
                errors.append(f"Workbook XML must list 4 sheets; found {len(sheets)}.")

            shared_strings_used = any(
                cell.attrib.get("t") == "s"
                for sheet in sheets
                for relationship_id in [sheet.attrib.get(f"{{{XML_NS['office_rel']}}}id")]
                if relationship_id in workbook_relationships
                for part in [_workbook_part_path(workbook_relationships[relationship_id])]
                if part in names
                for cell in ElementTree.fromstring(
                    archive.read(part)
                ).findall(".//main:c", XML_NS)
            )
            if (shared_strings_used or "xl/sharedStrings.xml" in names) and (
                "xl/sharedStrings.xml" not in names
            ):
                errors.append("Workbook uses shared strings but xl/sharedStrings.xml is missing.")

            for sheet in sheets:
                sheet_name = sheet.attrib["name"]
                relationship_id = sheet.attrib.get(f"{{{XML_NS['office_rel']}}}id")
                target = workbook_relationships.get(relationship_id)
                if target is None:
                    errors.append(f"Workbook XML has no relationship for sheet {sheet_name}.")
                    continue
                sheet_part = _workbook_part_path(target)
                if sheet_part not in names:
                    errors.append(f"Workbook ZIP is missing worksheet part {sheet_part}.")
                    continue
                sheet_root = ElementTree.fromstring(archive.read(sheet_part))
                rows = sheet_root.findall(".//main:sheetData/main:row", XML_NS)
                hyperlinks = sheet_root.findall(".//main:hyperlinks/main:hyperlink", XML_NS)
                if len(rows) != expected_data_rows[sheet_name] + 1:
                    errors.append(
                        f"{sheet_name} XML must have {expected_data_rows[sheet_name] + 1} rows; found {len(rows)}."
                    )
                if len(hyperlinks) != expected_hyperlinks[sheet_name]:
                    errors.append(
                        f"{sheet_name} XML must have {expected_hyperlinks[sheet_name]} hyperlinks; found {len(hyperlinks)}."
                    )
                pane = sheet_root.find(".//main:sheetViews/main:sheetView/main:pane", XML_NS)
                if pane is None or pane.attrib.get("state") != "frozen":
                    errors.append(f"{sheet_name} XML must have a frozen pane.")
                if sheet_root.find(".//main:autoFilter", XML_NS) is None:
                    errors.append(f"{sheet_name} XML must have an autoFilter.")

                rels_part = str(
                    Path(sheet_part).parent / "_rels" / f"{Path(sheet_part).name}.rels"
                )
                external_hyperlink_targets: list[str] = []
                if rels_part in names:
                    rels_root = ElementTree.fromstring(archive.read(rels_part))
                    external_hyperlink_targets = [
                        relationship.attrib.get("Target", "")
                        for relationship in rels_root.findall(
                            "package_rel:Relationship", XML_NS
                        )
                        if relationship.attrib.get("TargetMode") == "External"
                        and relationship.attrib.get("Type", "").endswith("/hyperlink")
                    ]
                if len(external_hyperlink_targets) != expected_hyperlinks[sheet_name]:
                    errors.append(
                        f"{sheet_name} XML relationships must contain {expected_hyperlinks[sheet_name]} external hyperlinks; found {len(external_hyperlink_targets)}."
                    )
                if any(not target.startswith(JIRA_BASE) for target in external_hyperlink_targets):
                    errors.append(
                        f"{sheet_name} has an external hyperlink target outside JIRA_BASE."
                    )
                counts[sheet_name] = {
                    "rows": len(rows),
                    "hyperlinks": len(hyperlinks),
                    "external_hyperlink_relationships": len(external_hyperlink_targets),
                }
    except (OSError, zipfile.BadZipFile, ElementTree.ParseError, KeyError) as exc:
        errors.append(f"Could not verify workbook XML/ZIP structure: {exc}")
    return errors, counts


def verify_workbook(path: str | Path, data: dict[str, Any]) -> list[str]:
    """Reopen a saved workbook and validate its spreadsheet and XML contents."""
    workbook_path = Path(path)
    errors = _verify_openpyxl(workbook_path, data)
    xml_errors, _counts = _verify_xml(workbook_path, data)
    return errors + xml_errors


def _print_summary(path: Path, data: dict[str, Any]) -> None:
    workbook = load_workbook(path, read_only=True, data_only=False)
    try:
        print("Per-requirement case counts:")
        for key, _feature, _summary, _first, _last in REQUIREMENTS:
            count = sum(case["jiraKey"] == key for case in data["cases"])
            print(f"  {key}: {count}")
        total_steps = sum(len(case["steps"]) for case in data["cases"])
        print(f"Total steps: {total_steps}")
        print("Sheet row counts (including headers):")
        for sheet in workbook.worksheets:
            print(f"  {sheet.title}: {sheet.max_row}")
    finally:
        workbook.close()
    _xml_errors, xml_counts = _verify_xml(path, data)
    print("XML counts (rows / hyperlinks / external hyperlink relationships):")
    for sheet_name in SHEET_NAMES:
        values = xml_counts.get(sheet_name, {})
        print(
            f"  {sheet_name}: {values.get('rows', 0)} / "
            f"{values.get('hyperlinks', 0)} / "
            f"{values.get('external_hyperlink_relationships', 0)}"
        )


def _load_cases(path: Path) -> tuple[dict[str, Any] | None, list[str]]:
    try:
        with path.open(encoding="utf-8") as case_file:
            data = json.load(case_file)
    except (OSError, json.JSONDecodeError) as exc:
        return None, [f"Could not read cases JSON {path}: {exc}"]
    if not isinstance(data, dict):
        return None, ["JSON root must be an object containing a cases array."]
    return data, validate_cases(data)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    generate_parser = subparsers.add_parser("generate", help="generate and verify a workbook")
    generate_parser.add_argument("--cases", type=Path)
    generate_parser.add_argument("--out", type=Path)
    validate_parser = subparsers.add_parser("validate", help="validate cases and an existing workbook")
    validate_parser.add_argument("--cases", type=Path)
    validate_parser.add_argument("--workbook", type=Path)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    cases_path = args.cases if args.cases is not None else ROOT / "qa" / "cases.json"
    cases_path = cases_path if cases_path.is_absolute() else Path.cwd() / cases_path
    data, errors = _load_cases(cases_path)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    assert data is not None

    if args.command == "generate":
        output_path = args.out if args.out is not None else ROOT / "qa" / "Wealth-Platform-Manual-QA.xlsx"
        output_path = output_path if output_path.is_absolute() else Path.cwd() / output_path
        try:
            generate_workbook(data, output_path)
        except (OSError, ValueError) as exc:
            print(f"ERROR: Could not write workbook {output_path}: {exc}", file=sys.stderr)
            return 1
        workbook_path = output_path
    else:
        workbook_path = (
            args.workbook
            if args.workbook is not None
            else ROOT / "qa" / "Wealth-Platform-Manual-QA.xlsx"
        )
        workbook_path = (
            workbook_path if workbook_path.is_absolute() else Path.cwd() / workbook_path
        )

    errors = verify_workbook(workbook_path, data)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(f"PASS: {args.command} verified {workbook_path}")
    _print_summary(workbook_path, data)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

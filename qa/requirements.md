# Wealth Platform manual QA requirements

Manual UAT coverage for the connected workspace (`/?screen=workspace&area=...`) of the synthetic
Wealth Platform demo. All clients, accounts, balances and exceptions are fictional sandbox data;
no real RBC customer data is used.

`qa/cases.json` is the source for the cases. `qa/Wealth-Platform-Manual-QA.xlsx` is generated from it by
`scripts/qa-workbook.py`. The workbook uses a qTest-style export layout for review. It is not a
certified qTest import file.

## Traceability

| Jira story | Module | Workspace area | Cases | Count |
| --- | --- | --- | --- | --- |
| [KAN-12](https://cognition-team-x9dqnayp.atlassian.net/browse/KAN-12) Manage client suitability and KYC profiles | Clients | `clients` | WM-TC-001 to WM-TC-008, WM-TC-051 | 9 |
| [KAN-13](https://cognition-team-x9dqnayp.atlassian.net/browse/KAN-13) Inspect account holdings and currency-safe valuations | Portfolio | `portfolio` | WM-TC-009 to WM-TC-018 | 10 |
| [KAN-14](https://cognition-team-x9dqnayp.atlassian.net/browse/KAN-14) Place and cancel investment orders with reservation controls | Orders | `orders` | WM-TC-019 to WM-TC-030, WM-TC-052 | 13 |
| [KAN-15](https://cognition-team-x9dqnayp.atlassian.net/browse/KAN-15) Review and confirm internal cash transfers | Move Money | `money` | WM-TC-031 to WM-TC-038, WM-TC-053 | 9 |
| [KAN-16](https://cognition-team-x9dqnayp.atlassian.net/browse/KAN-16) Maintain model targets and preview portfolio drift | Rebalance | `rebalance` | WM-TC-039 to WM-TC-044 | 6 |
| [KAN-17](https://cognition-team-x9dqnayp.atlassian.net/browse/KAN-17) Assign and resolve settlement exceptions with audit history | Settlements | `settlements` | WM-TC-045 to WM-TC-050 | 6 |

## Requirements under test

- **KAN-12 Clients.** Find clients by name or ID and inspect only the selected client's accounts. Risk
  profile options are Conservative, Moderate and Growth. KYC status options are Current and Review due.
  Saved changes persist after reload, stay scoped to the edited client and are audit logged. Abandoned
  edits change nothing.
- **KAN-13 Portfolio.** Filter positions by client, account and instrument. Market value is quantity
  times price. CAD and USD totals are always separate, with no unconverted mixed-currency total.
  Filters never show another client's positions. Open orders do not change holdings.
- **KAN-14 Orders.** Place whole, positive share Buy and Sell orders only for instruments the account
  holds. Buys are checked against cash less open buy reservations, in the account's currency. Sells
  are checked against settled quantity less all open sell reservations. For example, with 100 RY an
  open sell of 70 leaves 30 available, so a second sell of 50 is rejected and no order is created.
  Cancelling an Open order releases its reservation. Cancelled is final. Successful placements and
  cancellations are audit logged; rejected attempts are not.
- **KAN-15 Move Money.** Transfers run only between the same client's distinct CAD accounts (A1001 and
  A1002). Amounts must be greater than zero with at most two decimals, and no more than the cash left
  after open buy reservations. Review and edit never move funds. Confirm debits and credits both
  accounts, shows a reference, persists after reload and is audit logged. Same-account, cross-client
  and cross-currency transfers are rejected.
- **KAN-16 Rebalance.** The three classes are Equity, Fixed income and Cash, seeded at 60/30/10 current and
  target. Each target must be from 0 to 100 and the targets must total exactly 100. Valid targets persist
  and are audit logged. The drift preview shows drift per class and marks within-tolerance classes. It
  never places orders or changes holdings or cash.
- **KAN-17 Settlements.** Filter exceptions by Open, In progress and Resolved. Owners are A. Nguyen and
  S. Patel. Resolving needs an owner and a note of at least 10 meaningful characters. A Resolved exception
  cannot be reopened. Updates persist and are audit logged. Invalid actions change nothing.

## Seed fixture

| Type | Records |
| --- | --- |
| Clients | C1001 Eleanor Whitfield: Moderate, Current. C1002 James Chen: Conservative, Review due |
| Accounts | A1001 Whitfield Investment (C1001): CAD 25,000.00. A1002 Whitfield Savings (C1001): CAD 10,000.00. A1003 Chen USD Investment (C1002): USD 15,000.00 |
| Positions | P1001 A1001 RY Royal Bank of Canada: 100 × 140.00 CAD. P1002 A1002 BMO: 80 × 125.00 CAD. P1003 A1003 MSFT: 40 × 420.00 USD |
| Orders and transfers | None |
| Model targets | Equity 60, Fixed income 30, Cash 10 (current equals target) |
| Settlement exceptions | EX1001 A1001 Missing settlement instructions: Open, unassigned. EX1002 A1003 Cash reconciliation: Open, unassigned |

## Execution rules

- Before each case, restore the seed with the controlled test harness reset, not an in-app control.
  Then reload the browser. Every case can run on its own from the seed. Any order or transfer a case
  needs is created through the UI within that case.
- Every case is run in the browser. Each step lists the UI action and the result to check.
- Where a step expects a rejection, also check that no record, balance, holding, status or audit entry
  changed, including after a reload.

## Regenerating and validating

```sh
python3 -m venv ~/.venvs/qa && ~/.venvs/qa/bin/pip install -r qa/workbook-requirements.txt
~/.venvs/qa/bin/python scripts/qa-workbook.py generate   # validate JSON, write workbook, read it back
~/.venvs/qa/bin/python scripts/qa-workbook.py validate   # re-check JSON and the committed workbook
```

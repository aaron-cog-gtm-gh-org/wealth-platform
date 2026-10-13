# API Contract: `/api/custody`

**Feature**: [../spec.md](../spec.md) | DTOs are added to `src/api/types.ts`.

Conventions follow `server/app.ts`: JSON responses; dates `YYYY-MM-DD`; decimals as **strings**
(R-6). Errors: `404 { error: 'Not found' }`,
`400 { error: string }` (validation), `503 { error: 'Service unavailable' }` (unexpected).
No login: every route is open to every user (research R-9).

| Method & path | Response DTO | Story |
|---|---|---|
| `GET /api/clients?q=&page=` | `ClientPickerPage` (households + custody clients, 25/page) | US6 |
| `GET /api/custody/clients/:clientId/household` | `HouseholdDto` (mapped, GBP) | US1 |
| `GET /api/custody/clients/:clientId/portfolio` | `PortfolioDto` (latest effective statement, GBP) | US1 |
| `GET /api/custody/clients?q=&page=` | `CustodyClientPage` (25/page) | US6 |
| `GET /api/custody/clients/:clientId` | `CustodyClientSummary` | US6 |
| `GET /api/custody/accounts/:accountId/statements` | `CustodyStatementDate[]` (newest first) | US1 |
| `GET /api/custody/accounts/:accountId/statements/:date` | `CustodyStatement` | US1 |
| `GET /api/custody/accounts/:accountId/confirmations?from=&to=` | `CustodyConfirmation[]` | US2 |
| `GET /api/custody/position-checks?date=&accountId=&mode=` | `PositionCheckResult` | US3 |
| `PATCH /api/custody/breaks/:accountId/:isin/:date` | `BreakNote` | US3 |
| `GET /api/custody/breaks/:accountId/:isin/:date/history` | `BreakNoteHistory[]` | US3 |
| `GET /api/custody/messages?type=&date=&safe=&page=` | `CustodyMessagePage` | US4 |
| `GET /api/custody/messages/:messageId` | `CustodyMessage` | US4 |
| `GET /api/custody/admin/ingestion` | `IngestionStatus` | US5 |
| `POST /api/custody/admin/ingest-runs` | `IngestRun` | US5 |

`mode` = `corrected` (default) | `legacy` (BR-1..BR-5 unchanged, for sign-off). `accountId`
omitted ⇒ all accounts ("Check All").

## DTOs

```ts
export interface ClientPickerItem { kind: 'household' | 'custody'; id: string; name: string; clientRef: string | null; reportingCurrency: Currency }
export interface ClientPickerPage { items: ClientPickerItem[]; page: number; total: number }
export type Currency = 'CAD' | 'USD' | 'GBP' | 'EUR';          // widened (R-3)
export type CustodyRole = 'ADVISER' | 'OPS' | 'ADMIN';
export type CustodyAccountType = 'ISA' | 'SIPP' | 'GIA';
export type QtyType = 'UNIT' | 'FAMT';
export type BreakStatus = 'NEW' | 'OPEN' | 'CHASED' | 'RESOLVED' | 'WRITEOFF';
export type BreakCause = 'CORP_ACTION' | 'MISSING_CONFIRM' | 'OTHER';
type Dec = string;                                             // fixed-point decimal

export interface CustodyClientRow { clientId: number; clientRef: string; name: string;
  adviser: string | null; status: string; accountCount: number }
export interface CustodyClientPage { rows: CustodyClientRow[]; page: number; total: number }
export interface CustodyAccountSummary { accountId: number; safeNo: number; accountType: CustodyAccountType;
  reportingCcy: Currency; closed: boolean; latestStatementDate: string | null; latestValue: Dec | null }
export interface CustodyClientSummary extends CustodyClientRow { accounts: CustodyAccountSummary[]; total: Dec }

export interface CustodyStatementDate { date: string; isEmpty: boolean; superseded: number }
export interface CustodyStatementLine { isin: string; name: string; nameVerified: boolean;
  qty: Dec; qtyType: QtyType; price: Dec; ccy: Currency; marketValue: Dec;
  reportingValue: Dec | null; messageId: number }
export interface CustodyStatement { accountId: number; date: string; functionCode: string;
  isEmpty: boolean; lines: CustodyStatementLine[]; total: Dec; missingReportingValues: number;
  messageId: number }

export interface CustodyConfirmation { confirmationId: number; mtType: 544 | 545 | 546 | 547;
  direction: 'Receive' | 'Deliver'; freeOfPayment: boolean; tradeDate: string; settleDate: string;
  isin: string; name: string; qty: Dec; qtyType: QtyType; amount: Dec | null;
  amountCcy: Currency | null; reference: string; messageId: number }

export interface PositionBreak { accountId: number; safeNo: number; isin: string; name: string;
  qtyType: QtyType; previousQty: Dec; settledNet: Dec; expectedQty: Dec; reportedQty: Dec;
  difference: Dec; status: BreakStatus; cause: BreakCause | null; note: string | null;
  updatedBy: string | null; updatedAt: string | null; sourceMessageIds: number[] }
export interface PositionCheckResult { date: string; mode: 'corrected' | 'legacy';
  accountsChecked: number; breaks: PositionBreak[] }
export interface BreakNotePatch { author: string; status?: Exclude<BreakStatus, 'NEW'>; cause?: BreakCause | null; note?: string | null }
export interface BreakNote { status: BreakStatus; cause: BreakCause | null; note: string | null;
  updatedBy: string; updatedAt: string }
export interface BreakNoteHistory extends BreakNote { source: 'LEGACY_MIGRATION' | 'USER' }

export interface CustodyMessageRow { messageId: number; mtType: number; functionCode: string;
  safeNo: number | null; businessDate: string; sourceFile: string; parseStatus: 'OK' | 'ERROR' }
export interface CustodyMessagePage { rows: CustodyMessageRow[]; page: number; total: number }
export interface CustodyMessage extends CustodyMessageRow { rawText: string; parseError: string | null }

export interface IngestRun { runId: number; startedAt: string; finishedAt: string | null;
  filesSeen: number; filesNew: number; filesDuplicate: number; parseErrors: number }
export interface IngestionStatus { lastRun: IngestRun | null; messagesByType: Record<string, number>;
  statements: number; confirmations: number; unmatchedCancellations: number;
  errors: { sourceFile: string; error: string }[] }
```

`PATCH` semantics: only supplied fields change (fixes D-6); every call appends history.

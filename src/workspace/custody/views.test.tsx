import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import type { BreakRow } from './api';
import { CustodyContext } from './shared';
import type { CustodyCtx } from './shared';
import { readCustodyRoute } from './model';
import { HoldingsTable } from './views/Holdings';
import { NO_SETTLEMENTS, SettlementsTable } from './views/Settlements';
import { BreaksTable, ReconEditor } from './views/PositionCheck';
import { ClientAccountsTable } from './views/Clients';
import { ArchiveStats } from './views/Archive';

const ctx: CustodyCtx = {
  route: readCustodyRoute(new URLSearchParams('view=clients')),
  nav: () => {},
  accounts: { status: 'idle' },
  refreshAudit: async () => {},
};
const render = (el: ReactElement) => renderToStaticMarkup(<CustodyContext.Provider value={ctx}>{el}</CustodyContext.Provider>);

const row = (over: Partial<BreakRow> = {}): BreakRow => ({
  isin: 'GB00ZZ011962', instrument: 'Kestrel UK Equity Income', prevQty: 1000, netSettled: 0, expected: 1000, stmtQty: 2000, diff: 1000,
  status: 'NEW', note: null, updatedBy: null, updatedAt: null, ...over,
});

test('holdings table is captioned and totals GBP market value', () => {
  const html = render(<HoldingsTable caption="Holdings for 01001-01 at 09 Oct 2026" totalGbp={11524.08} lines={[
    { isin: 'GB00ZZ000080', instrument: 'UNKNOWN INSTRUMENT GB00ZZ000080', qty: 2.7316, qtyType: 'UNIT', price: 101.5, ccy: 'GBP', mktVal: 277.26, mktValGbp: 277.26 },
  ]} />);
  assert.match(html, /<caption[^>]*>Holdings for 01001-01 at 09 Oct 2026<\/caption>/);
  assert.match(html, /UNKNOWN INSTRUMENT GB00ZZ000080/);
  assert.match(html, /2\.7316/);
  assert.match(html, /Total market value \(GBP\)/);
  assert.match(html, /£11,524\.08/);
});

test('settlements table shows the empty-period message', () => {
  const html = render(<SettlementsTable caption="Settlement confirmations" rows={[]} />);
  assert.match(html, /<caption/);
  assert.ok(html.includes(NO_SETTLEMENTS));
  assert.equal(NO_SETTLEMENTS, 'No settlements in period.');
});

test('breaks table shows historic statuses verbatim and offers an update action per row', () => {
  const html = render(<BreaksTable caption="Breaks" selected={null} onEdit={() => {}} rows={[row(), row({ isin: 'US00ZZ011817', status: 'O', note: 'resend from custodian?', updatedBy: 'TGARNER', updatedAt: '2016-03-11T15:20:00Z' })]} />);
  assert.match(html, />NEW</);
  assert.match(html, />O</);
  assert.match(html, /aria-label="Update break US00ZZ011817"/);
  assert.match(html, /11 Mar 2016 15:20/);
});

test('recon editor offers only OPEN, CHASED, RESOLVED and WRITEOFF and labels every control', () => {
  const html = render(<ReconEditor row={row({ status: 'C' })} operators={[{ username: 'LBRENNAN', fullName: 'Lauren Brennan', role: 'OPS' }]} busy={false} error={null} success={null} onSave={() => {}} onCancel={() => {}} />);
  const statusSelect = /<label for="([^"]+)">Status<\/label><select id="\1"[^>]*>(.*?)<\/select>/.exec(html);
  assert.ok(statusSelect, 'status select is labelled');
  const options = [...statusSelect[2].matchAll(/<option value="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(options, ['OPEN', 'CHASED', 'RESOLVED', 'WRITEOFF']);
  assert.match(html, /<label for="[^"]+">Operator<\/label>/);
  assert.match(html, /Lauren Brennan \(LBRENNAN\)/);
  assert.match(html, /<label for="[^"]+">Note<\/label><textarea[^>]*maxLength="500"/);
});

test('client accounts trim account types and link into account views', () => {
  const html = render(<ClientAccountsTable clientName="The Penhaligon Family Trust" accounts={[
    { acctId: 2007, acctNo: '01005-02', acctType: 'SIPP ', baseCcy: 'GBP', safeCode: '13760', openDate: '2013-04-01', closeDate: null, status: 'O' },
  ]} />);
  assert.match(html, /<td>SIPP<\/td>/);
  assert.match(html, /01 Apr 2013/);
  for (const view of ['holdings', 'settlements', 'check']) assert.ok(html.includes(`area=custody&amp;view=${view}&amp;acct=2007`), view);
});

test('archive status highlights parse errors', () => {
  const html = render(<ArchiveStats status={{ root: 'server/custody/archive', mt535Count: 3073, mt54xCount: 2971, statements: 3073, confirmations: 2971, parseErrors: 2, loadedAt: '2026-11-09T15:00:00Z', loadMs: 4210 }} />);
  assert.match(html, /3,073/);
  assert.match(html, /cu-stat cu-stat--bad"><dt>Parse errors<\/dt><dd>2</);
  assert.match(html, /4,210 ms/);
});

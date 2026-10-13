import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { after, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../app';
import { closePool, query } from '../../db/pool';
import type { CustodyConfirmation } from '../../../src/api/types';
import { addDaysIso } from '../../../src/model/custody-settlements';
import { listConfirmations, listStatementDates } from '../../repositories/custody';

const enabled = process.env.CUSTODY_INT === '1';
const skipped = !enabled && 'set CUSTODY_INT=1 (requires the already-loaded Oracle database)';
const MIN_DATE = '0001-01-01';
const MAX_DATE = '9999-12-31';

interface LegacyConfirmation {
  file: string;
  folder: string;
  mtType: number;
  seme: string;
  prev: string | null;
  function: string;
  tradeDate: string;
  settleDate: string;
  isin: string;
  qty: string;
  safe: string;
  amountRaw: string | null;
  amount: string | null;
  ccy: string | null;
  direction: 'REC' | 'DEL';
}

const accountForSafe = async (safeNo: number) => {
  const rows = await query<{ accountId: number }>(
    'SELECT account_id AS "accountId" FROM custody_accounts WHERE safe_no = :safeNo',
    { safeNo },
  );
  assert.equal(rows.length, 1, `expected one account for safe ${safeNo}`);
  return rows[0].accountId;
};

const canonicalDecimal = (value: string) => {
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(value.trim());
  assert.ok(match, `invalid decimal ${value}`);
  const fraction = (match[3] ?? '').replace(/0+$/, '');
  return `${match[1] ?? ''}${BigInt(match[2]).toString()}${fraction ? `.${fraction}` : ''}`;
};

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), 'fixtures/custody/legacy/confirmations.json'), 'utf8'),
) as { confirmations: LegacyConfirmation[] };

after(async () => {
  await closePool();
});

test('D-1: account 2101 returns the expected June–July confirmation', { skip: skipped, timeout: 120_000 }, async () => {
  const rows = await listConfirmations(2101, '2026-06-01', '2026-07-31');
  const expected = rows.find((row) => row.reference === 'KS5400060214');
  assert.ok(expected, 'expected reference KS5400060214');
  assert.equal(expected.mtType, 545);
  assert.equal(expected.direction, 'Receive');
  assert.equal(expected.amount, '21637.50');
  assert.equal(expected.amountCcy, 'GBP');
  console.log(`D-1 account 2101 confirmations: ${rows.length}`);
});

test('D-3: cancellation and cancelled confirmation are excluded in all affected date ranges', { skip: skipped, timeout: 120_000 }, async () => {
  const accountId = await accountForSafe(16056);
  for (const [from, to] of [
    ['2026-07-01', '2026-07-31'],
    ['2026-07-14', '2026-07-14'],
    ['2026-07-15', '2026-07-15'],
  ]) {
    const rows = await listConfirmations(accountId, from, to);
    assert.equal(rows.some((row) => row.reference === 'KS5400060882'), false, `${from}..${to}: cancelled original`);
    assert.equal(rows.some((row) => row.reference === 'KS5400064555'), false, `${from}..${to}: CANC message`);
  }
});

test('D-2: the padded-safe accounts include the two late 2026 confirmations', { skip: skipped, timeout: 120_000 }, async () => {
  const messages = await query<{ messageId: number; sourceFile: string }>(
    'SELECT message_id AS "messageId", source_file AS "sourceFile" FROM custody_messages',
  );
  const sourceFileByMessageId = new Map(messages.map((row) => [row.messageId, basename(row.sourceFile)]));
  const expected = [
    [11397, 'MT544_11397_20260916_001.txt'],
    [10554, 'MT545_10554_20260916_001.txt'],
  ] as const;
  for (const [safeNo, file] of expected) {
    const rows = await listConfirmations(await accountForSafe(safeNo), MIN_DATE, MAX_DATE);
    assert.ok(rows.some((row) => sourceFileByMessageId.get(row.messageId) === file), `missing ${file}`);
  }
});

test('omitted dates default to the latest statement and the preceding 90 UTC days', { skip: skipped, timeout: 120_000 }, async () => {
  const latest = (await listStatementDates(2101))[0]?.date;
  assert.ok(latest, 'account 2101 should have an effective statement date');
  const from = addDaysIso(latest, -90);
  const defaults = await listConfirmations(2101);
  const explicit = await listConfirmations(2101, from, latest);
  assert.deepEqual(defaults, explicit);
  assert.ok(defaults.every((row) => row.settleDate >= from && row.settleDate <= latest));
});

test('MT544 free-of-payment confirmations preserve a null amount', { skip: skipped, timeout: 120_000 }, async () => {
  const rows = await listConfirmations(await accountForSafe(17220), MIN_DATE, MAX_DATE);
  assert.ok(rows.some((row) => row.mtType === 544 && row.freeOfPayment && row.amount === null));
});

test('HTTP confirmations endpoint validates ranges and unknown accounts', { skip: skipped, timeout: 120_000 }, async () => {
  const server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/custody`;
  try {
    const valid = await fetch(`${base}/accounts/2101/confirmations?from=2026-06-01&to=2026-07-31`);
    assert.equal(valid.status, 200);
    assert.ok(Array.isArray(await valid.json()));

    const reversed = await fetch(`${base}/accounts/2101/confirmations?from=2026-07-31&to=2026-06-01`);
    assert.equal(reversed.status, 400);
    const malformed = await fetch(`${base}/accounts/2101/confirmations?from=bad`);
    assert.equal(malformed.status, 400);
    const missingAccount = await fetch(`${base}/accounts/999999/confirmations`);
    assert.equal(missingAccount.status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test('all-account confirmation results match the legacy folder cancellation rules', { skip: skipped, timeout: 300_000 }, async () => {
  const accounts = await query<{ accountId: number; safeNo: number }>(
    'SELECT account_id AS "accountId", safe_no AS "safeNo" FROM custody_accounts WHERE safe_no IS NOT NULL ORDER BY account_id',
  );
  const messages = await query<{ messageId: number; sourceFile: string }>(
    'SELECT message_id AS "messageId", source_file AS "sourceFile" FROM custody_messages',
  );
  const sourceFileByMessageId = new Map(messages.map((row) => [row.messageId, basename(row.sourceFile)]));
  const rowsByFolder = new Map<string, LegacyConfirmation[]>();
  for (const row of fixture.confirmations) {
    const rows = rowsByFolder.get(row.folder) ?? [];
    rows.push(row);
    rowsByFolder.set(row.folder, rows);
  }
  const legacyVisible = fixture.confirmations.filter((row) => {
    if (row.function === 'CANC') return false;
    const cancellations = (rowsByFolder.get(row.folder) ?? []).filter((item) => item.function === 'CANC');
    return !cancellations.some((item) => item.prev === row.seme);
  });
  const newOnly = new Set<string>();
  const legacyOnly = new Set<string>();
  const amountDifferences = new Set<string>();
  const expectedDirection = { REC: 'Receive', DEL: 'Deliver' } as const;

  for (const account of accounts) {
    const paddedSafe = String(account.safeNo).padStart(7, '0');
    const legacyRows = legacyVisible.filter((row) => row.safe === paddedSafe);
    const apiRows = await listConfirmations(account.accountId, MIN_DATE, MAX_DATE);
    const actualByFile = new Map<string, CustodyConfirmation>();
    for (const row of apiRows) {
      const file = sourceFileByMessageId.get(row.messageId);
      assert.ok(file, `missing source file for message ${row.messageId}`);
      actualByFile.set(file, row);
    }
    const legacyByFile = new Map(legacyRows.map((row) => [row.file, row]));
    for (const file of actualByFile.keys()) if (!legacyByFile.has(file)) newOnly.add(file);
    for (const file of legacyByFile.keys()) if (!actualByFile.has(file)) legacyOnly.add(file);

    for (const [file, legacy] of legacyByFile) {
      const actual = actualByFile.get(file);
      if (!actual) continue;
      assert.equal(actual.direction, expectedDirection[legacy.direction], `${file} direction`);
      assert.equal(actual.isin, legacy.isin, `${file} ISIN`);
      assert.equal(actual.tradeDate, legacy.tradeDate, `${file} trade date`);
      assert.equal(actual.settleDate, legacy.settleDate, `${file} settle date`);
      assert.equal(actual.reference, legacy.seme, `${file} reference`);
      assert.equal(actual.amountCcy, legacy.ccy, `${file} currency`);
      assert.equal(canonicalDecimal(actual.qty), canonicalDecimal(legacy.qty), `${file} quantity`);
      if (legacy.amount === null) {
        assert.equal(actual.amount, null, `${file} null amount`);
      } else if (canonicalDecimal(actual.amount ?? '0') !== canonicalDecimal(legacy.amount)) {
        assert.match(legacy.amountRaw ?? '', /,\d$/, `${file} amount differs outside a one-digit raw fraction`);
        amountDifferences.add(file);
      }
    }
  }

  assert.deepEqual([...newOnly].sort(), [
    'MT544_11397_20260916_001.txt',
    'MT545_10554_20260916_001.txt',
  ]);
  assert.deepEqual([...legacyOnly].sort(), ['MT545_16056_20260714_001.txt']);
  assert.equal(amountDifferences.size, 240);
  console.log(`One-digit amountRaw legacy amount differences: ${amountDifferences.size}`);
});

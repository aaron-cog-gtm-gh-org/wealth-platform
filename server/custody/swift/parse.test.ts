import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  blocks,
  parseArchiveFileName,
  parseConfirmation,
  parseMessage,
  parseStatement,
  parseSwiftAmount,
  parseSwiftDecimal,
  safeKey,
  SwiftParseError,
} from './parse';
import { fixtureText } from './test-fixtures';

test('MT535: header fields, FIN lines, FX line with separate GBP value', () => {
  const st = parseStatement(fixtureText('MT535_10314_20260417_001.txt'));
  assert.equal(st.function, 'NEWM');
  assert.equal(st.statementDate, '2026-04-17');
  assert.equal(st.safekeepingAcct, '0010314');
  assert.equal(st.lines.length, 10);
  assert.deepEqual(st.lines[0], {
    isin: 'FR00ZZ000406',
    description: 'Tavistock Shipping SA',
    qty: 230,
    qtyType: 'UNIT',
    price: 109.556,
    ccy: 'EUR',
    mktVal: 25197.88,
    mktValGbp: 21433.64,
  });
  assert.equal(st.lines.filter((l) => l.qtyType === 'FAMT').length, 1);
});

test('MT535: continental decimals and fractional quantities to 4 dp', () => {
  const st = parseStatement(fixtureText('MT535_10049_20260501_001.txt'));
  const qty = Object.fromEntries(st.lines.map((l) => [l.isin, l.qty]));
  assert.equal(qty.GB00ZZ012549, 1487.999);
  assert.equal(qty.IE00ZZ012643, 31214.6894);
  const usd = st.lines.find((l) => l.isin === 'US00ZZ001461')!;
  assert.deepEqual([usd.ccy, usd.mktVal, usd.mktValGbp], ['USD', 13466.1, 10582.82]);
});

test('MT535: RPLC and NEWM/DUPL keep the whole 23G text', () => {
  assert.equal(parseStatement(fixtureText('MT535_16558_20260626_002.txt')).function, 'RPLC');
  assert.equal(parseStatement(fixtureText('MT535_16558_20260626_003.txt')).function, 'NEWM/DUPL');
  assert.equal(parseStatement(fixtureText('MT535_10925_20260515_002.txt')).function, 'RPLC');
});

test('MT535: _002 resend and _001 parse to the same date; RPLC adds a line', () => {
  const first = parseStatement(fixtureText('MT535_16558_20260626_001.txt'));
  const resend = parseStatement(fixtureText('MT535_16558_20260626_002.txt'));
  assert.equal(first.statementDate, resend.statementDate);
  assert.equal(first.lines.length, 9);
  assert.equal(resend.lines.length, 10);
  const added = resend.lines.find((l) => l.isin === 'GB00ZZ003373')!;
  assert.deepEqual([added.price, added.qty, added.mktVal], [10.612, 1250, 13265]);
});

test('MT535: no trailer, no FIN blocks, unpadded safekeeping, LF line endings', () => {
  const empty = fixtureText('MT535_10024_20260508_001.txt');
  assert.ok(!empty.includes('{5:'));
  const st = parseStatement(empty);
  assert.deepEqual([st.statementDate, st.safekeepingAcct, st.lines.length], ['2026-05-08', '0010024', 0]);

  const unpadded = parseStatement(fixtureText('MT535_12228_20260807_001.txt'));
  assert.equal(unpadded.safekeepingAcct, '12228');
  assert.equal(unpadded.lines.length, 8);
  assert.equal(safeKey(unpadded.safekeepingAcct), safeKey('0012228'));
});

test('MT54x: settlement confirmation fields and directions', () => {
  const rec = parseConfirmation(fixtureText('mt54x/20260505/MT545_15165_20260505_001.txt'));
  assert.deepEqual(rec, {
    mtType: 545,
    seme: 'SETT20260505863',
    prev: null,
    function: 'NEWM',
    tradeDate: '2026-04-30',
    settleDate: '2026-05-05',
    isin: 'GB00ZZ002847',
    qty: 530,
    safekeepingAcct: '0015165',
    amountRaw: 'GBP6950,95',
    amount: 6950.95,
    ccy: 'GBP',
    direction: 'REC',
  });
  assert.equal(parseConfirmation(fixtureText('mt54x/20260420/MT544_17220_20260420_001.txt')).direction, 'REC');
  assert.equal(parseConfirmation(fixtureText('mt54x/20260720/MT547_11848_20260720_001.txt')).direction, 'DEL');
});

test('MT54x: MT544 free receipt has no 19A amount', () => {
  const c = parseConfirmation(fixtureText('mt54x/20260420/MT544_17220_20260420_001.txt'));
  assert.deepEqual([c.amountRaw, c.amount, c.ccy, c.qty], [null, null, null, 2924.9]);
});

test('MT54x: no {5:} trailer tolerated; CANC carries PREV', () => {
  const text = fixtureText('mt54x/20260715/MT545_16056_20260715_002.txt');
  assert.ok(!text.includes('{5:'));
  const canc = parseConfirmation(text);
  assert.deepEqual([canc.function, canc.seme, canc.prev], ['CANC', 'KS5400064555', 'KS5400060882']);
  assert.equal(canc.settleDate, '2026-07-14');
});

test('MT54x: 8-digit safekeeping account kept as sent', () => {
  const c = parseConfirmation(fixtureText('mt54x/20260916/MT545_10554_20260916_001.txt'));
  assert.equal(c.safekeepingAcct, '00010554');
  assert.equal(c.qty, 3776.07);
  assert.equal(safeKey(c.safekeepingAcct), '10554');
});

test('D3 amounts: one-digit fractions, no decimals, beyond 2^31', () => {
  assert.equal(parseConfirmation(fixtureText('mt54x/20260720/MT547_11848_20260720_001.txt')).amount, 37619.4);
  assert.equal(parseSwiftAmount('GBP4303,01'), 4303.01);
  assert.equal(parseSwiftAmount('USD192,'), 192);
  assert.equal(parseSwiftAmount('GBP11524,8'), 11524.8);
  assert.equal(parseSwiftAmount('GBP3000000000,5'), 3000000000.5);
  assert.equal(parseSwiftAmount('EUR123456789012,345'), 123456789012.34);
  assert.equal(parseSwiftAmount('GBP0,125'), 0.12);
  assert.equal(parseSwiftAmount('GBP'), null);
  assert.equal(parseSwiftAmount(null), null);
  assert.equal(parseSwiftAmount('GBPabc'), null);

  const big = fixtureText('mt54x/20260505/MT545_15165_20260505_001.txt').replace('GBP6950,95', 'GBP2147483648,95');
  assert.equal(parseConfirmation(big).amount, 2147483648.95);
});

test('decimals: comma or point, rounding half-even like .NET Math.Round', () => {
  assert.equal(parseSwiftDecimal('1250,'), 1250);
  assert.equal(parseSwiftDecimal('2,7316'), 2.7316);
  assert.equal(parseSwiftDecimal('10.612'), 10.612);
  assert.throws(() => parseSwiftDecimal(''), SwiftParseError);
  const text = fixtureText('MT535_10049_20260501_001.txt');
  const q = (raw: string) => parseStatement(text.replace(/:93B::AGGR\/\/UNIT\/1300,/, `:93B::AGGR//UNIT/${raw}`)).lines[0].qty;
  assert.equal(q('1,00005'), 1);
  assert.equal(q('1,00015'), 1.0002);
  assert.equal(q('1,000151'), 1.0002);
});

test('field reader: qualifier, content, continuation lines, nested blocks', () => {
  const msg = parseMessage(fixtureText('MT535_16558_20260626_002.txt'));
  assert.equal(msg.mtType, 535);
  const safe = msg.fields.find((f) => f.tag === '97A')!;
  assert.deepEqual([safe.qualifier, safe.content], ['SAFE', '0016558']);
  const isin = msg.fields.find((f) => f.tag === '35B' && f.raw.startsWith('ISIN GB00ZZ003373'))!;
  assert.equal(isin.qualifier, null);
  assert.deepEqual(isin.raw.split('\n'), ['ISIN GB00ZZ003373', '/GB/9737818', 'Foxley Telecom PLC Ord']);
  assert.equal(blocks(msg, 'FIN').length, 10);
});

test('malformed input throws SwiftParseError', () => {
  assert.throws(() => parseStatement('{2:O535}{4:\n:16R:GENL\n-}'), SwiftParseError);
  assert.throws(() => parseStatement('{4:\n:98A::STAT//20261301\n-}'), SwiftParseError);
  assert.throws(() => parseConfirmation('{4:\n:98A::SETT//20260101\n-}'), SwiftParseError);
  assert.throws(() => parseMessage('{4:\n:98A::STAT//20260101\n'), SwiftParseError);
});

test('archive file names', () => {
  assert.deepEqual(parseArchiveFileName('MT535_16558_20260626_003.txt'), {
    fileName: 'MT535_16558_20260626_003.txt',
    family: 'MT535',
    mtType: 535,
    safeCode: '16558',
    date: '2026-06-26',
    fileSeq: 3,
  });
  assert.equal(parseArchiveFileName('mt54x/20260715/MT545_16056_20260715_002.txt')?.family, 'MT54x');
  assert.equal(parseArchiveFileName('MT535_16558_20260626.txt')?.fileSeq, 0);
  assert.equal(parseArchiveFileName('README.txt'), null);
});

const archive = process.env.PV_ARCHIVE_DIR;

test('entire PV archive parses without error', { skip: archive ? false : 'PV_ARCHIVE_DIR not set' }, () => {
  const errors: string[] = [];
  const attempt = (name: string, parse: () => void) => {
    try {
      parse();
    } catch (e) {
      errors.push(`${name}: ${(e as Error).message}`);
    }
  };
  const mt535 = readdirSync(join(archive!, 'mt535')).filter((f) => f.endsWith('.txt'));
  for (const f of mt535) {
    attempt(f, () => {
      const st = parseStatement(readFileSync(join(archive!, 'mt535', f), 'latin1'));
      assert.equal(safeKey(st.safekeepingAcct), parseArchiveFileName(f)?.safeCode);
    });
  }
  let mt54x = 0;
  for (const day of readdirSync(join(archive!, 'mt54x'))) {
    for (const f of readdirSync(join(archive!, 'mt54x', day)).filter((x) => x.endsWith('.txt'))) {
      mt54x++;
      attempt(f, () => {
        const c = parseConfirmation(readFileSync(join(archive!, 'mt54x', day, f), 'latin1'));
        assert.equal(c.mtType, parseArchiveFileName(f)?.mtType);
      });
    }
  }
  assert.deepEqual(errors, []);
  assert.equal(mt535.length, 3073);
  assert.equal(mt54x, 2971);
});

import type { CustodyConfirmation } from '../api/types';
import { dayMonthYear } from '../format';

export const addDaysIso = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const defaultSettlementRange = (latestStatementDate: string | null, todayIso: string) => {
  const to = latestStatementDate ?? todayIso;
  return { from: addDaysIso(to, -90), to };
};

export const fmtDec = (dec: string, minFrac: number, maxFrac: number) => {
  if (!Number.isInteger(minFrac) || !Number.isInteger(maxFrac) || minFrac < 0 || maxFrac < minFrac) {
    throw new RangeError('Fraction digits must be non-negative integers with minFrac <= maxFrac');
  }
  const match = /^(-)?(\d+)(?:\.(\d*))?$/.exec(dec.trim());
  if (!match) return dec;
  const fraction = match[3] ?? '';
  const scaledFraction = fraction.padEnd(maxFrac, '0');
  let scaled = BigInt(match[2] + scaledFraction.slice(0, maxFrac));
  if (fraction.length > maxFrac && fraction[maxFrac] >= '5') scaled += 1n;
  const digits = scaled.toString().padStart(maxFrac + 1, '0');
  const wholeDigits = maxFrac === 0 ? digits : digits.slice(0, -maxFrac);
  let fractionDigits = maxFrac === 0 ? '' : digits.slice(-maxFrac);
  while (fractionDigits.length > minFrac && fractionDigits.endsWith('0')) {
    fractionDigits = fractionDigits.slice(0, -1);
  }
  const whole = BigInt(wholeDigits).toLocaleString('en-CA');
  const sign = match[1] && scaled !== 0n ? '−' : '';
  return sign + whole + (fractionDigits ? `.${fractionDigits}` : '');
};

export interface SettlementRow {
  tradeDate: string;
  settleDate: string;
  msg: `MT${CustodyConfirmation['mtType']}`;
  direction: CustodyConfirmation['direction'];
  fop: boolean;
  fopLabel: 'Free of payment' | null;
  isin: string;
  name: string;
  qtyFmt: string;
  qtyType: 'units' | 'FAMT face';
  amountFmt: string;
  ccy: string;
  reference: string;
  messageId: number;
}

export const toSettlementRows = (confs: CustodyConfirmation[]): SettlementRow[] =>
  confs.map((conf) => ({
    tradeDate: dayMonthYear(conf.tradeDate),
    settleDate: dayMonthYear(conf.settleDate),
    msg: `MT${conf.mtType}` as SettlementRow['msg'],
    direction: conf.direction,
    fop: conf.freeOfPayment,
    fopLabel: conf.freeOfPayment ? 'Free of payment' : null,
    isin: conf.isin,
    name: conf.name,
    qtyFmt: fmtDec(conf.qty, 0, 4),
    qtyType: conf.qtyType === 'UNIT' ? 'units' : 'FAMT face',
    amountFmt: conf.amount === null ? '—' : fmtDec(conf.amount, 2, 2),
    ccy: conf.amountCcy ?? '—',
    reference: conf.reference,
    messageId: conf.messageId,
  }));

export const settlementsHref = (
  clientId: number,
  accountId: number,
  range?: { from: string; to: string },
) => {
  const params = new URLSearchParams({
    screen: 'custody-settlements',
    client: String(clientId),
    account: String(accountId),
  });
  if (range) {
    params.set('from', range.from);
    params.set('to', range.to);
  }
  return `?${params.toString()}`;
};

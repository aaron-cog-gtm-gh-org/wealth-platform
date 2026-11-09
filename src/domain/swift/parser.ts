// legacy: PV.Core/SwiftParser.cs - string-splitting MT535/MT54x parser (quirks Q1-Q6).
import { Decimal } from '../decimal';
import { parseYmd } from '../date';
import {
  csTrim, directoryName, fileName, fileNameWithoutExtension, parseInt32, substring, trimChars, tryParseInt,
} from '../dotnet';
import { SwiftField, SwiftMessage } from './message';
import { newLine, newStatement, type Mt535Statement, type SettlementConfirm } from './models';

const isLetter = (c: string | undefined) => !!c && /^\p{L}$/u.test(c);

/** legacy: SwiftParser.ParseDecimal - every `,` becomes `.` (Q1); "1.250,50" throws */
export const parseDecimal = (s: string): Decimal => Decimal.parse(s.replace(/,/g, '.'));

/** legacy: SwiftParser.Parse */
export function parseMessage(text: string, path: string | null = null): SwiftMessage {
  const msg = new SwiftMessage();
  msg.fileName = path !== null ? fileName(path) : null;

  const b2s = text.indexOf('{2:');
  if (b2s >= 0) {
    const b2e = text.indexOf('}', b2s);
    const b2 = substring(text, b2s + 3, b2e - b2s - 3);
    // O<mt><hhmm><yymmdd><LT12><sess4><isn6><yymmdd><hhmm>N
    if (b2.length > 0 && b2[0] === 'O') {
      msg.mtType = parseInt32(substring(b2, 1, 3));
      msg.senderLT = substring(b2, 11, 12);
    }
  }

  const b4s = text.indexOf('{4:');
  if (b4s < 0) return msg;
  let b4e = text.indexOf('\n-}', b4s);
  if (b4e < 0) b4e = text.indexOf('-}', b4s);
  const body = trimChars(substring(text, b4s + 3, b4e - b4s - 3), '\r\n');

  let cur: SwiftField | null = null;
  for (const line of body.split('\n')) {
    const l = trimChars(line, '\r', 'end');
    if (l.startsWith(':')) {
      const p = l.indexOf(':', 1);
      cur = new SwiftField(substring(l, 1, p - 1), substring(l, p + 1));
      msg.fields.push(cur);
    } else if (cur && l.length > 0) {
      cur.raw += '\n' + l;
    }
  }
  return msg;
}

/** legacy: SwiftParser.ParseStatement */
export function parseStatement(text: string, path: string | null = null): Mt535Statement {
  const msg = parseMessage(text, path);
  const st = newStatement();
  st.fileName = msg.fileName;
  st.fileSeq = fileSeq(path);

  const f23 = msg.find('23G');
  st.function = f23 ? csTrim(f23.raw) : null;
  const f98 = msg.find('98A');
  if (f98) st.statementDate = parseYmd(f98.content);
  const f97 = msg.find('97A');
  st.safekeepingAcct = f97 ? f97.content : null;

  for (const fin of msg.blocks('FIN')) {
    const line = newLine();
    for (const f of fin) {
      if (f.tag === '35B') {
        // first line "ISIN xxxx", optional "/GB/sedol", then name
        const parts = f.raw.split('\n');
        if (parts[0].startsWith('ISIN ')) line.isin = csTrim(parts[0].slice(5));
        line.msgDescription = csTrim(parts[parts.length - 1]);
      } else if (f.tag === '90A' || f.tag === '90B') {
        // MRKT//PRCT/97,425 or MRKT//ACTU/GBP4,5686 - price is the last part (Q2)
        let v = f.content;
        const slash = v.lastIndexOf('/');
        if (slash >= 0) v = v.slice(slash + 1);
        if (v.length > 3 && isLetter(v[0])) v = v.slice(3);
        line.price = parseDecimal(v);
      } else if (f.tag === '93B' && f.qualifier === 'AGGR') {
        // AGGR//UNIT/x or AGGR//FAMT/x - both treated as a number (Q3)
        const v = f.content;
        const slash = v.indexOf('/');
        line.qtyType = slash >= 0 ? v.slice(0, slash) : v;
        line.qty = parseDecimal(slash >= 0 ? v.slice(slash + 1) : v).round(4);
      } else if (f.tag === '19A' && f.qualifier === 'HOLD') {
        // e.g. EUR25197,88 (Q4)
        const v = f.content;
        const ccy = substring(v, 0, 3);
        const mv = parseDecimal(v.slice(3)).round(2);
        if (line.ccy === null) {
          line.ccy = ccy;
          line.mktVal = mv;
          if (ccy === 'GBP') line.mktValGbp = mv;
        } else if (ccy === 'GBP') {
          line.mktValGbp = mv;
        }
      }
    }
    if (line.isin !== null) st.lines.push(line);
  }
  return st;
}

/** legacy: SwiftParser.ParseConfirm (Q6) */
export function parseConfirm(text: string, path: string | null = null): SettlementConfirm {
  const msg = parseMessage(text, path);
  const f20 = msg.find('20C');
  const f23 = msg.find('23G');
  const c: SettlementConfirm = {
    mtType: msg.mtType,
    seme: f20 ? f20.content : null,
    prev: null,
    function: f23 ? csTrim(f23.raw) : null,
    tradeDate: '0001-01-01',
    settleDate: '0001-01-01',
    isin: null,
    qty: Decimal.ZERO,
    custAcct: null,
    amountRaw: null,
    ccy: null,
    direction: msg.mtType === 544 || msg.mtType === 545 ? 'REC' : 'DEL',
    filePath: path,
    folder: path !== null ? fileName(directoryName(path)) : null,
  };

  for (const f of msg.findAll('20C')) if (f.qualifier === 'PREV') c.prev = f.content;
  for (const f of msg.findAll('98A')) {
    if (f.qualifier === 'TRAD') c.tradeDate = parseYmd(f.content);
    else if (f.qualifier === 'SETT') c.settleDate = parseYmd(f.content);
  }

  const f35 = msg.find('35B');
  if (f35) {
    const parts = f35.raw.split('\n');
    if (parts[0].startsWith('ISIN ')) c.isin = csTrim(parts[0].slice(5));
  }

  const f36 = msg.find('36B');
  if (f36) {
    const v = f36.content; // ESTT//UNIT/2924,90 - not rounded
    const slash = v.indexOf('/');
    c.qty = parseDecimal(slash >= 0 ? v.slice(slash + 1) : v);
  }

  const f97 = msg.find('97A');
  c.custAcct = f97 ? f97.content : null;

  const f19 = msg.find('19A');
  if (f19 && f19.qualifier === 'ESTT') {
    c.amountRaw = f19.content; // GBP4303,01
    if (c.amountRaw.length > 3) c.ccy = c.amountRaw.slice(0, 3);
  }
  return c;
}

/** legacy: SwiftParser.FileSeq - trailing _NNN of the file name, 0 when absent */
export function fileSeq(path: string | null): number {
  if (path === null) return 0;
  const n = fileNameWithoutExtension(path);
  const us = n.lastIndexOf('_');
  if (us < 0) return 0;
  return tryParseInt(n.slice(us + 1)) ?? 0;
}

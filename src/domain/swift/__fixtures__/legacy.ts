// Fixtures copied from legacy PV.Tests/SwiftParserTests.cs (strings captured from real files).
export const MT535 =
  '{1:F01BRKWGB2LAXXX8176100240}{2:O5350911181115KSTLGB2LAXXX99501002331811150911N}{4:\r\n' +
  ':16R:GENL\r\n' +
  ':28E:1/ONLY\r\n' +
  ':20C::SEME//STMT20181115221\r\n' +
  ':23G:NEWM\r\n' +
  ':98A::STAT//20181115\r\n' +
  ':22F::STTY//CUST\r\n' +
  ':97A::SAFE//0010042\r\n' +
  ':17B::ACTI//Y\r\n' +
  ':16S:GENL\r\n' +
  ':16R:FIN\r\n' +
  ':35B:ISIN GB00ZZ000486\r\n' +
  'Draycott Systems PLC Ord\r\n' +
  ':90B::MRKT//ACTU/GBP34,553\r\n' +
  ':93B::AGGR//UNIT/1660,\r\n' +
  ':19A::HOLD//GBP57357,98\r\n' +
  ':16S:FIN\r\n' +
  ':16R:FIN\r\n' +
  ':35B:ISIN FR00ZZ000406\r\n' +
  'Tavistock Shipping SA\r\n' +
  ':90B::MRKT//ACTU/EUR109,556\r\n' +
  ':93B::AGGR//UNIT/230,\r\n' +
  ':19A::HOLD//EUR25197,88\r\n' +
  ':19A::HOLD//GBP21433,64\r\n' +
  ':92B::EXCH//EUR/GBP/0,850613\r\n' +
  ':16S:FIN\r\n' +
  '-}{5:{CHK:E5A896544EC0}}';

export const MT545 =
  '{1:F01BRKWGB2LAXXX3820107925}{2:O5451732260420KSTLGB2LAXXX44541079182604201732N}{4:\r\n' +
  ':16R:GENL\r\n' +
  ':20C::SEME//SETT20260420211\r\n' +
  ':23G:NEWM\r\n' +
  ':16S:GENL\r\n' +
  ':16R:TRADDET\r\n' +
  ':98A::TRAD//20260415\r\n' +
  ':98A::SETT//20260420\r\n' +
  ':90B::DEAL//ACTU/GBP33,990\r\n' +
  ':35B:ISIN LU00ZZ012622\r\n' +
  'Elmhurst UK Equity Income Fund Acc\r\n' +
  ':16S:TRADDET\r\n' +
  ':16R:FIAC\r\n' +
  ':36B::ESTT//UNIT/941,8671\r\n' +
  ':97A::SAFE//0011521\r\n' +
  ':16S:FIAC\r\n' +
  ':16R:SETDET\r\n' +
  ':22F::SETR//TRAD\r\n' +
  ':16R:AMT\r\n' +
  ':19A::ESTT//GBP4303,01\r\n' +
  ':16S:AMT\r\n' +
  ':16S:SETDET\r\n' +
  '-}{5:{CHK:E83F1E4429FC}}';

/** Build a block-4 message from field lines (CRLF, like the archive). */
export const fin = (mt: number, lines: string[]) =>
  `{1:F01BRKWGB2LAXXX0000000000}{2:O${mt}0911181115KSTLGB2LAXXX99501002331811150911N}{4:\r\n` +
  lines.join('\r\n') + '\r\n-}{5:{CHK:000000000000}}';

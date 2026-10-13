// Legacy parity harness (T003/T019): runs the legacy PV.Core code over the SWIFT archive and
// writes what the legacy Portfolio Viewer computes as JSON. Expectations are generated, never
// hand-written. Position checks need the legacy reference DB (db\setup_db.bat) for accounts.
//   LegacyParity.exe <archiveRoot> <outDir>
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using PV.Core;
using PV.Data;

namespace LegacyParity
{
    internal static class Program
    {
        private static int Main(string[] args)
        {
            if (args.Length < 2) { Console.Error.WriteLine("usage: LegacyParity <archiveRoot> <outDir>"); return 2; }
            string root = Path.GetFullPath(args[0]);
            string outDir = Path.GetFullPath(args[1]);
            Directory.CreateDirectory(outDir);

            ArchiveIndex.Reload(root);
            ArchiveIndex idx = ArchiveIndex.Current;
            Console.WriteLine("archive {0}: {1} MT535, {2} MT54x, {3} parse errors", root, idx.Mt535Count, idx.Mt54xCount, idx.ParseErrors);

            var statements = idx.Statements.Values.SelectMany(d => d.Values).SelectMany(l => l)
                .OrderBy(s => s.FileName, StringComparer.Ordinal).ToList();
            var sb = new Json();
            sb.Open('{').Prop("mt535Files", idx.Mt535Count).Prop("parseErrors", idx.ParseErrors).Key("statements").Open('[');
            foreach (Mt535Statement s in statements)
            {
                sb.Open('{').Prop("file", Path.GetFileName(s.FileName)).Prop("function", s.Function).Prop("statementDate", D(s.StatementDate))
                  .Prop("safe", s.SafekeepingAcct).Prop("fileSeq", s.FileSeq)
                  .Prop("effective", ReferenceEquals(PositionBuilder.GetStatement(s.SafekeepingAcct, s.StatementDate), s)).Key("lines").Open('[');
                foreach (Mt535Line l in s.Lines)
                    sb.Open('{').Prop("isin", l.Isin).Prop("description", l.MsgDescription).Prop("qty", N(l.Qty)).Prop("qtyType", l.QtyType)
                      .Prop("price", N(l.Price)).Prop("ccy", l.Ccy).Prop("marketValue", N(l.MktVal)).Prop("marketValueGbp", N(l.MktValGbp)).Close('}');
                sb.Close(']').Close('}');
            }
            sb.Close(']').Close('}');
            Write(outDir, "statements.json", sb);

            var confs = idx.ConfirmFolders.OrderBy(k => k.Key, StringComparer.Ordinal)
                .SelectMany(k => k.Value.Select(c => new { Folder = k.Key, C = c })).ToList();
            sb = new Json();
            sb.Open('{').Prop("mt54xFiles", idx.Mt54xCount).Key("confirmations").Open('[');
            foreach (var x in confs)
            {
                SettlementConfirm c = x.C;
                string amount = null;
                if (!string.IsNullOrEmpty(c.AmountRaw)) amount = N(SettlementReader.ToAmount(c.AmountRaw));
                sb.Open('{').Prop("file", Path.GetFileName(c.FilePath)).Prop("folder", x.Folder).Prop("mtType", c.MtType).Prop("seme", c.Seme)
                  .Prop("prev", c.Prev).Prop("function", c.Function).Prop("tradeDate", D(c.TradeDate)).Prop("settleDate", D(c.SettleDate))
                  .Prop("isin", c.Isin).Prop("qty", N(c.Qty)).Prop("safe", c.custAcct).Prop("amountRaw", c.AmountRaw).Prop("amount", amount)
                  .Prop("ccy", c.Ccy).Prop("direction", c.Direction).Close('}');
            }
            sb.Close(']').Close('}');
            Write(outDir, "confirmations.json", sb);

            List<AccountRow> accounts = AccountData.GetAllAccounts().OrderBy(a => a.ACCT_ID).ToList();
            int checks = 0;
            sb = new Json();
            sb.Open('{').Key("breaks").Open('[');
            int breaks = 0;
            foreach (AccountRow a in accounts)
            {
                foreach (DateTime d in PositionBuilder.GetStatementDates(a.SAFE_CODE).OrderBy(x => x))
                {
                    checks++;
                    PositionCheckResult r = PositionCheck.Run(a, d);
                    foreach (PositionCheckRow row in r.Rows)
                    {
                        breaks++;
                        sb.Open('{').Prop("accountId", a.ACCT_ID).Prop("safeCode", a.SAFE_CODE).Prop("date", D(d)).Prop("previousDate", r.PrevStmtDate.HasValue ? D(r.PrevStmtDate.Value) : null)
                          .Prop("isin", row.Isin).Prop("previousQty", N(row.PrevQty)).Prop("settledNet", N(row.NetSettled)).Prop("expectedQty", N(row.Expected))
                          .Prop("reportedQty", N(row.StmtQty)).Prop("difference", N(row.Diff)).Prop("status", row.Status).Close('}');
                    }
                }
            }
            sb.Close(']').Prop("accounts", accounts.Count).Prop("checks", checks).Prop("breakCount", breaks).Close('}');
            Write(outDir, "position-checks.json", sb);
            Console.WriteLine("statements {0}, confirmations {1}, accounts {2}, checks {3}, legacy breaks {4}", statements.Count, confs.Count, accounts.Count, checks, breaks);
            return 0;
        }

        private static string D(DateTime d) { return d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture); }
        private static string N(decimal v) { return v.ToString(CultureInfo.InvariantCulture); }

        private static void Write(string dir, string name, Json j)
        {
            File.WriteAllText(Path.Combine(dir, name), j.ToString() + "\n", new UTF8Encoding(false));
            Console.WriteLine("wrote " + name);
        }
    }

    /// <summary>Minimal deterministic JSON writer (one object/array element per line).</summary>
    internal sealed class Json
    {
        private readonly StringBuilder _b = new StringBuilder();
        private readonly Stack<bool> _first = new Stack<bool>();
        private bool _afterKey;

        private void Sep()
        {
            if (_afterKey) { _afterKey = false; return; }
            if (_first.Count == 0) return;
            if (!_first.Peek()) _b.Append(',');
            _first.Pop(); _first.Push(false);
            if (_first.Count <= 2) _b.Append('\n').Append(' ', _first.Count * 2);
        }
        public Json Open(char c) { Sep(); _b.Append(c); _first.Push(true); return this; }
        public Json Close(char c)
        {
            bool empty = _first.Pop();
            if (!empty && _first.Count < 2) _b.Append('\n').Append(' ', _first.Count * 2);
            _b.Append(c); return this;
        }
        public Json Key(string k) { Sep(); Str(k); _b.Append(':'); _afterKey = true; return this; }
        public Json Prop(string k, string v) { Key(k); _afterKey = false; if (v == null) _b.Append("null"); else Str(v); return this; }
        public Json Prop(string k, int v) { Key(k); _afterKey = false; _b.Append(v.ToString(CultureInfo.InvariantCulture)); return this; }
        public Json Prop(string k, bool v) { Key(k); _afterKey = false; _b.Append(v ? "true" : "false"); return this; }
        private void Str(string s)
        {
            _b.Append('"');
            foreach (char ch in s)
            {
                if (ch == '"' || ch == '\\') _b.Append('\\').Append(ch);
                else if (ch < ' ') _b.AppendFormat("\\u{0:x4}", (int)ch);
                else _b.Append(ch);
            }
            _b.Append('"');
        }
        public override string ToString() { return _b.ToString(); }
    }
}

// Legacy parity oracle: runs the unmodified Portfolio Viewer PV.Core / PV.Data
// assemblies against an archive + reference DB and writes deterministic JSON.
//
// usage: mono LegacyOracle.exe <archiveRoot> <connectionString> <out.json> [legacyCommit] [archiveManifestSha256]
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using log4net;
using log4net.Appender;
using log4net.Core;
using PV.Core;
using PV.Data;

namespace PV.LegacyOracle
{
    public static class Program
    {
        private static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

        public static int Main(string[] args)
        {
            if (args.Length < 3)
            {
                Console.Error.WriteLine("usage: LegacyOracle.exe <archiveRoot> <connectionString> <out.json> [legacyCommit] [archiveManifestSha256]");
                return 2;
            }
            string root = Path.GetFullPath(args[0]);
            string outPath = args[2];

            // PV.Web runs on a UK server; legacy parsing is invariant-culture anyway.
            Thread.CurrentThread.CurrentCulture = new CultureInfo("en-GB");

            var mem = new MemoryAppender();
            mem.Threshold = Level.All;
            log4net.Config.BasicConfigurator.Configure(mem);

            SqlHelper.ConnectionString = args[1];
            ArchiveIndex.Reload(root);
            ArchiveIndex idx = ArchiveIndex.Current;

            var w = new JsonWriter();
            w.BeginObject();
            w.Name("format").Value("pv-legacy-golden/1");
            w.Name("meta").BeginObject();
            w.Name("legacyRepo").Value("aaron-cog-gtm-gh-org/legacy-wealth-platform");
            w.Name("legacyCommit").Value(args.Length > 3 ? args[3] : null);
            w.Name("archiveManifestSha256").Value(args.Length > 4 ? args[4] : null);
            w.Name("culture").Value(Thread.CurrentThread.CurrentCulture.Name);
            w.Name("decimalFormat").Value("System.Decimal.ToString(InvariantCulture); scale preserved as computed by legacy, compare numerically");
            w.Name("settlementOrder").Value("settleDate desc, then folder asc, then fileName asc (legacy List.Sort is unstable within a settle date)");
            w.EndObject();

            var summary = new Summary();
            WriteIndex(w, idx, mem, summary);

            List<AccountRow> accts = AccountData.GetAllAccounts();   // ORDER BY ACCT_NO, as PositionCheck.aspx
            var outAccts = accts.OrderBy(a => a.ACCT_NO, StringComparer.Ordinal).ThenBy(a => a.ACCT_ID).ToList();
            w.Name("accounts").BeginArray();
            foreach (AccountRow a in outAccts) WriteAccount(w, a, summary);
            w.EndArray();

            WriteCheckAll(w, idx, accts, summary);

            w.Name("summary");
            summary.Write(w, accts.Count);
            w.EndObject();

            File.WriteAllText(outPath, w.ToString() + "\n", new UTF8Encoding(false));
            Console.WriteLine(summary.ToConsole(accts.Count));
            return 0;
        }

        // ---------------------------------------------------------------- index

        private static void WriteIndex(JsonWriter w, ArchiveIndex idx, MemoryAppender mem, Summary s)
        {
            w.Name("archiveIndex").BeginObject();
            w.Name("mt535Count").Value(idx.Mt535Count);
            w.Name("mt54xCount").Value(idx.Mt54xCount);
            w.Name("parseErrors").Value(idx.ParseErrors);
            s.ParseErrors = idx.ParseErrors;

            var warnings = mem.GetEvents()
                .Where(e => e.Level == Level.Warn && e.LoggerName == typeof(ArchiveIndex).FullName)
                .Select(e => e.RenderedMessage)
                .OrderBy(m => m, StringComparer.Ordinal).ToList();
            w.Name("parseErrorMessages").BeginArray();
            foreach (string m in warnings) w.Value(m);
            w.EndArray();

            w.Name("statementAccountCount").Value(idx.Statements.Count);
            w.Name("confirmFolderCount").Value(idx.ConfirmFolders.Count);

            var allDates = new SortedSet<DateTime>();
            foreach (var byDate in idx.Statements.Values) foreach (DateTime d in byDate.Keys) allDates.Add(d);
            w.Name("distinctStatementDates").BeginArray();
            foreach (DateTime d in allDates) w.Value(D(d));
            w.EndArray();

            w.Name("statementKeys").BeginArray();
            foreach (string key in idx.Statements.Keys.OrderBy(k => k, StringComparer.Ordinal))
            {
                w.BeginObject();
                w.Name("key").Value(key);
                w.Name("dates").BeginArray();
                foreach (var kv in idx.Statements[key].OrderBy(k => k.Key))
                {
                    Mt535Statement chosen = PositionBuilder.GetStatement(key, kv.Key);
                    var sorted = kv.Value.OrderBy(x => x.FileName, StringComparer.Ordinal).ToList();
                    int maxSeq = kv.Value.Max(x => x.FileSeq);
                    int ties = kv.Value.Count(x => x.FileSeq == maxSeq);
                    if (ties > 1) s.FileSeqTies.Add(key + "@" + D(kv.Key));
                    w.BeginObject();
                    w.Name("date").Value(D(kv.Key));
                    w.Name("selectedFile").Value(chosen != null ? chosen.FileName : null);
                    w.Name("statements").BeginArray();
                    foreach (Mt535Statement st in sorted)
                    {
                        w.BeginObject();
                        w.Name("fileName").Value(st.FileName);
                        w.Name("fileSeq").Value(st.FileSeq);
                        w.Name("function").Value(st.Function);
                        w.Name("safekeepingAcct").Value(st.SafekeepingAcct);
                        w.Name("statementDate").Value(D(st.StatementDate));
                        w.Name("lineCount").Value(st.Lines.Count);
                        w.EndObject();
                    }
                    w.EndArray();
                    w.EndObject();
                }
                w.EndArray();
                w.EndObject();
            }
            w.EndArray();

            w.Name("confirmFolders").BeginArray();
            foreach (string folder in idx.ConfirmFolders.Keys.OrderBy(k => k, StringComparer.Ordinal))
            {
                List<SettlementConfirm> confs = idx.ConfirmFolders[folder];   // legacy keeps file-name order
                w.BeginObject();
                w.Name("folder").Value(folder);
                w.Name("count").Value(confs.Count);
                w.Name("confirms").BeginArray();
                foreach (SettlementConfirm c in confs) WriteConfirm(w, c, false);
                w.EndArray();
                w.EndObject();
            }
            w.EndArray();

            w.Name("files").BeginArray();
            foreach (ArchiveIndex.ArchiveFileEntry f in idx.Files)   // legacy sorts ordinal by FullPath
            {
                w.BeginObject();
                w.Name("path").Value(Rel(idx.Root, f.FullPath));
                w.Name("fileName").Value(f.FileName);
                w.Name("msgType").Value(f.MsgType);
                w.Name("date").Value(f.Date == DateTime.MinValue ? null : D(f.Date));
                w.Name("safeCode").Value(f.SafeCode);
                w.Name("size").Value(f.Size);
                w.EndObject();
            }
            w.EndArray();
            w.EndObject();
        }

        // -------------------------------------------------------------- account

        private static void WriteAccount(JsonWriter w, AccountRow a, Summary s)
        {
            w.BeginObject();
            w.Name("acctId").Value(a.ACCT_ID);
            w.Name("acctNo").Value(a.ACCT_NO);
            w.Name("clientId").Value(a.CLIENT_ID);
            w.Name("clientName").Value(a.CLIENT_NAME);
            w.Name("acctType").Value(a.ACCT_TYPE);
            w.Name("baseCcy").Value(a.BASE_CCY);
            w.Name("safeCode").Value(a.SAFE_CODE);
            w.Name("openDt").Value(a.OPEN_DT.HasValue ? D(a.OPEN_DT.Value) : null);
            w.Name("closeDt").Value(a.CLOSE_DT.HasValue ? D(a.CLOSE_DT.Value) : null);
            w.Name("statusCd").Value(a.STATUS_CD);

            List<DateTime> dates = PositionBuilder.GetStatementDates(a.SAFE_CODE);   // legacy: newest first
            if (dates.Count > 0) s.AccountsWithStatements++;
            w.Name("statementDates").BeginArray();
            foreach (DateTime d in dates) w.Value(D(d));
            w.EndArray();

            w.Name("positionChecks").BeginArray();
            foreach (DateTime d in dates.OrderBy(x => x))
            {
                s.AccountDates++;
                w.BeginObject();
                w.Name("stmtDate").Value(D(d));

                Mt535Statement st = null;
                try { st = PositionBuilder.GetStatement(a.SAFE_CODE, d); }
                catch (Exception ex) { s.RuntimeErrors.Add("GetStatement " + a.ACCT_ID + " " + D(d) + ": " + Err(ex)); }
                w.Name("statement");
                WriteStatement(w, st, s, a, d);

                PositionCheckResult r = null;
                try { r = PositionCheck.Run(a, d); }
                catch (Exception ex)
                {
                    s.RunErrors++;
                    s.RuntimeErrors.Add("PositionCheck.Run acct " + a.ACCT_ID + " " + D(d) + ": " + Err(ex));
                    w.Name("error").Value(Err(ex));
                }
                if (r != null)
                {
                    w.Name("error").Value((string)null);
                    w.Name("prevStmtDate").Value(r.PrevStmtDate.HasValue ? D(r.PrevStmtDate.Value) : null);
                    w.Name("noPrevMessage").Value(r.NoPrevMessage);
                    w.Name("statementFile").Value(r.Statement != null ? r.Statement.FileName : null);
                    if (r.NoPrevMessage != null) s.NoPrev++;
                    s.DiffRows += r.Rows.Count;
                    if (r.Rows.Count > 0) s.AccountDatesWithDiffs++;
                    w.Name("rows").BeginArray();
                    foreach (PositionCheckRow row in r.Rows)
                    {
                        s.CountStatus(row.Status);
                        w.BeginObject();
                        w.Name("isin").Value(row.Isin);
                        w.Name("instrument").Value(row.Instrument);
                        w.Name("prevQty").Value(row.PrevQty);
                        w.Name("netSettled").Value(row.NetSettled);
                        w.Name("expected").Value(row.Expected);
                        w.Name("stmtQty").Value(row.StmtQty);
                        w.Name("diff").Value(row.Diff);
                        w.Name("status").Value(row.Status);
                        w.Name("note").Value(row.Note);
                        w.Name("updatedBy").Value(row.UpdatedBy);
                        w.Name("updatedDt").Value(row.UpdatedDt.HasValue ? Dt(row.UpdatedDt.Value) : null);
                        w.EndObject();
                    }
                    w.EndArray();
                }
                w.EndObject();
            }
            w.EndArray();

            // Settlements.aspx default window: 90 days ending at the latest statement.
            // With no statement the page uses DateTime.Today, which is not reproducible - recorded as null.
            w.Name("settlementsDefault90d");
            if (dates.Count == 0 || a.SAFE_CODE == null)
                w.Null();
            else
            {
                DateTime to = PositionBuilder.GetLatest(a.SAFE_CODE).StatementDate;
                WriteSettlements(w, a, to.AddDays(-90), to, s, true);
            }
            w.Name("settlementsFullRange");
            if (a.SAFE_CODE == null) w.Null();
            else WriteSettlements(w, a, DateTime.MinValue, DateTime.MaxValue.Date, s, false);
            w.EndObject();
        }

        private static void WriteStatement(JsonWriter w, Mt535Statement st, Summary s, AccountRow a, DateTime d)
        {
            if (st == null) { w.Null(); return; }
            w.BeginObject();
            w.Name("fileName").Value(st.FileName);
            w.Name("fileSeq").Value(st.FileSeq);
            w.Name("function").Value(st.Function);
            w.Name("statementDate").Value(D(st.StatementDate));
            w.Name("safekeepingAcct").Value(st.SafekeepingAcct);
            w.Name("lines").BeginArray();
            foreach (Mt535Line l in st.Lines)   // statement order, as Holdings.aspx shows it
            {
                s.HoldingLines++;
                w.BeginObject();
                w.Name("isin").Value(l.Isin);
                string name = null;
                try { name = PositionBuilder.InstrumentName(l.Isin); }
                catch (Exception ex) { s.RuntimeErrors.Add("InstrumentName " + l.Isin + ": " + Err(ex)); }
                w.Name("instrumentName").Value(name);
                w.Name("msgDescription").Value(l.MsgDescription);
                w.Name("qty").Value(l.Qty);
                w.Name("qtyType").Value(l.QtyType);
                w.Name("price").Value(l.Price);
                w.Name("ccy").Value(l.Ccy);
                w.Name("mktVal").Value(l.MktVal);
                w.Name("mktValGbp").Value(l.MktValGbp);
                w.Name("fileName").Value(st.FileName);
                w.Name("fileSeq").Value(st.FileSeq);
                w.Name("function").Value(st.Function);
                w.EndObject();
            }
            w.EndArray();
            w.EndObject();
        }

        private static void WriteSettlements(JsonWriter w, AccountRow a, DateTime from, DateTime to, Summary s, bool isDefault)
        {
            string cust = a.SAFE_CODE.PadLeft(7, '0');
            w.BeginObject();
            w.Name("custAcct").Value(cust);
            w.Name("from").Value(D(from));
            w.Name("to").Value(D(to));
            List<SettlementConfirm> list = SettlementReader.GetSettlements(cust, from, to);
            for (int i = 1; i < list.Count; i++)
                if (list[i - 1].SettleDate < list[i].SettleDate)
                    s.RuntimeErrors.Add("GetSettlements not newest-first for acct " + a.ACCT_ID);
            var ordered = list.OrderByDescending(c => c.SettleDate)
                .ThenBy(c => c.Folder, StringComparer.Ordinal)
                .ThenBy(c => Path.GetFileName(c.FilePath), StringComparer.Ordinal).ToList();
            string pageError = null;
            w.Name("count").Value(ordered.Count);
            w.Name("items").BeginArray();
            foreach (SettlementConfirm c in ordered)
            {
                if (isDefault) s.SettlementsDefault++; else s.SettlementsFull++;
                WriteConfirm(w, c, true, isDefault ? s : null, ref pageError);
            }
            w.EndArray();
            // Settlements.aspx Bind() has no try/catch: the first ToAmount failure fails the page
            w.Name("pageError").Value(pageError);
            if (isDefault && pageError != null) s.SettlementPageErrors.Add(a.ACCT_ID + ": " + pageError);
            w.EndObject();
        }

        private static void WriteConfirm(JsonWriter w, SettlementConfirm c, bool withAmount)
        {
            string ignored = null;
            WriteConfirm(w, c, withAmount, null, ref ignored);
        }

        private static void WriteConfirm(JsonWriter w, SettlementConfirm c, bool withAmount, Summary s, ref string pageError)
        {
            w.BeginObject();
            w.Name("folder").Value(c.Folder);
            w.Name("fileName").Value(Path.GetFileName(c.FilePath));
            w.Name("mtType").Value(c.MtType);
            w.Name("seme").Value(c.Seme);
            w.Name("prev").Value(c.Prev);
            w.Name("function").Value(c.Function);
            w.Name("tradeDate").Value(D(c.TradeDate));
            w.Name("settleDate").Value(D(c.SettleDate));
            w.Name("isin").Value(c.Isin);
            w.Name("qty").Value(c.Qty);
            w.Name("custAcct").Value(c.custAcct);
            w.Name("amountRaw").Value(c.AmountRaw);
            w.Name("ccy").Value(c.Ccy);
            w.Name("direction").Value(c.Direction);
            if (withAmount)
            {
                w.Name("instrumentName").Value(PositionBuilder.InstrumentName(c.Isin));
                // as Settlements.aspx: AmountRaw != null ? ToAmount(AmountRaw) : 0m
                try
                {
                    decimal amt = c.AmountRaw != null ? SettlementReader.ToAmount(c.AmountRaw) : 0m;
                    w.Name("amount").Value(amt);
                    w.Name("amountError").Value((string)null);
                }
                catch (Exception ex)
                {
                    w.Name("amount").Null();
                    w.Name("amountError").Value(Err(ex));
                    if (pageError == null) pageError = Err(ex) + " (" + Path.GetFileName(c.FilePath) + ")";
                    if (s != null) s.RuntimeErrors.Add("ToAmount " + c.AmountRaw + " (" + Path.GetFileName(c.FilePath) + "): " + Err(ex));
                }
            }
            w.EndObject();
        }

        // ------------------------------------------------------------ check all

        private static void WriteCheckAll(JsonWriter w, ArchiveIndex idx, List<AccountRow> accts, Summary s)
        {
            var allDates = new SortedSet<DateTime>();
            foreach (var byDate in idx.Statements.Values) foreach (DateTime d in byDate.Keys) allDates.Add(d);

            w.Name("checkAll").BeginArray();
            foreach (DateTime d in allDates)
            {
                w.BeginObject();
                w.Name("stmtDate").Value(D(d));
                string pageError = null;
                int total = 0, n = 0;
                w.Name("rows").BeginArray();
                foreach (AccountRow a in accts)   // btnAll_Click order: GetAllAccounts (ORDER BY ACCT_NO)
                {
                    if (!PositionBuilder.GetStatementDates(a.SAFE_CODE).Contains(d)) continue;
                    PositionCheckResult r;
                    try { r = PositionCheck.Run(a, d); }
                    catch (Exception ex)
                    {
                        // no try/catch in btnAll_Click: the postback fails and no grid is shown
                        pageError = "acct " + a.ACCT_ID + ": " + Err(ex);
                        break;
                    }
                    n++;
                    if (r.NoPrevMessage == null) total += r.Rows.Count;
                    w.BeginObject();
                    w.Name("acctId").Value(a.ACCT_ID);
                    w.Name("acctNo").Value(a.ACCT_NO);
                    w.Name("client").Value(a.CLIENT_NAME);
                    w.Name("diffs").Value(r.NoPrevMessage != null ? "-" : r.Rows.Count.ToString(Inv));
                    w.EndObject();
                }
                w.EndArray();
                w.Name("accountCount").Value(n);
                w.Name("totalDiffRows").Value(total);
                w.Name("pageError").Value(pageError);
                w.Name("message").Value(pageError == null && n == 0 ? "No statements on file for that date." : (string)null);
                if (pageError != null) s.CheckAllPageErrors.Add(D(d) + " " + pageError);
                w.EndObject();
            }
            w.EndArray();
        }

        // -------------------------------------------------------------- helpers

        private static string D(DateTime d) { return d.ToString("yyyy-MM-dd", Inv); }
        private static string Dt(DateTime d) { return d.ToString("yyyy-MM-ddTHH:mm:ss.fff", Inv); }
        private static string Err(Exception ex) { return ex.GetType().FullName + ": " + ex.Message; }
        private static string Rel(string root, string full)
        {
            string r = full.StartsWith(root) ? full.Substring(root.Length).TrimStart('/', '\\') : full;
            return r.Replace('\\', '/');
        }

        private class Summary
        {
            public int ParseErrors, AccountsWithStatements, AccountDates, AccountDatesWithDiffs, NoPrev, RunErrors;
            public int DiffRows, HoldingLines, SettlementsDefault, SettlementsFull;
            public SortedDictionary<string, int> Statuses = new SortedDictionary<string, int>(StringComparer.Ordinal);
            public SortedSet<string> RuntimeErrors = new SortedSet<string>(StringComparer.Ordinal);
            public List<string> SettlementPageErrors = new List<string>();
            public List<string> CheckAllPageErrors = new List<string>();
            public List<string> FileSeqTies = new List<string>();

            public void CountStatus(string st)
            {
                string k = st ?? "(null)";
                int n; Statuses.TryGetValue(k, out n); Statuses[k] = n + 1;
            }

            public void Write(JsonWriter w, int accounts)
            {
                w.BeginObject();
                w.Name("accounts").Value(accounts);
                w.Name("accountsWithStatements").Value(AccountsWithStatements);
                w.Name("accountStatementDatesChecked").Value(AccountDates);
                w.Name("accountStatementDatesWithDiffs").Value(AccountDatesWithDiffs);
                w.Name("noPreviousStatement").Value(NoPrev);
                w.Name("positionCheckRunErrors").Value(RunErrors);
                w.Name("totalDiffRows").Value(DiffRows);
                w.Name("diffRowsByStatus").BeginObject();
                foreach (var kv in Statuses) w.Name(kv.Key).Value(kv.Value);
                w.EndObject();
                w.Name("holdingLines").Value(HoldingLines);
                w.Name("settlementsDefault90dItems").Value(SettlementsDefault);
                w.Name("settlementsFullRangeItems").Value(SettlementsFull);
                w.Name("archiveParseErrors").Value(ParseErrors);
                w.Name("fileSeqTies").BeginArray(); foreach (string x in FileSeqTies) w.Value(x); w.EndArray();
                w.Name("settlementPageErrors").BeginArray(); foreach (string x in SettlementPageErrors) w.Value(x); w.EndArray();
                w.Name("checkAllPageErrors").BeginArray(); foreach (string x in CheckAllPageErrors) w.Value(x); w.EndArray();
                w.Name("runtimeErrors").BeginArray(); foreach (string x in RuntimeErrors) w.Value(x); w.EndArray();
                w.EndObject();
            }

            public string ToConsole(int accounts)
            {
                var sb = new StringBuilder();
                sb.AppendLine("accounts=" + accounts + " withStatements=" + AccountsWithStatements
                    + " accountDates=" + AccountDates + " withDiffs=" + AccountDatesWithDiffs
                    + " noPrev=" + NoPrev + " runErrors=" + RunErrors + " diffRows=" + DiffRows);
                sb.AppendLine("holdingLines=" + HoldingLines + " settlements90d=" + SettlementsDefault
                    + " settlementsFull=" + SettlementsFull + " parseErrors=" + ParseErrors);
                foreach (var kv in Statuses) sb.AppendLine("  status " + kv.Key + "=" + kv.Value);
                foreach (string x in FileSeqTies) sb.AppendLine("  fileSeqTie " + x);
                foreach (string x in SettlementPageErrors) sb.AppendLine("  settlementsPageError " + x);
                foreach (string x in CheckAllPageErrors) sb.AppendLine("  checkAllPageError " + x);
                foreach (string x in RuntimeErrors) sb.AppendLine("  runtimeError " + x);
                return sb.ToString();
            }
        }
    }

    // Minimal deterministic JSON writer (2-space indent, ordinal key order as written).
    public class JsonWriter
    {
        private readonly StringBuilder _sb = new StringBuilder();
        private readonly Stack<bool> _first = new Stack<bool>();
        private bool _afterName;

        public override string ToString() { return _sb.ToString(); }

        private void Indent() { _sb.Append('\n').Append(' ', 2 * _first.Count); }

        private void Pre()
        {
            if (_afterName) { _afterName = false; return; }
            if (_first.Count > 0)
            {
                if (!_first.Pop()) _sb.Append(',');
                _first.Push(false);
                Indent();
            }
        }

        public JsonWriter BeginObject() { Pre(); _sb.Append('{'); _first.Push(true); return this; }
        public JsonWriter EndObject() { bool empty = _first.Pop(); if (!empty) Indent(); _sb.Append('}'); return this; }
        public JsonWriter BeginArray() { Pre(); _sb.Append('['); _first.Push(true); return this; }
        public JsonWriter EndArray() { bool empty = _first.Pop(); if (!empty) Indent(); _sb.Append(']'); return this; }

        public JsonWriter Name(string n) { Pre(); Str(n); _sb.Append(": "); _afterName = true; return this; }
        public JsonWriter Null() { Pre(); _sb.Append("null"); return this; }
        public JsonWriter Value(string s) { Pre(); if (s == null) _sb.Append("null"); else Str(s); return this; }
        public JsonWriter Value(int i) { Pre(); _sb.Append(i.ToString(CultureInfo.InvariantCulture)); return this; }
        public JsonWriter Value(long i) { Pre(); _sb.Append(i.ToString(CultureInfo.InvariantCulture)); return this; }
        // decimals are emitted as strings so no consumer parses them as binary floats
        public JsonWriter Value(decimal d) { return Value(d.ToString(CultureInfo.InvariantCulture)); }

        private void Str(string s)
        {
            _sb.Append('"');
            foreach (char c in s)
            {
                switch (c)
                {
                    case '"': _sb.Append("\\\""); break;
                    case '\\': _sb.Append("\\\\"); break;
                    case '\n': _sb.Append("\\n"); break;
                    case '\r': _sb.Append("\\r"); break;
                    case '\t': _sb.Append("\\t"); break;
                    default:
                        if (c < 0x20 || c > 0x7e) _sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        else _sb.Append(c);
                        break;
                }
            }
            _sb.Append('"');
        }
    }
}

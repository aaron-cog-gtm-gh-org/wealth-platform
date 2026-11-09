# Research: Position building & reconciliation

- **R1 Provider shape**: legacy `ReconNoteData.GetNotes` runs one SQL query per Run. The async-capable `getNotes(acctId, stmtDate)` keeps that granularity, and the PostgreSQL version is a single parameterized SELECT.
- **R2 Case-insensitive notes**: the legacy dictionary uses `StringComparer.OrdinalIgnoreCase` on the trimmed ISIN. The port keys on `trim().toUpperCase()`, which is equivalent for ISIN characters.
- **R3 Stable selection**: `OrderByDescending(FileSeq).First()` is stable, so on ties the first file in index order wins. The port uses `reduce` with `>`, which has the same result. The oracle reports no ties (`fileSeqTies: []`).
- **R4 Golden reference data**: to stay DB-free, instrument names are collected from the golden holdings, and notes from golden rows that are not plain NEW. Spec 004 repeats the check with the PostgreSQL providers.

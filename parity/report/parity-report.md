# Portfolio Viewer decommission parity report

Result: **PASS**. Golden (gzip) SHA-256 `80305da21e329c989a25ac2b58130c389ea4d2aa12213d6d050adbbfa2405c62`. Declared divergences: none.

| Check | Legacy behaviour | Compared | Mismatches | Accepted divergences |
| --- | --- | ---: | ---: | ---: |
| archive-manifest | legacy archive/ (byte-for-byte) | 6044 | 0 | 0 |
| archive-index | PV.Core.ArchiveIndex.Build | 1 | 0 | 0 |
| statement-selection | PV.Core.PositionBuilder.GetStatement (Q8) | 3065 | 0 | 0 |
| statement-dates | PV.Core.PositionBuilder.GetStatementDates | 120 | 0 | 0 |
| holdings | PV.Core.PositionBuilder + InstrumentData (Holdings.aspx) | 3065 | 0 | 0 |
| position-check | PV.Core.PositionCheck.Run + PV.Data.ReconNoteData (PostgreSQL pv.recon_note) | 3065 | 0 | 0 |
| settlements | PV.Core.SettlementReader.GetSettlements + ToAmount (Settlements.aspx) | 240 | 0 | 0 |
| check-all | PositionCheck.aspx btnAll_Click | 26 | 0 | 0 |

Legacy oracle summary: 3065 PositionCheck runs, 7 break rows (CHASED 1, NEW 4, OPEN 1, RESOLVED 1), 30645 holdings lines, 1572 + 2950 settlements.

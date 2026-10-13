# Custody archive sample (edge-case fixtures)

Byte-for-byte copies (line endings preserved; see `.gitattributes`) of one archive file per edge case
listed in `specs/001-legacy-portfolio-viewer/spec.md` "Edge Cases", taken from
`aaron-cog-gtm-gh-org/legacy-wealth-platform` `archive/` at commit `91261288d02323e0526cb9fe71a7d6606e2f9c0a`.
Same layout as the legacy archive (`mt535/`, `mt54x/<yyyyMMdd>/`).

| File | Edge case |
|---|---|
| mt535/MT535_16558_20260626_001.txt | `NEWM` original (superseded) |
| mt535/MT535_16558_20260626_002.txt | `RPLC` replacement — effective statement [fix D-4] |
| mt535/MT535_16558_20260626_003.txt | `NEWM/DUPL` of the superseded original; legacy picks it (highest seq) |
| mt54x/20260714/MT545_16056_20260714_001.txt | Original MT545 (`SEME KS5400060882`) |
| mt54x/20260715/MT545_16056_20260715_002.txt | Cross-day `CANC` with `PREV KS5400060882` [fix D-3] |
| mt54x/20260916/MT544_11397_20260916_001.txt | 8-digit safe `00011397`, free of payment (no `19A`) [fix D-2] |
| mt54x/20260916/MT545_10554_20260916_001.txt | 8-digit safe `00010554` [fix D-2] |
| mt54x/20260701/MT545_12203_20260701_001.txt | One-decimal amount [fix D-1] |
| mt54x/20260420/MT545_14479_20260420_001.txt | `FAMT` (face amount) quantity |
| mt54x/20260421/MT546_14690_20260421_001.txt | MT546 deliver free of payment (no `19A::ESTT`) |
| mt535/MT535_10024_20260417_001.txt | Empty statement `17B::ACTI//N` |
| mt535/MT535_10049_20260703_001.txt | `SUBSAFE`-wrapped statement (post 2026-07 format) |
| mt535/MT535_10024_20260807_001.txt | LF-only line endings |
| mt535/MT535_10367_20260605_001.txt | ISIN `GB00ZZ004322` missing from reference data [fix D-5] |
| mt535/MT535_10226_20260828_001.txt | Unpadded 5-digit safekeeping account on MT535 |

# Research: Archive indexing & settlements

- **R1 Archive location**: repo-root `archive/`. The legacy `Web.config` `ArchiveRoot` is `..\..\archive` relative to PV.Web, which is the repo-root archive. Keeping the path lets the oracle manifest verify the copy as-is. Rejected alternatives: `data/archive` (path rewrites in the manifest) and Git LFS (not available to CI and parity tooling).
- **R2 Byte preservation**: the legacy repo has `archive/** -text`. The same rule is in a new `.gitattributes`. 5,568 CRLF, 396 LF and 80 mixed files are kept.
- **R3 Seam**: a synchronous `ArchiveSource` (`list`, `read`). Build is a startup step, and synchronous code keeps the port line-by-line. The API (spec 004) builds once at startup.
- **R4 Sort stability**: legacy `List.Sort` is an introsort, so the order within one settle date depends on `GetDirectories` order. The oracle documents the tie order folder→file name. A stable JS sort over ordinal folder and file order reproduces it.
- **R5 Golden oracle**: `parity/legacy-golden/legacy-golden.json.gz` (26 MB JSON) loads in under 1 s. Decimals are compared numerically.

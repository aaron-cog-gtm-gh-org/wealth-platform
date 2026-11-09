# Research: PV data layer

- **R1 Legacy access**: `BasePage.RequiredRoles` uses an exact role match. Admin.aspx requires ADMIN, and PositionCheck.aspx and MessageBrowser.aspx require OPS or ADMIN. Every other page only requires a session.
- **R2 Passwords**: legacy compares `HashPasswordForStoringInConfigFile(pwd,"SHA1")`, which is unsalted. The constitution forbids carrying this forward, so seeded users start without a password. An operator sets one with `pv:set-password`.
- **R3 SaveNote**: the legacy code runs UPDATE and then, when it matched 0 rows, INSERT, with `UPDATED_DT = GETDATE()`. The port does the same using `localtimestamp(3)`.
- **R4 Seed conversion**: the legacy seed files are single-line `INSERT ... VALUES (...)` statements separated by `GO`. They were converted once to `pv.*` statements ending in `;`, with values unchanged and `N'..'` literals turned into plain literals.
- **R5 Collation**: SQL Server's default collation is case-insensitive, so `ILIKE` is used. Account order is ordinal via `COLLATE "C"`, which matches the golden output.

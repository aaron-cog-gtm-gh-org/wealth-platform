# Contract: Message Browser (spec 009)

## URL (`?screen=messages`)
| Key | Values | Meaning |
| --- | --- | --- |
| `type` | `535`, `54x`, anything else | MT535, MT54x, All. Presence requests the list. |
| `date` | `yyyy-mm-dd` or `dd/MM/yyyy` (D-009-1), blank | Date filter. Presence requests the list. Other text → "Enter date as yyyy-mm-dd or dd/MM/yyyy." and no request. List writes ISO. |
| `safe` | text | Trimmed; server strips leading zeros on both sides (Q16). Presence requests the list. |
| `file` | archive file name | Opens the raw viewer via index lookup. |
These keys are dropped when navigating to another screen (`PV_SCREEN_KEYS`).

## API
- `GET /api/pv/archive/files?type=&date=&safe=` — unchanged (spec 004).
- `GET /api/pv/archive/files/raw?file=<name>` — new alternative to `?path=`. Looks up the first index entry whose `fileName` equals `<name>`; 404 "File not in archive index." otherwise. Response `text/plain`, header `X-Archive-Path: <archive-relative path>` (also sent for `?path=`). OPS/ADMIN only.
- Client: `createPvClient().archiveFileByName(name) → { fileName, path, raw }`.

## Shell
- `PV_PAGES` row `MessageBrowser.aspx` → `screen: 'messages'`; `PV_SLICES.messages` (`needs: 'none'`).
- `PvModelInput.setParams?(params)` sets/removes URL keys on the current screen (pushState). Shell model `emptyAction` runs the Empty CTA ("Clear filters").

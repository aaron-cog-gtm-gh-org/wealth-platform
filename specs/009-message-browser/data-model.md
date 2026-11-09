# Data Model: 009 Message Browser

- **MessageQuery** (`src/model/pv/message-query.ts`, on `PvContext.messages` when any key is present): `list` (bool: `type`, `date` or `safe` present), `type` (`'MT535'|'MT54x'|null`; from `535`/`54x`), `dateText` (trimmed raw), `date` (`IsoDate|null`), `dateError` (bool), `safe` (trimmed text), `file` (`string|null`).
- **MessageBrowserData** (slice data): `query` (`MessageQuery|null`), `files` (`PvArchiveFile[]|null`; null when no list was requested or the date is invalid), `file` (`{ name, path: string|null, raw: string|null }|null`; `path`/`raw` null = not found).
- **MessageBrowserVM** (`src/model/messages.ts`): filter form (type options, ISO date value, safe text, `formKey`, `onList`), `notice` (date error / prompt), list (title, rows with dd/MM/yyyy date, size, `selected`, `onOpen`), pager (page, pages, range text, `onPage`), viewer (name, path, text or "File not found.", `onClose`).
- Empty: `files` is an empty array and no file is open. Error: list or raw request failed (not 401/403/404).

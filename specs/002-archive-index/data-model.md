# Data Model: Archive indexing & settlements

| Entity | Fields | Legacy |
| --- | --- | --- |
| `ArchiveFileRef` | `path`, `size` | `FileInfo` |
| `ArchiveListing` | `mt535: ArchiveFileRef[] \| null`, `mt54x: {folder, files}[] \| null` | `Directory.GetFiles/GetDirectories` |
| `ArchiveFileEntry` | `path`, `fileName`, `msgType: 'MT535'\|'MT54x'`, `date: IsoDate`, `safeCode: string\|null`, `size` | `ArchiveFileEntry` |
| `ArchiveIndex` | `root`, `loadedAt: string\|null`, `loadMs`, `mt535Count`, `mt54xCount`, `parseErrors`, `parseErrorLog: {fileName,message}[]`, `statements: Map<key, Map<IsoDate, Mt535Statement[]>>`, `confirmFolders: Map<folder, SettlementConfirm[]>`, `files` | `ArchiveIndex` |

`key` is `97A::SAFE` with leading zeros trimmed. `SettlementConfirm.filePath` is archive-relative.

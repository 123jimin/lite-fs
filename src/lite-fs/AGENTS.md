## AGENTS.md for `src/lite-fs/`

Implementation layer for `@jiminp/lite-fs`.

## Ops Pattern

Each `*-ops.ts` file:

1. Re-exports its `*Ops` type from `src/api/`.
2. Exports `create*Ops(core: FSCore): *Ops` factory.
3. Inside: validate path → `core.getDB()` → transact → `core.emit()` watch events.

## `core/`

- `core.ts` — `FSCore` interface + `createFSCore(db_name)`. Owns the `IDBPDatabase` promise, subscriber set, `emit()`, `subscribe()`, `reset()`, `dumpFiles()`.
- `db-entry.ts` — `DBFileEntry`, `DBFolderEntry`, `DBEntry`. Helpers: `createDBFileEntry`, `createDBFolderEntry`, `getEntryByPath`, `putEntryByPath`, `ensureParentDirs`.
- `path.ts` — `StoragePath`, `toStoragePath`, `fromFolderStoragePath`.
- `const.ts` — IDB store name and index constants.

## `index.ts`

`LiteFS` class — the only class in the project. Composes all `create*Ops(core)` results and delegates each `FileSystemAPI` method. Also exposes `dumpFiles()` and `reset()` (not part of `FileSystemAPI`).

## Key Behaviors

- `writeFile` calls `ensureParentDirs` and emits `rename` for each auto-created dir.
- `mkdir({recursive: true})` silently succeeds if the folder already exists.
- `readdir` queries the `INDEX_BY_PARENT` index on `StoragePath`.
- `watch` returns a manual `AsyncIterableIterator`; supports `AbortSignal` via `options.signal`.

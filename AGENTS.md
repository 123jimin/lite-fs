## AGENTS.md for lite-fs

`@jiminp/lite-fs` — minimal Node.js-like fs API backed by IndexedDB. TypeScript, `pnpm`, mocha + chai tests.

## Path Rules

All API paths are absolute. Folder paths end with `/`; file paths do not. `//`, `/./`, `/../` are invalid.

Types: `AbsoluteFolderPath`, `AbsoluteFilePath`, `AbsolutePath` (in `src/path.ts`). Use `joinPath` for relative path resolution.

`StoragePath` (in `src/lite-fs/core/path.ts`) strips trailing `/` for IndexedDB keys. Internal only — never use in API surfaces.

## Structure

- `src/index.ts` — Re-exports from `src/api/`, `src/error.ts`, `src/path.ts`, `src/lite-fs/`.
- `src/path.ts` — Path branded types and utilities (`validatePath`, `joinPath`, `getParentPath`, `getBaseName`).
- `src/error.ts` — `FSError` (codes: ENOENT, EEXIST, ENOTDIR, EISDIR, ENOTEMPTY, EINVAL), `isFSError`, `assertFSError`.
- `src/api/` — Pure type definitions. `FileSystemAPI` = intersection of all ops interfaces.
- `src/lite-fs/` — Implementation. See `src/lite-fs/AGENTS.md`.

## Architecture

- Use factory functions (`createFSCore`, `create*Ops`), not classes, for the implementation layer.
- Root `/` is implicit (never stored in IndexedDB); `stat("/")` returns a synthetic entry.
- `writeFile` auto-creates parent dirs via `ensureParentDirs` and emits watch events for each.
- Watch: `FSCore` holds a subscriber set; ops call `core.emit()`; `watch()` returns `AsyncIterableIterator` filtering by path.

## Build & Test

```
pnpm build          # tsc
pnpm test           # build -> mocha "dist/**/*.spec.js"
```

## Testing Conventions

Test file for `src/foo.ts` is `src/foo.spec.ts`. Ops tests live next to ops files in `src/lite-fs/`.

- One `describe` per exported function.
- Use `context` for groups of related cases within a function.
- One test per nominal usage. Test edge cases, but don't over-test.
- Test against function signature and JSDoc only — not implementation details.
- `beforeEach`: create a fresh `FSCore` via `createFSCore("test-fs-<name>")`, call `core.reset()`, instantiate needed ops.
- `afterEach`: call `core.reset()`.
- Import `"fake-indexeddb/auto"` at the top of every spec file.
- Use `assert` from `chai`; use `assertFSError(e, '<CODE>')` in catch blocks.

Condensed example:

```ts
import "fake-indexeddb/auto";
import {assert} from "chai";
import {createFSCore, type FSCore} from "./core/index.ts";
import {createFileOps, type FileOps} from "./file-ops.ts";
import {createRemoveOps, type RemoveOps} from "./remove-ops.ts";
import {createStatOps, type StatOps} from "./stat-ops.ts";
import {assertFSError} from "../error.ts";

describe("unlink", () => {
    let core: FSCore;
    let file_ops: FileOps;
    let remove_ops: RemoveOps;
    let stat_ops: StatOps;

    beforeEach(async () => {
        core = createFSCore("test-fs-unlink");
        await core.reset();
        file_ops = createFileOps(core);
        remove_ops = createRemoveOps(core);
        stat_ops = createStatOps(core);
    });

    afterEach(async () => { await core.reset(); });

    it("should delete an existing file", async () => {
        await file_ops.writeFile("/to-delete.txt", "bye");
        await remove_ops.unlink("/to-delete.txt");
        try {
            await stat_ops.stat("/to-delete.txt");
            assert.fail("Expected error");
        } catch (e) { assertFSError(e, 'ENOENT'); }
    });

    // ... more cases, then describe("rm", ...) ...
});
```
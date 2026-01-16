# lite-fs

## Overview

`@jiminp/lite-fs` is a TypeScript library implementing minimal (Node.js-like) fs API, where data gets stored in an IndexedDB.

```ts
import { LiteFS } from "@jiminp/lite-fs";

// Write a text file
const fs = new LiteFS('my-app-fs');
await fs.writeFile("/hello.txt", "Hello, world!");

// Read as string
const text = await fs.readFile("/hello.txt", 'utf-8');
console.log(text); // "Hello, world!"
```

## Path

While the API is mostly compatible to Node.js, it currently enforces a strict rule on path parameters:

- All paths **must be absolute** (starting with `/`).
- Folder paths **must** end with `/`, and file paths **must not**.
- Empty segments (`//`), `/./`, and `/../` are not allowed.

`AbsoluteFolderPath`, `AbsoluteFilePath`, and `AbsolutePath` types are used throughout the library.

For handling relative paths, users are encouraged to use `joinPath` exported by this library.

### Internal Path

Strictly on IndexedDB entries (key and `parent` in particular), folder paths are stored **without a trailing `/`**.

`StoragePath` types are used to signal this, and this type should not be used for API surfaces.

## Structure

## Testing

`src/**/*.spec.ts` are test files. For example, codes in `src/foo.ts` is tested in `src/foo.spec.ts`.

Here's a condensed example for `src/lite-fs/remove-ops.spec.ts`.

```ts
import "fake-indexeddb/auto";
import { assert } from "chai";
import { createFSCore, type FSCore } from "./core/index.ts";
import { createDirOps, type DirOps } from "./dir-ops.ts";
import { createFileOps, type FileOps } from "./file-ops.ts";
import { createStatOps, type StatOps } from "./stat-ops.ts";
import { createRemoveOps, type RemoveOps } from "./remove-ops.ts";
import { assertFSError } from "../error.ts";

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

    afterEach(async () => {
        await core.reset();
    });

    it("should successfully delete an existing file", async () => {
        await file_ops.writeFile("/to-delete.txt", "Goodbye, world!");
        
        await remove_ops.unlink("/to-delete.txt");

        try {
            await stat_ops.stat("/to-delete.txt");
            assert.fail("Expected error");
        } catch (e) {
            assertFSError(e, 'ENOENT');
        }
    });

    // Test more...
});

// Test rm...
```

Advices on creating tests:

- Each function should get one `describe`.
- For a group of related unit-tests for a function, use `context`.
- Each 'nominal usage' should get one unit test.
- Do test edge cases, but don't make excessively many tests.
- Don't test implementation details.
  - Tests should only depend on the function signature and JSDoc description (if available).
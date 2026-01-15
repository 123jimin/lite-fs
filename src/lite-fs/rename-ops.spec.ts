import "fake-indexeddb/auto";
import { assert } from "chai";

import { createFSCore, type FSCore } from "./core/index.ts";
import { createDirOps, type DirOps } from "./dir-ops.ts";
import { createFileOps, type FileOps } from "./file-ops.ts";
import { createRenameOps, type RenameOps } from "./rename-ops.ts";
import { createStatOps, type StatOps } from "./stat-ops.ts";
import { isFSError } from "../error.ts";

describe("rename", () => {
    let core: FSCore;
    let dir_ops: DirOps;
    let file_ops: FileOps;
    let rename_ops: RenameOps;
    let stat_ops: StatOps;

    beforeEach(async () => {
        core = createFSCore("test-fs-rename-files");
        await core.reset();

        dir_ops = createDirOps(core);
        file_ops = createFileOps(core);
        rename_ops = createRenameOps(core);
        stat_ops = createStatOps(core);
    });

    afterEach(async () => {
        await core.reset();
    });

    context("files", () => {
        it("should rename a file within the same directory", async () => {
            await file_ops.writeFile("/a.txt", "hello");

            await rename_ops.rename("/a.txt", "/b.txt");

            const moved = await file_ops.readFile("/b.txt", "utf-8");
            assert.equal(moved, "hello");

            try {
                await stat_ops.stat("/a.txt");
                assert.fail("Expected ENOENT");
            } catch (e) {
                assert.isTrue(isFSError(e, "ENOENT"));
            }
        });

        it("should move a file into an existing directory", async () => {
            await file_ops.writeFile("/note.txt", "memo");
            await dir_ops.mkdir("/docs/");

            await rename_ops.rename("/note.txt", "/docs/note.txt");

            const moved = await file_ops.readFile("/docs/note.txt", "utf-8");
            assert.equal(moved, "memo");

            try {
                await stat_ops.stat("/note.txt");
                assert.fail("Expected ENOENT");
            } catch (e) {
                assert.isTrue(isFSError(e, "ENOENT"));
            }
        });

        it("should not throw when old_path and new_path are the same", async () => {
            await file_ops.writeFile("/same.txt", "unchanged");

            await rename_ops.rename("/same.txt", "/same.txt");

            const text = await file_ops.readFile("/same.txt", "utf-8");
            assert.equal(text, "unchanged");
        });

        it("should throw ENOENT if the source file doesn't exist", async () => {
            try {
                await rename_ops.rename("/missing.txt", "/new.txt");
                assert.fail("Expected ENOENT");
            } catch (e) {
                assert.isTrue(isFSError(e, "ENOENT"));
            }
        });

        it("should throw ENOENT if destination parent directory doesn't exist", async () => {
            await file_ops.writeFile("/a.txt", "data");

            try {
                await rename_ops.rename("/a.txt", "/nope/a.txt");
                assert.fail("Expected ENOENT");
            } catch (e) {
                assert.isTrue(isFSError(e, "ENOENT"));
            }
        });

        it("should overwrite destination file if destination file already exists", async () => {
            await file_ops.writeFile("/from.txt", "from");
            await file_ops.writeFile("/to.txt", "to");
            
            await rename_ops.rename("/from.txt", "/to.txt");

            assert.equal(await file_ops.readFile("/to.txt", "utf-8"), "from");
            
            try {
                await file_ops.readFile("/from.txt", "utf-8");
                assert.fail("Expected ENOENT");
            } catch(e) {
                assert.isTrue(isFSError(e, 'ENOENT'));
            }
        });

        it("should throw EISDIR when renaming a file to a folder path", async () => {
            await file_ops.writeFile("/file.txt", "x");
            await dir_ops.mkdir("/dir/");

            try {
                await rename_ops.rename("/file.txt", "/dir/");
                assert.fail("Expected EISDIR");
            } catch (e) {
                assert.isTrue(isFSError(e, "EISDIR"));
            }
        });

        it("should throw EINVAL when renaming root (source)", async () => {
            try {
                await rename_ops.rename("/", "/x/");
                assert.fail("Expected EINVAL");
            } catch (e) {
                assert.isTrue(isFSError(e, "EINVAL"));
            }
        });

        it("should throw EINVAL when renaming root (destination)", async () => {
            await dir_ops.mkdir("/x/");

            try {
                await rename_ops.rename("/x/", "/");
                assert.fail("Expected EINVAL");
            } catch (e) {
                assert.isTrue(isFSError(e, "EINVAL"));
            }
        });
    });

    context("directories", () => {
        it("should rename an empty directory", async () => {
            await dir_ops.mkdir("/empty/");

            await rename_ops.rename("/empty/", "/renamed/");

            // New exists
            const st = await stat_ops.stat("/renamed/");
            assert.isTrue(st.isDirectory());

            // Old does not
            try {
                await stat_ops.stat("/empty/");
                assert.fail("Expected ENOENT");
            } catch (e) {
                assert.isTrue(isFSError(e, "ENOENT"));
            }
        });

        it("should rename a directory and move all nested contents", async () => {
            await dir_ops.mkdir("/parent/child/grandchild/", { recursive: true });
            await file_ops.writeFile("/parent/child/grandchild/toy.txt", "broken");

            await rename_ops.rename("/parent/", "/moved/");

            const moved = await file_ops.readFile("/moved/child/grandchild/toy.txt", "utf-8");
            assert.equal(moved, "broken");

            try {
                await stat_ops.stat("/parent/");
                assert.fail("Expected ENOENT");
            } catch (e) {
                assert.isTrue(isFSError(e, "ENOENT"));
            }
        });

        it("should throw ENOENT if the source directory doesn't exist", async () => {
            try {
                await rename_ops.rename("/ghost/", "/alive/");
                assert.fail("Expected ENOENT");
            } catch (e) {
                assert.isTrue(isFSError(e, "ENOENT"));
            }
        });

        it("should throw ENOTDIR when renaming a directory to a file path", async () => {
            await dir_ops.mkdir("/adir/");

            try {
                await rename_ops.rename("/adir/", "/afile.txt");
                assert.fail("Expected ENOTDIR");
            } catch (e) {
                assert.isTrue(isFSError(e, "ENOTDIR"));
            }
        });

        it("should throw EINVAL when attempting to move a directory inside itself", async () => {
            await dir_ops.mkdir("/a/b/", { recursive: true });

            try {
                await rename_ops.rename("/a/", "/a/b/c/");
                assert.fail("Expected EINVAL");
            } catch (e) {
                assert.isTrue(isFSError(e, "EINVAL"));
            }
        });
    });
});


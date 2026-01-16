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

    it("should throw EISDIR when trying to unlink a directory", async () => {
        const dir_ops = createDirOps(core);
        await dir_ops.mkdir("/i-am-a-folder/");

        try {
            await remove_ops.unlink("/i-am-a-folder");
            assert.fail("Expected error");
        } catch (e) {
            assertFSError(e, 'EISDIR');
        }
    });

    it("should throw ENOENT if the file doesn't exist", async () => {
        try {
            await remove_ops.unlink("/ghost.txt");
            assert.fail("Expected error.");
        } catch (e) {
            assertFSError(e, 'ENOENT');
        }
    });
});

describe("rm", () => {
    let core: FSCore;
    let dir_ops: DirOps;
    let file_ops: FileOps;
    let remove_ops: RemoveOps;
    let stat_ops: StatOps;

    beforeEach(async () => {
        core = createFSCore("test-fs-rm");
        await core.reset();
        dir_ops = createDirOps(core);
        file_ops = createFileOps(core);
        remove_ops = createRemoveOps(core);
        stat_ops = createStatOps(core);
    });

    afterEach(async () => {
        await core.reset();
    });

    it("should remove a single file just like unlink", async () => {
        await file_ops.writeFile("/delete-me.bin", new Uint8Array([1, 2, 3]));
        await remove_ops.rm("/delete-me.bin");

        try {
            await stat_ops.stat("/delete-me.bin");
            assert.fail();
        } catch (e) {
            assertFSError(e, 'ENOENT');
        }
    });

    it("should remove an empty directory", async () => {
        await dir_ops.mkdir("/empty-box/");
        await remove_ops.rm("/empty-box/");

        try {
            await stat_ops.stat("/empty-box/");
            assert.fail();
        } catch (e) {
            assertFSError(e, 'ENOENT');
        }
    });

    it("should throw ENOTEMPTY if directory is not empty and recursive is false", async () => {
        await dir_ops.mkdir("/not-empty/", { recursive: true });
        await file_ops.writeFile("/not-empty/surprise.txt", "Peek-a-boo!");

        try {
            await remove_ops.rm("/not-empty/", { recursive: false });
            assert.fail("Expected error");
        } catch (e) {
            assertFSError(e, 'ENOTEMPTY');
        }
    });

    it("should delete everything inside if recursive is true", async () => {
        await dir_ops.mkdir("/parent/child/grandchild/", { recursive: true });
        await file_ops.writeFile("/parent/child/grandchild/toy.txt", "broken");

        await remove_ops.rm("/parent/", { recursive: true });

        try {
            await stat_ops.stat("/parent/");
            assert.fail("Expected error");
        } catch (e) {
            assertFSError(e, 'ENOENT');
        }
    });

    it("should not throw when force is true and path doesn't exist", async () => {
        await remove_ops.rm("/nothing-here", { force: true });
        await remove_ops.rm("/a/b/c", { force: true });
    });
});
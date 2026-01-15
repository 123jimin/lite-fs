import "fake-indexeddb/auto";
import { assert } from "chai";
import { createFSCore, type FSCore } from "./core/index.ts";
import { createDirOps, type DirOps } from "./dir-ops.ts";
import { createFileOps, type FileOps } from "./file-ops.ts";
import { createStatOps, type StatOps } from "./stat-ops.ts";
import { isFSError } from "../error.ts";

describe("stat", () => {
    let core: FSCore;
    let dir_ops: DirOps;
    let file_ops: FileOps;
    let stat_ops: StatOps;

    beforeEach(async () => {
        core = createFSCore("test-fs-stat");
        await core.reset();
        dir_ops = createDirOps(core);
        file_ops = createFileOps(core);
        stat_ops = createStatOps(core);
    });

    afterEach(async () => {
        await core.reset();
    });

    context("stating files", () => {
        it("should return Stats for a file at root level", async () => {
            await file_ops.writeFile("/test.txt", "content");

            const stats = await stat_ops.stat("/test.txt");

            assert.isTrue(stats.isFile());
            assert.isFalse(stats.isDirectory());
        });

        it("should return Stats for a file in nested directory", async () => {
            await dir_ops.mkdir("/foo/bar/", { recursive: true });
            await file_ops.writeFile("/foo/bar/file.txt", "content");

            const stats = await stat_ops.stat("/foo/bar/file.txt");

            assert.isTrue(stats.isFile());
            assert.isFalse(stats.isDirectory());
        });
    });

    context("stating directories", () => {
        it("should return Stats for a directory at root level", async () => {
            await dir_ops.mkdir("/mydir/");

            const stats = await stat_ops.stat("/mydir/");

            assert.isFalse(stats.isFile());
            assert.isTrue(stats.isDirectory());
        });

        it("should return Stats for a nested directory", async () => {
            await dir_ops.mkdir("/foo/bar/baz/", { recursive: true });

            const stats = await stat_ops.stat("/foo/bar/baz/");

            assert.isFalse(stats.isFile());
            assert.isTrue(stats.isDirectory());
        });

        it("should return Stats for intermediate directories", async () => {
            await dir_ops.mkdir("/a/b/c/", { recursive: true });

            const stats_a = await stat_ops.stat("/a/");
            const stats_b = await stat_ops.stat("/a/b/");

            assert.isTrue(stats_a.isDirectory());
            assert.isTrue(stats_b.isDirectory());
        });
    });

    context("mtime", () => {
        it("should return mtime as a Date object for files", async () => {
            await file_ops.writeFile("/test.txt", "content");

            const stats = await stat_ops.stat("/test.txt");

            assert.instanceOf(stats.mtime, Date);
        });

        it("should return recent mtime for newly created file", async () => {
            const before = Date.now();
            await file_ops.writeFile("/test.txt", "content");
            const after = Date.now();

            const stats = await stat_ops.stat("/test.txt");
            const mtime_ms = stats.mtime.getTime();

            assert.isAtLeast(mtime_ms, before);
            assert.isAtMost(mtime_ms, after);
        });

        it("should update mtime when file is overwritten", async () => {
            await file_ops.writeFile("/test.txt", "original");
            const stats_before = await stat_ops.stat("/test.txt");

            // Small delay to ensure different timestamp
            await new Promise((resolve) => setTimeout(resolve, 10));

            await file_ops.writeFile("/test.txt", "updated");
            const stats_after = await stat_ops.stat("/test.txt");

            assert.isAbove(stats_after.mtime.getTime(), stats_before.mtime.getTime());
        });
    });

    context("error cases", () => {
        it("should throw ENOENT for non-existent file", async () => {
            try {
                await stat_ops.stat("/nonexistent.txt");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "ENOENT"));
            }
        });

        it("should throw ENOENT for non-existent directory", async () => {
            try {
                await stat_ops.stat("/nonexistent/");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "ENOENT"));
            }
        });

        it("should throw ENOENT for file in non-existent directory", async () => {
            try {
                await stat_ops.stat("/foo/bar/file.txt");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "ENOENT"));
            }
        });

        it("should throw ENOENT for non-existent nested directory", async () => {
            await dir_ops.mkdir("/foo/");
            try {
                await stat_ops.stat("/foo/bar/");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "ENOENT"));
            }
        });

        it("should throw ENOENT for root directory", async () => {
            // Root is not stored as an entry in the database
            try {
                await stat_ops.stat("/");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "ENOENT"));
            }
        });
    });

    context("path validation", () => {
        it("should throw EINVAL for non-absolute path", async () => {
            try {
                await stat_ops.stat("relative/path.txt");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "EINVAL"));
            }
        });
    });

    context("distinguishing files and directories", () => {
        it("should correctly distinguish file from directory with similar names", async () => {
            await file_ops.writeFile("/item", "file content");
            await dir_ops.mkdir("/item-dir/");

            const file_stats = await stat_ops.stat("/item");
            const dir_stats = await stat_ops.stat("/item-dir/");

            assert.isTrue(file_stats.isFile());
            assert.isFalse(file_stats.isDirectory());

            assert.isFalse(dir_stats.isFile());
            assert.isTrue(dir_stats.isDirectory());
        });

        it("should handle file and directory in same parent", async () => {
            await dir_ops.mkdir("/parent/");
            await file_ops.writeFile("/parent/file", "content");
            await dir_ops.mkdir("/parent/subdir/");

            const file_stats = await stat_ops.stat("/parent/file");
            const dir_stats = await stat_ops.stat("/parent/subdir/");

            assert.isTrue(file_stats.isFile());
            assert.isTrue(dir_stats.isDirectory());
        });
    });
});
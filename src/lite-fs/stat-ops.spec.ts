import "fake-indexeddb/auto";
import { assert } from "chai";
import { createFSCore, type FSCore } from "./core/index.ts";
import { createDirOps, type DirOps } from "./dir-ops.ts";
import { createFileOps, type FileOps } from "./file-ops.ts";
import { createStatOps, type StatOps } from "./stat-ops.ts";
import { isFSError } from "../error.ts";

describe("stat", function () {
    let core: FSCore;
    let dir_ops: DirOps;
    let file_ops: FileOps;
    let stat_ops: StatOps;

    beforeEach(async function () {
        core = createFSCore("test-fs-stat");
        await core.reset();
        dir_ops = createDirOps(core);
        file_ops = createFileOps(core);
        stat_ops = createStatOps(core);
    });

    afterEach(async function () {
        await core.reset();
    });

    context("stating files", function () {
        it("should return Stats for a file at root level", async function () {
            await file_ops.writeFile("/test.txt", "content");

            const stats = await stat_ops.stat("/test.txt");

            assert.isTrue(stats.isFile());
            assert.isFalse(stats.isDirectory());
        });

        it("should return Stats for a file in nested directory", async function () {
            await dir_ops.mkdir("/foo/bar/", { recursive: true });
            await file_ops.writeFile("/foo/bar/file.txt", "content");

            const stats = await stat_ops.stat("/foo/bar/file.txt");

            assert.isTrue(stats.isFile());
            assert.isFalse(stats.isDirectory());
        });

        it("should return Stats for a file without extension", async function () {
            await file_ops.writeFile("/myfile", "content");

            const stats = await stat_ops.stat("/myfile");

            assert.isTrue(stats.isFile());
            assert.isFalse(stats.isDirectory());
        });

        it("should return Stats for an empty file", async function () {
            await file_ops.writeFile("/empty.txt", "");

            const stats = await stat_ops.stat("/empty.txt");

            assert.isTrue(stats.isFile());
            assert.isFalse(stats.isDirectory());
        });

        it("should return Stats for a binary file", async function () {
            const binary_content = new Uint8Array([0x00, 0x01, 0x02, 0xff]);
            await file_ops.writeFile("/binary.bin", binary_content);

            const stats = await stat_ops.stat("/binary.bin");

            assert.isTrue(stats.isFile());
            assert.isFalse(stats.isDirectory());
        });
    });

    context("stating directories", function () {
        it("should return Stats for a directory at root level", async function () {
            await dir_ops.mkdir("/mydir/");

            const stats = await stat_ops.stat("/mydir/");

            assert.isFalse(stats.isFile());
            assert.isTrue(stats.isDirectory());
        });

        it("should return Stats for a nested directory", async function () {
            await dir_ops.mkdir("/foo/bar/baz/", { recursive: true });

            const stats = await stat_ops.stat("/foo/bar/baz/");

            assert.isFalse(stats.isFile());
            assert.isTrue(stats.isDirectory());
        });

        it("should return Stats for an empty directory", async function () {
            await dir_ops.mkdir("/empty/");

            const stats = await stat_ops.stat("/empty/");

            assert.isFalse(stats.isFile());
            assert.isTrue(stats.isDirectory());
        });

        it("should return Stats for a directory with contents", async function () {
            await dir_ops.mkdir("/parent/");
            await file_ops.writeFile("/parent/child.txt", "content");
            await dir_ops.mkdir("/parent/subdir/");

            const stats = await stat_ops.stat("/parent/");

            assert.isFalse(stats.isFile());
            assert.isTrue(stats.isDirectory());
        });

        it("should return Stats for intermediate directories", async function () {
            await dir_ops.mkdir("/a/b/c/", { recursive: true });

            const stats_a = await stat_ops.stat("/a/");
            const stats_b = await stat_ops.stat("/a/b/");

            assert.isTrue(stats_a.isDirectory());
            assert.isTrue(stats_b.isDirectory());
        });
    });

    context("mtime", function () {
        it("should return mtime as a Date object for files", async function () {
            await file_ops.writeFile("/test.txt", "content");

            const stats = await stat_ops.stat("/test.txt");

            assert.instanceOf(stats.mtime, Date);
        });

        it("should return mtime as a Date object for directories", async function () {
            await dir_ops.mkdir("/mydir/");

            const stats = await stat_ops.stat("/mydir/");

            assert.instanceOf(stats.mtime, Date);
        });

        it("should return recent mtime for newly created file", async function () {
            const before = Date.now();
            await file_ops.writeFile("/test.txt", "content");
            const after = Date.now();

            const stats = await stat_ops.stat("/test.txt");
            const mtime_ms = stats.mtime.getTime();

            assert.isAtLeast(mtime_ms, before);
            assert.isAtMost(mtime_ms, after);
        });

        it("should return recent mtime for newly created directory", async function () {
            const before = Date.now();
            await dir_ops.mkdir("/mydir/");
            const after = Date.now();

            const stats = await stat_ops.stat("/mydir/");
            const mtime_ms = stats.mtime.getTime();

            assert.isAtLeast(mtime_ms, before);
            assert.isAtMost(mtime_ms, after);
        });

        it("should update mtime when file is overwritten", async function () {
            await file_ops.writeFile("/test.txt", "original");
            const stats_before = await stat_ops.stat("/test.txt");

            // Small delay to ensure different timestamp
            await new Promise((resolve) => setTimeout(resolve, 10));

            await file_ops.writeFile("/test.txt", "updated");
            const stats_after = await stat_ops.stat("/test.txt");

            assert.isAbove(stats_after.mtime.getTime(), stats_before.mtime.getTime());
        });
    });

    context("error cases", function () {
        it("should throw ENOENT for non-existent file", async function () {
            try {
                await stat_ops.stat("/nonexistent.txt");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "ENOENT"));
            }
        });

        it("should throw ENOENT for non-existent directory", async function () {
            try {
                await stat_ops.stat("/nonexistent/");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "ENOENT"));
            }
        });

        it("should throw ENOENT for file in non-existent directory", async function () {
            try {
                await stat_ops.stat("/foo/bar/file.txt");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "ENOENT"));
            }
        });

        it("should throw ENOENT for non-existent nested directory", async function () {
            await dir_ops.mkdir("/foo/");
            try {
                await stat_ops.stat("/foo/bar/");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "ENOENT"));
            }
        });

        it("should throw ENOENT for root directory", async function () {
            // Root is not stored as an entry in the database
            try {
                await stat_ops.stat("/");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "ENOENT"));
            }
        });
    });

    context("path validation", function () {
        it("should throw EINVAL for non-absolute path", async function () {
            try {
                await stat_ops.stat("relative/path.txt");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "EINVAL"));
            }
        });

        it("should throw EINVAL for path with empty segments", async function () {
            try {
                await stat_ops.stat("/foo//bar.txt");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "EINVAL"));
            }
        });

        it("should throw EINVAL for path with dot segment", async function () {
            try {
                await stat_ops.stat("/foo/./bar.txt");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "EINVAL"));
            }
        });

        it("should throw EINVAL for path with double-dot segment", async function () {
            try {
                await stat_ops.stat("/foo/../bar.txt");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "EINVAL"));
            }
        });
    });

    context("distinguishing files and directories", function () {
        it("should correctly distinguish file from directory with similar names", async function () {
            await file_ops.writeFile("/item", "file content");
            await dir_ops.mkdir("/item-dir/");

            const file_stats = await stat_ops.stat("/item");
            const dir_stats = await stat_ops.stat("/item-dir/");

            assert.isTrue(file_stats.isFile());
            assert.isFalse(file_stats.isDirectory());

            assert.isFalse(dir_stats.isFile());
            assert.isTrue(dir_stats.isDirectory());
        });

        it("should handle file and directory in same parent", async function () {
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
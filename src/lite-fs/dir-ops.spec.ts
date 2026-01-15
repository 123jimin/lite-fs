/* eslint-disable @typescript-eslint/no-non-null-assertion */

import "fake-indexeddb/auto";
import { assert } from "chai";
import { createFSCore, type FSCore } from "./core/index.ts";
import { createDirOps, type DirOps } from "./dir-ops.ts";
import { createFileOps, type FileOps } from "./file-ops.ts";
import { isFSError } from "../error.ts";

describe("mkdir", function () {
    let core: FSCore;
    let dir_ops: DirOps;
    let file_ops: FileOps;

    beforeEach(async function () {
        core = createFSCore("test-fs-mkdir");
        await core.reset();
        dir_ops = createDirOps(core);
        file_ops = createFileOps(core);
    });

    afterEach(async function () {
        await core.reset();
    });

    context("without recursive option", function () {
        it("should create a directory at root level", async function () {
            await dir_ops.mkdir("/foo/");
            const entries = await dir_ops.readdir("/");
            assert.deepEqual(entries, ["foo"]);
        });

        it("should create a directory when parent exists", async function () {
            await dir_ops.mkdir("/foo/");
            await dir_ops.mkdir("/foo/bar/");
            const entries = await dir_ops.readdir("/foo/");
            assert.deepEqual(entries, ["bar"]);
        });

        it("should throw ENOENT when parent directory does not exist", async function () {
            try {
                await dir_ops.mkdir("/foo/bar/");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "ENOENT"));
            }
        });

        it("should throw EEXIST when directory already exists", async function () {
            await dir_ops.mkdir("/foo/");
            try {
                await dir_ops.mkdir("/foo/");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "EEXIST"));
            }
        });

        it("should throw EEXIST when a file exists at the path", async function () {
            await file_ops.writeFile("/foo", "content");
            try {
                await dir_ops.mkdir("/foo/");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "EEXIST"));
            }
        });

        it("should throw ENOTDIR when parent is a file", async function () {
            await file_ops.writeFile("/foo", "content");
            try {
                await dir_ops.mkdir("/foo/bar/");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "ENOTDIR"));
            }
        });
    });

    context("with recursive option", function () {
        it("should create nested directories", async function () {
            await dir_ops.mkdir("/foo/bar/baz/", { recursive: true });

            const root_entries = await dir_ops.readdir("/");
            assert.deepEqual(root_entries, ["foo"]);

            const foo_entries = await dir_ops.readdir("/foo/");
            assert.deepEqual(foo_entries, ["bar"]);

            const bar_entries = await dir_ops.readdir("/foo/bar/");
            assert.deepEqual(bar_entries, ["baz"]);
        });

        it("should create single directory at root level", async function () {
            await dir_ops.mkdir("/foo/", { recursive: true });
            const entries = await dir_ops.readdir("/");
            assert.deepEqual(entries, ["foo"]);
        });

        it("should succeed when directory already exists", async function () {
            await dir_ops.mkdir("/foo/", { recursive: true });
            await dir_ops.mkdir("/foo/", { recursive: true });

            const entries = await dir_ops.readdir("/");
            assert.deepEqual(entries, ["foo"]);
        });

        it("should succeed when partial path already exists", async function () {
            await dir_ops.mkdir("/foo/", { recursive: true });
            await dir_ops.mkdir("/foo/bar/baz/", { recursive: true });

            const entries = await dir_ops.readdir("/foo/bar/");
            assert.deepEqual(entries, ["baz"]);
        });

        it("should throw EEXIST when a file exists at the path", async function () {
            await file_ops.writeFile("/foo", "content");
            try {
                await dir_ops.mkdir("/foo/", { recursive: true });
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "EEXIST"));
            }
        });

        it("should throw ENOTDIR when a parent path is a file", async function () {
            await file_ops.writeFile("/foo", "content");
            try {
                await dir_ops.mkdir("/foo/bar/", { recursive: true });
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "ENOTDIR"));
            }
        });
    });

    context("root directory", function () {
        it("should succeed silently for root path", async function () {
            await dir_ops.mkdir("/");
            const entries = await dir_ops.readdir("/");
            assert.deepEqual(entries, []);
        });

        it("should succeed silently for root path with recursive", async function () {
            await dir_ops.mkdir("/", { recursive: true });
            const entries = await dir_ops.readdir("/");
            assert.deepEqual(entries, []);
        });
    });

    context("path validation", function () {
        it("should throw EINVAL for non-absolute path", async function () {
            try {
                await dir_ops.mkdir("foo/");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "EINVAL"));
            }
        });

        it("should throw EINVAL for file path without trailing slash", async function () {
            try {
                await dir_ops.mkdir("/foo");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "EINVAL"));
            }
        });

        it("should throw EINVAL for path with empty segments", async function () {
            try {
                await dir_ops.mkdir("/foo//bar/");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "EINVAL"));
            }
        });

        it("should throw EINVAL for path with dot segments", async function () {
            try {
                await dir_ops.mkdir("/foo/../bar/");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "EINVAL"));
            }
        });
    });
});

describe("readdir", function () {
    let core: FSCore;
    let dir_ops: DirOps;
    let file_ops: FileOps;

    beforeEach(async function () {
        core = createFSCore("test-fs-readdir");
        await core.reset();
        dir_ops = createDirOps(core);
        file_ops = createFileOps(core);
    });

    afterEach(async function () {
        await core.reset();
    });

    context("reading directory contents", function () {
        it("should return empty array for empty directory", async function () {
            await dir_ops.mkdir("/empty/", { recursive: true });
            const entries = await dir_ops.readdir("/empty/");
            assert.deepEqual(entries, []);
        });

        it("should return file names in directory", async function () {
            await file_ops.writeFile("/a.txt", "a");
            await file_ops.writeFile("/b.txt", "b");

            const entries = await dir_ops.readdir("/");
            assert.sameMembers(entries, ["a.txt", "b.txt"]);
        });

        it("should return subdirectory names without trailing slash", async function () {
            await dir_ops.mkdir("/foo/", { recursive: true });
            await dir_ops.mkdir("/bar/", { recursive: true });

            const entries = await dir_ops.readdir("/");
            assert.sameMembers(entries, ["foo", "bar"]);
        });

        it("should return mixed files and directories", async function () {
            await dir_ops.mkdir("/subdir/", { recursive: true });
            await file_ops.writeFile("/file.txt", "content");

            const entries = await dir_ops.readdir("/");
            assert.sameMembers(entries, ["subdir", "file.txt"]);
        });

        it("should only return direct children", async function () {
            await dir_ops.mkdir("/foo/bar/baz/", { recursive: true });
            await file_ops.writeFile("/foo/file.txt", "content");
            await file_ops.writeFile("/foo/bar/nested.txt", "nested");

            const entries = await dir_ops.readdir("/foo/");
            assert.sameMembers(entries, ["bar", "file.txt"]);
        });

        it("should read nested directory contents", async function () {
            await dir_ops.mkdir("/a/b/", { recursive: true });
            await file_ops.writeFile("/a/b/file1.txt", "1");
            await file_ops.writeFile("/a/b/file2.txt", "2");

            const entries = await dir_ops.readdir("/a/b/");
            assert.sameMembers(entries, ["file1.txt", "file2.txt"]);
        });
    });

    context("with withFileTypes option", function () {
        it("should return Dirent objects for files", async function () {
            await file_ops.writeFile("/test.txt", "content");

            const entries = await dir_ops.readdir("/", { withFileTypes: true });
            assert.lengthOf(entries, 1);

            const entry = entries[0]!;
            assert.equal(entry.name, "test.txt");
            assert.isTrue(entry.isFile());
            assert.isFalse(entry.isDirectory());
        });

        it("should return Dirent objects for directories", async function () {
            await dir_ops.mkdir("/subdir/", { recursive: true });

            const entries = await dir_ops.readdir("/", { withFileTypes: true });
            assert.lengthOf(entries, 1);

            const entry = entries[0]!;
            assert.equal(entry.name, "subdir");
            assert.isFalse(entry.isFile());
            assert.isTrue(entry.isDirectory());
        });

        it("should return mixed Dirent objects", async function () {
            await dir_ops.mkdir("/subdir/", { recursive: true });
            await file_ops.writeFile("/file.txt", "content");

            const entries = await dir_ops.readdir("/", { withFileTypes: true });
            assert.lengthOf(entries, 2);

            const file_entry = entries.find((e) => e.name === "file.txt")!;
            const dir_entry = entries.find((e) => e.name === "subdir")!;

            assert.isTrue(file_entry.isFile());
            assert.isFalse(file_entry.isDirectory());

            assert.isFalse(dir_entry.isFile());
            assert.isTrue(dir_entry.isDirectory());
        });

        it("should return empty array for empty directory", async function () {
            await dir_ops.mkdir("/empty/", { recursive: true });
            const entries = await dir_ops.readdir("/empty/", { withFileTypes: true });
            assert.deepEqual(entries, []);
        });
    });

    context("root directory", function () {
        it("should read empty root directory", async function () {
            const entries = await dir_ops.readdir("/");
            assert.deepEqual(entries, []);
        });

        it("should list root directory contents", async function () {
            await file_ops.writeFile("/root-file.txt", "content");
            await dir_ops.mkdir("/root-dir/", { recursive: true });

            const entries = await dir_ops.readdir("/");
            assert.sameMembers(entries, ["root-file.txt", "root-dir"]);
        });

        it("should read root with withFileTypes", async function () {
            await file_ops.writeFile("/file.txt", "content");
            await dir_ops.mkdir("/dir/", { recursive: true });

            const entries = await dir_ops.readdir("/", { withFileTypes: true });
            assert.lengthOf(entries, 2);

            const file_entry = entries.find((e) => e.name === "file.txt")!;
            const dir_entry = entries.find((e) => e.name === "dir")!;

            assert.isTrue(file_entry.isFile());
            assert.isTrue(dir_entry.isDirectory());
        });
    });

    context("error cases", function () {
        it("should throw ENOENT for non-existent directory", async function () {
            try {
                await dir_ops.readdir("/nonexistent/");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "ENOENT"));
            }
        });

        it("should throw ENOENT for non-existent nested directory", async function () {
            await dir_ops.mkdir("/foo/", { recursive: true });
            try {
                await dir_ops.readdir("/foo/bar/");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "ENOENT"));
            }
        });

        it("should throw ENOTDIR when path points to a file", async function () {
            await file_ops.writeFile("/file", "content");
            try {
                await dir_ops.readdir("/file/");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "ENOTDIR"));
            }
        });
    });

    context("path validation", function () {
        it("should throw EINVAL for non-absolute path", async function () {
            try {
                await dir_ops.readdir("foo/");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "EINVAL"));
            }
        });

        it("should throw EINVAL for file path without trailing slash", async function () {
            try {
                await dir_ops.readdir("/foo");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "EINVAL"));
            }
        });

        it("should throw EINVAL for path with empty segments", async function () {
            try {
                await dir_ops.readdir("/foo//bar/");
                assert.fail("Expected error");
            } catch (err) {
                assert.isTrue(isFSError(err, "EINVAL"));
            }
        });
    });
});
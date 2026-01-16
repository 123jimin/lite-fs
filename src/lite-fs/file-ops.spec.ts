import "fake-indexeddb/auto";
import { assert } from "chai";
import { createFSCore, type FSCore } from "./core/index.ts";
import { createDirOps, type DirOps } from "./dir-ops.ts";
import { createFileOps, type FileOps } from "./file-ops.ts";
import { assertFSError } from "../error.ts";

describe("writeFile", () => {
    let core: FSCore;
    let dir_ops: DirOps;
    let file_ops: FileOps;

    beforeEach(async () => {
        core = createFSCore("test-fs-writefile");
        await core.reset();
        dir_ops = createDirOps(core);
        file_ops = createFileOps(core);
    });

    afterEach(async () => {
        await core.reset();
    });

    context("creating files", () => {
        it("should create a file at root level", async () => {
            await file_ops.writeFile("/test.txt", "hello");
            const content = await file_ops.readFile("/test.txt", "utf-8");
            assert.equal(content, "hello");
        });

        it("should create parent directories automatically", async () => {
            await file_ops.writeFile("/foo/bar/test.txt", "content");

            const entries = await dir_ops.readdir("/foo/bar/");
            assert.deepEqual(entries, ["test.txt"]);
        });

        it("should create deeply nested file with parents", async () => {
            await file_ops.writeFile("/a/b/c/d/file.txt", "deep");

            const content = await file_ops.readFile("/a/b/c/d/file.txt", "utf-8");
            assert.equal(content, "deep");
        });
    });

    context("writing content types", () => {
        it("should write string content", async () => {
            await file_ops.writeFile("/string.txt", "string content");
            const content = await file_ops.readFile("/string.txt", "utf-8");
            assert.equal(content, "string content");
        });

        it("should write Uint8Array content", async () => {
            const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
            await file_ops.writeFile("/binary.bin", bytes);

            const result = await file_ops.readFile("/binary.bin");
            assert.deepEqual(result, bytes);
        });

        it("should write empty string", async () => {
            await file_ops.writeFile("/empty.txt", "");
            const content = await file_ops.readFile("/empty.txt", "utf-8");
            assert.equal(content, "");
        });

        it("should write empty Uint8Array", async () => {
            await file_ops.writeFile("/empty.bin", new Uint8Array(0));
            const result = await file_ops.readFile("/empty.bin");
            assert.deepEqual(result, new Uint8Array(0));
        });

        it("should handle unicode content", async () => {
            const unicode = "Hello 世界 🌍";
            await file_ops.writeFile("/unicode.txt", unicode);
            const content = await file_ops.readFile("/unicode.txt", "utf-8");
            assert.equal(content, unicode);
        });
    });

    context("overwriting files", () => {
        it("should overwrite existing file content", async () => {
            await file_ops.writeFile("/test.txt", "original");
            await file_ops.writeFile("/test.txt", "updated");

            const content = await file_ops.readFile("/test.txt", "utf-8");
            assert.equal(content, "updated");
        });
    });

    context("error cases", () => {
        it("should throw ENOTDIR when parent is a file", async () => {
            await file_ops.writeFile("/file", "content");
            try {
                await file_ops.writeFile("/file/child.txt", "child");
                assert.fail("Expected error");
            } catch (err) {
                assertFSError(err, 'ENOTDIR');
            }
        });

        it("should throw ENOTDIR when ancestor is a file", async () => {
            await file_ops.writeFile("/file", "content");
            try {
                await file_ops.writeFile("/file/a/b/c.txt", "deep");
                assert.fail("Expected error");
            } catch (err) {
                assertFSError(err, 'ENOTDIR');
            }
        });
    });

    context("path validation", () => {
        it("should throw EINVAL for non-absolute path", async () => {
            try {
                await file_ops.writeFile("relative.txt", "content");
                assert.fail("Expected error");
            } catch (err) {
                assertFSError(err, 'EINVAL');
            }
        });
    });
});

describe("readFile", () => {
    let core: FSCore;
    let dir_ops: DirOps;
    let file_ops: FileOps;

    beforeEach(async () => {
        core = createFSCore("test-fs-readfile");
        await core.reset();
        dir_ops = createDirOps(core);
        file_ops = createFileOps(core);
    });

    afterEach(async () => {
        await core.reset();
    });

    context("reading as Uint8Array", () => {
        it("should read file as Uint8Array by default", async () => {
            await file_ops.writeFile("/test.txt", "hello");
            const result = await file_ops.readFile("/test.txt");

            assert.instanceOf(result, Uint8Array);
            const expected = new TextEncoder().encode("hello");
            assert.deepEqual(result, expected);
        });

        it("should read binary file correctly", async () => {
            const bytes = new Uint8Array([0, 1, 127, 128, 255]);
            await file_ops.writeFile("/binary.bin", bytes);

            const result = await file_ops.readFile("/binary.bin");
            assert.deepEqual(result, bytes);
        });

        it("should read empty file", async () => {
            await file_ops.writeFile("/empty.txt", "");
            const result = await file_ops.readFile("/empty.txt");
            assert.deepEqual(result, new Uint8Array(0));
        });
    });

    context("reading as string with utf-8", () => {
        it("should read file as string", async () => {
            await file_ops.writeFile("/test.txt", "hello world");
            const content = await file_ops.readFile("/test.txt", "utf-8");
            assert.equal(content, "hello world");
        });

        it("should read unicode content", async () => {
            const unicode = "日本語 🎉 émoji";
            await file_ops.writeFile("/unicode.txt", unicode);
            const content = await file_ops.readFile("/unicode.txt", "utf-8");
            assert.equal(content, unicode);
        });

        it("should read empty file as empty string", async () => {
            await file_ops.writeFile("/empty.txt", "");
            const content = await file_ops.readFile("/empty.txt", "utf-8");
            assert.equal(content, "");
        });

        it("should read multiline content", async () => {
            const multiline = "line1\nline2\nline3";
            await file_ops.writeFile("/multiline.txt", multiline);
            const content = await file_ops.readFile("/multiline.txt", "utf-8");
            assert.equal(content, multiline);
        });
    });

    context("reading from nested paths", () => {
        it("should read file from nested directory", async () => {
            await file_ops.writeFile("/a/b/c/file.txt", "nested content");
            const content = await file_ops.readFile("/a/b/c/file.txt", "utf-8");
            assert.equal(content, "nested content");
        });

        it("should read file at root level", async () => {
            await file_ops.writeFile("/root.txt", "root content");
            const content = await file_ops.readFile("/root.txt", "utf-8");
            assert.equal(content, "root content");
        });
    });

    context("error cases", () => {
        it("should throw ENOENT for non-existent file", async () => {
            try {
                await file_ops.readFile("/nonexistent.txt");
                assert.fail("Expected error");
            } catch (err) {
                assertFSError(err, 'ENOENT');
            }
        });

        it("should throw ENOENT for non-existent nested file", async () => {
            await dir_ops.mkdir("/foo/", { recursive: true });
            try {
                await file_ops.readFile("/foo/nonexistent.txt");
                assert.fail("Expected error");
            } catch (err) {
                assertFSError(err, 'ENOENT');
            }
        });

        it("should throw ENOENT when parent directory does not exist", async () => {
            try {
                await file_ops.readFile("/nonexistent/file.txt");
                assert.fail("Expected error");
            } catch (err) {
                assertFSError(err, 'ENOENT');
            }
        });

        it("should throw EISDIR when trying to read a directory", async () => {
            await dir_ops.mkdir("/mydir/", { recursive: true });
            try {
                await file_ops.readFile("/mydir");
                assert.fail("Expected error");
            } catch (err) {
                assertFSError(err, 'EISDIR');
            }
        });
    });

    context("path validation", () => {
        it("should throw EINVAL for non-absolute path", async () => {
            try {
                await file_ops.readFile("relative.txt");
                assert.fail("Expected error");
            } catch (err) {
                assertFSError(err, 'EINVAL');
            }
        });

        it("should throw EINVAL for folder path with trailing slash", async () => {
            try {
                await file_ops.readFile("/folder/");
                assert.fail("Expected error");
            } catch (err) {
                assertFSError(err, 'EINVAL');
            }
        });

        it("should throw EINVAL for path with empty segments", async () => {
            try {
                await file_ops.readFile("/foo//bar.txt");
                assert.fail("Expected error");
            } catch (err) {
                assertFSError(err, 'EINVAL');
            }
        });

        it("should throw EINVAL for path with dot segments", async () => {
            try {
                await file_ops.readFile("/foo/../bar.txt");
                assert.fail("Expected error");
            } catch (err) {
                assertFSError(err, 'EINVAL');
            }
        });
    });
});
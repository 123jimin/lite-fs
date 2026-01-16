import { assert } from 'chai';
import {
    isAbsolutePath,
    isFolderPath,
    validatePath,
    getParentPath,
    getBaseName,
    joinPath,
} from './path.ts';

import { assertFSError } from './error.ts';

describe("isAbsolutePath", () => {
    context("when path starts with /", () => {
        it("should return true for root path", () => {
            assert.isTrue(isAbsolutePath("/"));
        });

        it("should return true for absolute file path", () => {
            assert.isTrue(isAbsolutePath("/foo/bar.txt"));
        });

        it("should return true for absolute folder path", () => {
            assert.isTrue(isAbsolutePath("/foo/bar/"));
        });

        it("should return true for single segment path", () => {
            assert.isTrue(isAbsolutePath("/foo"));
        });
    });

    context("when path does not start with /", () => {
        it("should return false for relative path", () => {
            assert.isFalse(isAbsolutePath("foo/bar"));
        });

        it("should return false for empty string", () => {
            assert.isFalse(isAbsolutePath(""));
        });

        it("should return false for path starting with dot", () => {
            assert.isFalse(isAbsolutePath("./foo"));
        });

        it("should return false for path starting with double dot", () => {
            assert.isFalse(isAbsolutePath("../foo"));
        });
    });
});

describe("isFolderPath", () => {
    context("when path ends with /", () => {
        it("should return true for root path", () => {
            assert.isTrue(isFolderPath("/"));
        });

        it("should return true for absolute folder path", () => {
            assert.isTrue(isFolderPath("/foo/bar/"));
        });

        it("should return true for relative folder path", () => {
            assert.isTrue(isFolderPath("foo/bar/"));
        });

        it("should return true for single segment folder", () => {
            assert.isTrue(isFolderPath("foo/"));
        });
    });

    context("when path does not end with /", () => {
        it("should return false for absolute file path", () => {
            assert.isFalse(isFolderPath("/foo/bar.txt"));
        });

        it("should return false for path without trailing slash", () => {
            assert.isFalse(isFolderPath("/foo/bar"));
        });

        it("should return false for relative file path", () => {
            assert.isFalse(isFolderPath("foo/bar"));
        });

        it("should return false for empty string", () => {
            assert.isFalse(isFolderPath(""));
        });
    });
});

describe("validatePath", () => {
    context("with valid absolute paths", () => {
        it("should not throw for root path", () => {
            assert.doesNotThrow(() => validatePath("/"));
        });

        it("should not throw for absolute file path", () => {
            assert.doesNotThrow(() => validatePath("/foo/bar.txt"));
        });

        it("should not throw for absolute folder path", () => {
            assert.doesNotThrow(() => validatePath("/foo/bar/"));
        });

        it("should not throw for deeply nested path", () => {
            assert.doesNotThrow(() => validatePath("/a/b/c/d/e.txt"));
        });

        it("should not throw for path with hyphens and underscores", () => {
            assert.doesNotThrow(() => validatePath("/foo-bar/baz_qux.txt"));
        });
    });

    context("with non-absolute paths", () => {
        it("should throw EINVAL for relative path", () => {
            try {
                validatePath("foo/bar");
                assert.fail("should have thrown");
            } catch (e) {
                assertFSError(e, 'EINVAL');
            }
        });

        it("should throw EINVAL for empty path", () => {
            try {
                validatePath("");
                assert.fail("should have thrown");
            } catch (e) {
                assertFSError(e, 'EINVAL');
            }
        });
    });

    context("with empty segments", () => {
        it("should throw EINVAL for path with double slash", () => {
            try {
                validatePath("/foo//bar");
                assert.fail("should have thrown");
            } catch (e) {
                assertFSError(e, 'EINVAL');
            }
        });

        it("should throw EINVAL for path ending with double slash", () => {
            try {
                validatePath("/foo/bar//");
                assert.fail("should have thrown");
            } catch (e) {
                assertFSError(e, 'EINVAL');
            }
        });
    });

    context("with . segments", () => {
        it("should throw EINVAL for path with single dot segment", () => {
            try {
                validatePath("/foo/./bar");
                assert.fail("should have thrown");
            } catch (e) {
                assertFSError(e, 'EINVAL');
            }
        });

        it("should throw EINVAL for path starting with dot segment", () => {
            try {
                validatePath("/./foo");
                assert.fail("should have thrown");
            } catch (e) {
                assertFSError(e, 'EINVAL');
            }
        });
    });

    context("with .. segments", () => {
        it("should throw EINVAL for path with double dot segment", () => {
            try {
                validatePath("/foo/../bar");
                assert.fail("should have thrown");
            } catch (e) {
                assertFSError(e, 'EINVAL');
            }
        });

        it("should throw EINVAL for path starting with double dot", () => {
            try {
                validatePath("/../foo");
                assert.fail("should have thrown");
            } catch (e) {
                assertFSError(e, 'EINVAL');
            }
        });
    });

    context("with type constraint 'folder'", () => {
        it("should not throw for valid folder path", () => {
            assert.doesNotThrow(() => validatePath("/foo/bar/", "folder"));
        });

        it("should not throw for root path", () => {
            assert.doesNotThrow(() => validatePath("/", "folder"));
        });

        it("should throw EINVAL for file path", () => {
            try {
                validatePath("/foo/bar", "folder");
                assert.fail("should have thrown");
            } catch (e) {
                assertFSError(e, 'EINVAL');
            }
        });

        it("should throw EINVAL for file path with extension", () => {
            try {
                validatePath("/foo/bar.txt", "folder");
                assert.fail("should have thrown");
            } catch (e) {
                assertFSError(e, 'EINVAL');
            }
        });
    });

    context("with type constraint 'file'", () => {
        it("should not throw for valid file path", () => {
            assert.doesNotThrow(() => validatePath("/foo/bar.txt", "file"));
        });

        it("should not throw for file path without extension", () => {
            assert.doesNotThrow(() => validatePath("/foo/bar", "file"));
        });

        it("should throw EINVAL for folder path", () => {
            try {
                validatePath("/foo/bar/", "file");
                assert.fail("should have thrown");
            } catch (e) {
                assertFSError(e, 'EINVAL');
            }
        });

        it("should throw EINVAL for root path", () => {
            try {
                validatePath("/", "file");
                assert.fail("should have thrown");
            } catch (e) {
                assertFSError(e, 'EINVAL');
            }
        });
    });
});

describe("getParentPath", () => {
    context("with file paths", () => {
        it("should return root for file in root", () => {
            assert.strictEqual(getParentPath("/foo.txt"), "/");
        });

        it("should return parent folder for nested file", () => {
            assert.strictEqual(getParentPath("/foo/bar.txt"), "/foo/");
        });

        it("should return parent folder for deeply nested file", () => {
            assert.strictEqual(getParentPath("/a/b/c/d.txt"), "/a/b/c/");
        });
    });

    context("with folder paths", () => {
        it("should return root for folder in root", () => {
            assert.strictEqual(getParentPath("/foo/"), "/");
        });

        it("should return parent folder for nested folder", () => {
            assert.strictEqual(getParentPath("/foo/bar/"), "/foo/");
        });

        it("should return parent folder for deeply nested folder", () => {
            assert.strictEqual(getParentPath("/a/b/c/"), "/a/b/");
        });
    });

    context("with root path", () => {
        it("should return root for root path", () => {
            assert.strictEqual(getParentPath("/"), "/");
        });
    });
});

describe("getBaseName", () => {
    context("with file paths", () => {
        it("should return file name for file in root", () => {
            assert.strictEqual(getBaseName("/foo.txt"), "foo.txt");
        });

        it("should return file name for nested file", () => {
            assert.strictEqual(getBaseName("/foo/bar.txt"), "bar.txt");
        });

        it("should return file name for deeply nested file", () => {
            assert.strictEqual(getBaseName("/a/b/c/d.txt"), "d.txt");
        });
    });

    context("with folder paths", () => {
        it("should return folder name without trailing slash", () => {
            assert.strictEqual(getBaseName("/foo/"), "foo");
        });

        it("should return folder name for nested folder", () => {
            assert.strictEqual(getBaseName("/foo/bar/"), "bar");
        });

        it("should return folder name for deeply nested folder", () => {
            assert.strictEqual(getBaseName("/a/b/c/"), "c");
        });
    });

    context("with root path", () => {
        it("should return empty string for root", () => {
            assert.strictEqual(getBaseName("/"), "");
        });
    });

    context("with paths without trailing slash", () => {
        it("should return the segment name", () => {
            assert.strictEqual(getBaseName("/foo"), "foo");
        });

        it("should return last segment for nested path", () => {
            assert.strictEqual(getBaseName("/foo/bar"), "bar");
        });
    });
});

describe("joinPath", () => {
    context("basic joining", () => {
        it("should join simple path segments", () => {
            assert.strictEqual(joinPath("/home", "user", "file.txt"), "/home/user/file.txt");
        });

        it("should preserve trailing slash for folders", () => {
            assert.strictEqual(joinPath("/", "foo/bar/"), "/foo/bar/");
        });

        it("should handle single segment", () => {
            assert.strictEqual(joinPath("/", "foo"), "/foo");
        });

        it("should handle segment with nested path", () => {
            assert.strictEqual(joinPath("/home", "user/docs/file.txt"), "/home/user/docs/file.txt");
        });
    });

    context("with absolute paths in segments", () => {
        it("should reset to base when encountering absolute path", () => {
            assert.strictEqual(joinPath("/home", "/etc", "passwd"), "/home/etc/passwd");
        });

        it("should handle multiple absolute paths", () => {
            assert.strictEqual(joinPath("/base", "/a", "/b", "c"), "/base/b/c");
        });

        it("should reset to base for absolute path at start", () => {
            assert.strictEqual(joinPath("/home", "/usr/local"), "/home/usr/local");
        });
    });

    context("with . segments", () => {
        it("should ignore single . segment", () => {
            assert.strictEqual(joinPath("/home", ".", "user"), "/home/user");
        });

        it("should ignore . in path string", () => {
            assert.strictEqual(joinPath("/home", "./user"), "/home/user");
        });

        it("should handle multiple . segments", () => {
            assert.strictEqual(joinPath("/home", ".", ".", "user"), "/home/user");
        });

        it("should ignore . in middle of path", () => {
            assert.strictEqual(joinPath("/home", "a/./b"), "/home/a/b");
        });
    });

    context("with .. segments", () => {
        it("should navigate to parent directory", () => {
            assert.strictEqual(joinPath("/home", "user", "..", "other"), "/home/other");
        });

        it("should handle .. in path string", () => {
            assert.strictEqual(joinPath("/home", "a/b/../c"), "/home/a/c");
        });

        it("should handle multiple .. segments", () => {
            assert.strictEqual(joinPath("/home", "a/b/c", "..", ".."), "/home/a/");
        });

        it("should not escape above base", () => {
            assert.strictEqual(joinPath("/home", "..", ".."), "/home/");
        });

        it("should not escape above base with leading absolute path", () => {
            assert.strictEqual(joinPath("/home", "/../../../etc"), "/home/etc");
        });

        it("should not escape above base when .. is in relative segment", () => {
            // base is /home/user, so .. cannot escape above it
            assert.strictEqual(joinPath("/home/user", "../other"), "/home/user/other");
        });

        it("should allow .. within segments added after base", () => {
            // Navigate into "sub" then back out with ".." to "other"
            assert.strictEqual(joinPath("/home", "sub", "..", "other"), "/home/other");
        });
    });

    context("edge cases", () => {
        it("should return base as folder when no segments", () => {
            assert.strictEqual(joinPath("/home"), "/home/");
        });

        it("should handle base with trailing slash", () => {
            assert.strictEqual(joinPath("/home/", "user"), "/home/user");
        });

        it("should handle empty string segment", () => {
            assert.strictEqual(joinPath("/home", "", "user"), "/home/user");
        });

        it("should handle complex mixed paths", () => {
            assert.strictEqual(joinPath("/a", "b/c", "../d", "./e", "f"), "/a/b/d/e/f");
        });

        it("should handle trailing slash in segment", () => {
            assert.strictEqual(joinPath("/home", "user/"), "/home/user/");
        });

        it("should handle root as base", () => {
            assert.strictEqual(joinPath("/", "a", "b"), "/a/b");
        });
    });
});
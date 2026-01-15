import 'fake-indexeddb/auto';
import { assert } from 'chai';

import { LiteFS } from "./index.ts";
import { FSError, isFSError } from "../error.ts";

describe('FileOps', () => {
    let fs: LiteFS;
    let dbName: string;

    beforeEach(() => {
        dbName = `test-fs-${Date.now()}-${Math.random()}`;
        fs = new LiteFS(dbName);
    });

    describe('writeFile', () => {
        context('with string content', () => {
            it('should write a text file successfully', async () => {
                await fs.writeFile('/hello.txt', 'Hello, world!');
                const content = await fs.readFile('/hello.txt', 'utf-8');
                assert.strictEqual(content, 'Hello, world!');
            });

            it('should handle empty string', async () => {
                await fs.writeFile('/empty.txt', '');
                const content = await fs.readFile('/empty.txt', 'utf-8');
                assert.strictEqual(content, '');
            });

            it('should handle unicode content', async () => {
                const unicode = '你好世界 🌍 émojis';
                await fs.writeFile('/unicode.txt', unicode);
                const content = await fs.readFile('/unicode.txt', 'utf-8');
                assert.strictEqual(content, unicode);
            });

            it('should overwrite existing file', async () => {
                await fs.writeFile('/test.txt', 'First content');
                await fs.writeFile('/test.txt', 'Second content');
                const content = await fs.readFile('/test.txt', 'utf-8');
                assert.strictEqual(content, 'Second content');
            });
        });

        context('with Uint8Array content', () => {
            it('should write binary data', async () => {
                const data = new Uint8Array([0, 1, 2, 255, 128, 64]);
                await fs.writeFile('/binary.bin', data);
                const content = await fs.readFile('/binary.bin');
                assert.deepEqual(new Uint8Array(content), data);
            });

            it('should handle empty Uint8Array', async () => {
                const data = new Uint8Array([]);
                await fs.writeFile('/empty.bin', data);
                const content = await fs.readFile('/empty.bin');
                assert.strictEqual(content.length, 0);
            });
        });

        context('with nested paths', () => {
            it('should create parent directories automatically', async () => {
                await fs.writeFile('/a/b/c/deep.txt', 'Deep content');
                const content = await fs.readFile('/a/b/c/deep.txt', 'utf-8');
                assert.strictEqual(content, 'Deep content');
            });

            it('should write multiple files in same directory', async () => {
                await fs.writeFile('/dir/file1.txt', 'Content 1');
                await fs.writeFile('/dir/file2.txt', 'Content 2');
                
                const content1 = await fs.readFile('/dir/file1.txt', 'utf-8');
                const content2 = await fs.readFile('/dir/file2.txt', 'utf-8');
                
                assert.strictEqual(content1, 'Content 1');
                assert.strictEqual(content2, 'Content 2');
            });
        });

        context('with invalid paths', () => {
            it('should throw EINVAL for relative path', async () => {
                try {
                    await fs.writeFile('relative.txt', 'content');
                    assert.fail('Expected FSError to be thrown');
                } catch (err) {
                    assert.isTrue(isFSError(err, 'EINVAL'));
                }
            });

            it('should throw EINVAL for path ending with /', async () => {
                try {
                    await fs.writeFile('/folder/', 'content');
                    assert.fail('Expected FSError to be thrown');
                } catch (err) {
                    assert.isTrue(isFSError(err, 'EINVAL'));
                }
            });

            it('should throw EINVAL for path with empty segments', async () => {
                try {
                    await fs.writeFile('/foo//bar.txt', 'content');
                    assert.fail('Expected FSError to be thrown');
                } catch (err) {
                    assert.isTrue(isFSError(err, 'EINVAL'));
                }
            });

            it('should throw EINVAL for path with . segment', async () => {
                try {
                    await fs.writeFile('/foo/./bar.txt', 'content');
                    assert.fail('Expected FSError to be thrown');
                } catch (err) {
                    assert.isTrue(isFSError(err, 'EINVAL'));
                }
            });

            it('should throw EINVAL for path with .. segment', async () => {
                try {
                    await fs.writeFile('/foo/../bar.txt', 'content');
                    assert.fail('Expected FSError to be thrown');
                } catch (err) {
                    assert.isTrue(isFSError(err, 'EINVAL'));
                }
            });
        });

        context('when path conflicts with existing entry', () => {
            it('should throw ENOTDIR if parent path is a file', async () => {
                await fs.writeFile('/file.txt', 'content');
                try {
                    await fs.writeFile('/file.txt/nested.txt', 'nested');
                    assert.fail('Expected FSError to be thrown');
                } catch (err) {
                    assert.isTrue(isFSError(err, 'ENOTDIR'));
                }
            });
        });
    });

    describe('readFile', () => {
        context('without encoding', () => {
            it('should return Uint8Array for text file', async () => {
                await fs.writeFile('/test.txt', 'Hello');
                const content = await fs.readFile('/test.txt');
                assert.instanceOf(content, Uint8Array);
            });

            it('should return Uint8Array for binary file', async () => {
                const data = new Uint8Array([1, 2, 3]);
                await fs.writeFile('/test.bin', data);
                const content = await fs.readFile('/test.bin');
                assert.instanceOf(content, Uint8Array);
                assert.deepEqual(new Uint8Array(content), data);
            });
        });

        context('with utf-8 encoding', () => {
            it('should return string', async () => {
                await fs.writeFile('/test.txt', 'Hello, world!');
                const content = await fs.readFile('/test.txt', 'utf-8');
                assert.isString(content);
                assert.strictEqual(content, 'Hello, world!');
            });

            it('should decode binary data as utf-8', async () => {
                const text = 'UTF-8 text';
                const encoder = new TextEncoder();
                await fs.writeFile('/test.txt', encoder.encode(text));
                const content = await fs.readFile('/test.txt', 'utf-8');
                assert.strictEqual(content, text);
            });
        });

        context('when file does not exist', () => {
            it('should throw ENOENT', async () => {
                try {
                    await fs.readFile('/nonexistent.txt');
                    assert.fail('Expected FSError to be thrown');
                } catch (err) {
                    assert.isTrue(isFSError(err, 'ENOENT'));
                    assert.strictEqual((err as FSError).path, '/nonexistent.txt');
                }
            });

            it('should throw ENOENT for nested nonexistent path', async () => {
                try {
                    await fs.readFile('/a/b/c/nonexistent.txt');
                    assert.fail('Expected FSError to be thrown');
                } catch (err) {
                    assert.isTrue(isFSError(err, 'ENOENT'));
                }
            });
        });

        context('with invalid paths', () => {
            it('should throw EINVAL for relative path', async () => {
                try {
                    await fs.readFile('relative.txt');
                    assert.fail('Expected FSError to be thrown');
                } catch (err) {
                    assert.isTrue(isFSError(err, 'EINVAL'));
                }
            });

            it('should throw EINVAL for path with empty segments', async () => {
                try {
                    await fs.readFile('/foo//bar.txt');
                    assert.fail('Expected FSError to be thrown');
                } catch (err) {
                    assert.isTrue(isFSError(err, 'EINVAL'));
                }
            });
        });

        context('when path is a directory', () => {
            it('should throw EINVAL for folder path (paths ending with /)', async () => {
                await fs.writeFile('/dir/file.txt', 'content');
                try {
                    await fs.readFile('/dir/');
                    assert.fail('Expected FSError to be thrown');
                } catch (err) {
                    // Folder paths (ending with /) are invalid for file operations
                    assert.isTrue(isFSError(err, 'EINVAL'));
                }
            });
        });
    });

    describe('readFile and writeFile integration', () => {
        context('round-trip data integrity', () => {
            it('should preserve string content exactly', async () => {
                const original = 'Line 1\nLine 2\r\nLine 3\tTabbed';
                await fs.writeFile('/test.txt', original);
                const retrieved = await fs.readFile('/test.txt', 'utf-8');
                assert.strictEqual(retrieved, original);
            });

            it('should preserve binary content exactly', async () => {
                const original = new Uint8Array(256);
                for (let i = 0; i < 256; i++) {
                    original[i] = i;
                }
                await fs.writeFile('/all-bytes.bin', original);
                const retrieved = await fs.readFile('/all-bytes.bin');
                assert.deepEqual(new Uint8Array(retrieved), original);
            });

            it('should handle large files', async () => {
                const size = 1024 * 1024; // 1MB
                const original = new Uint8Array(size);
                for (let i = 0; i < size; i++) {
                    original[i] = i % 256;
                }
                await fs.writeFile('/large.bin', original);
                const retrieved = await fs.readFile('/large.bin');
                assert.strictEqual(retrieved.length, size);
                assert.deepEqual(new Uint8Array(retrieved), original);
            });
        });

        context('multiple file operations', () => {
            it('should handle many files in root', async () => {
                const count = 100;
                for (let i = 0; i < count; i++) {
                    await fs.writeFile(`/file${i}.txt`, `Content ${i}`);
                }
                for (let i = 0; i < count; i++) {
                    const content = await fs.readFile(`/file${i}.txt`, 'utf-8');
                    assert.strictEqual(content, `Content ${i}`);
                }
            });

            it('should handle deep nested structure', async () => {
                const paths = [
                    '/a/file.txt',
                    '/a/b/file.txt',
                    '/a/b/c/file.txt',
                    '/a/b/c/d/file.txt',
                    '/a/b/c/d/e/file.txt',
                ];
                for (const path of paths) {
                    await fs.writeFile(path, `Content at ${path}`);
                }
                for (const path of paths) {
                    const content = await fs.readFile(path, 'utf-8');
                    assert.strictEqual(content, `Content at ${path}`);
                }
            });
        });
    });
});
import 'fake-indexeddb/auto';

import { assert } from 'chai';
import { deleteDB, openDB, type IDBPDatabase } from 'idb';

import { isFSError } from "../../error.ts";

import { STORE_NAME, INDEX_BY_PARENT } from "./const.ts";
import type { DBFileEntry, DBFolderEntry, DBEntry, } from "./db-entry.ts";
import { now, ensureParentDirs } from "./db-entry.ts";

describe('ensureParentDirs', () => {
    const DB_NAME = 'test-ensure-parent-dirs';
    let db: IDBPDatabase;

    beforeEach(async () => {
        db = await openDB(DB_NAME, 1, {
            upgrade(db) {
                const store = db.createObjectStore(STORE_NAME);
                store.createIndex(INDEX_BY_PARENT, 'parent', { unique: false });
            },
        });
    });

    afterEach(async () => {
        db.close();
        await deleteDB(DB_NAME);
    });

    context('when parent directories do not exist', () => {
        it('should create a single parent directory', async () => {
            await ensureParentDirs(db, '/foo/bar.txt');

            const entry = await db.get(STORE_NAME, '/foo/');
            assert.isNotNull(entry);
            assert.strictEqual(entry.type, 'folder');
            assert.strictEqual(entry.parent, '/');
        });

        it('should create multiple nested parent directories', async () => {
            await ensureParentDirs(db, '/a/b/c/file.txt');

            const entryA = await db.get(STORE_NAME, '/a/');
            const entryB = await db.get(STORE_NAME, '/a/b/');
            const entryC = await db.get(STORE_NAME, '/a/b/c/');

            assert.isNotNull(entryA);
            assert.strictEqual(entryA.type, 'folder');
            assert.strictEqual(entryA.parent, '/');

            assert.isNotNull(entryB);
            assert.strictEqual(entryB.type, 'folder');
            assert.strictEqual(entryB.parent, '/a/');

            assert.isNotNull(entryC);
            assert.strictEqual(entryC.type, 'folder');
            assert.strictEqual(entryC.parent, '/a/b/');
        });

        it('should set mtime on created directories', async () => {
            const before = now();
            await ensureParentDirs(db, '/foo/bar.txt');
            const after = now();

            const entry: DBFolderEntry = await db.get(STORE_NAME, '/foo/');
            assert.isAtLeast(entry.mtime, before);
            assert.isAtMost(entry.mtime, after);
        });
    });

    context('when parent directories already exist', () => {
        it('should not modify existing folder', async () => {
            const existingEntry: DBFolderEntry = {
                type: 'folder',
                parent: '/',
                mtime: 1000,
            };
            await db.put(STORE_NAME, existingEntry, '/foo/');

            await ensureParentDirs(db, '/foo/bar.txt');

            const entry: DBFolderEntry = await db.get(STORE_NAME, '/foo/');
            assert.strictEqual(entry.mtime, 1000);
        });

        it('should create only missing directories in a partial path', async () => {
            const existingEntry: DBFolderEntry = {
                type: 'folder',
                parent: '/',
                mtime: 1000,
            };
            await db.put(STORE_NAME, existingEntry, '/a/');

            await ensureParentDirs(db, '/a/b/c/file.txt');

            const entryA: DBFolderEntry = await db.get(STORE_NAME, '/a/');
            assert.strictEqual(entryA.mtime, 1000);

            const entryB = await db.get(STORE_NAME, '/a/b/');
            assert.isNotNull(entryB);
            assert.strictEqual(entryB.type, 'folder');

            const entryC = await db.get(STORE_NAME, '/a/b/c/');
            assert.isNotNull(entryC);
            assert.strictEqual(entryC.type, 'folder');
        });
    });

    context('when a file exists in the path', () => {
        it('should throw ENOTDIR when a file blocks the path', async () => {
            const fileEntry: DBFileEntry = {
                type: 'file',
                content: new Uint8Array([1, 2, 3]),
                parent: '/',
                mtime: now(),
            };
            await db.put(STORE_NAME, fileEntry, '/foo');

            try {
                await ensureParentDirs(db, '/foo/bar.txt');
                assert.fail('Expected ENOTDIR error');
            } catch (err) {
                assert.isTrue(isFSError(err, 'ENOTDIR'));
                if (isFSError(err, 'ENOTDIR')) {
                    assert.strictEqual(err.path, '/foo');
                    assert.strictEqual(err.syscall, 'mkdir');
                }
            }
        });

        it('should throw ENOTDIR when a file blocks a nested path', async () => {
            const folderEntry: DBFolderEntry = {
                type: 'folder',
                parent: '/',
                mtime: now(),
            };
            await db.put(STORE_NAME, folderEntry, '/a/');

            const fileEntry: DBFileEntry = {
                type: 'file',
                content: new Uint8Array(),
                parent: '/a/',
                mtime: now(),
            };
            await db.put(STORE_NAME, fileEntry, '/a/b');

            try {
                await ensureParentDirs(db, '/a/b/c/file.txt');
                assert.fail('Expected ENOTDIR error');
            } catch (err) {
                assert.isTrue(isFSError(err, 'ENOTDIR'));
                if (isFSError(err, 'ENOTDIR')) {
                    assert.strictEqual(err.path, '/a/b');
                }
            }
        });
    });

    context('when entry exists but is not a folder', () => {
        it('should throw ENOTDIR for non-folder entry at folder path', async () => {
            // Simulate a corrupted or unexpected entry type at a folder path
            const badEntry: DBEntry = {
                type: 'file',
                content: new Uint8Array(),
                parent: '/',
                mtime: now(),
            };
            await db.put(STORE_NAME, badEntry, '/foo/');

            try {
                await ensureParentDirs(db, '/foo/bar.txt');
                assert.fail('Expected ENOTDIR error');
            } catch (err) {
                assert.isTrue(isFSError(err, 'ENOTDIR'));
                if (isFSError(err, 'ENOTDIR')) {
                    assert.strictEqual(err.path, '/foo/');
                }
            }
        });
    });

    context('edge cases', () => {
        it('should handle file directly in root (no parent dirs needed)', async () => {
            await ensureParentDirs(db, '/file.txt');

            const keys = await db.getAllKeys(STORE_NAME);
            assert.isEmpty(keys);
        });

        it('should handle deeply nested paths', async () => {
            await ensureParentDirs(db, '/a/b/c/d/e/f/g/file.txt');

            const paths = ['/a/', '/a/b/', '/a/b/c/', '/a/b/c/d/', '/a/b/c/d/e/', '/a/b/c/d/e/f/', '/a/b/c/d/e/f/g/'];
            for (const path of paths) {
                const entry = await db.get(STORE_NAME, path);
                assert.isNotNull(entry, `Expected folder at ${path}`);
                assert.strictEqual(entry.type, 'folder');
            }
        });

        it('should not create the file itself', async () => {
            await ensureParentDirs(db, '/foo/bar.txt');

            const fileEntry = await db.get(STORE_NAME, '/foo/bar.txt');
            assert.isUndefined(fileEntry);
        });
    });
});
import 'fake-indexeddb/auto';

import {assert} from 'chai';
import {deleteDB, openDB, type IDBPDatabase} from 'idb';

import {assertFSError, isFSError} from "../../error.ts";

import {STORE_NAME, INDEX_BY_PARENT} from "./const.ts";
import type {DBFileEntry, DBFolderEntry} from "./db-entry.ts";
import {now, ensureParentDirs, createDBFolderEntry, putEntryByPath, getEntryByPath, createDBFileEntry} from "./db-entry.ts";
import type {AbsoluteFolderPath} from '../../path.ts';

describe('ensureParentDirs', () => {
    const DB_NAME = 'test-ensure-parent-dirs';
    let db: IDBPDatabase;

    beforeEach(async () => {
        db = await openDB(DB_NAME, 1, {
            upgrade(db) {
                const store = db.createObjectStore(STORE_NAME);
                store.createIndex(INDEX_BY_PARENT, 'parent', {unique: false});
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

            const entry = await getEntryByPath(db, "/foo/");
            assert.isNotNull(entry);
            assert.strictEqual(entry.type, 'folder');
            assert.strictEqual(entry.parent, '/');
        });

        it('should create multiple nested parent directories', async () => {
            await ensureParentDirs(db, '/a/b/c/file.txt');

            const entryA = await getEntryByPath(db, "/a/");
            const entryB = await getEntryByPath(db, "/a/b/");
            const entryC = await getEntryByPath(db, "/a/b/c/");

            assert.isNotNull(entryA);
            assert.strictEqual(entryA.type, 'folder');
            assert.strictEqual(entryA.parent, '/');

            assert.isNotNull(entryB);
            assert.strictEqual(entryB.type, 'folder');
            assert.strictEqual(entryB.parent, '/a');

            assert.isNotNull(entryC);
            assert.strictEqual(entryC.type, 'folder');
            assert.strictEqual(entryC.parent, '/a/b');
        });

        it('should set mtime on created directories', async () => {
            const before = now();
            await ensureParentDirs(db, '/foo/bar.txt');
            const after = now();

            const entry = await getEntryByPath(db, "/foo/");
            assert.isNotNull(entry);
            assert.isAtLeast(entry.mtime, before);
            assert.isAtMost(entry.mtime, after);
        });
    });

    context('when parent directories already exist', () => {
        it('should not modify existing folder', async () => {
            const existing_entry: DBFolderEntry = createDBFolderEntry("/foo/");
            existing_entry.mtime = 1000;
            await putEntryByPath(db, "/foo/", existing_entry);

            await ensureParentDirs(db, '/foo/bar.txt');

            const entry = await getEntryByPath(db, "/foo/");
            assert.isNotNull(entry);
            assert.strictEqual(entry.mtime, 1000);
        });

        it('should create only missing directories in a partial path', async () => {
            const existing_entry: DBFolderEntry = createDBFolderEntry("/a/");
            existing_entry.mtime = 1000;
            await putEntryByPath(db, "/a/", existing_entry);

            await ensureParentDirs(db, '/a/b/c/file.txt');

            const entryA = await getEntryByPath(db, "/a/");
            assert.strictEqual(entryA?.mtime, 1000);

            const entryB = await getEntryByPath(db, "/a/b/");
            assert.strictEqual(entryB?.type, 'folder');

            const entryC = await getEntryByPath(db, "/a/b/c/");
            assert.strictEqual(entryC?.type, 'folder');
        });
    });

    context('when a file exists in the path', () => {
        it('should throw ENOTDIR when a file blocks the path', async () => {
            const file_entry: DBFileEntry = createDBFileEntry("/foo", new Uint8Array([1, 2, 3]));
            await putEntryByPath(db, "/foo", file_entry);

            try {
                await ensureParentDirs(db, '/foo/bar.txt');
                assert.fail('Expected ENOTDIR error');
            } catch (err) {
                if(!assertFSError(err, 'ENOTDIR')) {
                    assert.fail('(this fail is unreachable)');
                }

                assert.strictEqual(err.path, '/foo');
                assert.strictEqual(err.syscall, 'mkdir');
            }
        });

        it('should throw ENOTDIR when a file blocks a nested path', async () => {
            const folder_entry = createDBFolderEntry("/a/");
            await putEntryByPath(db, "/a/", folder_entry);

            const file_entry = createDBFileEntry("/a/b", new Uint8Array());
            await putEntryByPath(db, "/a/b", file_entry);

            try {
                await ensureParentDirs(db, '/a/b/c/file.txt');
                assert.fail('Expected ENOTDIR error');
            } catch (err) {
                assertFSError(err, 'ENOTDIR');
                if(isFSError(err, 'ENOTDIR')) {
                    assert.strictEqual(err.path, '/a/b');
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

            const paths: AbsoluteFolderPath[] = ['/a/', '/a/b/', '/a/b/c/', '/a/b/c/d/', '/a/b/c/d/e/', '/a/b/c/d/e/f/', '/a/b/c/d/e/f/g/'];
            for(const path of paths) {
                const entry = await getEntryByPath(db, path);
                assert.isNotNull(entry, `Expected folder at ${path}`);
                assert.strictEqual(entry.type, 'folder');
            }
        });

        it('should not create the file itself', async () => {
            await ensureParentDirs(db, '/foo/bar.txt');

            const file_entry = await getEntryByPath(db, "/foo/bar.txt");
            assert.isNull(file_entry);
        });
    });
});

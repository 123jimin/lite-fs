import { deleteDB, openDB, type IDBPDatabase } from "idb";

export const STORE_NAME = 'entries';
export const INDEX_BY_PARENT = 'by-parent';

export type DBTimeStamp = number;

export function now(): DBTimeStamp {
    return Date.now();
}

export interface DBFileEntry {
    type: 'file';
    content: Uint8Array;
    parent: string;
    mtime: DBTimeStamp;
}

export interface DBFolderEntry {
    type: 'folder';
    parent: string;
    mtime: DBTimeStamp;
}

export type DBEntry = DBFileEntry | DBFolderEntry;

export interface FSCore {
    getDB(): Promise<IDBPDatabase>;
    reset(): Promise<void>;
}

export function createFSCore(db_name: string): FSCore {
    let db_promise: Promise<IDBPDatabase> | null = null;

    return {
        getDB() {
            if (!db_promise) {
                db_promise = openDB(db_name, 1, {
                    upgrade(db) {
                        const store = db.createObjectStore(STORE_NAME);
                        store.createIndex(INDEX_BY_PARENT, 'parent', { unique: false });
                    },
                });
            }
            return db_promise;
        },
        async reset() {
            if(db_promise) {
                const db = await db_promise;
                db.close();
                db_promise = null;
            }
            await deleteDB(db_name);
        },
    };
}
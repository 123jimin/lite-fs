import { deleteDB, openDB, type IDBPDatabase } from "idb";
import { INDEX_BY_PARENT, STORE_NAME } from "./const.ts";
import type { DBEntry } from "./db-entry.ts";

export interface FSCore {
    getDB(): Promise<IDBPDatabase>;
    dumpFiles(): Promise<Array<[path: string, content: Uint8Array]>>;
    reset(): Promise<void>;
}

export function createFSCore(db_name: string): FSCore {
    let db_promise: Promise<IDBPDatabase> | null = null;

    const getDB = (): Promise<IDBPDatabase> => {
        if (!db_promise) {
            db_promise = openDB(db_name, 1, {
                upgrade(db) {
                    const store = db.createObjectStore(STORE_NAME);
                    store.createIndex(INDEX_BY_PARENT, 'parent', { unique: false });
                },
            });
        }
        return db_promise;
    };

    return {
        getDB,
        async dumpFiles(): Promise<Array<[path: string, content: Uint8Array]>> {
            const db = await getDB();
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);

            const out: Array<[path: string, content: Uint8Array]> = [];
            for (let cursor = await store.openCursor(); cursor; cursor = await cursor.continue()) {
                const key = cursor.key.toString();
                const value = cursor.value as DBEntry;
                if(value.type !== 'file') continue;
                out.push([key, value.content]);
            }

            await tx.done;
            return out;
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
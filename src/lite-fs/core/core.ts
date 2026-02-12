import {deleteDB, openDB, type IDBPDatabase} from "idb";
import {INDEX_BY_PARENT, STORE_NAME} from "./const.ts";
import type {DBEntry} from "./db-entry.ts";
import type {FSBuffer, WatchEvent} from "../../api/index.ts";

export type WatchCallback = (event: WatchEvent) => void;

export interface FSCore {
    getDB(): Promise<IDBPDatabase>;
    dumpFiles(): Promise<Array<[path: string, content: FSBuffer]>>;
    reset(): Promise<void>;

    emit(event: WatchEvent): void;
    subscribe(callback: WatchCallback): () => void;
}

export function createFSCore(db_name: string): FSCore {
    let db_promise: Promise<IDBPDatabase> | null = null;
    const subscribers = new Set<WatchCallback>();

    const getDB = (): Promise<IDBPDatabase> => {
        if(!db_promise) {
            db_promise = openDB(db_name, 1, {
                upgrade(db) {
                    const store = db.createObjectStore(STORE_NAME);
                    store.createIndex(INDEX_BY_PARENT, 'parent', {unique: false});
                },
            });
        }
        return db_promise;
    };

    return {
        getDB,
        async dumpFiles(): Promise<Array<[path: string, content: FSBuffer]>> {
            const db = await getDB();
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);

            const out: Array<[path: string, content: FSBuffer]> = [];
            for(let cursor = await store.openCursor(); cursor; cursor = await cursor.continue()) {
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
                const local_db_promise = db_promise;
                db_promise = null;

                const db = await local_db_promise;
                db.close();
            }
            await deleteDB(db_name);
        },
        emit(event: WatchEvent): void {
            for(const callback of subscribers) {
                try {
                    callback(event);
                } catch{
                    /* do nothing */
                }
            }
        },
        subscribe(callback: WatchCallback): () => void {
            subscribers.add(callback);
            return () => {
                subscribers.delete(callback);
            };
        },
    };
}

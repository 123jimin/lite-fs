export type {RemoveOps} from "../api/remove-ops.ts";
import type {RemoveOps, RmOptions} from "../api/remove-ops.ts";

import {FSError} from "../error.ts";
import {isFolderPath, validatePath} from "../path.ts";
import {STORE_NAME, toStoragePath, type FSCore, type DBEntry, INDEX_BY_PARENT, type StoragePath} from "./core/index.ts";

export function createRemoveOps(core: FSCore): RemoveOps {
    return {
        async unlink(in_path: string): Promise<void> {
            const path = validatePath(in_path, "file");

            const db = await core.getDB();
            const key = toStoragePath(path);

            const tx = db.transaction(STORE_NAME, "readwrite");

            const entry = (await tx.store.get(key)) as DBEntry | undefined;

            if(entry == null) {
                tx.abort();
                throw FSError.ENOENT(path, "unlink");
            }

            if(entry.type !== "file") {
                tx.abort();
                throw FSError.EISDIR(path, "unlink");
            }

            await tx.store.delete(key);
            await tx.done;

            core.emit({eventType: 'rename', filename: path});
        },
        async rm(in_path: string, options?: RmOptions): Promise<void> {
            const path = validatePath(in_path);

            if(path === "/") {
                throw FSError.EINVAL(path, "rm");
            }

            const db = await core.getDB();

            if(!isFolderPath(path)) {
                const file_key = toStoragePath(path);

                const tx = db.transaction(STORE_NAME, "readwrite");

                const entry = (await tx.store.get(file_key)) as DBEntry | undefined;

                if(entry == null) {
                    if(options?.force) {
                        await tx.done;
                        return;
                    }

                    tx.abort();
                    throw FSError.ENOENT(path, "rm");
                }

                if(entry.type !== "file") {
                    tx.abort();
                    throw FSError.EISDIR(path, "rm");
                }

                await tx.store.delete(file_key);
                await tx.done;

                core.emit({eventType: 'rename', filename: path});
                return;
            }

            const dir_key = toStoragePath(path);

            const tx = db.transaction(STORE_NAME, "readwrite");
            const index = tx.store.index(INDEX_BY_PARENT);

            const entry = (await tx.store.get(dir_key)) as DBEntry | undefined;

            if(entry == null) {
                if(options?.force) {
                    await tx.done;
                    return;
                }
                tx.abort();
                throw FSError.ENOENT(path, "rm");
            }

            if(entry.type !== "folder") {
                tx.abort();
                throw FSError.ENOTDIR(path, "rm");
            }

            if(!options?.recursive) {
                const first_child = await index.openCursor(dir_key);
                if(first_child) {
                    tx.abort();
                    throw FSError.ENOTEMPTY(path, "rm");
                }

                await tx.store.delete(dir_key);
                await tx.done;

                core.emit({eventType: 'rename', filename: path});
                return;
            }

            const stack: StoragePath[] = [dir_key];
            const keys_to_delete: string[] = [dir_key];

            while(stack.length > 0) {
                const parent = stack.pop()!;

                let cursor = await index.openCursor(parent);
                while(cursor) {
                    const key = cursor.primaryKey as string;
                    const child = cursor.value as DBEntry;

                    keys_to_delete.push(key);
                    if(child.type === "folder") {
                        stack.push(key as StoragePath);
                    }

                    cursor = await cursor.continue();
                }
            }

            for(const key_to_delete of keys_to_delete) {
                await tx.store.delete(key_to_delete);
            }

            await tx.done;

            // Emit watch event for top-level path only.
            core.emit({eventType: 'rename', filename: path});
            return;
        },
    };
}

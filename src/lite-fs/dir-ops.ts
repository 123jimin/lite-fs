export type {DirOps} from "../api/dir-ops.ts";
import type {DirOps, Dirent, MkdirOptions} from "../api/dir-ops.ts";

import {FSError} from "../error.ts";
import {getBaseName, getParentPath, validatePath, type AbsoluteFolderPath} from "../path.ts";
import {
    INDEX_BY_PARENT,
    STORE_NAME,
    createDBFolderEntry,
    ensureParentDirs,
    getEntryByPath,
    putEntryByPath,
    toStoragePath,
    fromFolderStoragePath,
    type DBEntry,
    type FSCore,
} from "./core/index.ts";

function createDirent(entry: DBEntry, name: string): Dirent {
    const is_file = entry.type === 'file';
    return {
        isFile: () => is_file,
        isDirectory: () => !is_file,
        parentPath: fromFolderStoragePath(entry.parent),
        name,
    };
}

export function createDirOps(core: FSCore): DirOps {
    async function mkdir(in_path: string, options?: MkdirOptions): Promise<void> {
        const path = validatePath(in_path, 'folder');
        if(path === '/') {
            return;
        }

        const db = await core.getDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');

        const existing = await getEntryByPath(tx.store, path);

        if(existing) {
            if(options?.recursive && existing.type === 'folder') {
                return;
            }
            tx.abort();
            throw FSError.EEXIST(path, 'mkdir');
        }

        let created_parents: AbsoluteFolderPath[] = [];

        if(options?.recursive) {
            created_parents = await ensureParentDirs(tx.store, path);
        } else {
            // Non-recursive: parent must exist.
            const parent_path = getParentPath(path);
            if(parent_path !== '/') {
                const parent = await getEntryByPath(tx.store, parent_path);
                if(!parent) {
                    tx.abort();
                    throw FSError.ENOENT(parent_path, 'mkdir');
                }
                if(parent.type !== 'folder') {
                    tx.abort();
                    throw FSError.ENOTDIR(parent_path.slice(0, -1), 'mkdir');
                }
            }
        }

        const entry = createDBFolderEntry(path);
        await putEntryByPath(tx.store, path, entry);

        await tx.done;

        for(const dir of created_parents) {
            core.emit({eventType: 'rename', filename: dir});
        }
        core.emit({eventType: 'rename', filename: path});
    }

    async function readdir(path: string): Promise<string[]>;
    async function readdir(path: string, options: {withFileTypes: true}): Promise<Dirent[]>;
    async function readdir(in_path: string, options?: {withFileTypes: true}): Promise<string[] | Dirent[]> {
        const path = validatePath(in_path, 'folder');

        const db = await core.getDB();
        const tx = db.transaction(STORE_NAME, 'readonly');

        // Check directory exists.
        if(path !== '/') {
            const dir_entry = await getEntryByPath(tx.store, path);
            if(!dir_entry) {
                throw FSError.ENOENT(path, 'readdir');
            }
            if(dir_entry.type !== 'folder') {
                throw FSError.ENOTDIR(path, 'readdir');
            }
        }

        // Query children by parent index.
        const storage_path = toStoragePath(path);
        const index = tx.store.index(INDEX_BY_PARENT);

        const results: Array<{name: string; entry: DBEntry}> = [];

        let cursor = await index.openCursor(storage_path);
        while(cursor) {
            const key = cursor.primaryKey as string;
            const entry = cursor.value as DBEntry;
            const name = getBaseName(key);

            results.push({name, entry});
            cursor = await cursor.continue();
        }

        if(options?.withFileTypes) {
            return results.map(({name, entry}) => createDirent(entry, name));
        }

        return results.map(({name}) => name);
    }

    return {mkdir, readdir};
}

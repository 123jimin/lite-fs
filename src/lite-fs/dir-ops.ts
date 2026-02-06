export type { DirOps } from "../api/dir-ops.ts";
import type { DirOps, Dirent, MkdirOptions } from "../api/dir-ops.ts";

import { FSError } from "../error.ts";
import { getBaseName, getParentPath, validatePath } from "../path.ts";
import {
    createDBFolderEntry,
    ensureParentDirs,
    getEntryByPath,
    putEntryByPath,
    type DBEntry,
    type FSCore,
} from "./core/index.ts";

import { INDEX_BY_PARENT, STORE_NAME } from "./core/const.ts";
import { fromFolderStoragePath, toStoragePath } from "./core/path.ts";

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
        if (path === '/') {
            return;
        }

        const db = await core.getDB();
        const existing = await getEntryByPath(db, path);

        if (existing) {
            if (options?.recursive && existing.type === 'folder') {
                // With recursive: true, existing directory is OK.
                return;
            }
            throw FSError.EEXIST(path, 'mkdir');
        }

        if (options?.recursive) {
            const created = await ensureParentDirs(db, path);
            for (const dir of created) {
                core.emit({eventType: 'rename', filename: dir});
            }
        } else {
            // Non-recursive: parent must exist.
            const parent_path = getParentPath(path);
            if (parent_path !== '/') {
                const parent = await getEntryByPath(db, parent_path);
                if (!parent) {
                    throw FSError.ENOENT(parent_path, 'mkdir');
                }
                if (parent.type !== 'folder') {
                    throw FSError.ENOTDIR(parent_path.slice(0, -1), 'mkdir');
                }
            }
        }

        const entry = createDBFolderEntry(path);
        await putEntryByPath(db, path, entry);

        core.emit({eventType: 'rename', filename: path});
    }

    async function readdir(path: string): Promise<string[]>;
    async function readdir(path: string, options: { withFileTypes: true }): Promise<Dirent[]>;
    async function readdir(in_path: string, options?: { withFileTypes: true }): Promise<string[] | Dirent[]> {
        const path = validatePath(in_path, 'folder');

        const db = await core.getDB();
        
        // Check directory exists.
        if (path !== '/') {
            const dir_entry = await getEntryByPath(db, path);
            if (!dir_entry) {
                throw FSError.ENOENT(path, 'readdir');
            }
            if (dir_entry.type !== 'folder') {
                throw FSError.ENOTDIR(path, 'readdir');
            }
        }

        // Query children by parent index.
        const storage_path = toStoragePath(path);
        const tx = db.transaction(STORE_NAME, 'readonly');
        const index = tx.store.index(INDEX_BY_PARENT);
        
        const results: Array<{ name: string; entry: DBEntry }> = [];
        
        let cursor = await index.openCursor(storage_path);
        while (cursor) {
            const key = cursor.primaryKey as string;
            const entry = cursor.value as DBEntry;
            const name = getBaseName(key);
            
            results.push({ name, entry });
            cursor = await cursor.continue();
        }

        if (options?.withFileTypes) {
            return results.map(({ name, entry }) => createDirent(entry, name));
        }

        return results.map(({ name }) => name);
    }

    return { mkdir, readdir };
}
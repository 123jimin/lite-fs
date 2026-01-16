export type { RenameOps } from "../api/rename-ops.ts";
import type { RenameOps } from "../api/rename-ops.ts";

import { FSError } from "../error.ts";
import { getBaseName, getParentPath, isFolderPath, validatePath } from "../path.ts";
import { 
    INDEX_BY_PARENT,
    now,
    STORE_NAME,
    toStoragePath,
    type DBEntry,
    type FSCore,
    type StoragePath, 
} from "./core/index.ts";

export function createRenameOps(core: FSCore): RenameOps {
    return {
        async rename(old_in: string, new_in: string): Promise<void> {
            const old_path = validatePath(old_in);
            const new_path = validatePath(new_in);

            if (old_path === new_path) return;

            if (old_path === '/') throw FSError.EINVAL(old_path, 'rename');
            if (new_path === '/') throw FSError.EINVAL(new_path, 'rename');

            if(!isFolderPath(old_path) && isFolderPath(new_path)) throw FSError.EISDIR(new_path, 'rename');
            if(isFolderPath(old_path) && !isFolderPath(new_path)) throw FSError.ENOTDIR(new_path, 'rename');

            // Prevent moving a directory into itself
            const old_prefix = old_path.endsWith('/') ? old_path : `${old_path}/`;
            if (new_path.startsWith(old_prefix)) {
                throw FSError.EINVAL(new_path, 'rename');
            }

            const db = await core.getDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);

            // 1. Verify source exists
            const old_key: StoragePath = toStoragePath(old_path);
            const new_key: StoragePath = toStoragePath(new_path);
            const source_entry = (await tx.store.get(old_key)) as DBEntry | undefined;
            if (source_entry == null) {
                throw FSError.ENOENT(old_path, 'rename');
            }

            // 2. Verify target parent exists
            const target_parent_path = getParentPath(new_path);
            const target_parent_key: StoragePath = toStoragePath(target_parent_path);

            if (target_parent_path !== '/') {
                const target_parent = (await tx.store.get(target_parent_key)) as DBEntry | undefined;
                if (!target_parent) throw FSError.ENOENT(target_parent_path, 'rename');
                if (target_parent.type !== 'folder') throw FSError.ENOTDIR(target_parent_path, 'rename');
            }

            // 3. Check if target exists and handle type mismatch
            const existing_target = (await tx.store.get(new_key)) as DBEntry | undefined;
            if (existing_target) {
                if (source_entry.type === 'file' && existing_target.type === 'folder') throw FSError.EISDIR(new_path, 'rename');
                if (source_entry.type === 'folder' && existing_target.type === 'file') throw FSError.ENOTDIR(new_path, 'rename');
                if (source_entry.type !== existing_target.type) throw FSError.EINVAL(new_path, 'rename');
                
                // If folder, it must be empty to be overwritten
                if (existing_target.type === 'folder') {
                    const index = tx.store.index(INDEX_BY_PARENT);
                    const has_children = await index.getKey(new_key);
                    if (has_children) throw FSError.ENOTEMPTY(new_path, 'rename');
                }
            }

            // 4. Collect all items to move (if it's a directory)
            const items_to_move: Array<{ old_key: string; new_key: string; entry: DBEntry }> = [{
                old_key, new_key,
                entry: { ...source_entry, parent: target_parent_key, mtime: now() },
            }];
            
            const index = tx.store.index(INDEX_BY_PARENT);
            for (let i = 0; i < items_to_move.length; ++i) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const { old_key, new_key, entry } = items_to_move[i]!;
                if(entry.type !== 'folder') continue;
                
                let cursor = await index.openCursor(old_key as StoragePath);
                while (cursor) {
                    const child_old_key = cursor.primaryKey as string;
                    const child_entry = cursor.value as DBEntry;
                    const child_name = getBaseName(child_old_key + (child_entry.type === 'folder' ? '/' : ''));
                    
                    const child_new_path = new_key === '/' ? `/${child_name}` : `${new_key}/${child_name}`;
                    
                    items_to_move.push({
                        old_key: child_old_key,
                        new_key: toStoragePath(child_new_path),
                        entry: { ...child_entry, parent: new_key as StoragePath }
                    });

                    cursor = await cursor.continue();
                }
            }

            // 5. Execute move: Delete old, Put new
            
            for (const item of items_to_move) {
                await store.delete(item.old_key);
            }

            for (const item of items_to_move) {
                await store.put(item.entry, item.new_key);
            }

            await tx.done;
        }
    };
}
import type { IDBPDatabase } from "idb";

import { getParentPath } from "../path.ts";
import { FSError } from "../error.ts";

import type { DBEntry, DBFolderEntry } from "./core.ts";
import { now, STORE_NAME } from "./core.ts";


export async function ensureParentDirs(db: IDBPDatabase, file_path: string): Promise<void> {
    const segments = file_path.split('/').filter(Boolean);
    segments.pop();

    let curr_path = '/';
    for (const segment of segments) {
        const file_path = curr_path + segment;        
        const file_entry: DBEntry|null = await db.get(STORE_NAME, file_path);
        if(file_entry != null) {
            throw FSError.ENOTDIR(file_path, 'mkdir');
        }
        
        curr_path = file_path + '/';

        const folder_entry: DBEntry|null = await db.get(STORE_NAME, curr_path);
        if (folder_entry == null) {
            const new_entry: DBFolderEntry = {
                type: 'folder',
                parent: getParentPath(curr_path),
                mtime: now(),
            };

            await db.put(STORE_NAME, new_entry, curr_path);
            continue;
        }

        if(folder_entry.type !== 'folder') {
            throw FSError.ENOTDIR(curr_path, 'mkdir');
        }
    }
}
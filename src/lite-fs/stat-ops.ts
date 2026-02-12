export type {StatOps} from "../api/stat-ops.ts";
import type {StatOps, Stats} from "../api/stat-ops.ts";

import {FSError} from "../error.ts";
import {validatePath} from "../path.ts";
import {getEntryByPath, type DBEntry, type FSCore} from "./core/index.ts";

function createStats(entry: DBEntry): Stats {
    const is_file = entry.type === 'file';

    return {
        isFile: () => is_file,
        isDirectory: () => !is_file,
        mtime: new Date(entry.mtime),
    };
}

export function createStatOps(core: FSCore): StatOps {
    return {
        async stat(in_path: string): Promise<Stats> {
            const path = validatePath(in_path);
            if(path === '/') {
                return {
                    isFile: () => false,
                    isDirectory: () => true,
                    mtime: new Date(0),
                };
            }

            const db = await core.getDB();
            const entry = await getEntryByPath(db, path);

            if(!entry) {
                throw FSError.ENOENT(path, 'stat');
            }

            return createStats(entry);
        },
    };
}

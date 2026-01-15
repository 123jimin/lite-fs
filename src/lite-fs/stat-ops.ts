import type { Stats } from "../api.ts";
import { FSError } from "../error.ts";
import { validatePath } from "../path.ts";
import { getEntryByPath, type DBEntry, type FSCore } from "./core/index.ts";

export interface StatOps {
    stat(path: string): Promise<Stats>;
}

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

            const db = await core.getDB();
            const entry = await getEntryByPath(db, path);

            if (!entry) {
                throw FSError.ENOENT(path, 'stat');
            }

            return createStats(entry);
        },
    };
}
export type { FileOps } from "../api/file-ops.ts";
import type { FileOps } from "../api/file-ops.ts";

import { validatePath } from "../path.ts";
import { FSError } from "../error.ts";
import type { FSBuffer } from "../api/index.ts";

import { createDBFileEntry, ensureParentDirs, getEntryByPath, putEntryByPath, type FSCore } from "./core/index.ts";

export function createFileOps(core: FSCore): FileOps {
    async function readFile(path: string): Promise<FSBuffer>;
    async function readFile(path: string, encoding: 'utf-8'): Promise<string>;
    async function readFile(in_path: string, encoding?: 'utf-8'): Promise<FSBuffer | string> {
        const path = validatePath(in_path, 'file');

        const db = await core.getDB();
        const entry = await getEntryByPath(db, path);

        if (!entry) {
            throw FSError.ENOENT(path, 'read');
        }
        if (entry.type !== 'file') {
            throw FSError.EISDIR(path, 'read');
        }

        const content = entry.content;
        return encoding === 'utf-8'
            ? new TextDecoder().decode(content)
            : content;
    }

    async function writeFile(in_path: string, content: string | FSBuffer): Promise<void> {
        const path = validatePath(in_path, 'file');

        const db = await core.getDB();
        const created_dirs = await ensureParentDirs(db, path);
        for (const dir of created_dirs) {
            core.emit({eventType: 'rename', filename: dir});
        }

        const existing = await getEntryByPath(db, path);
        const is_new_file = !existing || existing.type !== 'file';

        const bytes = typeof content === 'string'
            ? new TextEncoder().encode(content)
            : content;

        const entry = createDBFileEntry(path, bytes);
        await putEntryByPath(db, path, entry);

        core.emit({
            eventType: is_new_file ? 'rename' : 'change',
            filename: path,
        });
    }

    return { readFile, writeFile };
}
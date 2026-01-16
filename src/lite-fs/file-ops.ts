export type { FileOps } from "../api/file-ops.ts";
import type { FileOps } from "../api/file-ops.ts";

import { validatePath } from "../path.ts";
import { FSError } from "../error.ts";

import { createDBFileEntry, ensureParentDirs, getEntryByPath, putEntryByPath, type FSCore } from "./core/index.ts";

export function createFileOps(core: FSCore): FileOps {
    async function readFile(path: string): Promise<Uint8Array>;
    async function readFile(path: string, encoding: 'utf-8'): Promise<string>;
    async function readFile(in_path: string, encoding?: 'utf-8'): Promise<Uint8Array | string> {
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

    async function writeFile(in_path: string, content: string | Uint8Array): Promise<void> {
        const path = validatePath(in_path, 'file');

        const db = await core.getDB();
        await ensureParentDirs(db, path);

        const bytes = typeof content === 'string'
            ? new TextEncoder().encode(content)
            : content;

        const entry = createDBFileEntry(path, bytes);
        await putEntryByPath(db, path, entry);
    }

    return { readFile, writeFile };
}
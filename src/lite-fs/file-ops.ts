import type { FSCore, DBFileEntry } from "./core.ts";
import { now, STORE_NAME } from "./core.ts";
import { validatePath, getParentPath } from "../path.ts";
import { FSError } from "../error.ts";

export interface FileOps {
    readFile(path: string): Promise<Uint8Array>;
    readFile(path: string, encoding: 'utf-8'): Promise<string>;
    writeFile(path: string, content: string | Uint8Array): Promise<void>;
}

export function createFileOps(core: FSCore): FileOps {
    async function readFile(path: string): Promise<Uint8Array>;
    async function readFile(path: string, encoding: 'utf-8'): Promise<string>;
    async function readFile(path: string, encoding?: 'utf-8'): Promise<Uint8Array | string> {
        validatePath(path, 'file');

        const db = await core.getDB();
        const entry = await db.get(STORE_NAME, path);

        if (!entry) {
            throw FSError.ENOENT(path, 'read');
        }
        if (entry.type !== 'file') {
            throw FSError.EISDIR(path, 'read');
        }

        const content = (entry as DBFileEntry).content;
        return encoding === 'utf-8'
            ? new TextDecoder().decode(content)
            : content;
    }

    async function writeFile(path: string, content: string | Uint8Array): Promise<void> {
        validatePath(path, 'file');

        const db = await core.getDB();
        const bytes = typeof content === 'string'
            ? new TextEncoder().encode(content)
            : content;

        const entry: DBFileEntry = {
            type: 'file',
            content: bytes,
            parent: getParentPath(path),
            mtime: now(),
        };

        await db.put(STORE_NAME, entry, path);
    }

    return { readFile, writeFile };
}
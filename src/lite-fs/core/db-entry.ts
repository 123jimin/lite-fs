import type { IDBPDatabase } from "idb";

import { FSError } from "../../error.ts";
import type { AbsoluteFilePath, AbsoluteFolderPath, AbsolutePath } from "../../path.ts";
import { getParentPath, isAbsolutePath } from "../../path.ts";
import { STORE_NAME } from "./const.ts";

export type DBTimeStamp = number;

export function now(): DBTimeStamp {
    return Date.now();
}

export type StoragePath = '/' | `/${string}`;

export function toStoragePath(path: string): StoragePath {
    if(!isAbsolutePath(path)) throw FSError.EINVAL(path, "toStoragePath");

    if(path === '/') return '/';
    return (path.endsWith('/') ? path.slice(0, -1) : path) as StoragePath;
}

export interface DBFileEntry {
    type: 'file';
    content: Uint8Array;
    parent: StoragePath;
    mtime: DBTimeStamp;
}

export function createDBFileEntry(path: AbsoluteFilePath, content: Uint8Array): DBFileEntry {
    return {
        type: 'file',
        content,
        parent: toStoragePath(getParentPath(path)),
        mtime: now(),
    };
}

export interface DBFolderEntry {
    type: 'folder';
    parent: StoragePath;
    mtime: DBTimeStamp;
}

export function createDBFolderEntry(path: AbsoluteFolderPath): DBFolderEntry {
    return {
        type: 'folder',
        parent: toStoragePath(getParentPath(path)),
        mtime: now(),
    };
}

export type DBEntry = DBFileEntry | DBFolderEntry;

export async function getEntryByPath(db: IDBPDatabase, path: AbsoluteFolderPath): Promise<DBFolderEntry|null>;
export async function getEntryByPath(db: IDBPDatabase, path: AbsoluteFilePath): Promise<DBFileEntry|null>;
export async function getEntryByPath(db: IDBPDatabase, path: AbsolutePath): Promise<DBEntry|null> {
    return (await db.get(STORE_NAME, toStoragePath(path))) ?? null;
}

export async function putEntryByPath(db: IDBPDatabase, path: AbsoluteFolderPath, entry: DBFolderEntry): Promise<void>;
export async function putEntryByPath(db: IDBPDatabase, path: AbsoluteFilePath, entry: DBFileEntry): Promise<void>;
export async function putEntryByPath(db: IDBPDatabase, path: AbsolutePath, entry: DBEntry) {
    await db.put(STORE_NAME, entry, toStoragePath(path));
}

export async function ensureParentDirs(db: IDBPDatabase, path: AbsolutePath): Promise<void> {
    const segments = path.split('/').filter(Boolean);
    segments.pop();

    let curr_path: AbsoluteFolderPath = '/';
    for (const segment of segments) {
        const file_path = (curr_path + segment) as AbsoluteFilePath;        
        const file_entry = await getEntryByPath(db, file_path);
        if(file_entry != null) {
            throw FSError.ENOTDIR(file_path, 'mkdir');
        }
        
        curr_path = (file_path + '/') as AbsoluteFolderPath;
        const folder_entry = await getEntryByPath(db, curr_path);
        if (folder_entry == null) {
            const new_entry: DBFolderEntry = {
                type: 'folder',
                parent: getParentPath(curr_path),
                mtime: now(),
            };

            await putEntryByPath(db, curr_path, new_entry);
            continue;
        }

        if(folder_entry.type !== 'folder') {
            throw FSError.ENOTDIR(curr_path, 'mkdir');
        }
    }
}
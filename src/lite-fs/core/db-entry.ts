import type {IDBPDatabase} from "idb";

import type {FSBuffer} from "../../api/index.ts";

import {FSError} from "../../error.ts";
import type {AbsoluteFilePath, AbsoluteFolderPath, AbsolutePath} from "../../path.ts";
import {getParentPath} from "../../path.ts";
import {STORE_NAME} from "./const.ts";
import {toStoragePath, type StoragePath} from "./path.ts";

export type DBTimeStamp = number;

export function now(): DBTimeStamp {
    return Date.now();
}

export interface DBFileEntry {
    type: 'file';
    content: FSBuffer;
    parent: StoragePath;
    mtime: DBTimeStamp;
}

export function createDBFileEntry(path: AbsoluteFilePath, content: FSBuffer): DBFileEntry {
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

export async function ensureParentDirs(db: IDBPDatabase, path: AbsolutePath): Promise<AbsoluteFolderPath[]> {
    const segments = path.split('/').filter(Boolean);
    segments.pop();

    const created: AbsoluteFolderPath[] = [];
    let curr_path: AbsoluteFolderPath = '/';
    for(const segment of segments) {
        curr_path = (curr_path + segment + '/') as AbsoluteFolderPath;

        const folder_entry = await getEntryByPath(db, curr_path);
        if(folder_entry == null) {
            const new_entry: DBFolderEntry = createDBFolderEntry(curr_path);

            await putEntryByPath(db, curr_path, new_entry);
            created.push(curr_path);
            continue;
        }

        if(folder_entry.type !== 'folder') {
            throw FSError.ENOTDIR(curr_path.slice(0, -1), 'mkdir');
        }
    }

    return created;
}

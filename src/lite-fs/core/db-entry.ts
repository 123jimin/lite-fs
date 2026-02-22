import type {FSBuffer} from "../../api/index.ts";

import {FSError} from "../../error.ts";
import type {AbsoluteFilePath, AbsoluteFolderPath, AbsolutePath} from "../../path.ts";
import {getParentPath} from "../../path.ts";
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

/** Object store handle for reading entries. */
export interface EntryStoreReadable {
    get(query: StoragePath): Promise<DBEntry | undefined>;
}

/** Object store handle for reading and writing entries. */
export interface EntryStoreWritable extends EntryStoreReadable {
    put(value: DBEntry, key: StoragePath): Promise<unknown>;
}

export async function getEntryByPath(store: EntryStoreReadable, path: AbsoluteFolderPath): Promise<DBFolderEntry|null>;
export async function getEntryByPath(store: EntryStoreReadable, path: AbsoluteFilePath): Promise<DBFileEntry|null>;
export async function getEntryByPath(store: EntryStoreReadable, path: AbsolutePath): Promise<DBEntry|null> {
    return (await store.get(toStoragePath(path))) ?? null;
}

export async function putEntryByPath(store: EntryStoreWritable, path: AbsoluteFolderPath, entry: DBFolderEntry): Promise<void>;
export async function putEntryByPath(store: EntryStoreWritable, path: AbsoluteFilePath, entry: DBFileEntry): Promise<void>;
export async function putEntryByPath(store: EntryStoreWritable, path: AbsolutePath, entry: DBEntry) {
    await store.put(entry, toStoragePath(path));
}

export async function ensureParentDirs(store: EntryStoreWritable, path: AbsolutePath): Promise<AbsoluteFolderPath[]> {
    const segments = path.split('/').filter(Boolean);
    segments.pop();

    const created: AbsoluteFolderPath[] = [];
    let curr_path: AbsoluteFolderPath = '/';
    for(const segment of segments) {
        curr_path = (curr_path + segment + '/') as AbsoluteFolderPath;

        const folder_entry = await getEntryByPath(store, curr_path);
        if(folder_entry == null) {
            const new_entry: DBFolderEntry = createDBFolderEntry(curr_path);

            await putEntryByPath(store, curr_path, new_entry);
            created.push(curr_path);
            continue;
        }

        if(folder_entry.type !== 'folder') {
            throw FSError.ENOTDIR(curr_path.slice(0, -1), 'mkdir');
        }
    }

    return created;
}

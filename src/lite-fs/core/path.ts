import type { AbsoluteFolderPath, AbsolutePath } from "../../path.ts";

/** Folders are stored without a trailing `/`. */
export type StoragePath = '/' | `/${string}`;

export function toStoragePath(path: AbsolutePath): StoragePath {
    if(path === '/') return '/';
    return (path.endsWith('/') ? path.slice(0, -1) : path) as StoragePath;
}

export function fromFolderStoragePath(path: StoragePath): AbsoluteFolderPath {
    if(path === '/') return '/';
    return `${path}/`;
}
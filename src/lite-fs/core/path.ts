import { FSError } from "../../error.ts";
import { isAbsolutePath } from "../../path.ts";

/** Folders are stored without a trailing `/`. */
export type StoragePath = '/' | `/${string}`;

export function toStoragePath(path: string): StoragePath {
    if(!isAbsolutePath(path)) throw FSError.EINVAL(path, "toStoragePath");

    if(path === '/') return '/';
    return (path.endsWith('/') ? path.slice(0, -1) : path) as StoragePath;
}
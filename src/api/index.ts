export type { Dirent, MkdirOptions } from "./dir-ops.ts";

import type { DirOps } from "./dir-ops.ts";

export interface Stats {
    isFile(): boolean;
    isDirectory(): boolean;

    /** Last modification time. */
    mtime: Date;
}

export interface RmOptions {
    /** If true, remove directories and their contents recursively. Default: false */
    recursive?: boolean;
    /** If true, ignore errors if path doesn't exist. Default: false */
    force?: boolean;
}

export interface FileSystemAPI extends DirOps {
    // === File operations ===
    readFile(path: string): Promise<Uint8Array>;
    readFile(path: string, encoding: 'utf-8'): Promise<string>;
    writeFile(path: string, content: string | Uint8Array): Promise<void>;
    
    // === Metadata ===
    stat(path: string): Promise<Stats>;
    
    // === Removal ===
    /** Remove a file */
    unlink(path: string): Promise<void>;
    /** Remove a file or directory */
    rm(path: string, options?: RmOptions): Promise<void>;
    
    // === Move/Rename ===
    rename(old_path: string, new_path: string): Promise<void>;
}
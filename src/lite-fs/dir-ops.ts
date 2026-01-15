import type { Dirent, MkdirOptions } from "../api.ts";

export interface DirOps {
    mkdir(path: string, options?: MkdirOptions): Promise<void>;
    readdir(path: string): Promise<string[]>;
    readdir(path: string, options: { withFileTypes: true }): Promise<Dirent[]>;
}
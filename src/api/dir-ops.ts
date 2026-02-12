import type {AbsoluteFolderPath} from "../path.ts";

export interface Dirent {
    isFile(): boolean;
    isDirectory(): boolean;

    parentPath: AbsoluteFolderPath;
    name: string;
}

export interface MkdirOptions {
    /** If true, create parent directories as needed. Default: false */
    recursive?: boolean;
}

export interface DirOps {
    mkdir(path: string, options?: MkdirOptions): Promise<void>;
    readdir(path: string): Promise<string[]>;
    readdir(path: string, options: {withFileTypes: true}): Promise<Dirent[]>;
}

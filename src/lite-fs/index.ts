import type { Dirent, MkdirOptions } from "../api.ts";
import { createFSCore, type FSCore } from "./core/index.ts";
import { createDirOps, type DirOps } from "./dir-ops.ts";
import { createFileOps, type FileOps } from "./file-ops.ts";

export class LiteFS {
    readonly #core: FSCore;
    
    readonly #file_ops: FileOps;
    readonly #dir_ops: DirOps;

    constructor(db_name: string = 'lite-fs') {
        this.#core = createFSCore(db_name);
        this.#file_ops = createFileOps(this.#core);
        this.#dir_ops = createDirOps(this.#core);
    }

    readFile(path: string): Promise<Uint8Array>;
    readFile(path: string, encoding: 'utf-8'): Promise<string>;
    readFile(path: string, encoding?: 'utf-8') {
        return encoding
            ? this.#file_ops.readFile(path, encoding)
            : this.#file_ops.readFile(path);
    }

    writeFile(path: string, content: string | Uint8Array) {
        return this.#file_ops.writeFile(path, content);
    }

    mkdir(path: string, options?: MkdirOptions): Promise<void> {
        return this.#dir_ops.mkdir(path, options);
    }
    
    readdir(path: string): Promise<string[]>;
    readdir(path: string, options: { withFileTypes: true }): Promise<Dirent[]>;
    readdir(path: string, options?: { withFileTypes: true }): Promise<string[] | Dirent[]> {
        if(options) return this.#dir_ops.readdir(path, options);
        else return this.#dir_ops.readdir(path);
    }

}
import type { Dirent, FileSystemAPI, MkdirOptions, RmOptions, Stats } from "../api.ts";
import { createFSCore } from "./core/index.ts";
import { createDirOps, type DirOps } from "./dir-ops.ts";
import { createFileOps, type FileOps } from "./file-ops.ts";
import { createRemoveOps, type RemoveOps } from "./remove-ops.ts";
import { createRenameOps, type RenameOps } from "./rename-ops.ts";
import { createStatOps, type StatOps } from "./stat-ops.ts";

export class LiteFS implements FileSystemAPI {
    readonly #file_ops: FileOps;
    readonly #dir_ops: DirOps;
    readonly #remove_ops: RemoveOps;
    readonly #rename_ops: RenameOps;
    readonly #stat_ops: StatOps

    constructor(db_name: string = 'lite-fs') {
        const core = createFSCore(db_name);

        this.#file_ops = createFileOps(core);
        this.#dir_ops = createDirOps(core);
        this.#remove_ops = createRemoveOps(core);
        this.#rename_ops = createRenameOps(core);
        this.#stat_ops = createStatOps(core);
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

    unlink(path: string): Promise<void> {
        return this.#remove_ops.unlink(path);
    }

    rm(path: string, options?: RmOptions): Promise<void> {
        return this.#remove_ops.rm(path, options);
    }

    rename(old_path: string, new_path: string): Promise<void> {
        return this.#rename_ops.rename(old_path, new_path);
    }

    stat(path: string): Promise<Stats> {
        return this.#stat_ops.stat(path);
    }
}
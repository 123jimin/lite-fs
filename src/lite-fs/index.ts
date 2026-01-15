import { createFSCore, type FSCore } from "./core.ts";
import { createFileOps, type FileOps } from "./file-ops.ts";

export class LiteFS {
    readonly #core: FSCore;
    readonly #file_ops: FileOps;

    constructor(db_name: string = 'lite-fs') {
        this.#core = createFSCore(db_name);
        this.#file_ops = createFileOps(this.#core);
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
}
import type {FSBuffer} from "./buffer.ts";

export interface FileOps {
    readFile(path: string): Promise<FSBuffer>;
    readFile(path: string, encoding: 'utf-8'): Promise<string>;
    writeFile(path: string, content: string | Uint8Array): Promise<void>;
}

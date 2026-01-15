export interface FileSystemAPI {
    readFile(path: string): Promise<Uint8Array>;
    readFile(path: string, encoding: 'utf-8'): Promise<string>;
    writeFile(path: string, content: string | Uint8Array): Promise<void>;
}
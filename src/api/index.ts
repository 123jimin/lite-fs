export interface Stats {
    isFile(): boolean;
    isDirectory(): boolean;

    /** Last modification time. */
    mtime: Date;
}

export interface Dirent {
    isFile(): boolean;
    isDirectory(): boolean;

    /** The file name (not full path) */
    name: string;
}

export interface MkdirOptions {
    /** If true, create parent directories as needed. Default: false */
    recursive?: boolean;
}

export interface RmOptions {
    /** If true, remove directories and their contents recursively. Default: false */
    recursive?: boolean;
    /** If true, ignore errors if path doesn't exist. Default: false */
    force?: boolean;
}

export interface FileSystemAPI {
    // === File operations ===
    readFile(path: string): Promise<Uint8Array>;
    readFile(path: string, encoding: 'utf-8'): Promise<string>;
    writeFile(path: string, content: string | Uint8Array): Promise<void>;

    // === Directory operations ===
    mkdir(path: string, options?: MkdirOptions): Promise<void>;
    readdir(path: string): Promise<string[]>;
    readdir(path: string, options: { withFileTypes: true }): Promise<Dirent[]>;
    
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
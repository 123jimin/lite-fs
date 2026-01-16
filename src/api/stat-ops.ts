export interface Stats {
    isFile(): boolean;
    isDirectory(): boolean;

    /** Last modification time. */
    mtime: Date;
}

export interface StatOps {
    stat(path: string): Promise<Stats>;
}
export interface RmOptions {
    /** If true, remove directories and their contents recursively. Default: false */
    recursive?: boolean;
    /** If true, ignore errors if path doesn't exist. Default: false */
    force?: boolean;
}

export interface RemoveOps {
    unlink(path: string): Promise<void>;
    rm(path: string, options?: RmOptions): Promise<void>;
}

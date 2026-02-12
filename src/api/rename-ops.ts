export interface RenameOps {
    rename(old_path: string, new_path: string): Promise<void>;
}

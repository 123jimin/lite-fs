import type { RmOptions } from "../api.ts";

export interface RemoveOps {
    unlink(path: string): Promise<void>;
    rm(path: string, options?: RmOptions): Promise<void>;
}
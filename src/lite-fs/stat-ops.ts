import type { Stats } from "../api.ts";

export interface StatOps {
    stat(path: string): Promise<Stats>;
}
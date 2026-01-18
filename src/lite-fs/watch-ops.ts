export type { WatchOps } from "../api/watch-ops.ts";
import type { WatchOps, WatchOptions } from "../api/watch-ops.ts";

import type { FSCore } from "./core/index.ts";

export function createWatchOps(core: FSCore): WatchOps {
    return {
        watch(path: string, options?: WatchOptions) {
            throw new Error("Not yet implemented!");
        },
    };
}
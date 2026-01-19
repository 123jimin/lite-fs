export type { Dirent, MkdirOptions } from "./dir-ops.ts";
export type { Stats } from "./stat-ops.ts";
export type { RmOptions } from "./remove-ops.ts";
export type { WatchEvent, WatchOptions , RenameWatchEvent, ChangeWatchEvent } from "./watch-ops.ts";

import type { DirOps } from "./dir-ops.ts";
import type { FileOps } from "./file-ops.ts";
import type { StatOps } from "./stat-ops.ts";
import type { RemoveOps } from "./remove-ops.ts";
import type { RenameOps } from "./rename-ops.ts";
import type { WatchOps } from "./watch-ops.ts";

export interface FileSystemAPI
    extends DirOps, FileOps, StatOps, RemoveOps, RenameOps, WatchOps {}
import type { AbsolutePath } from "../path.ts";

export interface RenameWatchEvent {
    eventType: 'rename';
    filename: AbsolutePath;
}

export interface ChangeWatchEvent {
    eventType: 'change';
    filename: AbsolutePath;
}

export type WatchEvent =
    | RenameWatchEvent
    | ChangeWatchEvent
    ;

export interface WatchOptions {
    signal?: AbortSignal;
}

export interface WatchOps {
    watch(path: string, options?: WatchOptions): AsyncIterableIterator<WatchEvent>;
}
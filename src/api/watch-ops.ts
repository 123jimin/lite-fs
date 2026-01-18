import type { AbsolutePath } from "../path.ts";

export interface RenameWatchEvent {
    eventType: 'rename';
    filename: AbsolutePath;
}

export type WatchEvent =
    | RenameWatchEvent
    ;

export interface WatchOptions {
    signal?: AbortSignal;
}

export interface WatchOps {
    watch(path: string, options?: WatchOptions): AsyncIterator<WatchEvent>;
}
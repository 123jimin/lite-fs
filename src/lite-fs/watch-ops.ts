export type { WatchOps } from "../api/watch-ops.ts";
import type { WatchEvent, WatchOps, WatchOptions } from "../api/watch-ops.ts";
import { getParentPath, isFolderPath, validatePath } from "../path.ts";

import type { FSCore } from "./core/index.ts";

export function createWatchOps(core: FSCore): WatchOps {
    return {
        watch(in_path: string, options?: WatchOptions): AsyncIterableIterator<WatchEvent> {
            const path = validatePath(in_path);

            const queue: WatchEvent[] = [];
            let resolveNext: ((value: IteratorResult<WatchEvent>) => void)|null = null;
            let done = false;

            const shouldEmit = (event: WatchEvent): boolean => {
                const event_path = event.filename;
                if(event_path === path) return true;

                if(isFolderPath(path)) {
                    const parent = getParentPath(event_path);
                    if(parent === path) return true;
                }

                return false;
            };

            const unsubscribe = core.subscribe((event) => {
                if(!shouldEmit(event)) return;

                if(resolveNext) {
                    resolveNext({value: event, done: false});
                    resolveNext = null;
                } else {
                    queue.push(event);
                }
            });

            const cleanup = () => {
                done = true;
                unsubscribe();
            };

            if(options?.signal) {
                if(options.signal.aborted) {
                    cleanup();
                } else {
                    options.signal.addEventListener('abort', () => {
                        cleanup();
                        if(resolveNext) {
                            resolveNext({value: (void 0), done: true});
                            resolveNext = null;
                        }
                    }, {once: true});
                }
            }

            return {
                [Symbol.asyncIterator]() {
                    return this;
                },
                next(): Promise<IteratorResult<WatchEvent>> {
                    if(done) {
                        return Promise.resolve({value: (void 0), done: true});
                    }

                    if(queue.length > 0) {
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        return Promise.resolve({value: queue.shift()!, done: false});
                    }
                    
                    return new Promise((resolve) => {
                        resolveNext = resolve;
                    });
                },
                return(): Promise<IteratorResult<WatchEvent>> {
                    cleanup();
                    return Promise.resolve({value: (void 0), done: true});
                },
                throw(e?: unknown): Promise<IteratorResult<WatchEvent>> {
                    cleanup();
                    return Promise.reject(e);
                }
            };
        },
    };
}
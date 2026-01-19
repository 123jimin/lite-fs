import "fake-indexeddb/auto";
import { assert } from "chai";
import { createFSCore, type FSCore } from "./core/index.ts";
import { createDirOps, type DirOps } from "./dir-ops.ts";
import { createFileOps, type FileOps } from "./file-ops.ts";
import { createRemoveOps, type RemoveOps } from "./remove-ops.ts";
import { createRenameOps, type RenameOps } from "./rename-ops.ts";
import { createWatchOps, type WatchOps } from "./watch-ops.ts";
import type { WatchEvent } from "../api/watch-ops.ts";

describe("watch", () => {
    let core: FSCore;
    let dir_ops: DirOps;
    let file_ops: FileOps;
    let remove_ops: RemoveOps;
    let rename_ops: RenameOps;
    let watch_ops: WatchOps;

    beforeEach(async () => {
        core = createFSCore("test-fs-watch");
        await core.reset();
        dir_ops = createDirOps(core);
        file_ops = createFileOps(core);
        remove_ops = createRemoveOps(core);
        rename_ops = createRenameOps(core);
        watch_ops = createWatchOps(core);
    });

    afterEach(async () => {
        await core.reset();
    });

    context("watching directories for file creation", () => {
        it("should emit 'rename' when a file is created in watched directory", async () => {
            const watcher = watch_ops.watch("/");

            await file_ops.writeFile("/test.txt", "hello");

            const result = await watcher.next();
            assert.isFalse(result.done);
            assert.equal(result.value.eventType, "rename");
            assert.equal(result.value.filename, "/test.txt");

            await watcher.return?.();
        });

        it("should emit 'rename' when a directory is created in watched directory", async () => {
            const watcher = watch_ops.watch("/");

            await dir_ops.mkdir("/subdir/");

            const result = await watcher.next();
            assert.isFalse(result.done);
            assert.equal(result.value.eventType, "rename");
            assert.equal(result.value.filename, "/subdir/");

            await watcher.return?.();
        });

        it("should not emit events for files in other directories", async () => {
            await dir_ops.mkdir("/a/");
            await dir_ops.mkdir("/b/");

            const watcher = watch_ops.watch("/a/");

            await file_ops.writeFile("/b/file.txt", "other");
            await file_ops.writeFile("/a/file.txt", "mine");

            const result = await watcher.next();
            assert.equal(result.value.filename, "/a/file.txt");

            await watcher.return?.();
        });

        it("should not emit events for nested descendants", async () => {
            await dir_ops.mkdir("/parent/child/", { recursive: true });

            const watcher = watch_ops.watch("/parent/");

            await file_ops.writeFile("/parent/child/deep.txt", "deep");
            await file_ops.writeFile("/parent/direct.txt", "direct");

            const result = await watcher.next();
            assert.equal(result.value.filename, "/parent/direct.txt");

            await watcher.return?.();
        });
    });

    context("watching files for changes", () => {
        it("should emit 'change' when watched file is modified", async () => {
            await file_ops.writeFile("/file.txt", "original");

            const watcher = watch_ops.watch("/file.txt");

            await file_ops.writeFile("/file.txt", "modified");

            const result = await watcher.next();
            assert.isFalse(result.done);
            assert.equal(result.value.eventType, "change");
            assert.equal(result.value.filename, "/file.txt");

            await watcher.return?.();
        });

        it("should emit 'rename' when new file is created at watched path", async () => {
            const watcher = watch_ops.watch("/new-file.txt");

            await file_ops.writeFile("/new-file.txt", "content");

            const result = await watcher.next();
            assert.isFalse(result.done);
            assert.equal(result.value.eventType, "rename");
            assert.equal(result.value.filename, "/new-file.txt");

            await watcher.return?.();
        });

        it("should not emit events for other files", async () => {
            await file_ops.writeFile("/a.txt", "a");
            await file_ops.writeFile("/b.txt", "b");

            const watcher = watch_ops.watch("/a.txt");

            await file_ops.writeFile("/b.txt", "b modified");
            await file_ops.writeFile("/a.txt", "a modified");

            const result = await watcher.next();
            assert.equal(result.value.filename, "/a.txt");
            assert.equal(result.value.eventType, "change");

            await watcher.return?.();
        });
    });

    context("watching for deletions", () => {
        it("should emit 'rename' when a file is deleted via unlink", async () => {
            await file_ops.writeFile("/to-delete.txt", "goodbye");

            const watcher = watch_ops.watch("/");

            await remove_ops.unlink("/to-delete.txt");

            const result = await watcher.next();
            assert.equal(result.value.eventType, "rename");
            assert.equal(result.value.filename, "/to-delete.txt");

            await watcher.return?.();
        });

        it("should emit 'rename' when a directory is deleted via rm", async () => {
            await dir_ops.mkdir("/to-remove/");

            const watcher = watch_ops.watch("/");

            await remove_ops.rm("/to-remove/");

            const result = await watcher.next();
            assert.equal(result.value.eventType, "rename");
            assert.equal(result.value.filename, "/to-remove/");

            await watcher.return?.();
        });

        it("should emit single 'rename' for recursive rm", async () => {
            await dir_ops.mkdir("/parent/child/", { recursive: true });
            await file_ops.writeFile("/parent/child/file.txt", "content");

            const watcher = watch_ops.watch("/");

            await remove_ops.rm("/parent/", { recursive: true });

            const result = await watcher.next();
            assert.equal(result.value.eventType, "rename");
            assert.equal(result.value.filename, "/parent/");

            await watcher.return?.();
        });
    });

    context("watching for renames", () => {
        it("should emit 'rename' for both old and new paths", async () => {
            await file_ops.writeFile("/old.txt", "content");

            const watcher = watch_ops.watch("/");

            await rename_ops.rename("/old.txt", "/new.txt");

            const events: WatchEvent[] = [];
            events.push((await watcher.next()).value);
            events.push((await watcher.next()).value);

            const filenames = events.map((e) => e.filename);
            assert.sameMembers(filenames, ["/old.txt", "/new.txt"]);
            assert.isTrue(events.every((e) => e.eventType === "rename"));

            await watcher.return?.();
        });
    });

    context("abort signal", () => {
        it("should stop iteration when signal is aborted", async () => {
            const controller = new AbortController();
            const watcher = watch_ops.watch("/", { signal: controller.signal });

            controller.abort();

            const result = await watcher.next();
            assert.isTrue(result.done);
        });

        it("should immediately end if signal is already aborted", async () => {
            const controller = new AbortController();
            controller.abort();

            const watcher = watch_ops.watch("/", { signal: controller.signal });

            const result = await watcher.next();
            assert.isTrue(result.done);
        });

        it("should abort pending next() call when signal is aborted", async () => {
            const controller = new AbortController();
            const watcher = watch_ops.watch("/", { signal: controller.signal });

            const next_promise = watcher.next();
            controller.abort();

            const result = await next_promise;
            assert.isTrue(result.done);
        });
    });

    context("iterator cleanup", () => {
        it("should end iteration when return() is called", async () => {
            const watcher = watch_ops.watch("/");

            await watcher.return?.();

            const result = await watcher.next();
            assert.isTrue(result.done);
        });

        it("should not receive events after return() is called", async () => {
            const watcher = watch_ops.watch("/");

            await watcher.return?.();

            await file_ops.writeFile("/test.txt", "content");

            const result = await watcher.next();
            assert.isTrue(result.done);
        });
    });

    context("multiple events", () => {
        it("should queue multiple events", async () => {
            const watcher = watch_ops.watch("/");

            await file_ops.writeFile("/a.txt", "a");
            await file_ops.writeFile("/b.txt", "b");
            await dir_ops.mkdir("/c/");

            const results: WatchEvent[] = [];
            for (let i = 0; i < 3; i++) {
                const r = await watcher.next();
                if (!r.done) results.push(r.value);
            }

            assert.lengthOf(results, 3);
            assert.sameMembers(
                results.map((e) => e.filename),
                ["/a.txt", "/b.txt", "/c/"]
            );

            await watcher.return?.();
        });

        it("should deliver events in order", async () => {
            const watcher = watch_ops.watch("/");

            await file_ops.writeFile("/1.txt", "1");
            await file_ops.writeFile("/2.txt", "2");
            await file_ops.writeFile("/3.txt", "3");

            const r1 = await watcher.next();
            const r2 = await watcher.next();
            const r3 = await watcher.next();

            assert.equal(r1.value.filename, "/1.txt");
            assert.equal(r2.value.filename, "/2.txt");
            assert.equal(r3.value.filename, "/3.txt");

            await watcher.return?.();
        });
    });

    context("watching the watched path itself", () => {
        it("should emit when the watched directory itself is deleted", async () => {
            await dir_ops.mkdir("/watched/");

            const watcher = watch_ops.watch("/watched/");

            await remove_ops.rm("/watched/");

            const result = await watcher.next();
            assert.equal(result.value.eventType, "rename");
            assert.equal(result.value.filename, "/watched/");

            await watcher.return?.();
        });

        it("should emit when the watched file is deleted", async () => {
            await file_ops.writeFile("/watched.txt", "content");

            const watcher = watch_ops.watch("/watched.txt");

            await remove_ops.unlink("/watched.txt");

            const result = await watcher.next();
            assert.equal(result.value.eventType, "rename");
            assert.equal(result.value.filename, "/watched.txt");

            await watcher.return?.();
        });
    });
});
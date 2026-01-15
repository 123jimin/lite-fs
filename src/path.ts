import { FSError } from "./error.ts";

/**A path that represents a folder (ends with `/`). */
export type FolderPath = `${string}/`;

/** An absolute path to a folder (starts and ends with `/`). */
export type AbsoluteFolderPath = "/" | `/${string}/`;

/** An absolute path to a file (starts with `/`, does not end with `/`). */
export type AbsoluteFilePath = `${AbsoluteFolderPath}${string}`;

/** Any absolute path (file or folder). */
export type AbsolutePath = AbsoluteFolderPath | AbsoluteFilePath;

/**
 * Checks if a path is an absolute path (starts with `/`).
 *
 * @param path - The path to check
 * @returns `true` if the path is absolute
 */
export function isAbsolutePath(path: string): path is AbsolutePath {
    return path.startsWith("/");
}

/**
 * Checks if a path represents a folder (ends with `/`).
 *
 * @param path - The path to check
 * @returns `true` if the path represents a folder
 */
export function isFolderPath(path: string): path is FolderPath {
    return path.endsWith("/");
}

/**
 * Validates that a path is a well-formed absolute path.
 *
 * Validation rules:
 * - Path must start with `/`
 * - Path must not contain empty segments (e.g., `//`)
 * - Path must not contain `.` or `..` segments
 *
 * @param path - The path to validate
 * @param type - Optional type constraint:
 *   - `'folder'`: path must end with `/`
 *   - `'file'`: path must not end with `/`
 * @throws {FSError} `EINVAL` if the path is invalid
 *
 * @example
 * validatePath("/foo/bar.txt");           // OK
 * validatePath("/foo/bar/", "folder");    // OK
 * validatePath("/foo/bar", "file");       // OK
 * validatePath("foo/bar");                // throws EINVAL (not absolute)
 * validatePath("/foo//bar");              // throws EINVAL (empty segment)
 * validatePath("/foo/../bar");            // throws EINVAL (.. segment)
 */
export function validatePath(path: string): AbsolutePath;
export function validatePath(path: string, type: "folder"): AbsoluteFolderPath;
export function validatePath(path: string, type: "file"): AbsoluteFilePath;
export function validatePath(path: string, type?: "folder" | "file"): AbsolutePath {
    if (!path.startsWith("/")) {
        throw FSError.EINVAL(path, "validatePath");
    }

    const is_folder_path = path.endsWith('/');

    switch(type) {
        case (void 0):
        case null:
            break;
        case 'file':
            if(is_folder_path) throw FSError.EINVAL(path, "validatePath");
            break;
        case 'folder':
            if(!is_folder_path) throw FSError.EINVAL(path, "validatePath");
            break;
    }

    const segments = path.split("/");
    for (let i = 1; i < segments.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const segment = segments[i]!;
        const is_last_segment = i === segments.length - 1;

        if (segment === "") {
            if (!is_last_segment) {
                throw FSError.EINVAL(path, "validatePath");
            }
            continue;
        }

        if (segment === "." || segment === "..") {
            throw FSError.EINVAL(path, "validatePath");
        }
    }

    return path as AbsolutePath;
}

/**
 * Returns the parent directory path of the given path.
 *
 * @param path - An absolute path (file or folder)
 * @returns The parent folder path, or `"/"` if already at root or path is invalid
 *
 * @example
 * getParentPath("/foo/bar.txt");  // "/foo/"
 * getParentPath("/foo/bar/");     // "/foo/"
 * getParentPath("/foo");          // "/"
 * getParentPath("/");             // "/"
 */
export function getParentPath(path: string): AbsoluteFolderPath {
    if (path === "/" || !path.startsWith("/")) {
        return "/";
    }

    const normalized = path.endsWith("/") ? path.slice(0, -1) : path;
    const last_slash_ind = normalized.lastIndexOf("/");

    if (last_slash_ind <= 0) {
        return "/";
    }

    return `${normalized.slice(0, last_slash_ind)}/` as AbsoluteFolderPath;
}

/**
 * Returns the base name (final segment) of a path.
 *
 * @param path - The path to extract the base name from
 * @returns The base name, or an empty string for root paths
 *
 * @example
 * getBaseName("/foo/bar.txt");  // "bar.txt"
 * getBaseName("/foo/bar/");     // "bar"
 * getBaseName("/foo");          // "foo"
 * getBaseName("/");             // ""
 */
export function getBaseName(path: string): string {
    if (path === "/") {
        return "";
    }

    const normalized = path.endsWith("/") ? path.slice(0, -1) : path;
    const last_slash_ind = normalized.lastIndexOf("/");

    return last_slash_ind === -1 ? normalized : normalized.slice(last_slash_ind + 1);
}

/**
 * Joins path segments together, resolving `.` and `..` while staying within the base path.
 *
 * Behavior:
 * - `base` is treated as a folder path and serves as the root boundary
 * - Absolute paths in `paths` reset navigation to `base` (not filesystem root)
 * - `.` segments are ignored
 * - `..` segments navigate up, but cannot escape above `base`
 * - Trailing `/` in the final path determines if result is a folder path
 *
 * @param base - The base path serving as the root boundary
 * @param paths - Path segments to join (can be absolute or relative)
 * @returns The resolved absolute path
 *
 * @example
 * // Basic joining
 * joinPath("/home", "user", "file.txt");     // "/home/user/file.txt"
 * joinPath("/", "foo/bar/");                 // "/foo/bar/"
 *
 * // Absolute paths reset to base
 * joinPath("/home", "/etc", "passwd");       // "/home/etc/passwd"
 *
 * // Parent navigation
 * joinPath("/home", "user", "..", "other");  // "/home/other/"
 * joinPath("/home", "a/b/../c");             // "/home/a/c"
 *
 * // Cannot escape base
 * joinPath("/home", "..", "..");             // "/home/"
 * joinPath("/home", "/../../../etc");        // "/home/etc"
 */
export function joinPath(base: string, ...paths: string[]): AbsolutePath {
    if (!base.startsWith("/")) {
        base = `/${base}`;
    }

    if (!base.endsWith("/")) {
        base = `${base}/`;
    }

    const folders: string[] = [];
    let file_name: string | null = null;

    for (let path_ind = 0; path_ind < paths.length; path_ind++) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        let path = paths[path_ind]!;

        // Absolute path resets to base
        if (path.startsWith("/")) {
            folders.length = 0;
            file_name = null;
            path = path.slice(1);
        }

        const segments = path.split("/");
        const is_last_path = path_ind === paths.length - 1;
        const ends_with_slash = path.endsWith("/");

        for (let seg_ind = 0; seg_ind < segments.length; seg_ind++) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const segment = segments[seg_ind]!;
            const is_last_segment = seg_ind === segments.length - 1;

            // Skip empty segments and current-directory markers
            if (segment === "" || segment === ".") {
                continue;
            }

            // Handle parent directory navigation
            if (segment === "..") {
                if (folders.length > 0) {
                    folders.pop();
                }
                file_name = null;
                continue;
            }

            // Determine if this segment represents a file or folder
            const is_file = is_last_path && is_last_segment && !ends_with_slash;

            if (is_file) {
                file_name = segment;
            } else {
                folders.push(segment);
                file_name = null;
            }
        }
    }

    const folder_path: AbsoluteFolderPath =
        folders.length === 0
            ? (base as AbsoluteFolderPath)
            : (`${base}${folders.join("/")}/` as AbsoluteFolderPath);

    return file_name != null ? `${folder_path}${file_name}` : folder_path;
}
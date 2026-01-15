export type FSErrorCode =
    | 'ENOENT'
    | 'EEXIST'
    | 'ENOTDIR'
    | 'EISDIR'
    | 'ENOTEMPTY'
    | 'EINVAL';

const ERROR_MESSAGES: Record<FSErrorCode, string> = {
    ENOENT: "no such file or directory",
    EEXIST: "file already exists",
    ENOTDIR: "not a directory",
    EISDIR: "illegal operation on a directory",
    ENOTEMPTY: "directory not empty",
    EINVAL: "invalid argument",
};

export class FSError extends Error {
    readonly code: FSErrorCode;
    readonly path: string;
    readonly syscall?: string;

    constructor(code: FSErrorCode, path: string, syscall?: string) {
        const message = `${code}: ${ERROR_MESSAGES[code]}, ${syscall ?? 'operation'} '${path}'`;
        super(message);

        this.name = 'FSError';
        this.code = code;
        this.path = path;

        if(syscall != null) {
            this.syscall = syscall;
        }

        if (Object.hasOwn(Error, 'captureStackTrace')) {
            (Error as unknown as {captureStackTrace: (obj: object, constructor?: unknown) => void}).captureStackTrace(this, FSError);
        }
    }

    static ENOENT(path: string, syscall?: string): FSError {
        return new FSError('ENOENT', path, syscall);
    }

    static EEXIST(path: string, syscall?: string): FSError {
        return new FSError('EEXIST', path, syscall);
    }

    static ENOTDIR(path: string, syscall?: string): FSError {
        return new FSError('ENOTDIR', path, syscall);
    }

    static EISDIR(path: string, syscall?: string): FSError {
        return new FSError('EISDIR', path, syscall);
    }

    static ENOTEMPTY(path: string, syscall?: string): FSError {
        return new FSError('ENOTEMPTY', path, syscall);
    }

    static EINVAL(path: string, syscall?: string): FSError {
        return new FSError('EINVAL', path, syscall);
    }
}

/**
 * Type guard to check if an error is an FSError with a specific code.
 */
export function isFSError(error: unknown, code?: FSErrorCode): error is FSError {
    if (!(error instanceof FSError)) return false;
    if (code != null && error.code !== code) return false;
    return true;
}
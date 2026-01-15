import { FSError } from "../error.ts";
import { validatePath } from "../path.ts";
import { 
    type FSCore, 
} from "./core/index.ts";

export interface RenameOps {
    rename(old_path: string, new_path: string): Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createRenameOps(core: FSCore): RenameOps {
    return {
        async rename(old_in: string, new_in: string): Promise<void> {
            const old_path = validatePath(old_in);
            const new_path = validatePath(new_in);

            if (old_path === new_path) return;

            if (old_path === '/') {
                throw FSError.EINVAL(old_path, 'rename');
            }

            if (new_path === '/') {
                throw FSError.EINVAL(old_path, 'rename');
            }

            // No recursion.
            if (new_path.startsWith(old_path.endsWith('/') ? old_path : `${old_path}/`)) {
                throw FSError.EINVAL(new_path, 'rename');
            }
            
            throw new Error("Not yet implemented!");
        }
    };
}
import {
	existsSync,
	mkdirSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

interface AtomicWriteOptions {
	dirMode?: number;
	fileMode?: number;
}

// atomically write a file by writing to a temp file and renaming into place.
// ensures parent directory exists and cleans up temp files on failure.
export const writeFileAtomic = (
	filePath: string,
	content: string,
	options: AtomicWriteOptions = {},
): void => {
	const dir = dirname(filePath);
	if (!existsSync(dir)) {
		if (options.dirMode !== undefined) {
			mkdirSync(dir, { recursive: true, mode: options.dirMode });
		} else {
			mkdirSync(dir, { recursive: true });
		}
	}

	const tempPath = join(dir, `.${basename(filePath)}.tmp.${process.pid}`);
	try {
		if (options.fileMode !== undefined) {
			writeFileSync(tempPath, content, {
				encoding: "utf-8",
				mode: options.fileMode,
			});
		} else {
			writeFileSync(tempPath, content, "utf-8");
		}
		renameSync(tempPath, filePath);
	} catch (error) {
		try {
			unlinkSync(tempPath);
		} catch {
			// ignore cleanup errors
		}
		throw error;
	}
};

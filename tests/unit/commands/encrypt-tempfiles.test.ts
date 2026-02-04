import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("secure temp file creation", () => {
	let tempDirs: string[] = [];

	afterEach(() => {
		// Cleanup any created temp directories
		for (const dir of tempDirs) {
			try {
				rmSync(dir, { recursive: true, force: true });
			} catch {}
		}
		tempDirs = [];
	});

	test("mkdtempSync creates unpredictable directory names", () => {
		// Create two temp directories and verify they differ
		const dir1 = mkdtempSync(join(tmpdir(), "devbox-"));
		const dir2 = mkdtempSync(join(tmpdir(), "devbox-"));
		tempDirs.push(dir1, dir2);

		expect(dir1).not.toBe(dir2);
		expect(dir1).toMatch(/devbox-[a-zA-Z0-9]+$/);
		expect(dir2).toMatch(/devbox-[a-zA-Z0-9]+$/);
	});

	test("mkdtempSync directories are not guessable from timestamp", () => {
		const timestamp = Date.now();
		const dir = mkdtempSync(join(tmpdir(), "devbox-"));
		tempDirs.push(dir);

		// Directory name should NOT contain the timestamp
		expect(dir).not.toContain(timestamp.toString());
	});
});

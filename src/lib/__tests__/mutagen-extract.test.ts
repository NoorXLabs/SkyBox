import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
	mkdirSync,
	rmSync,
	writeFileSync,
	readFileSync,
	existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("mutagen-extract", () => {
	let testDir: string;
	let originalEnv: string | undefined;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-test-mutagen-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		originalEnv = process.env.DEVBOX_HOME;
		process.env.DEVBOX_HOME = testDir;
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
		if (originalEnv !== undefined) {
			process.env.DEVBOX_HOME = originalEnv;
		} else {
			delete process.env.DEVBOX_HOME;
		}
	});

	test("needsMutagenExtraction returns true when no binary exists", async () => {
		const { needsMutagenExtraction } = await import("../mutagen-extract.ts");
		expect(needsMutagenExtraction()).toBe(true);
	});

	test("needsMutagenExtraction returns true when version file is stale", async () => {
		const { needsMutagenExtraction } = await import("../mutagen-extract.ts");
		const binDir = join(testDir, "bin");
		mkdirSync(binDir, { recursive: true });
		writeFileSync(join(binDir, "mutagen"), "fake-binary");
		writeFileSync(join(binDir, ".mutagen-version"), "0.16.0");
		expect(needsMutagenExtraction()).toBe(true);
	});

	test("needsMutagenExtraction returns false when version matches", async () => {
		const { needsMutagenExtraction, BUNDLED_MUTAGEN_VERSION } = await import(
			"../mutagen-extract.ts"
		);
		const binDir = join(testDir, "bin");
		mkdirSync(binDir, { recursive: true });
		writeFileSync(join(binDir, "mutagen"), "fake-binary");
		writeFileSync(join(binDir, ".mutagen-version"), BUNDLED_MUTAGEN_VERSION);
		expect(needsMutagenExtraction()).toBe(false);
	});

	test("recordMutagenVersion writes version file", async () => {
		const { recordMutagenVersion, BUNDLED_MUTAGEN_VERSION } = await import(
			"../mutagen-extract.ts"
		);
		const binDir = join(testDir, "bin");
		mkdirSync(binDir, { recursive: true });
		recordMutagenVersion();
		const versionPath = join(binDir, ".mutagen-version");
		expect(existsSync(versionPath)).toBe(true);
		expect(readFileSync(versionPath, "utf-8")).toBe(BUNDLED_MUTAGEN_VERSION);
	});
});

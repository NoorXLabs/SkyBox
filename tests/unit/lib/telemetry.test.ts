import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("telemetry", () => {
	let testDir: string;
	let originalHome: string | undefined;
	let originalTelemetry: string | undefined;
	let originalRybbitUrl: string | undefined;
	let originalRybbitSiteId: string | undefined;
	let originalRybbitApiKey: string | undefined;
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		testDir = join(tmpdir(), `skybox-test-telemetry-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });

		originalHome = process.env.SKYBOX_HOME;
		originalTelemetry = process.env.SKYBOX_TELEMETRY;
		originalRybbitUrl = process.env.RYBBIT_URL;
		originalRybbitSiteId = process.env.RYBBIT_SITE_ID;
		originalRybbitApiKey = process.env.RYBBIT_API_KEY;
		originalFetch = globalThis.fetch;

		process.env.SKYBOX_HOME = testDir;
		delete process.env.SKYBOX_TELEMETRY;
		// Set Rybbit env vars so telemetry is enabled in tests
		process.env.RYBBIT_URL = "https://test.example.com/api/track";
		process.env.RYBBIT_SITE_ID = "test-site-id";
		process.env.RYBBIT_API_KEY = "test-api-key";
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
		globalThis.fetch = originalFetch;

		for (const [key, val] of [
			["SKYBOX_HOME", originalHome],
			["SKYBOX_TELEMETRY", originalTelemetry],
			["RYBBIT_URL", originalRybbitUrl],
			["RYBBIT_SITE_ID", originalRybbitSiteId],
			["RYBBIT_API_KEY", originalRybbitApiKey],
		] as const) {
			if (val !== undefined) {
				process.env[key] = val;
			} else {
				delete process.env[key];
			}
		}
	});

	test("shouldTrackInstall returns true when no marker exists", async () => {
		const { shouldTrackInstall } = await import("@lib/telemetry.ts");
		expect(shouldTrackInstall()).toBe(true);
	});

	test("shouldTrackInstall returns false when marker exists", async () => {
		const { shouldTrackInstall } = await import("@lib/telemetry.ts");
		writeFileSync(join(testDir, ".installed"), "{}");
		expect(shouldTrackInstall()).toBe(false);
	});

	test("shouldTrackInstall returns false when Rybbit env vars are unset", async () => {
		const { shouldTrackInstall } = await import("@lib/telemetry.ts");
		delete process.env.RYBBIT_URL;
		delete process.env.RYBBIT_SITE_ID;
		delete process.env.RYBBIT_API_KEY;
		expect(shouldTrackInstall()).toBe(false);
	});

	test("shouldTrackInstall returns false when SKYBOX_TELEMETRY=0", async () => {
		const { shouldTrackInstall } = await import("@lib/telemetry.ts");
		process.env.SKYBOX_TELEMETRY = "0";
		expect(shouldTrackInstall()).toBe(false);
	});

	test("trackInstall writes marker file with correct metadata", async () => {
		const { trackInstall } = await import("@lib/telemetry.ts");
		// Mock fetch to prevent real HTTP calls
		globalThis.fetch = mock(() =>
			Promise.resolve(new Response(null, { status: 200 })),
		) as unknown as typeof fetch;

		trackInstall("0.7.7");

		const markerPath = join(testDir, ".installed");
		expect(existsSync(markerPath)).toBe(true);

		const marker = JSON.parse(readFileSync(markerPath, "utf-8"));
		expect(marker.version).toBe("0.7.7");
		expect(marker.installedAt).toBeTruthy();
		expect(marker.installMethod).toBeTruthy();
		expect(marker.platform).toMatch(/^\w+-\w+$/);
	});

	test("trackInstall writes marker even before HTTP completes", async () => {
		const { trackInstall } = await import("@lib/telemetry.ts");
		// Mock fetch that never resolves
		globalThis.fetch = mock(
			() => new Promise(() => {}),
		) as unknown as typeof fetch;

		trackInstall("0.7.7");

		// Marker should exist immediately (synchronous write)
		const markerPath = join(testDir, ".installed");
		expect(existsSync(markerPath)).toBe(true);
	});

	test("trackInstall does not throw on HTTP failure", async () => {
		const { trackInstall } = await import("@lib/telemetry.ts");
		globalThis.fetch = mock(() =>
			Promise.reject(new Error("network error")),
		) as unknown as typeof fetch;

		// Should not throw
		expect(() => trackInstall("0.7.7")).not.toThrow();
	});

	test("trackInstall does not send HTTP when marker write fails", async () => {
		const { trackInstall } = await import("@lib/telemetry.ts");
		const fetchMock = mock(() =>
			Promise.resolve(new Response(null, { status: 200 })),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		// Point SKYBOX_HOME to a path that can't be written
		process.env.SKYBOX_HOME = "/dev/null/impossible";

		trackInstall("0.7.7");

		// fetch should not have been called because marker write failed
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

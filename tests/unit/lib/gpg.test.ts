import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import {
	fetchMutagenPublicKey,
	fetchMutagenSignature,
	isGpgAvailable,
	verifyGpgSignature,
} from "@lib/gpg.ts";
import {
	createTestContext,
	type TestContext,
} from "@tests/helpers/test-utils.ts";

describe("GPG verification", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("gpg");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	describe("isGpgAvailable", () => {
		test("returns boolean", async () => {
			const result = await isGpgAvailable();
			expect(typeof result).toBe("boolean");
		});
	});

	describe("verifyGpgSignature", () => {
		test("returns error when GPG not available and signature check required", async () => {
			// If GPG is not installed, verification should fail gracefully
			const result = await verifyGpgSignature(
				Buffer.from("test"),
				Buffer.from("fake sig"),
				"fake key",
			);

			// Should return a result (success or failure based on GPG availability)
			expect(result).toHaveProperty("verified");
		});

		test("returns gpgUnavailable: true when GPG not installed", async () => {
			// Skip if GPG is available - this test verifies behavior when GPG is missing
			const gpgAvailable = await isGpgAvailable();
			if (gpgAvailable) return;

			const result = await verifyGpgSignature(
				Buffer.from("test data"),
				Buffer.from("fake signature"),
				"fake public key",
			);

			expect(result.verified).toBe(false);
			expect(result.gpgUnavailable).toBe(true);
		});

		test("cleans up temp directory after verification", async () => {
			// Skip if GPG is not available - this test requires GPG to be installed
			const gpgAvailable = await isGpgAvailable();
			if (!gpgAvailable) return;

			const tempBase = tmpdir();
			const beforeDirs = readdirSync(tempBase).filter((d) =>
				d.startsWith("devbox-gpg-"),
			);

			await verifyGpgSignature(
				Buffer.from("test"),
				Buffer.from("sig"),
				"-----BEGIN PGP PUBLIC KEY BLOCK-----\ntest\n-----END PGP PUBLIC KEY BLOCK-----",
			);

			const afterDirs = readdirSync(tempBase).filter((d) =>
				d.startsWith("devbox-gpg-"),
			);
			expect(afterDirs.length).toBe(beforeDirs.length);
		});
	});

	describe("fetchMutagenPublicKey", () => {
		test("returns string on success", async () => {
			const originalFetch = globalThis.fetch;
			globalThis.fetch = (async () =>
				new Response(
					"-----BEGIN PGP PUBLIC KEY BLOCK-----\nfake\n-----END PGP PUBLIC KEY BLOCK-----",
					{ status: 200 },
				)) as unknown as typeof fetch;

			try {
				const result = await fetchMutagenPublicKey();
				expect(typeof result).toBe("string");
				expect(result).toContain("BEGIN PGP PUBLIC KEY BLOCK");
			} finally {
				globalThis.fetch = originalFetch;
			}
		});

		test("returns null on fetch failure", async () => {
			const originalFetch = globalThis.fetch;
			globalThis.fetch = (async () =>
				new Response(null, { status: 404 })) as unknown as typeof fetch;

			try {
				const result = await fetchMutagenPublicKey();
				expect(result).toBeNull();
			} finally {
				globalThis.fetch = originalFetch;
			}
		});

		test("returns null on network error", async () => {
			const originalFetch = globalThis.fetch;
			globalThis.fetch = (async () => {
				throw new Error("network error");
			}) as unknown as typeof fetch;

			try {
				const result = await fetchMutagenPublicKey();
				expect(result).toBeNull();
			} finally {
				globalThis.fetch = originalFetch;
			}
		});
	});

	describe("fetchMutagenSignature", () => {
		test("returns Buffer on success", async () => {
			const originalFetch = globalThis.fetch;
			const fakeSignature = new Uint8Array([0x89, 0x02, 0x33]);
			globalThis.fetch = (async () =>
				new Response(fakeSignature, {
					status: 200,
				})) as unknown as typeof fetch;

			try {
				const result = await fetchMutagenSignature("0.18.1");
				expect(Buffer.isBuffer(result)).toBe(true);
			} finally {
				globalThis.fetch = originalFetch;
			}
		});

		test("returns null on fetch failure", async () => {
			const originalFetch = globalThis.fetch;
			globalThis.fetch = (async () =>
				new Response(null, { status: 404 })) as unknown as typeof fetch;

			try {
				const result = await fetchMutagenSignature("0.18.1");
				expect(result).toBeNull();
			} finally {
				globalThis.fetch = originalFetch;
			}
		});

		test("returns null on network error", async () => {
			const originalFetch = globalThis.fetch;
			globalThis.fetch = (async () => {
				throw new Error("network error");
			}) as unknown as typeof fetch;

			try {
				const result = await fetchMutagenSignature("0.18.1");
				expect(result).toBeNull();
			} finally {
				globalThis.fetch = originalFetch;
			}
		});
	});
});

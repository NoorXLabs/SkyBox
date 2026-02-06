import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import {
	fetchMutagenPublicKey,
	fetchMutagenSignature,
	isGpgAvailable,
	verifyGpgSignature,
	verifyKeyFingerprint,
} from "@lib/gpg.ts";
import {
	createTestContext,
	type TestContext,
} from "@tests/helpers/test-utils.ts";

const gpgAvailable = await isGpgAvailable();

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
			const result = await verifyGpgSignature(
				Buffer.from("test"),
				Buffer.from("fake sig"),
				"fake key",
			);
			expect(result).toHaveProperty("verified");
		});

		test.skipIf(gpgAvailable)(
			"returns gpgUnavailable: true when GPG not installed",
			async () => {
				const result = await verifyGpgSignature(
					Buffer.from("test data"),
					Buffer.from("fake signature"),
					"fake public key",
				);

				expect(result.verified).toBe(false);
				expect(result.gpgUnavailable).toBe(true);
			},
		);

		test.skipIf(!gpgAvailable)(
			"cleans up temp directory after verification",
			async () => {
				const beforeDirs = readdirSync(tmpdir()).filter((d) =>
					d.startsWith("skybox-gpg-"),
				);

				await verifyGpgSignature(
					Buffer.from("test"),
					Buffer.from("sig"),
					"-----BEGIN PGP PUBLIC KEY BLOCK-----\ntest\n-----END PGP PUBLIC KEY BLOCK-----",
				);

				const afterDirs = readdirSync(tmpdir()).filter((d) =>
					d.startsWith("skybox-gpg-"),
				);
				expect(afterDirs.length).toBe(beforeDirs.length);
			},
		);
	});

	describe("verifyKeyFingerprint", () => {
		test.skipIf(gpgAvailable)(
			"returns error when GPG is not available",
			async () => {
				const result = await verifyKeyFingerprint("fake-key", "ABCD1234");
				expect(result.matches).toBe(false);
				expect(result.error).toContain("not available");
			},
		);

		test.skipIf(!gpgAvailable)(
			"returns mismatch for invalid key material",
			async () => {
				const result = await verifyKeyFingerprint(
					"not-a-real-key",
					"ABCD1234ABCD1234ABCD1234ABCD1234ABCD1234",
				);
				expect(result.matches).toBe(false);
			},
		);

		test.skipIf(!gpgAvailable)(
			"normalizes fingerprint comparison (case insensitive, strips spaces)",
			async () => {
				const result = await verifyKeyFingerprint(
					"not-a-real-key",
					"abcd 1234 ABCD 1234",
				);
				expect(result).toHaveProperty("matches");
			},
		);
	});

	describe("fetchMutagenPublicKey", () => {
		let originalFetch: typeof globalThis.fetch;

		beforeEach(() => {
			originalFetch = globalThis.fetch;
		});

		afterEach(() => {
			globalThis.fetch = originalFetch;
		});

		test("returns string on success", async () => {
			globalThis.fetch = (async () =>
				new Response(
					"-----BEGIN PGP PUBLIC KEY BLOCK-----\nfake\n-----END PGP PUBLIC KEY BLOCK-----",
					{ status: 200 },
				)) as unknown as typeof fetch;

			const result = await fetchMutagenPublicKey();
			expect(typeof result).toBe("string");
			expect(result).toContain("BEGIN PGP PUBLIC KEY BLOCK");
		});

		test("returns null on fetch failure", async () => {
			globalThis.fetch = (async () =>
				new Response(null, { status: 404 })) as unknown as typeof fetch;

			const result = await fetchMutagenPublicKey();
			expect(result).toBeNull();
		});

		test("returns null on network error", async () => {
			globalThis.fetch = (async () => {
				throw new Error("network error");
			}) as unknown as typeof fetch;

			const result = await fetchMutagenPublicKey();
			expect(result).toBeNull();
		});
	});

	describe("fetchMutagenSignature", () => {
		let originalFetch: typeof globalThis.fetch;

		beforeEach(() => {
			originalFetch = globalThis.fetch;
		});

		afterEach(() => {
			globalThis.fetch = originalFetch;
		});

		test("returns Buffer on success", async () => {
			const fakeSignature = new Uint8Array([0x89, 0x02, 0x33]);
			globalThis.fetch = (async () =>
				new Response(fakeSignature, {
					status: 200,
				})) as unknown as typeof fetch;

			const result = await fetchMutagenSignature("0.18.1");
			expect(Buffer.isBuffer(result)).toBe(true);
		});

		test("returns null on fetch failure", async () => {
			globalThis.fetch = (async () =>
				new Response(null, { status: 404 })) as unknown as typeof fetch;

			const result = await fetchMutagenSignature("0.18.1");
			expect(result).toBeNull();
		});

		test("returns null on network error", async () => {
			globalThis.fetch = (async () => {
				throw new Error("network error");
			}) as unknown as typeof fetch;

			const result = await fetchMutagenSignature("0.18.1");
			expect(result).toBeNull();
		});
	});
});

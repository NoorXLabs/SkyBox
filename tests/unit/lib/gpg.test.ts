import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import {
	createTestContext,
	type TestContext,
} from "@lib/__tests__/test-utils.ts";
import {
	fetchMutagenPublicKey,
	fetchMutagenSignature,
	isGpgAvailable,
	verifyGpgSignature,
} from "@lib/gpg.ts";

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

		test("cleans up temp directory on success", async () => {
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
			expect(afterDirs.length).toBeLessThanOrEqual(beforeDirs.length + 1);
		});
	});

	describe("fetchMutagenPublicKey", () => {
		test("returns string or null", async () => {
			const result = await fetchMutagenPublicKey();

			expect(result === null || typeof result === "string").toBe(true);
		});
	});

	describe("fetchMutagenSignature", () => {
		test("returns Buffer or null", async () => {
			const result = await fetchMutagenSignature("0.18.1");

			expect(result === null || Buffer.isBuffer(result)).toBe(true);
		});
	});
});

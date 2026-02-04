import { describe, expect, test } from "bun:test";
import { TEMPLATES } from "@lib/constants.ts";

describe("INSTALL_METHOD", () => {
	test("defaults to source when env var is not set", async () => {
		const { INSTALL_METHOD } = await import("@lib/constants.ts");
		// In test/dev environment, env var is not set, so it should be "source"
		expect(INSTALL_METHOD).toBe("source");
	});
});

describe("template security", () => {
	test("bun template does not use curl pipe to bash", () => {
		const bunTemplate = TEMPLATES.find((t) => t.id === "bun");
		expect(bunTemplate).toBeDefined();

		const postCreateCommand = bunTemplate?.config.postCreateCommand ?? "";

		// Should not contain curl piped directly to bash/sh
		expect(postCreateCommand).not.toMatch(/curl\s+[^|]*\|\s*(ba)?sh/i);
	});

	test("no template uses curl pipe to bash pattern", () => {
		for (const template of TEMPLATES) {
			const postCreateCommand = template.config.postCreateCommand ?? "";
			const postStartCommand = template.config.postStartCommand ?? "";

			// Neither command should contain curl | bash
			expect(postCreateCommand).not.toMatch(/curl\s+[^|]*\|\s*(ba)?sh/i);
			expect(postStartCommand).not.toMatch(/curl\s+[^|]*\|\s*(ba)?sh/i);
		}
	});
});

describe("devcontainer image security", () => {
	test("all templates with images use SHA256 digests", () => {
		for (const template of TEMPLATES) {
			const image = template.config.image;
			if (image) {
				// Images should use immutable @sha256: digest format
				const hasShaDigest = image.includes("@sha256:");
				expect(hasShaDigest).toBe(true);

				// Should not use mutable tags like :latest, :1, etc.
				const hasMutableTag =
					/:[\w.-]+$/.test(image) && !image.includes("@sha256:");
				expect(hasMutableTag).toBe(false);
			}
		}
	});

	test("SHA256 digests are valid format", () => {
		for (const template of TEMPLATES) {
			const image = template.config.image;
			if (image?.includes("@sha256:")) {
				// SHA256 hash should be 64 hex characters
				const hashMatch = image.match(/@sha256:([a-f0-9]+)$/);
				expect(hashMatch).not.toBeNull();
				expect(hashMatch?.[1].length).toBe(64);
			}
		}
	});
});

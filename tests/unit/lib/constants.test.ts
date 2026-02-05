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

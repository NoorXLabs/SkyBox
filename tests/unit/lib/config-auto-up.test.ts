import { describe, expect, test } from "bun:test";
import { isAutoUpEnabled } from "@lib/config.ts";
import type { SkyboxConfigV2 } from "@typedefs/index.ts";

/**
 * Helper to create a minimal valid SkyboxConfigV2 for testing.
 * All fields are empty/default unless overridden.
 */
function createTestConfig(
	overrides: Partial<SkyboxConfigV2> = {},
): SkyboxConfigV2 {
	return {
		editor: "code",
		defaults: {
			sync_mode: "two-way-resolved",
			ignore: [],
			...overrides.defaults,
		},
		remotes: {},
		projects: {},
		...overrides,
	};
}

describe("isAutoUpEnabled", () => {
	describe("project-level settings", () => {
		test("returns true when project has auto_up: true (overrides global false)", () => {
			const config = createTestConfig({
				defaults: {
					sync_mode: "two-way-resolved",
					ignore: [],
					auto_up: false,
				},
				projects: {
					"my-project": {
						remote: "default",
						auto_up: true,
					},
				},
			});

			expect(isAutoUpEnabled("my-project", config)).toBe(true);
		});

		test("returns true when project has auto_up: true (overrides global true)", () => {
			const config = createTestConfig({
				defaults: {
					sync_mode: "two-way-resolved",
					ignore: [],
					auto_up: true,
				},
				projects: {
					"my-project": {
						remote: "default",
						auto_up: true,
					},
				},
			});

			expect(isAutoUpEnabled("my-project", config)).toBe(true);
		});

		test("returns false when project has auto_up: false (overrides global true)", () => {
			const config = createTestConfig({
				defaults: {
					sync_mode: "two-way-resolved",
					ignore: [],
					auto_up: true,
				},
				projects: {
					"my-project": {
						remote: "default",
						auto_up: false,
					},
				},
			});

			expect(isAutoUpEnabled("my-project", config)).toBe(false);
		});

		test("returns false when project has auto_up: false (overrides global false)", () => {
			const config = createTestConfig({
				defaults: {
					sync_mode: "two-way-resolved",
					ignore: [],
					auto_up: false,
				},
				projects: {
					"my-project": {
						remote: "default",
						auto_up: false,
					},
				},
			});

			expect(isAutoUpEnabled("my-project", config)).toBe(false);
		});
	});

	describe("global defaults fallback", () => {
		test("returns true when project has no setting and global defaults.auto_up is true", () => {
			const config = createTestConfig({
				defaults: {
					sync_mode: "two-way-resolved",
					ignore: [],
					auto_up: true,
				},
				projects: {
					"my-project": {
						remote: "default",
						// auto_up not set
					},
				},
			});

			expect(isAutoUpEnabled("my-project", config)).toBe(true);
		});

		test("returns false when project has no setting and global defaults.auto_up is false", () => {
			const config = createTestConfig({
				defaults: {
					sync_mode: "two-way-resolved",
					ignore: [],
					auto_up: false,
				},
				projects: {
					"my-project": {
						remote: "default",
						// auto_up not set
					},
				},
			});

			expect(isAutoUpEnabled("my-project", config)).toBe(false);
		});
	});

	describe("default behavior (no settings)", () => {
		test("returns false when neither project nor global setting exists", () => {
			const config = createTestConfig({
				defaults: {
					sync_mode: "two-way-resolved",
					ignore: [],
					// auto_up not set
				},
				projects: {
					"my-project": {
						remote: "default",
						// auto_up not set
					},
				},
			});

			expect(isAutoUpEnabled("my-project", config)).toBe(false);
		});

		test("returns false when project does not exist in config and no global default", () => {
			const config = createTestConfig({
				defaults: {
					sync_mode: "two-way-resolved",
					ignore: [],
					// auto_up not set
				},
				projects: {
					"other-project": {
						remote: "default",
					},
				},
			});

			expect(isAutoUpEnabled("nonexistent-project", config)).toBe(false);
		});

		test("falls back to global default when project does not exist in config", () => {
			const config = createTestConfig({
				defaults: {
					sync_mode: "two-way-resolved",
					ignore: [],
					auto_up: true,
				},
				projects: {
					"other-project": {
						remote: "default",
					},
				},
			});

			// Even for nonexistent projects, falls back to global default
			expect(isAutoUpEnabled("nonexistent-project", config)).toBe(true);
		});

		test("returns false when projects object is empty", () => {
			const config = createTestConfig({
				defaults: {
					sync_mode: "two-way-resolved",
					ignore: [],
					// auto_up not set
				},
				projects: {},
			});

			expect(isAutoUpEnabled("any-project", config)).toBe(false);
		});
	});
});

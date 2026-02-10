// tests/unit/commands/doctor.test.ts

import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkEditor } from "@commands/doctor.ts";
import {
	createTestConfig,
	setupTestContext,
	writeTestConfig,
} from "@tests/helpers/test-utils.ts";

describe("doctor command", () => {
	const getCtx = setupTestContext("doctor");

	const writeDoctorConfig = (
		overrides: Parameters<typeof createTestConfig>[0] = {},
	): void => {
		writeTestConfig(getCtx().testDir, createTestConfig(overrides));
	};

	test("should detect missing config", async () => {
		const { configExists } = await import("@lib/config.ts");
		expect(configExists()).toBe(false);
	});

	test("should detect valid config", async () => {
		writeDoctorConfig({
			remotes: {
				work: {
					host: "work-server",
					path: "~/code",
				},
			},
		});

		const { configExists, loadConfig } = await import("@lib/config.ts");
		expect(configExists()).toBe(true);

		const config = loadConfig();
		expect(config).not.toBeNull();
		expect(Object.keys(config?.remotes || {})).toHaveLength(1);
	});

	test("should throw on invalid YAML config", async () => {
		// Create invalid YAML
		writeFileSync(
			join(getCtx().testDir, "config.yaml"),
			"invalid: yaml: syntax:",
		);

		const { loadConfig } = await import("@lib/config.ts");
		expect(() => loadConfig()).toThrow();
	});

	test("checkEditor returns pass when editor command is available", async () => {
		writeDoctorConfig({ editor: "zed" });

		const result = await checkEditor(async () => ({
			status: "available",
			command: "zed",
		}));

		expect(result.status).toBe("pass");
		expect(result.message).toContain("'zed' is available");
	});

	test("checkEditor warns when fallback app will be used", async () => {
		writeDoctorConfig({ editor: "zed" });

		const result = await checkEditor(async () => ({
			status: "fallback",
			command: "zed",
			fallbackApp: "Zed",
		}));

		expect(result.status).toBe("warn");
		expect(result.message).toContain("macOS fallback app 'Zed'");
	});

	test("checkEditor warns when editor command is missing", async () => {
		writeDoctorConfig({ editor: "unknown-editor" });

		const result = await checkEditor(async () => ({
			status: "missing",
			command: "unknown-editor",
		}));

		expect(result.status).toBe("warn");
		expect(result.message).toContain("was not found");
	});
});

// tests/unit/commands/config-cmd.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { configCommand, setConfigValue, showConfig } from "@commands/config.ts";
import { loadConfig, saveConfig } from "@lib/config.ts";
import {
	createTestConfig,
	createUnitTestContext,
	type UnitTestContext,
} from "@tests/helpers/test-utils.ts";
import type { SkyboxConfigV2 } from "@typedefs/index.ts";

describe("config command", () => {
	let ctx: UnitTestContext;

	const saveCommandConfig = (overrides: Partial<SkyboxConfigV2> = {}): void => {
		saveConfig(createTestConfig(overrides));
	};

	beforeEach(() => {
		ctx = createUnitTestContext("config");
	});

	afterEach(() => {
		ctx.cleanup();
		ctx.restoreConsole();
	});

	describe("showConfig", () => {
		test("shows config with remotes", async () => {
			saveCommandConfig({
				remotes: {
					myserver: {
						host: "192.168.1.100",
						user: "root",
						path: "~/code",
					},
					production: {
						host: "prod.example.com",
						user: "deploy",
						path: "/var/www",
						key: "~/.ssh/prod_key",
					},
				},
			});

			await showConfig();

			const output = ctx.logOutput.join("\n");
			expect(output).toContain("Remotes:");
			expect(output).toContain("myserver");
			expect(output).toContain("root@192.168.1.100:~/code");
			expect(output).toContain("production");
			expect(output).toContain("deploy@prod.example.com:/var/www");
			expect(output).toContain("Settings:");
			expect(output).toContain("editor: cursor");
		});

		test("shows message when no remotes configured", async () => {
			saveCommandConfig({
				editor: "code",
			});

			await showConfig();

			const output = ctx.logOutput.join("\n");
			expect(output).toContain("Remotes:");
			expect(output).toContain("No remotes configured");
			expect(output).toContain("editor: code");
		});

		test("shows remote without user part when user is undefined", async () => {
			saveCommandConfig({
				editor: "vim",
				remotes: {
					sshconfig: {
						host: "myhost",
						path: "~/projects",
					},
				},
			});

			await showConfig();

			const output = ctx.logOutput.join("\n");
			expect(output).toContain("sshconfig");
			expect(output).toContain("myhost:~/projects");
			// Should NOT contain @ before host when user is undefined
			expect(output).not.toContain("@myhost");
		});
	});

	describe("setConfigValue", () => {
		test("sets editor value", async () => {
			saveCommandConfig();

			await setConfigValue("editor", "vim");

			const config = loadConfig();
			expect(config?.editor).toBe("vim");
		});

		test("rejects unknown config key", async () => {
			saveCommandConfig();

			await setConfigValue("unknown_key", "value");

			const output = ctx.logOutput.join("\n");
			expect(output).toContain("Unknown config key");

			// Config should remain unchanged
			const config = loadConfig();
			expect(config?.editor).toBe("cursor");
		});
	});

	describe("configCommand", () => {
		test("shows config when called without options", async () => {
			saveCommandConfig({
				editor: "code",
				remotes: {
					testremote: {
						host: "test.host",
						user: "testuser",
						path: "~/test",
					},
				},
			});

			await configCommand({});

			const output = ctx.logOutput.join("\n");
			expect(output).toContain("Remotes:");
			expect(output).toContain("testremote");
			expect(output).toContain("editor: code");
		});

		test("handles set subcommand", async () => {
			saveCommandConfig();

			await configCommand({}, "set", "editor", "nano");

			const config = loadConfig();
			expect(config?.editor).toBe("nano");
		});

		test("shows error when set missing arguments", async () => {
			saveCommandConfig();

			await configCommand({}, "set", "editor");

			const output = ctx.logOutput.join("\n");
			expect(output).toContain("Missing arguments");
		});

		test("shows error for unknown subcommand", async () => {
			saveCommandConfig();

			await configCommand({}, "unknown");

			const output = ctx.logOutput.join("\n");
			expect(output).toContain("Unknown subcommand");
		});
	});
});

// src/commands/__tests__/config-cmd.test.ts
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, saveConfig } from "../../lib/config.ts";
import { configCommand, setConfigValue, showConfig } from "../config.ts";

describe("config command", () => {
	let testDir: string;
	let originalEnv: string | undefined;
	let consoleLogSpy: ReturnType<typeof spyOn>;
	let logOutput: string[];

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-config-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		originalEnv = process.env.DEVBOX_HOME;
		process.env.DEVBOX_HOME = testDir;

		// Capture console.log output
		logOutput = [];
		consoleLogSpy = spyOn(console, "log").mockImplementation(
			(...args: unknown[]) => {
				logOutput.push(
					args.map((a) => (typeof a === "string" ? a : String(a))).join(" "),
				);
			},
		);
	});

	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		if (originalEnv) {
			process.env.DEVBOX_HOME = originalEnv;
		} else {
			delete process.env.DEVBOX_HOME;
		}
		consoleLogSpy.mockRestore();
	});

	describe("showConfig", () => {
		test("shows config with remotes", async () => {
			// Create test config with remotes
			saveConfig({
				editor: "cursor",
				defaults: {
					sync_mode: "two-way-resolved",
					ignore: [],
				},
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
				projects: {},
			});

			await showConfig();

			const output = logOutput.join("\n");
			expect(output).toContain("Remotes:");
			expect(output).toContain("myserver");
			expect(output).toContain("root@192.168.1.100:~/code");
			expect(output).toContain("production");
			expect(output).toContain("deploy@prod.example.com:/var/www");
			expect(output).toContain("Settings:");
			expect(output).toContain("editor: cursor");
		});

		test("shows message when no remotes configured", async () => {
			// Create test config without remotes
			saveConfig({
				editor: "code",
				defaults: {
					sync_mode: "two-way-resolved",
					ignore: [],
				},
				remotes: {},
				projects: {},
			});

			await showConfig();

			const output = logOutput.join("\n");
			expect(output).toContain("Remotes:");
			expect(output).toContain("No remotes configured");
			expect(output).toContain("editor: code");
		});

		test("shows remote without user part when user is undefined", async () => {
			// Create test config with remote that has no user (uses SSH config default)
			saveConfig({
				editor: "vim",
				defaults: {
					sync_mode: "two-way-resolved",
					ignore: [],
				},
				remotes: {
					sshconfig: {
						host: "myhost",
						path: "~/projects",
					},
				},
				projects: {},
			});

			await showConfig();

			const output = logOutput.join("\n");
			expect(output).toContain("sshconfig");
			expect(output).toContain("myhost:~/projects");
			// Should NOT contain @ before host when user is undefined
			expect(output).not.toContain("@myhost");
		});
	});

	describe("setConfigValue", () => {
		test("sets editor value", async () => {
			// Create initial config
			saveConfig({
				editor: "cursor",
				defaults: {
					sync_mode: "two-way-resolved",
					ignore: [],
				},
				remotes: {},
				projects: {},
			});

			await setConfigValue("editor", "vim");

			const config = loadConfig();
			expect(config?.editor).toBe("vim");
		});

		test("rejects unknown config key", async () => {
			// Create initial config
			saveConfig({
				editor: "cursor",
				defaults: {
					sync_mode: "two-way-resolved",
					ignore: [],
				},
				remotes: {},
				projects: {},
			});

			await setConfigValue("unknown_key", "value");

			const output = logOutput.join("\n");
			expect(output).toContain("Unknown config key");

			// Config should remain unchanged
			const config = loadConfig();
			expect(config?.editor).toBe("cursor");
		});
	});

	describe("configCommand", () => {
		test("shows config when called without options", async () => {
			// Create test config
			saveConfig({
				editor: "code",
				defaults: {
					sync_mode: "two-way-resolved",
					ignore: [],
				},
				remotes: {
					testremote: {
						host: "test.host",
						user: "testuser",
						path: "~/test",
					},
				},
				projects: {},
			});

			await configCommand({});

			const output = logOutput.join("\n");
			expect(output).toContain("Remotes:");
			expect(output).toContain("testremote");
			expect(output).toContain("editor: code");
		});

		test("handles set subcommand", async () => {
			// Create initial config
			saveConfig({
				editor: "cursor",
				defaults: {
					sync_mode: "two-way-resolved",
					ignore: [],
				},
				remotes: {},
				projects: {},
			});

			await configCommand({}, "set", "editor", "nano");

			const config = loadConfig();
			expect(config?.editor).toBe("nano");
		});

		test("shows error when set missing arguments", async () => {
			saveConfig({
				editor: "cursor",
				defaults: {
					sync_mode: "two-way-resolved",
					ignore: [],
				},
				remotes: {},
				projects: {},
			});

			await configCommand({}, "set", "editor");

			const output = logOutput.join("\n");
			expect(output).toContain("Missing arguments");
		});

		test("shows error for unknown subcommand", async () => {
			saveConfig({
				editor: "cursor",
				defaults: {
					sync_mode: "two-way-resolved",
					ignore: [],
				},
				remotes: {},
				projects: {},
			});

			await configCommand({}, "unknown");

			const output = logOutput.join("\n");
			expect(output).toContain("Unknown subcommand");
		});
	});
});

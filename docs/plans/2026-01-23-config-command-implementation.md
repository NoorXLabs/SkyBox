# Config Command Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `devbox config` and `devbox remote` commands to support multiple remote servers with per-project associations.

**Architecture:** Extend the existing config system with a new `remotes` map. Each remote stores host, user, path, and key. Projects reference remotes by name. Migrate existing single-remote configs automatically. Commands follow existing patterns (Commander.js CLI, inquirer prompts, chalk output).

**Tech Stack:** TypeScript, Commander.js, inquirer, chalk, execa, yaml

---

## Task 1: Update Types for Multi-Remote Support

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Write the new type definitions**

Add these types to `src/types/index.ts`:

```typescript
// New remote entry type (replaces single RemoteConfig)
export interface RemoteEntry {
	host: string;      // SSH host (hostname or IP)
	user: string;      // SSH username
	path: string;      // Remote projects directory
	key?: string;      // Path to SSH private key (optional)
}

// Updated config with remotes map
export interface DevboxConfigV2 {
	editor: string;
	defaults: SyncDefaults;
	remotes: Record<string, RemoteEntry>;  // name -> remote
	projects: Record<string, ProjectConfigV2>;
	templates?: Record<string, string>;
}

// Updated project config with remote reference
export interface ProjectConfigV2 {
	remote: string;    // Name of the remote this project belongs to
	ignore?: string[];
	editor?: string;
}
```

**Step 2: Run type check to verify no errors**

Run: `bun run --cwd /Users/noorchasib/Documents/Code/DevBox/.worktrees/config-command check`

If no `check` script, run: `bunx tsc --noEmit`

Expected: No errors (new types are additive)

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add types for multi-remote config support"
```

---

## Task 2: Add Config Migration Logic

**Files:**
- Create: `src/lib/migration.ts`
- Create: `src/lib/__tests__/migration.test.ts`

**Step 1: Write the failing test**

Create `src/lib/__tests__/migration.test.ts`:

```typescript
// src/lib/__tests__/migration.test.ts
import { describe, expect, test } from "bun:test";
import { migrateConfig, needsMigration } from "../migration.ts";
import type { DevboxConfig } from "../../types/index.ts";

describe("config migration", () => {
	describe("needsMigration", () => {
		test("returns true for old single-remote config", () => {
			const oldConfig = {
				remote: { host: "my-server", base_path: "~/code" },
				editor: "cursor",
				defaults: { sync_mode: "two-way-resolved", ignore: [] },
				projects: {},
			};
			expect(needsMigration(oldConfig)).toBe(true);
		});

		test("returns false for new multi-remote config", () => {
			const newConfig = {
				editor: "cursor",
				defaults: { sync_mode: "two-way-resolved", ignore: [] },
				remotes: { "my-server": { host: "my-server", user: "root", path: "~/code" } },
				projects: {},
			};
			expect(needsMigration(newConfig)).toBe(false);
		});
	});

	describe("migrateConfig", () => {
		test("migrates old config to new format", () => {
			const oldConfig: DevboxConfig = {
				remote: { host: "my-server", base_path: "~/code" },
				editor: "cursor",
				defaults: { sync_mode: "two-way-resolved", ignore: [] },
				projects: { "my-app": {} },
			};

			const result = migrateConfig(oldConfig);

			expect(result.remotes).toBeDefined();
			expect(result.remotes["my-server"]).toEqual({
				host: "my-server",
				user: null,
				path: "~/code",
				key: null,
			});
			expect(result.projects["my-app"].remote).toBe("my-server");
			expect(result.remote).toBeUndefined();
		});

		test("preserves existing project settings during migration", () => {
			const oldConfig: DevboxConfig = {
				remote: { host: "my-server", base_path: "~/code" },
				editor: "code",
				defaults: { sync_mode: "two-way-resolved", ignore: [] },
				projects: { "my-app": { ignore: ["custom/*"], editor: "vim" } },
			};

			const result = migrateConfig(oldConfig);

			expect(result.projects["my-app"].ignore).toEqual(["custom/*"]);
			expect(result.projects["my-app"].editor).toBe("vim");
			expect(result.projects["my-app"].remote).toBe("my-server");
		});
	});
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/__tests__/migration.test.ts`

Expected: FAIL (module not found)

**Step 3: Write minimal implementation**

Create `src/lib/migration.ts`:

```typescript
// src/lib/migration.ts
import type { DevboxConfig, DevboxConfigV2, RemoteEntry } from "../types/index.ts";

/**
 * Check if config needs migration from old single-remote format
 */
export function needsMigration(config: unknown): boolean {
	if (!config || typeof config !== "object") return false;
	const c = config as Record<string, unknown>;
	// Old format has `remote` object, new format has `remotes` map
	return "remote" in c && !("remotes" in c);
}

/**
 * Migrate old single-remote config to new multi-remote format
 */
export function migrateConfig(oldConfig: DevboxConfig): DevboxConfigV2 {
	const remoteName = oldConfig.remote.host;

	const newRemote: RemoteEntry = {
		host: oldConfig.remote.host,
		user: null as unknown as string, // Will use SSH config
		path: oldConfig.remote.base_path,
		key: null as unknown as string,  // Will use SSH config
	};

	// Update all projects to reference the migrated remote
	const migratedProjects: Record<string, { remote: string; ignore?: string[]; editor?: string }> = {};
	for (const [name, project] of Object.entries(oldConfig.projects)) {
		migratedProjects[name] = {
			...project,
			remote: remoteName,
		};
	}

	// Return new format without the old `remote` field
	return {
		editor: oldConfig.editor,
		defaults: oldConfig.defaults,
		remotes: { [remoteName]: newRemote },
		projects: migratedProjects,
		templates: oldConfig.templates,
	};
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/__tests__/migration.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/migration.ts src/lib/__tests__/migration.test.ts
git commit -m "feat: add config migration from single to multi-remote format"
```

---

## Task 3: Update Config Module with Migration

**Files:**
- Modify: `src/lib/config.ts`
- Modify: `src/lib/__tests__/config.test.ts`

**Step 1: Write the failing test**

Add to `src/lib/__tests__/config.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("loadConfig with migration", () => {
	let testDir: string;
	let originalEnv: string | undefined;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-config-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		originalEnv = process.env.DEVBOX_HOME;
		process.env.DEVBOX_HOME = testDir;
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
	});

	test("auto-migrates old config format on load", async () => {
		const oldConfig = `
remote:
  host: my-server
  base_path: ~/code
editor: cursor
defaults:
  sync_mode: two-way-resolved
  ignore: []
projects:
  my-app: {}
`;
		writeFileSync(join(testDir, "config.yaml"), oldConfig);

		// Clear module cache for fresh import
		const { loadConfig } = await import("../config.ts");
		const config = loadConfig();

		expect(config).not.toBeNull();
		expect(config!.remotes).toBeDefined();
		expect(config!.remotes["my-server"]).toBeDefined();
		expect((config as any).remote).toBeUndefined();
	});
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/__tests__/config.test.ts --test-name-pattern "auto-migrates"`

Expected: FAIL (remotes not defined)

**Step 3: Update config.ts to handle migration**

Modify `src/lib/config.ts`:

```typescript
// src/lib/config.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parse, stringify } from "yaml";
import type { DevboxConfig, DevboxConfigV2 } from "../types/index.ts";
import { migrateConfig, needsMigration } from "./migration.ts";
import { info } from "./ui.ts";

function getConfigPath(): string {
	const home =
		process.env.DEVBOX_HOME || `${require("node:os").homedir()}/.devbox`;
	return `${home}/config.yaml`;
}

export function configExists(): boolean {
	return existsSync(getConfigPath());
}

export function loadConfig(): DevboxConfigV2 | null {
	const configPath = getConfigPath();
	if (!existsSync(configPath)) {
		return null;
	}

	const content = readFileSync(configPath, "utf-8");
	const rawConfig = parse(content);

	// Auto-migrate old format
	if (needsMigration(rawConfig)) {
		const migrated = migrateConfig(rawConfig as DevboxConfig);
		saveConfig(migrated);
		info("Migrated config to support multiple remotes. Your existing setup is preserved.");
		return migrated;
	}

	return rawConfig as DevboxConfigV2;
}

export function saveConfig(config: DevboxConfigV2): void {
	const configPath = getConfigPath();
	const dir = dirname(configPath);

	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	const content = stringify(config);
	writeFileSync(configPath, content, "utf-8");
}

// Helper to get a specific remote
export function getRemote(name: string): { host: string; user: string; path: string; key?: string } | null {
	const config = loadConfig();
	if (!config || !config.remotes[name]) {
		return null;
	}
	return config.remotes[name];
}

// Helper to list all remotes
export function listRemotes(): Array<{ name: string; host: string; user: string; path: string }> {
	const config = loadConfig();
	if (!config || !config.remotes) {
		return [];
	}
	return Object.entries(config.remotes).map(([name, remote]) => ({
		name,
		host: remote.host,
		user: remote.user,
		path: remote.path,
	}));
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/__tests__/config.test.ts`

Expected: PASS

**Step 5: Run full test suite to ensure no regressions**

Run: `bun test`

Expected: All tests pass (may need to update other tests that depend on old config format)

**Step 6: Commit**

```bash
git add src/lib/config.ts src/lib/__tests__/config.test.ts
git commit -m "feat: auto-migrate config on load, add remote helpers"
```

---

## Task 4: Implement `devbox remote add` Command

**Files:**
- Create: `src/commands/remote.ts`
- Create: `src/commands/__tests__/remote.test.ts`

**Step 1: Write the failing test**

Create `src/commands/__tests__/remote.test.ts`:

```typescript
// src/commands/__tests__/remote.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";

describe("remote command", () => {
	let testDir: string;
	let originalEnv: string | undefined;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-remote-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		originalEnv = process.env.DEVBOX_HOME;
		process.env.DEVBOX_HOME = testDir;

		// Create minimal config
		writeFileSync(
			join(testDir, "config.yaml"),
			`editor: cursor
defaults:
  sync_mode: two-way-resolved
  ignore: []
remotes: {}
projects: {}
`
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
	});

	describe("parseRemoteString", () => {
		test("parses user@host:path format", async () => {
			const { parseRemoteString } = await import("../remote.ts");
			const result = parseRemoteString("noor@192.168.1.50:/srv/Projects");

			expect(result).toEqual({
				user: "noor",
				host: "192.168.1.50",
				path: "/srv/Projects",
			});
		});

		test("returns null for invalid format", async () => {
			const { parseRemoteString } = await import("../remote.ts");
			expect(parseRemoteString("invalid")).toBeNull();
			expect(parseRemoteString("host:path")).toBeNull();
		});
	});

	describe("addRemote", () => {
		test("adds remote to config", async () => {
			const { addRemoteDirect } = await import("../remote.ts");

			await addRemoteDirect("work-nas", {
				user: "noor",
				host: "192.168.1.50",
				path: "/srv/Projects",
				key: "~/.ssh/id_ed25519",
			});

			const configContent = readFileSync(join(testDir, "config.yaml"), "utf-8");
			const config = parse(configContent);

			expect(config.remotes["work-nas"]).toBeDefined();
			expect(config.remotes["work-nas"].host).toBe("192.168.1.50");
			expect(config.remotes["work-nas"].user).toBe("noor");
			expect(config.remotes["work-nas"].path).toBe("/srv/Projects");
		});

		test("rejects duplicate remote name", async () => {
			const { addRemoteDirect } = await import("../remote.ts");

			await addRemoteDirect("work-nas", {
				user: "noor",
				host: "192.168.1.50",
				path: "/srv/Projects",
			});

			await expect(
				addRemoteDirect("work-nas", {
					user: "other",
					host: "other.host",
					path: "/other/path",
				})
			).rejects.toThrow("already exists");
		});
	});
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/commands/__tests__/remote.test.ts`

Expected: FAIL (module not found)

**Step 3: Write minimal implementation**

Create `src/commands/remote.ts`:

```typescript
// src/commands/remote.ts
import chalk from "chalk";
import inquirer from "inquirer";
import { loadConfig, saveConfig } from "../lib/config.ts";
import { findSSHKeys, testConnection, copyKey, runRemoteCommand } from "../lib/ssh.ts";
import { error, header, info, spinner, success, warn } from "../lib/ui.ts";
import type { RemoteEntry } from "../types/index.ts";

/**
 * Parse remote string in format: user@host:path
 */
export function parseRemoteString(str: string): { user: string; host: string; path: string } | null {
	const match = str.match(/^([^@]+)@([^:]+):(.+)$/);
	if (!match) return null;
	return { user: match[1], host: match[2], path: match[3] };
}

/**
 * Add a remote directly (used by CLI direct mode)
 */
export async function addRemoteDirect(
	name: string,
	remote: { user: string; host: string; path: string; key?: string }
): Promise<void> {
	const config = loadConfig();
	if (!config) {
		throw new Error("devbox not configured. Run 'devbox init' first.");
	}

	if (config.remotes[name]) {
		throw new Error(`Remote '${name}' already exists. Use 'devbox remote remove ${name}' first.`);
	}

	config.remotes[name] = {
		host: remote.host,
		user: remote.user,
		path: remote.path,
		key: remote.key,
	};

	saveConfig(config);
}

/**
 * Interactive wizard to add a remote
 */
export async function addRemoteInteractive(): Promise<void> {
	const config = loadConfig();
	if (!config) {
		error("devbox not configured. Run 'devbox init' first.");
		process.exit(1);
	}

	const { name } = await inquirer.prompt([
		{ type: "input", name: "name", message: "Remote name:" },
	]);

	if (config.remotes[name]) {
		error(`Remote '${name}' already exists.`);
		process.exit(1);
	}

	const { host, user, path } = await inquirer.prompt([
		{ type: "input", name: "host", message: "SSH host:" },
		{ type: "input", name: "user", message: "SSH user:", default: "root" },
		{ type: "input", name: "path", message: "Projects path on remote:", default: "~/code" },
	]);

	// SSH key selection
	const keys = findSSHKeys();
	const keyChoices = [
		{ name: "+ Enter custom path...", value: "__custom__" },
		...keys.map((k) => ({ name: k, value: k })),
	];

	const { keyChoice } = await inquirer.prompt([
		{
			type: "rawlist",
			name: "keyChoice",
			message: "Select SSH key:",
			choices: keyChoices,
		},
	]);

	let identityFile: string | undefined;
	if (keyChoice === "__custom__") {
		const { customPath } = await inquirer.prompt([
			{ type: "input", name: "customPath", message: "Path to SSH private key:" },
		]);
		identityFile = customPath.replace(/^~/, process.env.HOME || "");
	} else {
		identityFile = keyChoice;
	}

	// Test connection
	const spin = spinner("Testing SSH connection...");
	const connectString = `${user}@${host}`;
	const connResult = await testConnection(connectString, identityFile);

	if (connResult.success) {
		spin.succeed("SSH connection successful");
	} else {
		spin.fail("SSH connection failed");

		const { shouldCopy } = await inquirer.prompt([
			{
				type: "confirm",
				name: "shouldCopy",
				message: "Copy SSH key to server? (requires password)",
				default: true,
			},
		]);

		if (shouldCopy && identityFile) {
			info("Running ssh-copy-id...");
			const copyResult = await copyKey(connectString, identityFile);
			if (!copyResult.success) {
				error("Failed to copy SSH key. Remote was not added.");
				process.exit(1);
			}
			success("SSH key copied successfully");
		} else {
			error("Remote was not added.");
			process.exit(1);
		}
	}

	// Check/create remote directory
	const checkSpin = spinner("Checking remote directory...");
	const checkResult = await runRemoteCommand(
		connectString,
		`ls -d ${path} 2>/dev/null || echo "__NOT_FOUND__"`,
		identityFile
	);

	if (checkResult.stdout?.includes("__NOT_FOUND__")) {
		checkSpin.warn("Directory doesn't exist");
		const { createDir } = await inquirer.prompt([
			{
				type: "confirm",
				name: "createDir",
				message: `Create ${path} on remote?`,
				default: true,
			},
		]);

		if (createDir) {
			await runRemoteCommand(connectString, `mkdir -p ${path}`, identityFile);
			success("Created remote directory");
		}
	} else {
		checkSpin.succeed("Remote directory exists");
	}

	// Save remote
	config.remotes[name] = {
		host,
		user,
		path,
		key: identityFile,
	};
	saveConfig(config);

	success(`Remote '${name}' added successfully.`);
}

/**
 * List all configured remotes
 */
export async function listRemotes(): Promise<void> {
	const config = loadConfig();
	if (!config) {
		error("devbox not configured. Run 'devbox init' first.");
		process.exit(1);
	}

	const remotes = Object.entries(config.remotes);
	if (remotes.length === 0) {
		console.log();
		info("No remotes configured. Run 'devbox remote add' to add one.");
		return;
	}

	console.log();
	header("Remotes:");
	console.log();
	for (const [name, remote] of remotes) {
		console.log(`  ${chalk.bold(name)}  ${remote.user}@${remote.host}:${remote.path}`);
	}
	console.log();
}

/**
 * Remove a remote
 */
export async function removeRemote(name: string): Promise<void> {
	const config = loadConfig();
	if (!config) {
		error("devbox not configured. Run 'devbox init' first.");
		process.exit(1);
	}

	if (!config.remotes[name]) {
		error(`Remote '${name}' not found.`);
		process.exit(1);
	}

	// Check if any projects use this remote
	const projectsUsingRemote = Object.entries(config.projects)
		.filter(([_, p]) => p.remote === name)
		.map(([n, _]) => n);

	if (projectsUsingRemote.length > 0) {
		warn(`The following projects use remote '${name}':`);
		for (const p of projectsUsingRemote) {
			console.log(`  - ${p}`);
		}
		const { confirm } = await inquirer.prompt([
			{
				type: "confirm",
				name: "confirm",
				message: "Remove anyway? (projects will need to be reassigned)",
				default: false,
			},
		]);
		if (!confirm) {
			info("Cancelled.");
			return;
		}
	}

	delete config.remotes[name];
	saveConfig(config);
	success(`Remote '${name}' removed.`);
}

/**
 * Rename a remote
 */
export async function renameRemote(oldName: string, newName: string): Promise<void> {
	const config = loadConfig();
	if (!config) {
		error("devbox not configured. Run 'devbox init' first.");
		process.exit(1);
	}

	if (!config.remotes[oldName]) {
		error(`Remote '${oldName}' not found.`);
		process.exit(1);
	}

	if (config.remotes[newName]) {
		error(`Remote '${newName}' already exists.`);
		process.exit(1);
	}

	// Move the remote
	config.remotes[newName] = config.remotes[oldName];
	delete config.remotes[oldName];

	// Update all projects that reference the old name
	for (const project of Object.values(config.projects)) {
		if (project.remote === oldName) {
			project.remote = newName;
		}
	}

	saveConfig(config);
	success(`Remote renamed from '${oldName}' to '${newName}'.`);
}

/**
 * Main remote command handler
 */
export async function remoteCommand(
	subcommand?: string,
	arg1?: string,
	arg2?: string,
	options?: { key?: string }
): Promise<void> {
	if (!subcommand) {
		// Show help
		console.log(`
Usage: devbox remote <command>

Commands:
  add [name] [user@host:path]  Add a new remote
  list                         List all remotes
  remove <name>                Remove a remote
  rename <old> <new>           Rename a remote
`);
		return;
	}

	switch (subcommand) {
		case "add":
			if (arg1 && arg2) {
				// Direct mode: devbox remote add <name> <user@host:path>
				const parsed = parseRemoteString(arg2);
				if (!parsed) {
					error("Invalid format. Use: user@host:path");
					process.exit(1);
				}
				await addRemoteDirect(arg1, { ...parsed, key: options?.key });
				success(`Remote '${arg1}' added successfully.`);
			} else {
				// Interactive mode
				await addRemoteInteractive();
			}
			break;
		case "list":
			await listRemotes();
			break;
		case "remove":
			if (!arg1) {
				error("Usage: devbox remote remove <name>");
				process.exit(1);
			}
			await removeRemote(arg1);
			break;
		case "rename":
			if (!arg1 || !arg2) {
				error("Usage: devbox remote rename <old> <new>");
				process.exit(1);
			}
			await renameRemote(arg1, arg2);
			break;
		default:
			error(`Unknown remote command: ${subcommand}`);
			process.exit(1);
	}
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/commands/__tests__/remote.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/remote.ts src/commands/__tests__/remote.test.ts
git commit -m "feat: implement devbox remote command (add, list, remove, rename)"
```

---

## Task 5: Implement `devbox config` Command

**Files:**
- Create: `src/commands/config.ts`
- Create: `src/commands/__tests__/config-cmd.test.ts`

**Step 1: Write the failing test**

Create `src/commands/__tests__/config-cmd.test.ts`:

```typescript
// src/commands/__tests__/config-cmd.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("config command", () => {
	let testDir: string;
	let originalEnv: string | undefined;
	let logs: string[];
	let originalLog: typeof console.log;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-config-cmd-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		originalEnv = process.env.DEVBOX_HOME;
		process.env.DEVBOX_HOME = testDir;

		// Capture console output
		logs = [];
		originalLog = console.log;
		console.log = (...args) => logs.push(args.join(" "));

		// Create config with remotes
		writeFileSync(
			join(testDir, "config.yaml"),
			`editor: cursor
defaults:
  sync_mode: two-way-resolved
  ignore: []
remotes:
  work-nas:
    host: 192.168.1.50
    user: noor
    path: /srv/Projects
projects: {}
`
		);
	});

	afterEach(() => {
		console.log = originalLog;
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		if (originalEnv) {
			process.env.DEVBOX_HOME = originalEnv;
		} else {
			delete process.env.DEVBOX_HOME;
		}
	});

	test("shows config with remotes", async () => {
		const { configCommand } = await import("../config.ts");
		await configCommand({});

		expect(logs.some((l) => l.includes("work-nas"))).toBe(true);
		expect(logs.some((l) => l.includes("192.168.1.50"))).toBe(true);
		expect(logs.some((l) => l.includes("cursor"))).toBe(true);
	});
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/commands/__tests__/config-cmd.test.ts`

Expected: FAIL (module not found)

**Step 3: Write minimal implementation**

Create `src/commands/config.ts`:

```typescript
// src/commands/config.ts
import chalk from "chalk";
import { loadConfig, saveConfig, listRemotes } from "../lib/config.ts";
import { testConnection } from "../lib/ssh.ts";
import { error, header, info, spinner, success } from "../lib/ui.ts";

interface ConfigOptions {
	validate?: boolean;
}

/**
 * Show current configuration
 */
async function showConfig(): Promise<void> {
	const config = loadConfig();
	if (!config) {
		error("devbox not configured. Run 'devbox init' first.");
		process.exit(1);
	}

	console.log();
	header("Remotes:");
	console.log();

	const remotes = Object.entries(config.remotes);
	if (remotes.length === 0) {
		info("  No remotes configured");
	} else {
		for (const [name, remote] of remotes) {
			console.log(`  ${chalk.bold(name)}  ${remote.user}@${remote.host}:${remote.path}`);
		}
	}

	console.log();
	header("Settings:");
	console.log();
	console.log(`  editor: ${config.editor}`);
	console.log();
}

/**
 * Validate all remote connections
 */
async function validateConfig(): Promise<void> {
	const config = loadConfig();
	if (!config) {
		error("devbox not configured. Run 'devbox init' first.");
		process.exit(1);
	}

	console.log();
	header("Testing remotes...");
	console.log();

	const remotes = Object.entries(config.remotes);
	if (remotes.length === 0) {
		info("No remotes configured.");
		return;
	}

	// Count projects per remote
	const projectCounts: Record<string, number> = {};
	for (const project of Object.values(config.projects)) {
		if (project.remote) {
			projectCounts[project.remote] = (projectCounts[project.remote] || 0) + 1;
		}
	}

	let allPassed = true;
	for (const [name, remote] of remotes) {
		const spin = spinner(`Testing ${name}...`);
		const connectString = `${remote.user}@${remote.host}`;
		const result = await testConnection(connectString, remote.key);
		const projectCount = projectCounts[name] || 0;

		if (result.success) {
			spin.succeed(`${chalk.green("✓")} ${name} - connected (${projectCount} project${projectCount !== 1 ? "s" : ""})`);
		} else {
			spin.fail(`${chalk.red("✗")} ${name} - failed`);
			allPassed = false;
		}
	}

	console.log();
	if (allPassed) {
		success("All remotes connected successfully.");
	} else {
		error("Some remotes failed to connect.");
	}
}

/**
 * Set a config value
 */
async function setConfigValue(key: string, value: string): Promise<void> {
	const config = loadConfig();
	if (!config) {
		error("devbox not configured. Run 'devbox init' first.");
		process.exit(1);
	}

	switch (key) {
		case "editor":
			config.editor = value;
			break;
		default:
			error(`Unknown config key: ${key}`);
			error("Available keys: editor");
			process.exit(1);
	}

	saveConfig(config);
	success(`Set ${key} = ${value}`);
}

/**
 * Main config command handler
 */
export async function configCommand(options: ConfigOptions, key?: string, value?: string): Promise<void> {
	if (options.validate) {
		await validateConfig();
		return;
	}

	if (key === "set" && value) {
		// devbox config set <key> <value>
		const [setKey, setValue] = [value, process.argv[process.argv.indexOf(value) + 1]];
		if (!setKey || !setValue) {
			error("Usage: devbox config set <key> <value>");
			process.exit(1);
		}
		await setConfigValue(setKey, setValue);
		return;
	}

	await showConfig();
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/commands/__tests__/config-cmd.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/config.ts src/commands/__tests__/config-cmd.test.ts
git commit -m "feat: implement devbox config command (show, validate)"
```

---

## Task 6: Register Commands in CLI

**Files:**
- Modify: `src/index.ts`

**Step 1: Add remote and config commands to CLI**

Update `src/index.ts` to add the new commands:

```typescript
// Add imports at top
import { configCommand } from "./commands/config.ts";
import { remoteCommand } from "./commands/remote.ts";

// Add after existing commands, before program.parse()

program
	.command("remote [subcommand] [arg1] [arg2]")
	.description("Manage remote servers")
	.option("-k, --key <path>", "SSH key path")
	.action((subcommand, arg1, arg2, options) => remoteCommand(subcommand, arg1, arg2, options));

program
	.command("config [key] [value]")
	.description("View or modify configuration")
	.option("--validate", "Test connection to all remotes")
	.action((key, value, options) => configCommand(options, key, value));
```

**Step 2: Run CLI to verify commands are registered**

Run: `bun run --cwd /Users/noorchasib/Documents/Code/DevBox/.worktrees/config-command src/index.ts --help`

Expected: Should show `remote` and `config` commands in help output

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: register remote and config commands in CLI"
```

---

## Task 7: Update Existing Commands to Use Remotes

**Files:**
- Modify: `src/commands/clone.ts`
- Modify: `src/commands/push.ts`
- Modify: `src/commands/up.ts`
- Modify: `src/commands/down.ts`

This task updates existing commands to:
1. Prompt for remote selection when multiple remotes exist
2. Store the selected remote in project config
3. Use the project's remote for operations

**Step 1: Create helper for remote selection**

Add to `src/commands/remote.ts`:

```typescript
/**
 * Prompt user to select a remote
 */
export async function selectRemote(): Promise<string> {
	const config = loadConfig();
	if (!config) {
		error("devbox not configured. Run 'devbox init' first.");
		process.exit(1);
	}

	const remotes = Object.keys(config.remotes);
	if (remotes.length === 0) {
		error("No remotes configured. Run 'devbox remote add' first.");
		process.exit(1);
	}

	if (remotes.length === 1) {
		return remotes[0];
	}

	const { selected } = await inquirer.prompt([
		{
			type: "rawlist",
			name: "selected",
			message: "Select remote:",
			choices: remotes.map((name) => {
				const r = config.remotes[name];
				return { name: `${name} (${r.user}@${r.host})`, value: name };
			}),
		},
	]);

	return selected;
}

/**
 * Get remote config for a project
 */
export function getProjectRemote(projectName: string): { name: string; config: RemoteEntry } | null {
	const config = loadConfig();
	if (!config) return null;

	const project = config.projects[projectName];
	if (!project?.remote) return null;

	const remoteConfig = config.remotes[project.remote];
	if (!remoteConfig) return null;

	return { name: project.remote, config: remoteConfig };
}
```

**Step 2: Update clone command**

The clone command needs to prompt for remote selection and store it. Update to use `selectRemote()` and save the selected remote in project config.

**Step 3: Update push command**

Same pattern as clone.

**Step 4: Update up/down commands**

These should read the project's remote from config and error if not found.

**Step 5: Run full test suite**

Run: `bun test`

Expected: All tests pass

**Step 6: Commit**

```bash
git add src/commands/remote.ts src/commands/clone.ts src/commands/push.ts src/commands/up.ts src/commands/down.ts
git commit -m "feat: update commands to use per-project remotes"
```

---

## Task 8: Update init Command for Multi-Remote

**Files:**
- Modify: `src/commands/init.ts`

The init command currently creates a single remote. Update it to:
1. Create the first remote using the new multi-remote format
2. Keep the interactive flow but store in `remotes` map

**Step 1: Update configureRemote to return remote name**

Modify the function to return `{ name, remote }` instead of just connection info.

**Step 2: Update config creation**

Change from:
```typescript
remote: { host: ..., base_path: ... }
```
to:
```typescript
remotes: { [remoteName]: { host, user, path, key } }
```

**Step 3: Test init command**

Run: `bun run src/index.ts init` (in a test environment)

**Step 4: Commit**

```bash
git add src/commands/init.ts
git commit -m "feat: update init to use multi-remote config format"
```

---

## Task 9: Update Documentation

**Files:**
- Modify: `docs/guide/getting-started.md` (if exists)
- Modify: `README.md`

**Step 1: Update README with new commands**

Add documentation for:
- `devbox remote add`
- `devbox remote list`
- `devbox remote remove`
- `devbox remote rename`
- `devbox config`
- `devbox config --validate`

**Step 2: Commit**

```bash
git add README.md docs/
git commit -m "docs: add documentation for remote and config commands"
```

---

## Task 10: Final Testing and Cleanup

**Step 1: Run full test suite**

Run: `bun test`

Expected: All tests pass

**Step 2: Run linter**

Run: `bun run lint` or `bunx biome check --write`

**Step 3: Manual testing**

Test the full flow:
1. `devbox remote add` (interactive)
2. `devbox remote list`
3. `devbox config`
4. `devbox config --validate`

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup and formatting"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add types for multi-remote | `src/types/index.ts` |
| 2 | Add config migration | `src/lib/migration.ts` |
| 3 | Update config module | `src/lib/config.ts` |
| 4 | Implement `remote` command | `src/commands/remote.ts` |
| 5 | Implement `config` command | `src/commands/config.ts` |
| 6 | Register CLI commands | `src/index.ts` |
| 7 | Update existing commands | `clone.ts`, `push.ts`, `up.ts`, `down.ts` |
| 8 | Update init command | `src/commands/init.ts` |
| 9 | Update documentation | `README.md`, `docs/` |
| 10 | Final testing | - |

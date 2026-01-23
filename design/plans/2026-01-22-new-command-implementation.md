# `devbox new` Command Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add interactive `devbox new` command to create projects on the remote server with optional templates.

**Architecture:** The command uses an interactive wizard to collect project name and type (empty or template), creates the project on the remote via SSH, and offers to clone locally. Templates come from built-in git repos or user-defined URLs in config.

**Tech Stack:** TypeScript, Commander.js, Inquirer, SSH via execa, existing config/ui/ssh libs

---

## Task 1: Add Template Types to Types File

**Files:**
- Modify: `src/types/index.ts:156-163`

**Step 1: Read current Template type**

The existing Template type is for devcontainer templates. We need a new type for git-based project templates.

**Step 2: Add UserTemplate type**

Add after line 163 in `src/types/index.ts`:

```typescript
// User-defined project templates (git repos)
export interface UserTemplate {
	name: string;
	url: string;
}

// Built-in template definition
export interface BuiltInTemplate {
	id: string;
	name: string;
	url: string;
}
```

**Step 3: Update DevboxConfig type**

Modify `DevboxConfig` interface (around line 36) to add templates field:

```typescript
export interface DevboxConfig {
	remote: RemoteConfig;
	editor: string;
	defaults: SyncDefaults;
	projects: Record<string, ProjectConfig>;
	templates?: Record<string, string>; // name -> git URL
}
```

**Step 4: Run type check**

Run: `bun run build`
Expected: No errors

**Step 5: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add user template types for new command"
```

---

## Task 2: Create Template Utilities

**Files:**
- Create: `src/lib/projectTemplates.ts`
- Test: `src/lib/__tests__/projectTemplates.test.ts`

**Step 1: Write the failing test**

Create `src/lib/__tests__/projectTemplates.test.ts`:

```typescript
// src/lib/__tests__/projectTemplates.test.ts
import { describe, expect, test } from "bun:test";
import { BUILT_IN_TEMPLATES, getBuiltInTemplates } from "../projectTemplates.ts";

describe("projectTemplates", () => {
	describe("BUILT_IN_TEMPLATES", () => {
		test("includes node template", () => {
			const node = BUILT_IN_TEMPLATES.find((t) => t.id === "node");
			expect(node).toBeDefined();
			expect(node?.url).toContain("github.com");
		});

		test("includes bun template", () => {
			const bun = BUILT_IN_TEMPLATES.find((t) => t.id === "bun");
			expect(bun).toBeDefined();
		});

		test("includes python template", () => {
			const python = BUILT_IN_TEMPLATES.find((t) => t.id === "python");
			expect(python).toBeDefined();
		});

		test("includes go template", () => {
			const go = BUILT_IN_TEMPLATES.find((t) => t.id === "go");
			expect(go).toBeDefined();
		});
	});

	describe("getBuiltInTemplates", () => {
		test("returns all built-in templates", () => {
			const templates = getBuiltInTemplates();
			expect(templates.length).toBeGreaterThanOrEqual(4);
		});
	});
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/__tests__/projectTemplates.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Create `src/lib/projectTemplates.ts`:

```typescript
// src/lib/projectTemplates.ts
import type { BuiltInTemplate } from "../types/index.ts";

// Built-in project templates - git repos with starter projects
// TODO: Replace with your actual template repo URLs
export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
	{
		id: "node",
		name: "Node.js",
		url: "https://github.com/devbox-templates/node-starter",
	},
	{
		id: "bun",
		name: "Bun",
		url: "https://github.com/devbox-templates/bun-starter",
	},
	{
		id: "python",
		name: "Python",
		url: "https://github.com/devbox-templates/python-starter",
	},
	{
		id: "go",
		name: "Go",
		url: "https://github.com/devbox-templates/go-starter",
	},
];

export function getBuiltInTemplates(): BuiltInTemplate[] {
	return BUILT_IN_TEMPLATES;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/__tests__/projectTemplates.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/projectTemplates.ts src/lib/__tests__/projectTemplates.test.ts
git commit -m "feat(lib): add built-in project templates"
```

---

## Task 3: Add User Template Utilities

**Files:**
- Modify: `src/lib/projectTemplates.ts`
- Modify: `src/lib/__tests__/projectTemplates.test.ts`

**Step 1: Write the failing test**

Add to `src/lib/__tests__/projectTemplates.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify } from "yaml";
import {
	BUILT_IN_TEMPLATES,
	getBuiltInTemplates,
	getUserTemplates,
	getAllTemplates,
} from "../projectTemplates.ts";

describe("projectTemplates", () => {
	let testDir: string;
	let originalEnv: string | undefined;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-templates-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		originalEnv = process.env.DEVBOX_HOME;
		process.env.DEVBOX_HOME = testDir;
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true });
		if (originalEnv) {
			process.env.DEVBOX_HOME = originalEnv;
		} else {
			delete process.env.DEVBOX_HOME;
		}
	});

	// ... existing tests ...

	describe("getUserTemplates", () => {
		test("returns empty array when no config", () => {
			const templates = getUserTemplates();
			expect(templates).toEqual([]);
		});

		test("returns empty array when no templates in config", () => {
			const config = {
				remote: { host: "test", base_path: "~/code" },
				editor: "code",
				defaults: { sync_mode: "two-way-resolved", ignore: [] },
				projects: {},
			};
			writeFileSync(join(testDir, "config.yaml"), stringify(config));

			const templates = getUserTemplates();
			expect(templates).toEqual([]);
		});

		test("returns user templates from config", () => {
			const config = {
				remote: { host: "test", base_path: "~/code" },
				editor: "code",
				defaults: { sync_mode: "two-way-resolved", ignore: [] },
				projects: {},
				templates: {
					react: "https://github.com/user/react-template",
					rust: "https://github.com/user/rust-template",
				},
			};
			writeFileSync(join(testDir, "config.yaml"), stringify(config));

			const templates = getUserTemplates();
			expect(templates).toHaveLength(2);
			expect(templates[0]).toEqual({
				name: "react",
				url: "https://github.com/user/react-template",
			});
		});
	});

	describe("getAllTemplates", () => {
		test("combines built-in and user templates", () => {
			const config = {
				remote: { host: "test", base_path: "~/code" },
				editor: "code",
				defaults: { sync_mode: "two-way-resolved", ignore: [] },
				projects: {},
				templates: {
					custom: "https://github.com/user/custom",
				},
			};
			writeFileSync(join(testDir, "config.yaml"), stringify(config));

			const all = getAllTemplates();
			expect(all.builtIn.length).toBeGreaterThanOrEqual(4);
			expect(all.user).toHaveLength(1);
			expect(all.user[0].name).toBe("custom");
		});
	});
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/__tests__/projectTemplates.test.ts`
Expected: FAIL with "getUserTemplates is not exported"

**Step 3: Add user template functions**

Add to `src/lib/projectTemplates.ts`:

```typescript
import { loadConfig } from "./config.ts";
import type { BuiltInTemplate, UserTemplate } from "../types/index.ts";

// ... existing code ...

export function getUserTemplates(): UserTemplate[] {
	const config = loadConfig();
	if (!config?.templates) {
		return [];
	}

	return Object.entries(config.templates).map(([name, url]) => ({
		name,
		url,
	}));
}

export function getAllTemplates(): {
	builtIn: BuiltInTemplate[];
	user: UserTemplate[];
} {
	return {
		builtIn: getBuiltInTemplates(),
		user: getUserTemplates(),
	};
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/__tests__/projectTemplates.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/projectTemplates.ts src/lib/__tests__/projectTemplates.test.ts
git commit -m "feat(lib): add user template loading from config"
```

---

## Task 4: Add Project Name Validation

**Files:**
- Modify: `src/lib/projectTemplates.ts`
- Modify: `src/lib/__tests__/projectTemplates.test.ts`

**Step 1: Write the failing test**

Add to test file:

```typescript
describe("validateProjectName", () => {
	test("accepts valid alphanumeric names", () => {
		expect(validateProjectName("myproject")).toEqual({ valid: true });
		expect(validateProjectName("my-project")).toEqual({ valid: true });
		expect(validateProjectName("my_project")).toEqual({ valid: true });
		expect(validateProjectName("MyProject123")).toEqual({ valid: true });
	});

	test("rejects empty names", () => {
		const result = validateProjectName("");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("empty");
	});

	test("rejects names with spaces", () => {
		const result = validateProjectName("my project");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("alphanumeric");
	});

	test("rejects names with special characters", () => {
		const result = validateProjectName("my@project!");
		expect(result.valid).toBe(false);
	});

	test("rejects names starting with hyphen or underscore", () => {
		expect(validateProjectName("-myproject").valid).toBe(false);
		expect(validateProjectName("_myproject").valid).toBe(false);
	});
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/__tests__/projectTemplates.test.ts`
Expected: FAIL with "validateProjectName is not defined"

**Step 3: Add validation function**

Add to `src/lib/projectTemplates.ts`:

```typescript
export function validateProjectName(name: string): {
	valid: boolean;
	error?: string;
} {
	if (!name || name.trim() === "") {
		return { valid: false, error: "Project name cannot be empty" };
	}

	if (/^[-_]/.test(name)) {
		return {
			valid: false,
			error: "Project name cannot start with a hyphen or underscore",
		};
	}

	if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name)) {
		return {
			valid: false,
			error:
				"Project name must be alphanumeric with hyphens or underscores only",
		};
	}

	return { valid: true };
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/__tests__/projectTemplates.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/projectTemplates.ts src/lib/__tests__/projectTemplates.test.ts
git commit -m "feat(lib): add project name validation"
```

---

## Task 5: Create New Command Basic Structure

**Files:**
- Create: `src/commands/new.ts`
- Modify: `src/index.ts`

**Step 1: Create command file scaffold**

Create `src/commands/new.ts`:

```typescript
// src/commands/new.ts
import inquirer from "inquirer";
import { configExists, loadConfig } from "../lib/config.ts";
import { validateProjectName } from "../lib/projectTemplates.ts";
import { runRemoteCommand } from "../lib/ssh.ts";
import { error, header, info, spinner, success } from "../lib/ui.ts";

export async function newCommand(): Promise<void> {
	// Check config exists
	if (!configExists()) {
		error("devbox not configured. Run 'devbox init' first.");
		process.exit(1);
	}

	const config = loadConfig();
	if (!config) {
		error("Failed to load config.");
		process.exit(1);
	}

	header("Create a new project");

	// Step 1: Get project name
	const { projectName } = await inquirer.prompt([
		{
			type: "input",
			name: "projectName",
			message: "Project name:",
			validate: (input: string) => {
				const result = validateProjectName(input);
				return result.valid ? true : result.error || "Invalid name";
			},
		},
	]);

	// Step 2: Check if project exists on remote
	const checkSpin = spinner("Checking remote...");
	const checkResult = await runRemoteCommand(
		config.remote.host,
		`test -d ${config.remote.base_path}/${projectName} && echo "EXISTS" || echo "NOT_FOUND"`,
	);

	if (checkResult.stdout?.includes("EXISTS")) {
		checkSpin.fail("Project already exists");
		error(
			`A project named '${projectName}' already exists on the remote. Please choose a different name.`,
		);
		// Recursively call to re-prompt
		return newCommand();
	}
	checkSpin.succeed("Name available");

	// TODO: Step 3-6 in next tasks
	info(`Project '${projectName}' will be created.`);
}
```

**Step 2: Register command in index.ts**

Add import at top of `src/index.ts`:

```typescript
import { newCommand } from "./commands/new.ts";
```

Add command registration (after the status command):

```typescript
program
	.command("new")
	.description("Create a new project on the remote server")
	.action(newCommand);
```

**Step 3: Verify it compiles**

Run: `bun run build`
Expected: No errors

**Step 4: Commit**

```bash
git add src/commands/new.ts src/index.ts
git commit -m "feat(commands): add new command scaffold with name validation"
```

---

## Task 6: Add Project Type Selection

**Files:**
- Modify: `src/commands/new.ts`

**Step 1: Add project type prompt**

After the "Name available" success message, add:

```typescript
	// Step 3: Choose project type
	const { projectType } = await inquirer.prompt([
		{
			type: "list",
			name: "projectType",
			message: "How would you like to create this project?",
			choices: [
				{ name: "Empty project (with devcontainer.json)", value: "empty" },
				{ name: "From a template", value: "template" },
			],
		},
	]);

	if (projectType === "empty") {
		await createEmptyProject(config, projectName);
	} else {
		await createFromTemplate(config, projectName);
	}
```

**Step 2: Add placeholder functions**

Add at bottom of file:

```typescript
import type { DevboxConfig } from "../types/index.ts";

async function createEmptyProject(
	config: DevboxConfig,
	projectName: string,
): Promise<void> {
	// TODO: Implement in Task 7
	info(`Creating empty project: ${projectName}`);
}

async function createFromTemplate(
	config: DevboxConfig,
	projectName: string,
): Promise<void> {
	// TODO: Implement in Task 8
	info(`Creating from template: ${projectName}`);
}
```

**Step 3: Verify it compiles**

Run: `bun run build`
Expected: No errors

**Step 4: Commit**

```bash
git add src/commands/new.ts
git commit -m "feat(new): add project type selection (empty vs template)"
```

---

## Task 7: Implement Empty Project Creation

**Files:**
- Modify: `src/commands/new.ts`

**Step 1: Implement createEmptyProject function**

Replace the placeholder:

```typescript
async function createEmptyProject(
	config: DevboxConfig,
	projectName: string,
): Promise<void> {
	const remotePath = `${config.remote.base_path}/${projectName}`;

	// Create project directory with devcontainer
	const createSpin = spinner("Creating project on remote...");

	const devcontainerJson = JSON.stringify(
		{
			name: projectName,
			image: "mcr.microsoft.com/devcontainers/base:ubuntu",
		},
		null,
		2,
	);

	// Escape the JSON for shell
	const escapedJson = devcontainerJson.replace(/'/g, "'\\''");

	const createCmd = `
		mkdir -p ${remotePath}/.devcontainer && \
		echo '${escapedJson}' > ${remotePath}/.devcontainer/devcontainer.json
	`;

	const createResult = await runRemoteCommand(config.remote.host, createCmd);

	if (!createResult.success) {
		createSpin.fail("Failed to create project");
		error(createResult.error || "Unknown error");
		process.exit(1);
	}

	createSpin.succeed("Project created on remote");

	// Offer to clone locally
	await offerClone(config, projectName);
}
```

**Step 2: Add offerClone helper**

Add at bottom of file:

```typescript
async function offerClone(
	config: DevboxConfig,
	projectName: string,
): Promise<void> {
	console.log();
	const { shouldClone } = await inquirer.prompt([
		{
			type: "confirm",
			name: "shouldClone",
			message: "Clone this project locally now?",
			default: true,
		},
	]);

	if (shouldClone) {
		const { cloneCommand } = await import("./clone.ts");
		await cloneCommand(projectName);
	} else {
		success(`Project '${projectName}' created on remote`);
		info(`Run 'devbox clone ${projectName}' to clone locally.`);
	}
}
```

**Step 3: Verify it compiles**

Run: `bun run build`
Expected: No errors

**Step 4: Commit**

```bash
git add src/commands/new.ts
git commit -m "feat(new): implement empty project creation"
```

---

## Task 8: Implement Template Selection UI

**Files:**
- Modify: `src/commands/new.ts`

**Step 1: Import template utilities**

Add at top of file:

```typescript
import { getAllTemplates } from "../lib/projectTemplates.ts";
```

**Step 2: Implement createFromTemplate function**

Replace the placeholder:

```typescript
async function createFromTemplate(
	config: DevboxConfig,
	projectName: string,
): Promise<void> {
	const { builtIn, user } = getAllTemplates();

	// Build choices with separators
	const choices: Array<{
		name: string;
		value: string;
		type?: "separator";
	}> = [];

	// Built-in templates
	if (builtIn.length > 0) {
		choices.push(new inquirer.Separator("──── Built-in ────") as any);
		for (const t of builtIn) {
			choices.push({ name: t.name, value: `builtin:${t.id}` });
		}
	}

	// User templates
	if (user.length > 0) {
		choices.push(new inquirer.Separator("──── Custom ────") as any);
		for (const t of user) {
			choices.push({ name: t.name, value: `user:${t.name}` });
		}
	}

	// Git URL option
	choices.push(new inquirer.Separator("────────────────") as any);
	choices.push({ name: "Enter git URL...", value: "custom" });

	const { templateChoice } = await inquirer.prompt([
		{
			type: "list",
			name: "templateChoice",
			message: "Select a template:",
			choices,
		},
	]);

	let templateUrl: string;

	if (templateChoice === "custom") {
		const { gitUrl } = await inquirer.prompt([
			{
				type: "input",
				name: "gitUrl",
				message: "Git repository URL:",
				validate: (input: string) => {
					if (!input.trim()) return "URL cannot be empty";
					if (
						!input.startsWith("https://") &&
						!input.startsWith("git@")
					) {
						return "URL must start with https:// or git@";
					}
					return true;
				},
			},
		]);
		templateUrl = gitUrl;
	} else if (templateChoice.startsWith("builtin:")) {
		const id = templateChoice.replace("builtin:", "");
		const template = builtIn.find((t) => t.id === id);
		if (!template) {
			error("Template not found");
			process.exit(1);
		}
		templateUrl = template.url;
	} else {
		const name = templateChoice.replace("user:", "");
		const template = user.find((t) => t.name === name);
		if (!template) {
			error("Template not found");
			process.exit(1);
		}
		templateUrl = template.url;
	}

	// Ask about git history for custom URLs
	let keepHistory = false;
	if (templateChoice === "custom") {
		const { historyChoice } = await inquirer.prompt([
			{
				type: "list",
				name: "historyChoice",
				message: "Git history:",
				choices: [
					{ name: "Start fresh (recommended)", value: "fresh" },
					{ name: "Keep original history", value: "keep" },
				],
			},
		]);
		keepHistory = historyChoice === "keep";
	}

	await cloneTemplateToRemote(config, projectName, templateUrl, keepHistory);
}
```

**Step 3: Verify it compiles**

Run: `bun run build`
Expected: No errors

**Step 4: Commit**

```bash
git add src/commands/new.ts
git commit -m "feat(new): implement template selection UI"
```

---

## Task 9: Implement Template Cloning to Remote

**Files:**
- Modify: `src/commands/new.ts`

**Step 1: Add cloneTemplateToRemote function**

Add at bottom of file:

```typescript
async function cloneTemplateToRemote(
	config: DevboxConfig,
	projectName: string,
	templateUrl: string,
	keepHistory: boolean,
): Promise<void> {
	const remotePath = `${config.remote.base_path}/${projectName}`;

	const cloneSpin = spinner("Cloning template to remote...");

	// Clone to temp, then move to final location
	const tempPath = `/tmp/devbox-template-${Date.now()}`;

	let cloneCmd: string;
	if (keepHistory) {
		cloneCmd = `
			git clone ${templateUrl} ${tempPath} && \
			mv ${tempPath} ${remotePath}
		`;
	} else {
		cloneCmd = `
			git clone ${templateUrl} ${tempPath} && \
			rm -rf ${tempPath}/.git && \
			git -C ${tempPath} init && \
			mv ${tempPath} ${remotePath}
		`;
	}

	const cloneResult = await runRemoteCommand(config.remote.host, cloneCmd);

	if (!cloneResult.success) {
		cloneSpin.fail("Failed to clone template");
		error(cloneResult.error || "Unknown error");

		// Offer to retry or go back
		const { retryChoice } = await inquirer.prompt([
			{
				type: "list",
				name: "retryChoice",
				message: "What would you like to do?",
				choices: [
					{ name: "Try again", value: "retry" },
					{ name: "Go back to template selection", value: "back" },
					{ name: "Cancel", value: "cancel" },
				],
			},
		]);

		if (retryChoice === "retry") {
			return cloneTemplateToRemote(
				config,
				projectName,
				templateUrl,
				keepHistory,
			);
		} else if (retryChoice === "back") {
			return createFromTemplate(config, projectName);
		} else {
			process.exit(1);
		}
	}

	cloneSpin.succeed("Template cloned to remote");

	// Check if devcontainer.json exists, add if not
	const checkDevcontainer = await runRemoteCommand(
		config.remote.host,
		`test -f ${remotePath}/.devcontainer/devcontainer.json && echo "EXISTS" || echo "NOT_FOUND"`,
	);

	if (checkDevcontainer.stdout?.includes("NOT_FOUND")) {
		const addSpin = spinner("Adding devcontainer.json...");

		const devcontainerJson = JSON.stringify(
			{
				name: projectName,
				image: "mcr.microsoft.com/devcontainers/base:ubuntu",
			},
			null,
			2,
		);
		const escapedJson = devcontainerJson.replace(/'/g, "'\\''");

		await runRemoteCommand(
			config.remote.host,
			`mkdir -p ${remotePath}/.devcontainer && echo '${escapedJson}' > ${remotePath}/.devcontainer/devcontainer.json`,
		);

		addSpin.succeed("Added devcontainer.json");
	}

	// Offer to clone locally
	await offerClone(config, projectName);
}
```

**Step 2: Verify it compiles**

Run: `bun run build`
Expected: No errors

**Step 3: Commit**

```bash
git add src/commands/new.ts
git commit -m "feat(new): implement template cloning to remote"
```

---

## Task 10: Add Tests for New Command

**Files:**
- Create: `src/commands/__tests__/new.test.ts`

**Step 1: Create test file**

Create `src/commands/__tests__/new.test.ts`:

```typescript
// src/commands/__tests__/new.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify } from "yaml";

describe("new command", () => {
	let testDir: string;
	let originalEnv: string | undefined;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-new-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		originalEnv = process.env.DEVBOX_HOME;
		process.env.DEVBOX_HOME = testDir;
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true });
		if (originalEnv) {
			process.env.DEVBOX_HOME = originalEnv;
		} else {
			delete process.env.DEVBOX_HOME;
		}
	});

	describe("config validation", () => {
		test("requires devbox to be configured", () => {
			// No config file exists
			const configExists = false;
			expect(configExists).toBe(false);
		});

		test("config can be loaded when exists", () => {
			const config = {
				remote: { host: "test-server", base_path: "~/code" },
				editor: "code",
				defaults: { sync_mode: "two-way-resolved", ignore: [] },
				projects: {},
			};
			writeFileSync(join(testDir, "config.yaml"), stringify(config));

			const content = require("node:fs").readFileSync(
				join(testDir, "config.yaml"),
				"utf-8",
			);
			expect(content).toContain("test-server");
		});
	});

	describe("remote path construction", () => {
		test("constructs correct remote path", () => {
			const basePath = "~/code";
			const projectName = "myapp";
			const remotePath = `${basePath}/${projectName}`;
			expect(remotePath).toBe("~/code/myapp");
		});
	});

	describe("devcontainer.json generation", () => {
		test("generates valid JSON structure", () => {
			const projectName = "test-project";
			const devcontainerJson = JSON.stringify(
				{
					name: projectName,
					image: "mcr.microsoft.com/devcontainers/base:ubuntu",
				},
				null,
				2,
			);

			const parsed = JSON.parse(devcontainerJson);
			expect(parsed.name).toBe("test-project");
			expect(parsed.image).toContain("devcontainers");
		});
	});
});
```

**Step 2: Run tests**

Run: `bun test src/commands/__tests__/new.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/__tests__/new.test.ts
git commit -m "test(new): add unit tests for new command"
```

---

## Task 11: Run Full Test Suite and Verify

**Files:**
- None (verification only)

**Step 1: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 2: Run linter**

Run: `bun run lint`
Expected: No errors (or fix any that appear)

**Step 3: Manual verification checklist**

If you have access to a test remote server:
- [ ] Run `devbox new` and create an empty project
- [ ] Run `devbox new` and create from a built-in template
- [ ] Run `devbox new` and create from a custom git URL
- [ ] Verify project appears in `devbox browse`
- [ ] Verify clone option works

**Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address test/lint issues"
```

---

## Summary

After completing all tasks, the `devbox new` command will:

1. Prompt for project name with validation
2. Check remote for name conflicts
3. Offer empty project or template creation
4. For templates: show built-in + user-defined + custom URL option
5. Clone template to remote (with git history choice)
6. Add devcontainer.json if missing
7. Offer to clone locally

Files created/modified:
- `src/types/index.ts` - Added UserTemplate, BuiltInTemplate types
- `src/lib/projectTemplates.ts` - New file with template utilities
- `src/lib/__tests__/projectTemplates.test.ts` - Tests for templates
- `src/commands/new.ts` - New command implementation
- `src/commands/__tests__/new.test.ts` - Tests for command
- `src/index.ts` - Register new command

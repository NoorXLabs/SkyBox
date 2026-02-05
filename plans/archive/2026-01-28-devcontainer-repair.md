# Devcontainer Repair Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add two sub-features under `skybox config devcontainer`: (1) `edit` — open local devcontainer.json in editor and push to remote, (2) `reset` — regenerate from built-in template and push to remote.

**Architecture:** Add a new `devcontainer` subcommand group under the existing `config` command. The `edit` subcommand opens the local `.devcontainer/devcontainer.json` in `$EDITOR`, then pushes it to the remote via `scp` or `runRemoteCommand`. The `reset` subcommand prompts for a template, regenerates using `createDevcontainerConfig()`, and pushes to remote.

**Tech Stack:** Commander.js (nested subcommand), `execa` for editor launch, SSH for remote push, existing templates.ts for regeneration.

---

### Task 1: Write failing test for devcontainer edit path resolution

**Files:**
- Create: `src/commands/__tests__/config-devcontainer.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createTestContext } from "../../lib/__tests__/test-utils.ts";

describe("devcontainer repair", () => {
	let ctx: ReturnType<typeof createTestContext>;

	beforeEach(() => {
		ctx = createTestContext();
	});

	afterEach(() => {
		ctx.cleanup();
	});

	test("finds devcontainer.json in project directory", () => {
		const projectDir = join(ctx.projectsDir, "test-project");
		const devcontainerDir = join(projectDir, ".devcontainer");
		mkdirSync(devcontainerDir, { recursive: true });
		writeFileSync(
			join(devcontainerDir, "devcontainer.json"),
			JSON.stringify({ name: "test" }),
		);

		const configPath = join(projectDir, ".devcontainer", "devcontainer.json");
		const content = JSON.parse(readFileSync(configPath, "utf-8"));
		expect(content.name).toBe("test");
	});

	test("detects missing devcontainer.json", () => {
		const projectDir = join(ctx.projectsDir, "empty-project");
		mkdirSync(projectDir, { recursive: true });

		const configPath = join(projectDir, ".devcontainer", "devcontainer.json");
		expect(() => readFileSync(configPath, "utf-8")).toThrow();
	});
});
```

**Step 2: Run test**

Run: `bun test src/commands/__tests__/config-devcontainer.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/__tests__/config-devcontainer.test.ts
git commit -m "test: add devcontainer repair test scaffold"
```

---

### Task 2: Create devcontainer repair module

**Files:**
- Create: `src/commands/config-devcontainer.ts`

**Step 1: Write the module**

```typescript
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execa } from "execa";
import { select } from "@inquirer/prompts";
import { getProjectPath, projectExists } from "../lib/project.ts";
import { createDevcontainerConfig, templates } from "../lib/templates.ts";
import { runRemoteCommand } from "../lib/ssh.ts";
import { getProjectRemote, getRemoteHost, getRemotePath } from "./remote.ts";
import { loadConfig } from "../lib/config.ts";
import { success, error, info, spinner } from "../lib/ui.ts";
import { getErrorMessage } from "../lib/errors.ts";

function getDevcontainerPath(projectPath: string): string {
	return join(projectPath, ".devcontainer", "devcontainer.json");
}

export async function devcontainerEditCommand(
	project: string,
): Promise<void> {
	if (!projectExists(project)) {
		error(`Project "${project}" not found locally.`);
		return;
	}

	const projectPath = getProjectPath(project);
	const configPath = getDevcontainerPath(projectPath);

	if (!existsSync(configPath)) {
		error(`No devcontainer.json found for "${project}".`);
		info('Use "skybox config devcontainer reset" to create one from a template.');
		return;
	}

	const editor = process.env.EDITOR || "vim";
	await execa(editor, [configPath], { stdio: "inherit" });

	// Push to remote
	await pushDevcontainerToRemote(project, projectPath);
}

export async function devcontainerResetCommand(
	project: string,
): Promise<void> {
	if (!projectExists(project)) {
		error(`Project "${project}" not found locally.`);
		return;
	}

	const projectPath = getProjectPath(project);

	const templateId = await select({
		message: "Select a devcontainer template:",
		choices: templates.map((t) => ({
			name: `${t.name} - ${t.description}`,
			value: t.id,
		})),
	});

	createDevcontainerConfig(projectPath, templateId, project);
	success(`Reset devcontainer.json to "${templateId}" template.`);

	// Push to remote
	await pushDevcontainerToRemote(project, projectPath);
}

async function pushDevcontainerToRemote(
	project: string,
	projectPath: string,
): Promise<void> {
	const config = loadConfig();
	const remote = await getProjectRemote(project, config);
	if (!remote) {
		info("No remote configured. Skipped pushing to remote.");
		return;
	}

	const remoteHost = getRemoteHost(remote);
	const remotePath = getRemotePath(remote, project);
	const configPath = getDevcontainerPath(projectPath);
	const configContent = readFileSync(configPath, "utf-8");

	const s = spinner("Pushing devcontainer.json to remote...");
	try {
		const encoded = Buffer.from(configContent).toString("base64");
		await runRemoteCommand(
			remoteHost,
			`mkdir -p "${remotePath}/.devcontainer" && echo "${encoded}" | base64 -d > "${remotePath}/.devcontainer/devcontainer.json"`,
		);
		s.succeed("Pushed devcontainer.json to remote.");
	} catch (err) {
		s.fail(`Failed to push: ${getErrorMessage(err)}`);
	}
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/config-devcontainer.ts
git commit -m "feat: add devcontainer edit and reset commands"
```

---

### Task 3: Register subcommands in config command

**Files:**
- Modify: `src/commands/config.ts`
- Modify: `src/index.ts`

**Step 1: Add devcontainer subcommand routing in config.ts**

At the end of `configCommand()` in `src/commands/config.ts`, add routing for the `devcontainer` subcommand:

```typescript
import {
	devcontainerEditCommand,
	devcontainerResetCommand,
} from "./config-devcontainer.ts";

// Inside configCommand, add case for "devcontainer" subcommand:
case "devcontainer": {
	const action = arg1; // "edit" or "reset"
	const project = arg2;
	if (!project) {
		error('Usage: skybox config devcontainer <edit|reset> <project>');
		return;
	}
	if (action === "edit") {
		await devcontainerEditCommand(project);
	} else if (action === "reset") {
		await devcontainerResetCommand(project);
	} else {
		error(`Unknown devcontainer action: ${action}`);
		error('Usage: skybox config devcontainer <edit|reset> <project>');
	}
	break;
}
```

**Step 2: Run all tests**

Run: `bun test`
Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/config.ts src/index.ts
git commit -m "feat(config): register devcontainer edit/reset subcommands"
```

---

### Task 4: Write integration test for reset flow

**Files:**
- Modify: `src/commands/__tests__/config-devcontainer.test.ts`

**Step 1: Add test for reset creating devcontainer.json**

```typescript
test("createDevcontainerConfig creates valid devcontainer.json", () => {
	const projectDir = join(ctx.projectsDir, "reset-project");
	mkdirSync(projectDir, { recursive: true });

	const { createDevcontainerConfig } = require("../../lib/templates.ts");
	createDevcontainerConfig(projectDir, "node", "reset-project");

	const configPath = join(projectDir, ".devcontainer", "devcontainer.json");
	expect(existsSync(configPath)).toBe(true);

	const content = JSON.parse(readFileSync(configPath, "utf-8"));
	expect(content.name).toBe("reset-project");
});
```

**Step 2: Run test**

Run: `bun test src/commands/__tests__/config-devcontainer.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/__tests__/config-devcontainer.test.ts
git commit -m "test: add devcontainer reset integration test"
```

---

### Task 5: Run full check suite

**Step 1: Run all checks**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Test scaffold for devcontainer path resolution |
| 2 | Create config-devcontainer.ts with edit and reset commands |
| 3 | Register subcommands in config routing |
| 4 | Integration test for reset flow |
| 5 | Full check suite |

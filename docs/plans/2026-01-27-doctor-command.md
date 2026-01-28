# Doctor Command Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `devbox doctor` command that diagnoses common issues with DevBox setup, dependencies, and configuration.

**Architecture:** The doctor command runs a series of health checks (Docker, SSH, Mutagen, config, remotes) and reports issues with suggested fixes. Each check is independent and reports pass/warn/fail status.

**Tech Stack:** TypeScript, Commander.js, chalk for colored output, execa for command execution

---

## Task 1: Add DoctorCheck Types

**Files:**
- Modify: `src/types/index.ts` (add at end of file)

**Step 1: Add the type definitions**

```typescript
// Doctor command types
export type DoctorCheckStatus = "pass" | "warn" | "fail";

export interface DoctorCheckResult {
	name: string;
	status: DoctorCheckStatus;
	message: string;
	fix?: string; // Suggested fix for warn/fail
}

export interface DoctorReport {
	checks: DoctorCheckResult[];
	passed: number;
	warned: number;
	failed: number;
}
```

**Step 2: Run typecheck**

```bash
bun run typecheck
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add doctor command types"
```

---

## Task 2: Create doctor.ts Command File with Docker Check

**Files:**
- Create: `src/commands/doctor.ts`

**Step 1: Create the command file with Docker check**

```typescript
// src/commands/doctor.ts

import { execSync } from "node:child_process";
import chalk from "chalk";
import type {
	DoctorCheckResult,
	DoctorCheckStatus,
	DoctorReport,
} from "../types/index.ts";

// Check icons
const icons: Record<DoctorCheckStatus, string> = {
	pass: chalk.green("✓"),
	warn: chalk.yellow("!"),
	fail: chalk.red("✗"),
};

function checkDocker(): DoctorCheckResult {
	const name = "Docker";

	// Check if Docker is installed
	try {
		execSync("docker --version", { stdio: "pipe" });
	} catch {
		return {
			name,
			status: "fail",
			message: "Docker is not installed",
			fix: "Install Docker Desktop: brew install --cask docker",
		};
	}

	// Check if Docker daemon is running
	try {
		execSync("docker info", { stdio: "pipe", timeout: 5000 });
	} catch {
		return {
			name,
			status: "fail",
			message: "Docker is installed but not running",
			fix: "Start Docker Desktop application",
		};
	}

	// Check Docker version
	try {
		const result = execSync("docker --version", { encoding: "utf-8" });
		const versionMatch = result.match(/Docker version (\d+\.\d+)/);
		const version = versionMatch ? versionMatch[1] : "unknown";
		return {
			name,
			status: "pass",
			message: `Docker ${version} is running`,
		};
	} catch {
		return {
			name,
			status: "pass",
			message: "Docker is running",
		};
	}
}

function printResult(result: DoctorCheckResult): void {
	const icon = icons[result.status];
	console.log(`  ${icon} ${result.name}: ${result.message}`);
	if (result.fix && result.status !== "pass") {
		console.log(chalk.dim(`      Fix: ${result.fix}`));
	}
}

function printReport(report: DoctorReport): void {
	console.log();
	console.log(chalk.bold("DevBox Doctor"));
	console.log(chalk.dim("─".repeat(40)));
	console.log();

	for (const check of report.checks) {
		printResult(check);
	}

	console.log();
	console.log(chalk.dim("─".repeat(40)));

	const summary = [];
	if (report.passed > 0) summary.push(chalk.green(`${report.passed} passed`));
	if (report.warned > 0) summary.push(chalk.yellow(`${report.warned} warnings`));
	if (report.failed > 0) summary.push(chalk.red(`${report.failed} failed`));

	console.log(`  ${summary.join(", ")}`);
	console.log();

	if (report.failed > 0) {
		console.log(
			chalk.red("  Some checks failed. Please fix the issues above."),
		);
	} else if (report.warned > 0) {
		console.log(
			chalk.yellow("  Some checks have warnings. DevBox should work but may have issues."),
		);
	} else {
		console.log(chalk.green("  All checks passed. DevBox is ready to use!"));
	}
	console.log();
}

export async function doctorCommand(): Promise<void> {
	const checks: DoctorCheckResult[] = [];

	// Run all checks
	checks.push(checkDocker());

	// Calculate summary
	const passed = checks.filter((c) => c.status === "pass").length;
	const warned = checks.filter((c) => c.status === "warn").length;
	const failed = checks.filter((c) => c.status === "fail").length;

	const report: DoctorReport = { checks, passed, warned, failed };
	printReport(report);

	// Exit with error code if any checks failed
	if (failed > 0) {
		process.exit(1);
	}
}
```

**Step 2: Run typecheck**

```bash
bun run typecheck
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/doctor.ts
git commit -m "feat(doctor): add doctor command with Docker check"
```

---

## Task 3: Add Mutagen Check

**Files:**
- Modify: `src/commands/doctor.ts`

**Step 1: Add Mutagen check function**

Add after `checkDocker()`:

```typescript
function checkMutagen(): DoctorCheckResult {
	const name = "Mutagen";

	// Check if Mutagen binary exists
	try {
		const { getMutagenPath } = require("../lib/mutagen.ts");
		const mutagenPath = getMutagenPath();
		const { existsSync } = require("node:fs");

		if (!existsSync(mutagenPath)) {
			return {
				name,
				status: "warn",
				message: "Mutagen not installed (will be downloaded on first use)",
				fix: "Run 'devbox init' to download Mutagen",
			};
		}

		// Try to get version
		const result = execSync(`"${mutagenPath}" version`, {
			encoding: "utf-8",
			timeout: 5000,
		});
		const version = result.trim().split("\n")[0] || "installed";

		return {
			name,
			status: "pass",
			message: `Mutagen ${version}`,
		};
	} catch {
		return {
			name,
			status: "warn",
			message: "Mutagen check failed",
			fix: "Run 'devbox init' to reinstall Mutagen",
		};
	}
}
```

**Step 2: Add to checks array**

In `doctorCommand()`, add after Docker check:

```typescript
checks.push(checkMutagen());
```

**Step 3: Run typecheck**

```bash
bun run typecheck
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/commands/doctor.ts
git commit -m "feat(doctor): add Mutagen check"
```

---

## Task 4: Add DevBox Config Check

**Files:**
- Modify: `src/commands/doctor.ts`

**Step 1: Add config check function**

Add after `checkMutagen()`:

```typescript
function checkConfig(): DoctorCheckResult {
	const name = "Configuration";

	try {
		const { configExists, loadConfig } = require("../lib/config.ts");

		if (!configExists()) {
			return {
				name,
				status: "warn",
				message: "DevBox not configured",
				fix: "Run 'devbox init' to set up DevBox",
			};
		}

		const config = loadConfig();
		if (!config) {
			return {
				name,
				status: "fail",
				message: "Config file exists but failed to load",
				fix: "Check ~/.devbox/config.yaml for syntax errors",
			};
		}

		// Check for remotes
		const remoteCount = Object.keys(config.remotes || {}).length;
		if (remoteCount === 0) {
			return {
				name,
				status: "warn",
				message: "No remotes configured",
				fix: "Run 'devbox init' or 'devbox remote add' to add a remote",
			};
		}

		return {
			name,
			status: "pass",
			message: `Config loaded (${remoteCount} remote${remoteCount > 1 ? "s" : ""})`,
		};
	} catch (err) {
		return {
			name,
			status: "fail",
			message: `Config error: ${err instanceof Error ? err.message : "unknown"}`,
			fix: "Check ~/.devbox/config.yaml for errors",
		};
	}
}
```

**Step 2: Add to checks array**

In `doctorCommand()`:

```typescript
checks.push(checkConfig());
```

**Step 3: Run typecheck**

```bash
bun run typecheck
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/commands/doctor.ts
git commit -m "feat(doctor): add configuration check"
```

---

## Task 5: Add SSH Connectivity Check

**Files:**
- Modify: `src/commands/doctor.ts`

**Step 1: Add SSH check function**

Add after `checkConfig()`:

```typescript
async function checkSSHConnectivity(): Promise<DoctorCheckResult[]> {
	const results: DoctorCheckResult[] = [];

	try {
		const { configExists, loadConfig } = require("../lib/config.ts");
		const { testSSHConnection } = require("../lib/ssh.ts");
		const { getRemoteHost } = require("./remote.ts");

		if (!configExists()) {
			return []; // Skip if no config
		}

		const config = loadConfig();
		if (!config || !config.remotes) {
			return [];
		}

		for (const [remoteName, remote] of Object.entries(config.remotes)) {
			const name = `SSH: ${remoteName}`;
			try {
				const host = getRemoteHost(remote);
				const result = await testSSHConnection(host);

				if (result.success) {
					results.push({
						name,
						status: "pass",
						message: `Connected to ${remote.host}`,
					});
				} else {
					results.push({
						name,
						status: "fail",
						message: `Cannot connect: ${result.error}`,
						fix: `Check SSH key and host configuration for '${remoteName}'`,
					});
				}
			} catch (err) {
				results.push({
					name,
					status: "fail",
					message: `Connection failed: ${err instanceof Error ? err.message : "unknown"}`,
					fix: `Verify SSH access to ${remote.host}`,
				});
			}
		}
	} catch {
		// If we can't load config, skip SSH checks
	}

	return results;
}
```

**Step 2: Update doctorCommand to handle async checks**

Replace the `doctorCommand` function:

```typescript
export async function doctorCommand(): Promise<void> {
	const checks: DoctorCheckResult[] = [];

	// Run sync checks
	checks.push(checkDocker());
	checks.push(checkMutagen());
	checks.push(checkConfig());

	// Run async checks
	const sshChecks = await checkSSHConnectivity();
	checks.push(...sshChecks);

	// Calculate summary
	const passed = checks.filter((c) => c.status === "pass").length;
	const warned = checks.filter((c) => c.status === "warn").length;
	const failed = checks.filter((c) => c.status === "fail").length;

	const report: DoctorReport = { checks, passed, warned, failed };
	printReport(report);

	// Exit with error code if any checks failed
	if (failed > 0) {
		process.exit(1);
	}
}
```

**Step 3: Run typecheck**

```bash
bun run typecheck
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/commands/doctor.ts
git commit -m "feat(doctor): add SSH connectivity check"
```

---

## Task 6: Add Devcontainer CLI Check

**Files:**
- Modify: `src/commands/doctor.ts`

**Step 1: Add devcontainer check function**

Add after `checkSSHConnectivity()`:

```typescript
function checkDevcontainerCLI(): DoctorCheckResult {
	const name = "Devcontainer CLI";

	try {
		const result = execSync("devcontainer --version", {
			encoding: "utf-8",
			timeout: 5000,
		});
		const version = result.trim() || "installed";

		return {
			name,
			status: "pass",
			message: `devcontainer ${version}`,
		};
	} catch {
		return {
			name,
			status: "warn",
			message: "Devcontainer CLI not found",
			fix: "npm install -g @devcontainers/cli",
		};
	}
}
```

**Step 2: Add to checks array**

In `doctorCommand()`, add after Mutagen check:

```typescript
checks.push(checkDevcontainerCLI());
```

**Step 3: Run typecheck**

```bash
bun run typecheck
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/commands/doctor.ts
git commit -m "feat(doctor): add devcontainer CLI check"
```

---

## Task 7: Register Command in index.ts

**Files:**
- Modify: `src/index.ts`

**Step 1: Add import**

Add after other imports:

```typescript
import { doctorCommand } from "./commands/doctor.ts";
```

**Step 2: Register the command**

Add after the `config` command registration:

```typescript
program
	.command("doctor")
	.description("Diagnose common issues")
	.action(doctorCommand);
```

**Step 3: Run typecheck**

```bash
bun run typecheck
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat(cli): register doctor command"
```

---

## Task 8: Add Tests for doctor.ts

**Files:**
- Create: `src/commands/__tests__/doctor.test.ts`

**Step 1: Create the test file**

```typescript
// src/commands/__tests__/doctor.test.ts

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("doctor command", () => {
	let testDir: string;
	let originalEnv: string | undefined;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-doctor-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });

		originalEnv = process.env.DEVBOX_HOME;
		process.env.DEVBOX_HOME = testDir;
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
		if (originalEnv) {
			process.env.DEVBOX_HOME = originalEnv;
		} else {
			delete process.env.DEVBOX_HOME;
		}
	});

	test("should detect missing config", async () => {
		const { configExists } = await import("../../lib/config.ts");
		expect(configExists()).toBe(false);
	});

	test("should detect valid config", async () => {
		// Create minimal config
		writeFileSync(
			join(testDir, "config.yaml"),
			`editor: cursor
defaults:
  sync_mode: two-way-resolved
  ignore: []
remotes:
  work:
    host: work-server
    path: ~/code
projects: {}
`,
		);

		const { configExists, loadConfig } = await import("../../lib/config.ts");
		expect(configExists()).toBe(true);

		const config = loadConfig();
		expect(config).not.toBeNull();
		expect(Object.keys(config?.remotes || {})).toHaveLength(1);
	});

	test("should detect invalid YAML config", async () => {
		// Create invalid YAML
		writeFileSync(join(testDir, "config.yaml"), "invalid: yaml: syntax:");

		const { loadConfig } = await import("../../lib/config.ts");
		const config = loadConfig();
		expect(config).toBeNull();
	});
});
```

**Step 2: Run tests**

```bash
bun test src/commands/__tests__/doctor.test.ts
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/__tests__/doctor.test.ts
git commit -m "test(doctor): add tests for doctor command"
```

---

## Task 9: Update Implementation Tracker

**Files:**
- Modify: `plans/IMPLEMENTATION.md`

**Step 1: Mark Doctor Command as complete**

In the Future Features > High Priority section, change:

```markdown
- [ ] **Health Check Command:** `devbox doctor` to diagnose common issues
```

To:

```markdown
- [x] **Health Check Command:** `devbox doctor` to diagnose common issues
  - Checks: Docker, Mutagen, Config, SSH connectivity, Devcontainer CLI
  - Commit: `<commit-hash>`
```

**Step 2: Run all checks**

```bash
bun run check && bun run typecheck && bun test
```

Expected: All pass

**Step 3: Final commit**

```bash
git add plans/IMPLEMENTATION.md
git commit -m "docs: mark doctor command as complete"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add DoctorCheck types | `src/types/index.ts` |
| 2 | Create doctor.ts with Docker check | `src/commands/doctor.ts` |
| 3 | Add Mutagen check | `src/commands/doctor.ts` |
| 4 | Add Config check | `src/commands/doctor.ts` |
| 5 | Add SSH connectivity check | `src/commands/doctor.ts` |
| 6 | Add Devcontainer CLI check | `src/commands/doctor.ts` |
| 7 | Register in index.ts | `src/index.ts` |
| 8 | Add tests | `src/commands/__tests__/doctor.test.ts` |
| 9 | Update tracker | `plans/IMPLEMENTATION.md` |

**Total: 9 tasks, ~9 commits**

## Example Output

```
DevBox Doctor
────────────────────────────────────────

  ✓ Docker: Docker 24.0 is running
  ✓ Mutagen: Mutagen 0.17.5
  ✓ Devcontainer CLI: devcontainer 0.62.0
  ✓ Configuration: Config loaded (2 remotes)
  ✓ SSH: work: Connected to work-server
  ✗ SSH: personal: Cannot connect: Connection refused

────────────────────────────────────────
  5 passed, 1 failed

  Some checks failed. Please fix the issues above.
```

# Phase 3: up.ts Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the 243-line `upCommand` and 109-line `handlePostStart` functions into smaller, focused helper functions for improved readability and maintainability.

**Architecture:** Extract logical sections into named functions that each handle one responsibility. Keep all extracted functions in the same file to maintain locality. Use TypeScript interfaces for function parameters where multiple values need passing.

**Tech Stack:** TypeScript, Bun, Commander.js

---

## Task 1: Add Parameter Interfaces

**Files:**
- Modify: `src/commands/up.ts:1-33` (imports section)

**Step 1: Read the file to confirm current state**

Run: `bun run typecheck`
Expected: PASS (baseline check)

**Step 2: Add interfaces after imports**

Add these interfaces after line 33:

```typescript
/** Context passed between up command phases */
interface UpContext {
	project: string;
	projectPath: string;
	config: DevboxConfigV2;
	options: UpOptions;
	remoteInfo: LockRemoteInfo | null;
}

/** Result of project resolution phase */
interface ResolvedProject {
	project: string;
	projectPath: string;
}
```

**Step 3: Run typecheck to verify**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/commands/up.ts
git commit -m "$(cat <<'EOF'
refactor(up): add parameter interfaces for extracted functions

Preparation for extracting upCommand into smaller functions.
EOF
)"
```

---

## Task 2: Extract `resolveProject()` Function

**Files:**
- Modify: `src/commands/up.ts:51-103`

**Step 1: Add the extracted function before `upCommand`**

Insert after the interfaces (around line 45):

```typescript
/**
 * Resolve which project to operate on from argument, cwd, or prompt.
 * Returns null if no project could be resolved.
 */
async function resolveProject(
	projectArg: string | undefined,
	options: UpOptions,
): Promise<ResolvedProject | null> {
	let project = projectArg;

	if (!project) {
		project = resolveProjectFromCwd() ?? undefined;
	}

	if (!project) {
		const projects = getLocalProjects();

		if (projects.length === 0) {
			error(
				"No local projects found. Run 'devbox clone' or 'devbox push' first.",
			);
			return null;
		}

		if (options.noPrompt) {
			error("No project specified and --no-prompt is set.");
			return null;
		}

		const { selectedProject } = await inquirer.prompt([
			{
				type: "rawlist",
				name: "selectedProject",
				message: "Select a project:",
				choices: projects,
			},
		]);
		project = selectedProject;
	}

	if (!projectExists(project ?? "")) {
		error(
			`Project '${project}' not found locally. Run 'devbox clone ${project}' first.`,
		);
		return null;
	}

	const projectPath = getProjectPath(project ?? "");
	const { realpathSync } = await import("node:fs");
	let normalizedProjectPath: string;
	try {
		normalizedProjectPath = realpathSync(projectPath);
	} catch {
		normalizedProjectPath = projectPath;
	}

	return { project: project ?? "", projectPath: normalizedProjectPath };
}
```

**Step 2: Update `upCommand` to use the extracted function**

Replace lines 51-104 in `upCommand` with:

```typescript
	// Step 2: Resolve project
	const resolved = await resolveProject(projectArg, options);
	if (!resolved) {
		process.exit(1);
	}
	const { project, projectPath } = resolved;

	header(`Starting '${project}'...`);
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Run tests**

Run: `bun test src/commands/__tests__/up.test.ts`
Expected: PASS (if tests exist) or no test file found

**Step 5: Commit**

```bash
git add src/commands/up.ts
git commit -m "$(cat <<'EOF'
refactor(up): extract resolveProject() function

Moves project resolution logic (arg, cwd, prompt) into dedicated function.
Reduces upCommand complexity by ~55 lines.
EOF
)"
```

---

## Task 3: Extract `handleLockAcquisition()` Function

**Files:**
- Modify: `src/commands/up.ts:106-164`

**Step 1: Add the extracted function**

Insert after `resolveProject()`:

```typescript
/**
 * Acquire lock for the project on the remote server.
 * Handles lock conflicts with optional takeover prompt.
 * Returns true if lock acquired (or no remote), false if user cancelled.
 */
async function handleLockAcquisition(
	project: string,
	config: DevboxConfigV2,
	options: UpOptions,
): Promise<{ success: boolean; remoteInfo: LockRemoteInfo | null }> {
	const projectRemote = getProjectRemote(project, config);

	if (!projectRemote) {
		warn("No remote configured for this project - skipping lock");
		return { success: true, remoteInfo: null };
	}

	const remoteInfo = createLockRemoteInfo(projectRemote.remote);
	const lockResult = await acquireLock(project, remoteInfo);

	if (lockResult.success) {
		info("Lock acquired");
		return { success: true, remoteInfo };
	}

	if (lockResult.existingLock) {
		const { machine, timestamp } = lockResult.existingLock;
		warn(`Project locked by '${machine}' since ${timestamp}`);

		if (options.noPrompt) {
			error("Cannot take over lock with --no-prompt. Exiting.");
			return { success: false, remoteInfo };
		}

		const { takeover } = await inquirer.prompt([
			{
				type: "confirm",
				name: "takeover",
				message: "Take over lock anyway?",
				default: false,
			},
		]);

		if (!takeover) {
			info("Exiting without starting.");
			return { success: false, remoteInfo };
		}

		const releaseResult = await releaseLock(project, remoteInfo);
		if (!releaseResult.success) {
			error(`Failed to release existing lock: ${releaseResult.error}`);
			return { success: false, remoteInfo };
		}

		const forceResult = await acquireLock(project, remoteInfo);
		if (!forceResult.success) {
			error(`Failed to acquire lock: ${forceResult.error}`);
			return { success: false, remoteInfo };
		}

		success("Lock acquired (forced takeover)");
		return { success: true, remoteInfo };
	}

	error(`Failed to acquire lock: ${lockResult.error}`);
	return { success: false, remoteInfo };
}
```

**Step 2: Update `upCommand` to use the extracted function**

Replace the lock acquisition section with:

```typescript
	// Step 2.5: Acquire lock before any container/sync operations
	const lockResult = await handleLockAcquisition(project, config, options);
	if (!lockResult.success) {
		if (lockResult.remoteInfo) {
			process.exit(1);
		}
		return;
	}
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/commands/up.ts
git commit -m "$(cat <<'EOF'
refactor(up): extract handleLockAcquisition() function

Moves lock acquisition and takeover logic into dedicated function.
Reduces upCommand complexity by ~60 lines.
EOF
)"
```

---

## Task 4: Extract `checkAndResumeSync()` Function

**Files:**
- Modify: `src/commands/up.ts:166-183`

**Step 1: Add the extracted function**

Insert after `handleLockAcquisition()`:

```typescript
/**
 * Check sync status and resume if paused.
 * Non-fatal - container can start without sync.
 */
async function checkAndResumeSync(project: string): Promise<void> {
	const syncSpin = spinner("Checking sync status...");
	const syncStatus = await getSyncStatus(project);

	if (!syncStatus.exists) {
		syncSpin.warn("No sync session found - remote backup not active");
		info("Run 'devbox push' to set up remote sync.");
		return;
	}

	if (syncStatus.paused) {
		syncSpin.text = "Resuming sync...";
		const resumeResult = await resumeSync(project);
		if (!resumeResult.success) {
			syncSpin.warn("Failed to resume sync - continuing without remote backup");
		} else {
			syncSpin.succeed("Sync resumed");
		}
		return;
	}

	syncSpin.succeed("Sync is active");
}
```

**Step 2: Update `upCommand` to use the extracted function**

Replace lines 166-183 with:

```typescript
	// Step 3: Ensure sync is running (background sync to remote)
	await checkAndResumeSync(project);
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/commands/up.ts
git commit -m "$(cat <<'EOF'
refactor(up): extract checkAndResumeSync() function

Moves sync status checking and resume logic into dedicated function.
Reduces upCommand complexity by ~18 lines.
EOF
)"
```

---

## Task 5: Extract `handleContainerStatus()` Function

**Files:**
- Modify: `src/commands/up.ts:185-226`

**Step 1: Add the extracted function**

Insert after `checkAndResumeSync()`:

```typescript
/**
 * Handle existing container status (running or stopped).
 * Returns 'skip' to skip to post-start, 'continue' to proceed, or 'exit' to abort.
 */
async function handleContainerStatus(
	projectPath: string,
	options: UpOptions,
): Promise<{ action: "skip" | "continue" | "exit"; rebuild?: boolean }> {
	const containerStatus = await getContainerStatus(projectPath);

	if (containerStatus === ContainerStatus.Running) {
		if (options.noPrompt) {
			info("Container already running, continuing...");
			return { action: "continue" };
		}

		const { action } = await inquirer.prompt([
			{
				type: "rawlist",
				name: "action",
				message: "Container already running. What would you like to do?",
				choices: [
					{ name: "Continue with existing container", value: "continue" },
					{ name: "Restart container", value: "restart" },
					{ name: "Rebuild container", value: "rebuild" },
				],
			},
		]);

		if (action === "continue") {
			return { action: "skip" };
		}

		const stopSpin = spinner("Stopping container...");
		const stopResult = await stopContainer(projectPath);
		if (!stopResult.success) {
			stopSpin.fail("Failed to stop container");
			error(stopResult.error || "Unknown error");
			return { action: "exit" };
		}
		stopSpin.succeed("Container stopped");

		return { action: "continue", rebuild: action === "rebuild" };
	}

	if (containerStatus === ContainerStatus.Stopped) {
		info("Found stopped container, will restart it...");
	}

	return { action: "continue" };
}
```

**Step 2: Update `upCommand` to use the extracted function**

Replace lines 185-226 with:

```typescript
	// Step 4: Check container status
	const statusResult = await handleContainerStatus(projectPath, options);
	if (statusResult.action === "exit") {
		process.exit(1);
	}
	if (statusResult.action === "skip") {
		await handlePostStart(projectPath, config, options);
		return;
	}
	if (statusResult.rebuild) {
		options.rebuild = true;
	}
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/commands/up.ts
git commit -m "$(cat <<'EOF'
refactor(up): extract handleContainerStatus() function

Moves container status checking and restart/rebuild prompts into dedicated function.
Reduces upCommand complexity by ~40 lines.
EOF
)"
```

---

## Task 6: Extract `ensureDevcontainerConfig()` Function

**Files:**
- Modify: `src/commands/up.ts:228-270`

**Step 1: Add the extracted function**

Insert after `handleContainerStatus()`:

```typescript
/**
 * Ensure project has devcontainer.json, creating from template if needed.
 * Returns true if config exists (or was created), false if user cancelled.
 */
async function ensureDevcontainerConfig(
	projectPath: string,
	project: string,
	options: UpOptions,
): Promise<boolean> {
	if (hasLocalDevcontainerConfig(projectPath)) {
		return true;
	}

	if (options.noPrompt) {
		error("No devcontainer.json found and --no-prompt is set.");
		return false;
	}

	warn("No devcontainer.json found");

	const { createTemplate } = await inquirer.prompt([
		{
			type: "confirm",
			name: "createTemplate",
			message: "Would you like to create a devcontainer.json from a template?",
			default: true,
		},
	]);

	if (!createTemplate) {
		info("Please add a .devcontainer/devcontainer.json and try again.");
		return false;
	}

	const { templateId } = await inquirer.prompt([
		{
			type: "rawlist",
			name: "templateId",
			message: "Select a template:",
			choices: TEMPLATES.map((t) => ({
				name: `${t.name} - ${t.description}`,
				value: t.id,
			})),
		},
	]);

	createDevcontainerConfig(projectPath, templateId, project);
	success("Created .devcontainer/devcontainer.json");

	await commitDevcontainerConfig(projectPath);
	return true;
}
```

**Step 2: Update `upCommand` to use the extracted function**

Replace lines 228-270 with:

```typescript
	// Step 5: Check for devcontainer.json
	const hasConfig = await ensureDevcontainerConfig(projectPath, project, options);
	if (!hasConfig) {
		return;
	}
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/commands/up.ts
git commit -m "$(cat <<'EOF'
refactor(up): extract ensureDevcontainerConfig() function

Moves devcontainer.json detection and template creation into dedicated function.
Reduces upCommand complexity by ~43 lines.
EOF
)"
```

---

## Task 7: Refactor `handlePostStart()` - Extract Action Determination

**Files:**
- Modify: `src/commands/up.ts:329-437`

**Step 1: Add PostStartAction type and helper**

Insert before `handlePostStart()`:

```typescript
type PostStartAction = "editor" | "shell" | "both" | "none";

/**
 * Determine what post-start action to take based on options or user prompt.
 */
async function determinePostStartAction(
	config: DevboxConfigV2,
	options: UpOptions,
): Promise<{ action: PostStartAction; editor: string | undefined }> {
	// Handle flags for non-interactive mode
	if (options.editor && options.attach) {
		return { action: "both", editor: config.editor || "cursor" };
	}
	if (options.editor) {
		return { action: "editor", editor: config.editor || "cursor" };
	}
	if (options.attach) {
		return { action: "shell", editor: undefined };
	}
	if (options.noPrompt) {
		return { action: "none", editor: undefined };
	}

	// Interactive mode - may need to select editor
	let editor = config.editor;

	if (!editor) {
		const { selectedEditor } = await inquirer.prompt([
			{
				type: "rawlist",
				name: "selectedEditor",
				message: "Which editor would you like to use?",
				choices: [
					...SUPPORTED_EDITORS.map((e) => ({ name: e.name, value: e.id })),
					{ name: "Other (specify command)", value: "other" },
				],
			},
		]);

		if (selectedEditor === "other") {
			const { customEditor } = await inquirer.prompt([
				{
					type: "input",
					name: "customEditor",
					message: "Enter editor command:",
				},
			]);
			editor = customEditor;
		} else {
			editor = selectedEditor;
		}
	}

	// Ask what to do
	const { action } = await inquirer.prompt([
		{
			type: "rawlist",
			name: "action",
			message: "What would you like to do?",
			choices: [
				{ name: "Open in editor", value: "editor" },
				{ name: "Attach to shell", value: "shell" },
				{ name: "Both", value: "both" },
				{ name: "Neither (just exit)", value: "none" },
			],
		},
	]);

	return { action, editor };
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/up.ts
git commit -m "$(cat <<'EOF'
refactor(up): add determinePostStartAction() function

Extracts post-start action determination logic (flags vs prompts).
Preparation for simplifying handlePostStart().
EOF
)"
```

---

## Task 8: Refactor `handlePostStart()` - Extract Action Execution

**Files:**
- Modify: `src/commands/up.ts`

**Step 1: Add executePostStartAction() function**

Insert after `determinePostStartAction()`:

```typescript
/**
 * Execute the determined post-start action (open editor, attach shell, or both).
 */
async function executePostStartAction(
	projectPath: string,
	action: PostStartAction,
	editor: string | undefined,
): Promise<void> {
	if (action === "none") {
		success("Container ready. Run 'devbox up' again to open editor or attach.");
		return;
	}

	if (action === "editor" || action === "both") {
		if (!editor) {
			warn("No editor configured");
		} else {
			const openSpin = spinner(`Opening in ${editor}...`);
			const openResult = await openInEditor(projectPath, editor);
			if (openResult.success) {
				openSpin.succeed(`Opened in ${editor}`);
			} else {
				openSpin.fail(`Failed to open in ${editor}`);
				warn(openResult.error || "Unknown error");
			}
		}
	}

	if (action === "shell" || action === "both") {
		info("Attaching to shell (Ctrl+D to exit)...");
		await attachToShell(projectPath);
	}
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/up.ts
git commit -m "$(cat <<'EOF'
refactor(up): add executePostStartAction() function

Extracts post-start action execution (editor/shell/both).
Preparation for simplifying handlePostStart().
EOF
)"
```

---

## Task 9: Simplify `handlePostStart()` Using Extracted Functions

**Files:**
- Modify: `src/commands/up.ts`

**Step 1: Rewrite handlePostStart() to use extracted functions**

Replace the entire `handlePostStart()` function with:

```typescript
async function handlePostStart(
	projectPath: string,
	config: DevboxConfigV2,
	options: UpOptions,
): Promise<void> {
	const { action, editor } = await determinePostStartAction(config, options);

	// Handle editor preference saving (only in interactive mode)
	if (!options.noPrompt && !options.editor && !options.attach && !config.editor && editor) {
		const { makeDefault } = await inquirer.prompt([
			{
				type: "confirm",
				name: "makeDefault",
				message: `Make ${editor} your default editor for future sessions?`,
				default: true,
			},
		]);

		if (makeDefault) {
			config.editor = editor;
			saveConfig(config);
			success(`Set ${editor} as default editor.`);
		}
	}

	await executePostStartAction(projectPath, action, editor);
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Run full test suite**

Run: `bun test`
Expected: PASS

**Step 4: Commit**

```bash
git add src/commands/up.ts
git commit -m "$(cat <<'EOF'
refactor(up): simplify handlePostStart() using extracted functions

handlePostStart() now delegates to determinePostStartAction() and
executePostStartAction(), reducing complexity from 109 lines to ~25 lines.
EOF
)"
```

---

## Task 10: Final Cleanup and Verification

**Files:**
- Modify: `src/commands/up.ts`

**Step 1: Verify final upCommand is clean**

The final `upCommand` should now be approximately:

```typescript
export async function upCommand(
	projectArg: string | undefined,
	options: UpOptions,
): Promise<void> {
	// Step 1: Check config exists
	if (!configExists()) {
		error("devbox not configured. Run 'devbox init' first.");
		process.exit(1);
	}

	const config = loadConfig();
	if (!config) {
		error("Failed to load config.");
		process.exit(1);
	}

	// Step 2: Resolve project
	const resolved = await resolveProject(projectArg, options);
	if (!resolved) {
		process.exit(1);
	}
	const { project, projectPath } = resolved;

	header(`Starting '${project}'...`);

	// Step 2.5: Acquire lock before any container/sync operations
	const lockResult = await handleLockAcquisition(project, config, options);
	if (!lockResult.success) {
		if (lockResult.remoteInfo) {
			process.exit(1);
		}
		return;
	}

	// Step 3: Ensure sync is running
	await checkAndResumeSync(project);

	// Step 4: Check container status
	const statusResult = await handleContainerStatus(projectPath, options);
	if (statusResult.action === "exit") {
		process.exit(1);
	}
	if (statusResult.action === "skip") {
		await handlePostStart(projectPath, config, options);
		return;
	}
	if (statusResult.rebuild) {
		options.rebuild = true;
	}

	// Step 5: Check for devcontainer.json
	const hasConfig = await ensureDevcontainerConfig(projectPath, project, options);
	if (!hasConfig) {
		return;
	}

	// Step 6: Start container locally with retry
	await startContainerWithRetry(projectPath, options);

	// Step 7: Post-start options
	await handlePostStart(projectPath, config, options);
}
```

**Step 2: Run all checks**

Run: `bun run check && bun run typecheck && bun test`
Expected: All PASS

**Step 3: Count lines**

Run: `wc -l src/commands/up.ts`
Expected: Similar line count (extracted functions add overhead) but `upCommand` is now ~50 lines vs 243

**Step 4: Update implementation tracker**

Edit `plans/IMPLEMENTATION.md`:
- Mark Task 15 as complete with commit hash
- Mark Task 16 as complete with commit hash

**Step 5: Final commit**

```bash
git add src/commands/up.ts plans/IMPLEMENTATION.md
git commit -m "$(cat <<'EOF'
refactor(up): complete upCommand and handlePostStart refactoring

Task 15: upCommand reduced from 243 to ~50 lines by extracting:
- resolveProject()
- handleLockAcquisition()
- checkAndResumeSync()
- handleContainerStatus()
- ensureDevcontainerConfig()

Task 16: handlePostStart reduced from 109 to ~25 lines by extracting:
- determinePostStartAction()
- executePostStartAction()
EOF
)"
```

---

## Summary

| Before | After |
|--------|-------|
| `upCommand`: 243 lines | `upCommand`: ~50 lines |
| `handlePostStart`: 109 lines | `handlePostStart`: ~25 lines |
| 2 functions | 10 focused functions |

**New helper functions:**
1. `resolveProject()` - Project resolution from arg/cwd/prompt
2. `handleLockAcquisition()` - Lock acquire with takeover handling
3. `checkAndResumeSync()` - Sync status and resume
4. `handleContainerStatus()` - Container restart/rebuild prompts
5. `ensureDevcontainerConfig()` - Template creation prompts
6. `determinePostStartAction()` - Post-start action determination
7. `executePostStartAction()` - Post-start action execution

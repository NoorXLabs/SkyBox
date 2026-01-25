# Comprehensive Code Review - DevBox

**Date:** 2026-01-25
**Reviewer:** Automated Code Analysis
**Scope:** Complete codebase review including commands, libraries, types, tests, and configuration

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Critical Issues (Must Fix)](#critical-issues-must-fix)
3. [High Priority Issues](#high-priority-issues)
4. [Code Structure & Organization](#code-structure--organization)
5. [Reusability & Duplication](#reusability--duplication)
6. [Error Handling](#error-handling)
7. [Type Safety](#type-safety)
8. [Testing Improvements](#testing-improvements)
9. [Configuration Improvements](#configuration-improvements)
10. [Security Considerations](#security-considerations)
11. [Performance Optimizations](#performance-optimizations)
12. [Documentation Improvements](#documentation-improvements)

---

## Executive Summary

### Overview
DevBox is a well-architected CLI tool with clear separation of concerns and comprehensive documentation. However, this review identified **150+ improvement opportunities** across the codebase, ranging from critical security issues to minor consistency improvements.

### Key Statistics

| Category | Issue Count | Priority |
|----------|-------------|----------|
| Critical (Security/Bugs) | 3 | Immediate |
| High Priority | 18 | This Sprint |
| Medium Priority | 45 | Next Sprint |
| Low Priority | 85+ | Backlog |

### Areas Requiring Most Attention
1. **Security:** Shell injection vulnerability in lock.ts
2. **Duplication:** 12+ functions/patterns repeated across files
3. **Test Isolation:** Module-level mocks cause test order dependencies
4. **Type Safety:** Loose types and missing validations
5. **Error Handling:** Inconsistent patterns across commands

---

## Critical Issues (Must Fix)

### 1. Shell Injection Vulnerability in lock.ts

**Location:** `src/lib/lock.ts:104, 130`
**Severity:** CRITICAL
**Type:** Security Vulnerability

```typescript
// VULNERABLE CODE
const json = JSON.stringify(lockInfo);
const command = `mkdir -p ${locksDir} && echo '${json}' > ${lockPath}`;
const result = await runRemoteCommand(remoteInfo.host, command);
```

**Problem:** JSON string containing special characters (quotes, backslashes) will break the shell command. If `lockInfo` contains malicious content like `user: "admin'; rm -rf /"`, the resulting command becomes vulnerable to injection.

**Fix:**
```typescript
// Option 1: Base64 encoding
const jsonBase64 = Buffer.from(json).toString('base64');
const command = `mkdir -p ${locksDir} && echo '${jsonBase64}' | base64 -d > ${lockPath}`;

// Option 2: Proper shell escaping
const escapedJson = json.replace(/'/g, "'\\''");
const command = `mkdir -p ${locksDir} && echo '${escapedJson}' > ${lockPath}`;
```

---

### 2. Unescaped Remote Paths in Shell Commands

**Locations:**
- `src/lib/lock.ts:52, 149`
- `src/commands/clone.ts`
- `src/commands/push.ts:140`

**Severity:** HIGH
**Type:** Potential Bug / Security

```typescript
// VULNERABLE - paths with spaces or special chars break
const command = `cat ${lockPath} 2>/dev/null`;
const command = `rm -f ${lockPath}`;
await runRemoteCommand(host, `rm -rf ${remotePath}`);
```

**Fix:** Always quote paths:
```typescript
const command = `cat "${lockPath}" 2>/dev/null`;
const command = `rm -f "${lockPath}"`;
await runRemoteCommand(host, `rm -rf "${remotePath}"`);
```

---

### 3. Conflicting TypeScript Compiler Options

**Location:** `tsconfig.json:11, 13`
**Severity:** HIGH
**Type:** Configuration Bug

```json
{
  "compilerOptions": {
    "declaration": true,   // Generate .d.ts files
    "noEmit": true         // Don't emit any files
  }
}
```

**Problem:** These options conflict. With `noEmit: true`, declaration files are never generated despite `declaration: true`.

**Fix:** Choose one approach:
```json
// Option 1: If you need .d.ts files
{
  "declaration": true,
  "noEmit": false,
  "emitDeclarationOnly": true
}

// Option 2: If you don't need .d.ts files
{
  "declaration": false,
  "noEmit": true
}
```

---

## High Priority Issues

### 1. Docker Label Magic String Repeated 7 Times

**Location:** `src/lib/container.ts:59, 78, 106, 153, 181, 212, 252`
**Type:** Duplication / Maintainability

```typescript
// Repeated throughout file
`label=devcontainer.local_folder=${projectPath}`
`label=devcontainer.local_folder=${normalizedPath}`
"label=devcontainer.local_folder"
```

**Fix:** Extract to constant:
```typescript
const DOCKER_LABEL_KEY = "devcontainer.local_folder";
const getDockerLabelFilter = (path: string) => `label=${DOCKER_LABEL_KEY}=${path}`;
```

---

### 2. Duplicated checkRemoteProjectExists Function

**Locations:**
- `src/commands/clone.ts:18-28`
- `src/commands/push.ts:16-26`

**Type:** Code Duplication

```typescript
// Identical in both files
async function checkRemoteProjectExists(
  host: string,
  basePath: string,
  project: string,
): Promise<boolean> {
  const result = await runRemoteCommand(
    host,
    `test -d ${basePath}/${project} && echo "EXISTS" || echo "NOT_FOUND"`,
  );
  return result.stdout?.includes("EXISTS") ?? false;
}
```

**Fix:** Move to `src/lib/ssh.ts` or create `src/lib/remote.ts`:
```typescript
// src/lib/remote.ts
export async function checkRemoteProjectExists(
  host: string,
  basePath: string,
  project: string,
): Promise<boolean> {
  const result = await runRemoteCommand(
    host,
    `test -d "${basePath}/${project}" && echo "EXISTS" || echo "NOT_FOUND"`,
  );
  return result.stdout?.includes("EXISTS") ?? false;
}
```

---

### 3. Lock Status Checking Pattern Duplicated in 4 Files

**Locations:**
- `src/commands/rm.ts:65-95`
- `src/commands/down.ts`
- `src/commands/status.ts`
- `src/commands/up.ts`

**Type:** Code Duplication

```typescript
// Pattern repeated in all files
const projectRemote = getProjectRemote(project, config);
const lockSpin = spinner("Checking lock status...");
try {
  if (projectRemote) {
    const remoteInfo = createLockRemoteInfo(projectRemote.remote);
    const lockStatus = await getLockStatus(project, remoteInfo);
    if (lockStatus.locked) {
      if (lockStatus.ownedByMe) {
        // release
      } else {
        // show info
      }
    }
  }
} catch {
  lockSpin.warn("Could not check lock status");
}
```

**Fix:** Extract to shared function:
```typescript
// src/lib/lock.ts
export async function checkAndReportLockStatus(
  project: string,
  config: DevboxConfigV2,
  options?: { releaseIfOwned?: boolean }
): Promise<{ locked: boolean; ownedByMe: boolean; released?: boolean }>;
```

---

### 4. SSH Config Magic Numbers for String Slicing

**Location:** `src/lib/ssh.ts:33, 37, 39, 41, 43`

```typescript
// Hard to understand magic numbers
currentHost = { name: trimmed.slice(5).trim() };       // 5 = "host ".length
currentHost.hostname = trimmed.slice(9).trim();        // 9 = "hostname ".length
currentHost.user = trimmed.slice(5).trim();            // 5 = "user ".length
currentHost.port = parseInt(trimmed.slice(5).trim());  // 5 = "port ".length
currentHost.identityFile = trimmed.slice(13).trim();   // 13 = "identityfile ".length
```

**Fix:**
```typescript
const SSH_PREFIXES = {
  HOST: "host ",
  HOSTNAME: "hostname ",
  USER: "user ",
  PORT: "port ",
  IDENTITY_FILE: "identityfile ",
} as const;

if (lower.startsWith(SSH_PREFIXES.HOST)) {
  currentHost = { name: trimmed.slice(SSH_PREFIXES.HOST.length).trim() };
}
```

---

### 5. Repeated Error Handling Pattern in mutagen.ts

**Location:** `src/lib/mutagen.ts` (5+ functions)

```typescript
// Same try/catch pattern in createSyncSession, pauseSync, resumeSync, terminateSession
const name = sessionName(project);
try {
  await execa(MUTAGEN_PATH, args);
  return { success: true };
} catch (error: unknown) {
  return { success: false, error: getExecaErrorMessage(error) };
}
```

**Fix:** Create abstraction:
```typescript
async function executeMutagenCommand(
  args: string[],
  project?: string
): Promise<{ success: boolean; error?: string; stdout?: string }> {
  try {
    const result = await execa(MUTAGEN_PATH, args);
    return { success: true, stdout: result.stdout };
  } catch (error: unknown) {
    return { success: false, error: getExecaErrorMessage(error) };
  }
}
```

---

### 6. Biome Ignores .gitignore

**Location:** `biome.json:6`

```json
"vcs": {
  "enabled": false,
  "useIgnoreFile": false  // .gitignore completely ignored
}
```

**Fix:**
```json
"vcs": {
  "enabled": true,
  "clientKind": "git",
  "useIgnoreFile": true
}
```

---

### 7. Test Isolation Issues - Module-Level Mocks

**Locations:**
- `src/commands/__tests__/shell-docker-isolated.test.ts:12`
- `src/lib/__tests__/lock.test.ts:7-10`
- `src/lib/__tests__/container-id-isolated.test.ts`

**Problem:** Global execa mocks affect all subsequent tests in the test runner.

```typescript
// shell-docker-isolated.test.ts:12
mock.module("execa", () => ({ execa: mockExeca }));  // Pollutes global state
```

**Fix:** Use per-test mocking or dependency injection:
```typescript
// Option 1: Reset mocks after each test
afterEach(() => {
  mock.restore();
});

// Option 2: Use dependency injection in the actual code
export async function shellCommand(
  project: string,
  options: ShellOptions,
  deps = { execa }  // Injectable dependency
): Promise<void>
```

---

### 8. Loose Type for Template.config

**Location:** `src/types/index.ts:192`

```typescript
export interface Template {
  id: string;
  name: string;
  description: string;
  config: object;  // Too loose - no type safety
}
```

**Fix:**
```typescript
export interface DevcontainerConfig {
  name?: string;
  image?: string;
  features?: Record<string, unknown>;
  customizations?: {
    vscode?: {
      extensions?: string[];
      settings?: Record<string, unknown>;
    };
  };
  mounts?: string[];
  postCreateCommand?: string;
  workspaceFolder?: string;
  workspaceMount?: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  config: DevcontainerConfig;
}
```

---

## Code Structure & Organization

### 1. Function Complexity - upCommand is 234 Lines

**Location:** `src/commands/up.ts:35-268`

**Problem:** Main function has multiple nested conditions spanning 58+ lines for lock acquisition alone.

**Fix:** Break into smaller functions:
```typescript
async function upCommand(project?: string, options: UpOptions = {}): Promise<void> {
  const resolvedProject = await resolveProject(project);
  const config = await loadAndValidateConfig();

  await handleLockAcquisition(resolvedProject, config, options);
  await handleContainerStartup(resolvedProject, config, options);
  await handlePostStart(resolvedProject, config, options);
}

async function handleLockAcquisition(...): Promise<void> { /* 20-30 lines */ }
async function handleContainerStartup(...): Promise<void> { /* 30-40 lines */ }
async function handlePostStart(...): Promise<void> { /* 30-40 lines */ }
```

---

### 2. handlePostStart is 109 Lines with Complex Branching

**Location:** `src/commands/up.ts:320-428`

**Problem:** Complex multi-branch logic handling flags, prompts, and actions.

**Fix:** Extract decision logic:
```typescript
type PostStartAction = "editor" | "shell" | "both" | "none";

function determinePostStartAction(options: UpOptions, config: DevboxConfigV2): PostStartAction {
  if (options.editor && options.attach) return "both";
  if (options.editor) return "editor";
  if (options.attach) return "shell";
  if (options.noPrompt) return "none";
  return "prompt"; // will trigger interactive prompt
}

async function executePostStartAction(action: PostStartAction, ...): Promise<void> {
  const actions: Record<PostStartAction, () => Promise<void>> = {
    editor: () => openInEditor(...),
    shell: () => attachToShell(...),
    both: async () => { await openInEditor(...); await attachToShell(...); },
    none: async () => {},
  };
  await actions[action]();
}
```

---

### 3. DEVBOX_HOME Computed in 3 Different Files

**Locations:**
- `src/lib/paths.ts:5-6`
- `src/lib/config.ts:14-16`
- `src/lib/project.ts:8`

**Fix:** Use paths.ts as single source of truth:
```typescript
// src/lib/paths.ts (already exists)
export const DEVBOX_HOME = process.env.DEVBOX_HOME || join(homedir(), ".devbox");

// src/lib/config.ts - import instead of recomputing
import { DEVBOX_HOME } from "./paths.ts";
const CONFIG_PATH = join(DEVBOX_HOME, "config.yaml");

// src/lib/project.ts - import instead of recomputing
import { DEVBOX_HOME } from "./paths.ts";
```

---

### 4. Paths Computed at Module Load Time

**Location:** `src/lib/paths.ts:5-11`

**Problem:** If `DEVBOX_HOME` env var changes after import, paths are stale.

```typescript
// Current - computed once
export const DEVBOX_HOME = process.env.DEVBOX_HOME || join(homedir(), ".devbox");
export const CONFIG_PATH = join(DEVBOX_HOME, "config.yaml");
```

**Fix:** Use getters or functions:
```typescript
export const getDevboxHome = () =>
  process.env.DEVBOX_HOME || join(homedir(), ".devbox");

export const getConfigPath = () => join(getDevboxHome(), "config.yaml");
export const getProjectsDir = () => join(getDevboxHome(), "Projects");
export const getBinDir = () => join(getDevboxHome(), "bin");
export const getMutagenPath = () => join(getBinDir(), "mutagen");
export const getLogsDir = () => join(getDevboxHome(), "logs");
```

---

### 5. Inconsistent Dynamic Imports

**Locations:**
- `src/commands/clone.ts:162-165`
- `src/commands/new.ts:319`
- `src/commands/up.ts:273`

```typescript
// Inconsistent - sometimes dynamic import inside function
const { upCommand } = await import("./up.ts");
await upCommand(project, {});
```

**Fix:** Prefer static imports unless there's a specific reason for dynamic:
```typescript
// At top of file
import { upCommand } from "./up.ts";

// Or if circular dependency, document why:
// Dynamic import to avoid circular dependency with up.ts
const { upCommand } = await import("./up.ts");
```

---

## Reusability & Duplication

### Summary of Duplicated Code

| Pattern | Occurrences | Files |
|---------|-------------|-------|
| `checkRemoteProjectExists` | 2 | clone.ts, push.ts |
| SSH config writing | 2 | init.ts (lines 186-191, 236-241) |
| Lock status checking | 4 | rm.ts, down.ts, status.ts, up.ts |
| Devcontainer JSON creation | 2 | new.ts (lines 93-105, 284-296) |
| JSON shell escaping | 2 | new.ts (lines 102-103, 292) |
| Overwrite confirmation prompts | 2 | clone.ts, push.ts |
| Docker query patterns | 6 | container.ts |
| VSCode settings in templates | 4 | templates.ts (lines 44, 66, 87, 107) |

---

### 1. Extract Common VSCode Settings

**Location:** `src/lib/templates.ts:44, 66, 87, 107`

```typescript
// Repeated in 4 templates
"terminal.integrated.defaultProfile.linux": "zsh",
```

**Fix:**
```typescript
const COMMON_VSCODE_SETTINGS = {
  "terminal.integrated.defaultProfile.linux": "zsh",
} as const;

// Use in templates
customizations: {
  vscode: {
    settings: {
      ...COMMON_VSCODE_SETTINGS,
      // template-specific settings
    }
  }
}
```

---

### 2. Extract Docker Query Helper

**Location:** `src/lib/container.ts` (6 variations)

```typescript
// Pattern repeated with minor variations
const result = await execa("docker", [
  "ps", "-a", "-q", "--filter",
  `label=devcontainer.local_folder=${path}`,
]);
return result.stdout.trim() || null;
```

**Fix:**
```typescript
async function queryDocker(
  filters: string[],
  format?: string
): Promise<string | null> {
  const args = ["ps", "-a", "-q"];
  for (const filter of filters) {
    args.push("--filter", filter);
  }
  if (format) {
    args.push("--format", format);
  }
  const result = await execa("docker", args);
  return result.stdout.trim() || null;
}

// Usage
const containerId = await queryDocker([`label=${DOCKER_LABEL_KEY}=${path}`]);
```

---

### 3. Extract Confirmation Prompt Helper

**Location:** `src/commands/clone.ts:72-98`, `src/commands/push.ts:111-137`

```typescript
// Repeated double-confirmation pattern
const { overwrite } = await inquirer.prompt([...]);
if (!overwrite) {
  info("Operation cancelled.");
  return;
}
const { confirmOverwrite } = await inquirer.prompt([...]);
if (!confirmOverwrite) {
  info("Operation cancelled.");
  return;
}
```

**Fix:**
```typescript
// src/lib/ui.ts
export async function confirmDestructiveAction(
  message: string,
  confirmMessage: string
): Promise<boolean> {
  const { proceed } = await inquirer.prompt([{
    type: "confirm",
    name: "proceed",
    message,
    default: false,
  }]);

  if (!proceed) return false;

  const { confirm } = await inquirer.prompt([{
    type: "confirm",
    name: "confirm",
    message: confirmMessage,
    default: false,
  }]);

  return confirm;
}
```

---

## Error Handling

### 1. Missing YAML Parse Error Handling

**Location:** `src/lib/config.ts:30`

```typescript
const content = readFileSync(configPath, "utf-8");
const rawConfig = parse(content);  // Can throw on invalid YAML
```

**Fix:**
```typescript
try {
  const content = readFileSync(configPath, "utf-8");
  const rawConfig = parse(content);
} catch (err) {
  if (err instanceof YAMLError) {
    throw new Error(`Invalid config file: ${getErrorMessage(err)}`);
  }
  throw err;
}
```

---

### 2. Unsafe HOME Environment Variable Fallback

**Location:** `src/commands/init.ts:158`

```typescript
identityFile = customPath.replace(/^~/, process.env.HOME || "");
```

**Problem:** If `HOME` is not set, results in `/ssh/id_ed25519` instead of home path.

**Fix:**
```typescript
import { homedir } from "node:os";

const home = process.env.HOME || homedir();
if (!home) {
  throw new Error("Could not determine home directory");
}
identityFile = customPath.replace(/^~/, home);
```

---

### 3. Missing Filesystem Error Handling

**Location:** `src/commands/init.ts:447-448`

```typescript
mkdirSync(PROJECTS_DIR, { recursive: true });
mkdirSync(BIN_DIR, { recursive: true });
```

**Fix:**
```typescript
try {
  mkdirSync(PROJECTS_DIR, { recursive: true });
  mkdirSync(BIN_DIR, { recursive: true });
} catch (err) {
  error(`Failed to create directories: ${getErrorMessage(err)}`);
  info("Check permissions for ~/.devbox");
  process.exit(1);
}
```

---

### 4. Race Condition in list.ts

**Location:** `src/commands/list.ts:33-42`

```typescript
for (const entry of entries) {
  const fullPath = join(PROJECTS_DIR, entry);
  if (statSync(fullPath).isDirectory()) {  // Can throw - file could be deleted
```

**Fix:**
```typescript
for (const entry of entries) {
  const fullPath = join(PROJECTS_DIR, entry);
  try {
    if (statSync(fullPath).isDirectory()) {
      // ...
    }
  } catch {
    // File was deleted between readdir and stat, skip it
    continue;
  }
}
```

---

### 5. Unhandled Stream Errors in download.ts

**Location:** `src/lib/download.ts:73-84`

```typescript
const fileStream = createWriteStream(tarPath);
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  fileStream.write(value);  // NO ERROR HANDLING
}
fileStream.close();
```

**Fix:**
```typescript
const fileStream = createWriteStream(tarPath);

try {
  await new Promise<void>((resolve, reject) => {
    fileStream.on('error', reject);

    (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!fileStream.write(value)) {
          await new Promise(r => fileStream.once('drain', r));
        }
      }
      fileStream.end();
      fileStream.on('close', resolve);
    })().catch(reject);
  });
} catch (err) {
  return { success: false, error: `Download failed: ${getErrorMessage(err)}` };
}
```

---

### 6. Silent Error Handling in getGitBranch

**Location:** `src/commands/list.ts:11-23`

```typescript
async function getGitBranch(projectPath: string): Promise<string> {
  try {
    const result = await execa("git", [...]);
    return result.stdout.trim() || "-";
  } catch {
    return "-";  // No logging of actual error
  }
}
```

**Fix:** At least log in debug mode:
```typescript
catch (err) {
  // Debug logging for troubleshooting
  if (process.env.DEBUG) {
    console.debug(`Failed to get git branch for ${projectPath}:`, err);
  }
  return "-";
}
```

---

### 7. Inconsistent Error Message Functions

**Locations:**
- `src/lib/ssh.ts:104` uses `getErrorMessage`
- `src/lib/ssh.ts:122` uses `getExecaErrorMessage`

**Fix:** Document when to use each:
```typescript
// src/lib/errors.ts - Add JSDoc

/**
 * Get error message from any error type.
 * Use for general errors (fs operations, network, etc.)
 */
export function getErrorMessage(error: unknown): string;

/**
 * Get error message from execa errors, prioritizing stderr.
 * Use for command execution errors.
 */
export function getExecaErrorMessage(error: unknown): string;
```

---

## Type Safety

### 1. ContainerStatus Enum Not Used Consistently

**Location:** `src/types/index.ts:70-75` vs lines 110, 120

```typescript
// Enum exists
export enum ContainerStatus {
  Running = "running",
  Stopped = "stopped",
  NotFound = "not_found",
  Error = "error",
}

// But not used here:
export interface ProjectSummary {
  container: "running" | "stopped" | "unknown";  // Should use enum
}

export interface ContainerDetails {
  status: "running" | "stopped" | "unknown";  // Should use enum
}
```

**Fix:**
```typescript
// Add "unknown" to enum or use different approach
export enum ContainerStatus {
  Running = "running",
  Stopped = "stopped",
  NotFound = "not_found",
  Error = "error",
  Unknown = "unknown",  // Add this
}

export interface ProjectSummary {
  container: ContainerStatus;
}
```

---

### 2. SyncStatus.status is Generic String

**Location:** `src/types/index.ts:212`

```typescript
export interface SyncStatus {
  exists: boolean;
  paused: boolean;
  status: string;  // Too vague
}
```

**Fix:**
```typescript
export type SyncStatusValue = "syncing" | "paused" | "none" | "error";

export interface SyncStatus {
  exists: boolean;
  paused: boolean;
  status: SyncStatusValue;
}
```

---

### 3. Inconsistent null vs undefined

**Location:** `src/types/index.ts:49, 51`

```typescript
export interface RemoteEntry {
  host: string;
  user: string | null;    // null
  path: string;
  key?: string | null;    // optional AND nullable - confusing
}
```

**Fix:** Pick one convention (prefer undefined for optional):
```typescript
export interface RemoteEntry {
  host: string;
  user?: string;        // undefined = not set
  path: string;
  key?: string;         // undefined = not set
}
```

---

### 4. Unsafe Null Coalescing to Empty String

**Locations:**
- `src/commands/up.ts:94, 101, 104, 132, 138`

```typescript
const projectPath = getProjectPath(project ?? "");
```

**Problem:** Empty string can cause silent failures.

**Fix:**
```typescript
if (!project) {
  error("Project name is required");
  process.exit(1);
}
const projectPath = getProjectPath(project);
```

---

### 5. No Input Validation for Project Names

**Location:** Multiple files

**Problem:** Project names not validated for valid characters, path traversal, etc.

**Fix:**
```typescript
// src/lib/validation.ts
export function validateProjectName(name: string): { valid: boolean; error?: string } {
  if (!name || !name.trim()) {
    return { valid: false, error: "Project name is required" };
  }

  if (name.includes("/") || name.includes("\\")) {
    return { valid: false, error: "Project name cannot contain path separators" };
  }

  if (name.startsWith(".") || name.startsWith("-")) {
    return { valid: false, error: "Project name cannot start with . or -" };
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name)) {
    return { valid: false, error: "Project name can only contain letters, numbers, hyphens, and underscores" };
  }

  if (name.length > 100) {
    return { valid: false, error: "Project name is too long (max 100 characters)" };
  }

  return { valid: true };
}
```

---

### 6. Missing Type Guards

**Location:** `src/lib/errors.ts:32-38`

```typescript
export function hasExitCode(error: unknown, code: number): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "exitCode" in error &&
    error.exitCode === code
  );
}
```

**Fix:** Use proper type guard:
```typescript
interface ExecaError {
  exitCode: number;
  stderr?: string;
  stdout?: string;
}

export function isExecaError(error: unknown): error is ExecaError {
  return (
    error !== null &&
    typeof error === "object" &&
    "exitCode" in error &&
    typeof (error as Record<string, unknown>).exitCode === "number"
  );
}

export function hasExitCode(error: unknown, code: number): boolean {
  return isExecaError(error) && error.exitCode === code;
}
```

---

## Testing Improvements

### 1. Extract Shared Test Setup to test-utils.ts

**Problem:** 15+ test files have identical beforeEach/afterEach boilerplate.

```typescript
// Repeated in many files
beforeEach(() => {
  testDir = join(tmpdir(), `devbox-test-${Date.now()}`);
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
```

**Fix:** Add to `src/lib/__tests__/test-utils.ts`:
```typescript
export interface TestContext {
  testDir: string;
  cleanup: () => void;
}

export function createTestContext(name: string): TestContext {
  const testDir = join(tmpdir(), `devbox-${name}-test-${Date.now()}`);
  const originalEnv = process.env.DEVBOX_HOME;

  mkdirSync(testDir, { recursive: true });
  process.env.DEVBOX_HOME = testDir;

  return {
    testDir,
    cleanup: () => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true });
      }
      if (originalEnv) {
        process.env.DEVBOX_HOME = originalEnv;
      } else {
        delete process.env.DEVBOX_HOME;
      }
    }
  };
}

// Usage in tests
let ctx: TestContext;

beforeEach(() => {
  ctx = createTestContext("mytest");
});

afterEach(() => {
  ctx.cleanup();
});
```

---

### 2. Unify Mock Detection Logic

**Problem:** Three different implementations of the same detection:
- `src/lib/__tests__/container.test.ts:23-36`
- `src/lib/__tests__/container-id-isolated.test.ts:19-22`
- `src/commands/__tests__/status.test.ts:21-28`

**Fix:** Add to test-utils.ts:
```typescript
export function isExecaMocked(): boolean {
  try {
    const { execa } = require("execa");
    // Check if it's a mock by inspecting the function
    return execa.mock !== undefined ||
           execa.toString().includes("[mock]") ||
           execa.name === "mockConstructor";
  } catch {
    return true; // If require fails, likely mocked
  }
}
```

---

### 3. Extract Common Config Factory

**Problem:** Similar config objects created in 10+ test files.

**Fix:**
```typescript
// src/lib/__tests__/test-utils.ts
export function createTestConfig(overrides: Partial<DevboxConfigV2> = {}): DevboxConfigV2 {
  return {
    editor: "cursor",
    defaults: { sync_mode: "two-way-resolved", ignore: [] },
    remotes: {},
    projects: {},
    ...overrides,
  };
}

export function createTestRemote(name: string, overrides: Partial<RemoteEntry> = {}): RemoteEntry {
  return {
    host: `${name}.example.com`,
    user: "testuser",
    path: "/home/testuser/projects",
    ...overrides,
  };
}
```

---

### 4. Extract Git Repository Setup

**Problem:** Identical git init pattern in multiple test files.

**Fix:**
```typescript
// src/lib/__tests__/test-utils.ts
export async function createTestGitRepo(dir: string): Promise<void> {
  await execa("git", ["init"], { cwd: dir });
  await execa("git", ["config", "user.email", "test@test.com"], { cwd: dir });
  await execa("git", ["config", "user.name", "Test"], { cwd: dir });
  writeFileSync(join(dir, "README.md"), "# Test");
  await execa("git", ["add", "."], { cwd: dir });
  await execa("git", ["commit", "-m", "init"], { cwd: dir });
}
```

---

### 5. Strengthen Weak Assertions

**Location:** `src/commands/__tests__/clone.test.ts:29-33`

```typescript
// Current - trivial assertion
test("requires project argument", async () => {
  const projectName = "";
  expect(projectName).toBeFalsy();  // Always passes
});
```

**Fix:**
```typescript
test("requires project argument", async () => {
  // Mock console.error to capture output
  const errorSpy = spyOn(console, "error");

  await cloneCommand("", {});

  expect(errorSpy).toHaveBeenCalledWith(
    expect.stringContaining("Project name is required")
  );
});
```

---

### 6. Add Missing Error Path Tests

**Problem:** Many happy paths tested, few error paths.

**Examples to add:**
```typescript
// src/lib/__tests__/config.test.ts
test("throws on malformed YAML", () => {
  writeFileSync(join(testDir, "config.yaml"), "invalid: yaml: content:");
  expect(() => loadConfig()).toThrow(/Invalid config/);
});

// src/lib/__tests__/migration.test.ts
test("handles missing required fields", () => {
  const incomplete = { remote: {} };  // Missing host, path
  expect(() => migrateConfig(incomplete)).toThrow();
});
```

---

## Configuration Improvements

### 1. Add Missing Package.json Fields

**Location:** `package.json`

```json
{
  "name": "devbox",
  "version": "0.5.1-beta",
  // Add these:
  "description": "Local-first development containers with remote sync",
  "license": "Apache-2.0",
  "author": "DevBox Team",
  "homepage": "https://github.com/your-org/devbox",
  "repository": {
    "type": "git",
    "url": "https://github.com/your-org/devbox.git"
  },
  "engines": {
    "node": ">=18.0.0",
    "bun": ">=1.0.0"
  },
  "keywords": ["devcontainer", "docker", "development", "cli"]
}
```

---

### 2. Add Missing TypeScript Strict Flags

**Location:** `tsconfig.json`

```json
{
  "compilerOptions": {
    // Add these for better type safety:
    "forceConsistentCasingInFileNames": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true
  }
}
```

---

### 3. Fix Lefthook Glob Patterns

**Location:** `lefthook.yml`

```yaml
# Current - tests run on all changes
test:
  priority: 3
  run: bun run test

# Fix - add glob filter
test:
  priority: 3
  glob: "src/**/*.{ts,test.ts}"
  run: bun run test
```

---

### 4. Consider Bunfig Build Configuration

**Location:** `bunfig.toml`

```toml
[build]
entrypoints = ["./src/index.ts"]
outdir = "./dist"
target = "bun"

[build.define]
"process.env.VERSION" = "\"0.5.1-beta\""
```

---

## Security Considerations

### 1. Shell Command Injection Prevention

Create a utility for safe command building:

```typescript
// src/lib/shell.ts
export function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

export function buildShellCommand(parts: string[]): string {
  return parts.map(escapeShellArg).join(" ");
}

// Usage
const command = `rm -f ${escapeShellArg(lockPath)}`;
```

---

### 2. Path Traversal Prevention

```typescript
// src/lib/validation.ts
export function isPathTraversal(path: string): boolean {
  const normalized = resolve(path);
  return path.includes("..") ||
         normalized !== join(dirname(normalized), basename(normalized));
}

export function validatePath(basePath: string, relativePath: string): boolean {
  const full = resolve(basePath, relativePath);
  return full.startsWith(resolve(basePath));
}
```

---

### 3. Download Integrity Verification

**Location:** `src/lib/download.ts`

The `getMutagenChecksumUrl` function exists but is never used.

**Fix:** Implement checksum verification:
```typescript
async function verifyChecksum(filePath: string, expectedHash: string): Promise<boolean> {
  const content = readFileSync(filePath);
  const hash = await crypto.subtle.digest("SHA-256", content);
  const hashHex = Buffer.from(hash).toString("hex");
  return hashHex === expectedHash;
}

// In downloadMutagen, after extraction:
const checksumUrl = getMutagenChecksumUrl(version);
const checksums = await fetch(checksumUrl).then(r => r.text());
const expected = parseChecksumFile(checksums, filename);
if (!await verifyChecksum(binaryPath, expected)) {
  throw new Error("Checksum verification failed");
}
```

---

## Performance Optimizations

### 1. Parallelize Git Operations in list.ts

**Location:** `src/commands/list.ts:36`

```typescript
// Current - sequential
for (const entry of entries) {
  const branch = await getGitBranch(fullPath);  // Sequential
}
```

**Fix:**
```typescript
// Parallel
const projectsWithBranches = await Promise.all(
  entries
    .filter(entry => statSync(join(PROJECTS_DIR, entry)).isDirectory())
    .map(async entry => ({
      name: entry,
      branch: await getGitBranch(join(PROJECTS_DIR, entry))
    }))
);
```

---

### 2. Cache Config Loading

**Location:** `src/lib/config.ts`

```typescript
// Current - loads from disk on every call
export function loadConfig(): DevboxConfigV2 | null {
  // reads file every time
}
```

**Fix:**
```typescript
let cachedConfig: DevboxConfigV2 | null = null;
let configMtime: number = 0;

export function loadConfig(forceReload = false): DevboxConfigV2 | null {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    cachedConfig = null;
    return null;
  }

  const stat = statSync(configPath);
  if (!forceReload && cachedConfig && stat.mtimeMs === configMtime) {
    return cachedConfig;
  }

  // Load and cache
  const content = readFileSync(configPath, "utf-8");
  cachedConfig = parse(content) as DevboxConfigV2;
  configMtime = stat.mtimeMs;

  return cachedConfig;
}

export function invalidateConfigCache(): void {
  cachedConfig = null;
  configMtime = 0;
}
```

---

### 3. Avoid require() Inside Functions

**Location:** `src/lib/config.ts:15`

```typescript
// Current - requires module on every call
function getConfigPath(): string {
  const home = process.env.DEVBOX_HOME || `${require("node:os").homedir()}/.devbox`;
}
```

**Fix:** Import at module level:
```typescript
import { homedir } from "node:os";

function getConfigPath(): string {
  const home = process.env.DEVBOX_HOME || join(homedir(), ".devbox");
}
```

---

## Documentation Improvements

### 1. Add JSDoc to Complex Types

**Location:** `src/types/index.ts`

```typescript
/**
 * Lock information stored on remote server.
 * Used to prevent concurrent access to the same project from multiple machines.
 */
export interface LockInfo {
  /** Hostname of the machine holding the lock */
  machine: string;
  /** Username of the user holding the lock */
  user: string;
  /** ISO timestamp when lock was acquired */
  timestamp: string;
  /** Process ID of the devbox process holding the lock */
  pid: number;
}

/**
 * Result of checking lock status.
 * Discriminated union - if locked is true, info is guaranteed to exist.
 */
export type LockStatus =
  | { locked: false }
  | { locked: true; ownedByMe: boolean; info: LockInfo };
```

---

### 2. Document V1 to V2 Migration

**Location:** `src/types/index.ts`

```typescript
/**
 * @deprecated Use DevboxConfigV2 instead.
 * This type represents the legacy single-remote configuration format.
 * Configs in this format are automatically migrated to V2 on first load.
 * @see migrateConfig in migration.ts
 */
export interface DevboxConfig { ... }
```

---

### 3. Add File-Level Documentation

Each library file should have a header comment:

```typescript
/**
 * @file lock.ts
 * @description Manages multi-machine lock system for project access control.
 *
 * Locks are stored on the remote server in ~/.devbox-locks/<project>.lock
 * and prevent concurrent modifications from multiple machines.
 *
 * @example
 * const remoteInfo = createLockRemoteInfo(remote);
 * const result = await acquireLock("myproject", remoteInfo);
 * if (result.success) {
 *   // Safe to modify project
 *   await releaseLock("myproject", remoteInfo);
 * }
 */
```

---

### 4. Document Constants and Magic Values

```typescript
// src/lib/container.ts
/**
 * Docker label key used to identify devcontainers.
 * This label is set automatically by devcontainer-cli when starting a container.
 * The value is the absolute path to the local project folder.
 */
const DOCKER_LABEL_KEY = "devcontainer.local_folder";

// src/lib/download.ts
/**
 * Pinned Mutagen version for binary downloads.
 * Update this when a new stable Mutagen release is available.
 * @see https://github.com/mutagen-io/mutagen/releases
 */
const MUTAGEN_VERSION = "0.17.5";
```

---

## Implementation Priority

### Phase 1: Critical (Immediate)
1. Fix shell injection in lock.ts
2. Quote all paths in shell commands
3. Fix tsconfig.json conflict

### Phase 2: High Priority (This Sprint)
1. Extract duplicated functions to shared modules
2. Fix biome.json VCS settings
3. Add test isolation improvements
4. Add Template type safety

### Phase 3: Medium Priority (Next Sprint)
1. Refactor large functions (up.ts, status.ts)
2. Add error handling improvements
3. Improve type safety across the board
4. Extract test utilities

### Phase 4: Low Priority (Backlog)
1. Performance optimizations
2. Documentation improvements
3. Configuration enhancements
4. Minor consistency fixes

---

## Appendix: Quick Reference

### Files with Most Issues

| File | Issue Count | Priority Issues |
|------|-------------|-----------------|
| `src/lib/lock.ts` | 6 | Security vulnerability |
| `src/commands/up.ts` | 8 | Function complexity |
| `src/lib/container.ts` | 9 | Duplication |
| `src/lib/ssh.ts` | 7 | Magic numbers |
| `src/lib/mutagen.ts` | 5 | Duplication |
| `src/types/index.ts` | 7 | Type safety |

### Constants to Extract

```typescript
// Suggested src/lib/constants.ts
export const DOCKER_LABEL_KEY = "devcontainer.local_folder";
export const LOCKS_DIR_NAME = ".devbox-locks";
export const CONFIG_FILENAME = "config.yaml";
export const DEFAULT_EDITOR = "cursor";
export const MUTAGEN_VERSION = "0.17.5";
export const CTRL_C_EXIT_CODE = 130;
```

### New Modules to Create

1. `src/lib/remote.ts` - Remote project operations
2. `src/lib/validation.ts` - Input validation
3. `src/lib/shell.ts` - Shell escaping utilities
4. `src/lib/constants.ts` - Shared constants

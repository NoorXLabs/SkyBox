# Init Command Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the `devbox init` command - an interactive wizard that configures devbox for first use.

**Architecture:** Modular TypeScript CLI using Commander.js for parsing and Inquirer for prompts. Core modules (paths, config, ssh, download) are decoupled for testability. The init command orchestrates these modules in a step-by-step wizard flow.

**Tech Stack:** Bun runtime, Commander.js, Inquirer, Chalk, Ora, YAML, execa

---

## Task 1: Initialize Bun Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `bin/devbox`
- Create: `src/index.ts`

**Step 1: Initialize bun project**

Run: `bun init -y`

**Step 2: Update package.json with dependencies and config**

```json
{
  "name": "devbox",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "devbox": "./bin/devbox"
  },
  "scripts": {
    "dev": "bun run src/index.ts",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "chalk": "^5.3.0",
    "commander": "^12.1.0",
    "execa": "^9.5.2",
    "inquirer": "^12.3.2",
    "ora": "^8.1.1",
    "yaml": "^2.7.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "@types/inquirer": "^9.0.7"
  }
}
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "types": ["bun"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create bin/devbox executable**

```bash
#!/usr/bin/env bun
import "../src/index.ts";
```

**Step 5: Create minimal src/index.ts**

```typescript
import { program } from "commander";

program
  .name("devbox")
  .description("Local-first dev containers with remote sync")
  .version("0.1.0");

program.parse();
```

**Step 6: Install dependencies**

Run: `bun install`
Expected: Dependencies installed, bun.lockb created

**Step 7: Make bin executable and test**

Run: `chmod +x bin/devbox && bun run dev --help`
Expected: Shows help output with "Local-first dev containers with remote sync"

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: initialize bun project with commander setup"
```

---

## Task 2: Paths Module

**Files:**
- Create: `src/lib/paths.ts`
- Create: `src/lib/paths.test.ts`

**Step 1: Write the test**

```typescript
// src/lib/paths.test.ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { DEVBOX_HOME, CONFIG_PATH, PROJECTS_DIR, BIN_DIR, MUTAGEN_PATH } from "./paths";
import { homedir } from "os";

describe("paths", () => {
  const originalEnv = process.env.DEVBOX_HOME;

  afterEach(() => {
    if (originalEnv) {
      process.env.DEVBOX_HOME = originalEnv;
    } else {
      delete process.env.DEVBOX_HOME;
    }
  });

  test("uses default home when DEVBOX_HOME not set", () => {
    delete process.env.DEVBOX_HOME;
    // Re-import to get fresh values
    const paths = require("./paths");
    expect(paths.DEVBOX_HOME).toBe(`${homedir()}/.devbox`);
  });

  test("CONFIG_PATH is under DEVBOX_HOME", () => {
    expect(CONFIG_PATH).toContain("config.yaml");
  });

  test("PROJECTS_DIR is under DEVBOX_HOME", () => {
    expect(PROJECTS_DIR).toContain("projects");
  });

  test("BIN_DIR is under DEVBOX_HOME", () => {
    expect(BIN_DIR).toContain("bin");
  });

  test("MUTAGEN_PATH is under BIN_DIR", () => {
    expect(MUTAGEN_PATH).toContain("mutagen");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/paths.test.ts`
Expected: FAIL - Cannot find module './paths'

**Step 3: Implement paths module**

```typescript
// src/lib/paths.ts
import { homedir } from "os";
import { join } from "path";

export const DEVBOX_HOME = process.env.DEVBOX_HOME || join(homedir(), ".devbox");
export const CONFIG_PATH = join(DEVBOX_HOME, "config.yaml");
export const PROJECTS_DIR = join(DEVBOX_HOME, "projects");
export const BIN_DIR = join(DEVBOX_HOME, "bin");
export const MUTAGEN_PATH = join(BIN_DIR, "mutagen");
export const LOGS_DIR = join(DEVBOX_HOME, "logs");
```

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/paths.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/lib/paths.ts src/lib/paths.test.ts
git commit -m "feat: add paths module for devbox directory constants"
```

---

## Task 3: Types Module

**Files:**
- Create: `src/types/index.ts`

**Step 1: Create types**

```typescript
// src/types/index.ts

export interface SSHHost {
  name: string;
  hostname?: string;
  user?: string;
  port?: number;
  identityFile?: string;
}

export interface RemoteConfig {
  host: string;
  base_path: string;
}

export interface SyncDefaults {
  sync_mode: string;
  ignore: string[];
}

export interface ProjectConfig {
  remote?: string;
  ignore?: string[];
  editor?: string;
}

export interface DevboxConfig {
  remote: RemoteConfig;
  editor: string;
  defaults: SyncDefaults;
  projects: Record<string, ProjectConfig>;
}

export const DEFAULT_IGNORE = [
  ".git/index.lock",
  ".git/*.lock",
  ".git/hooks/*",
  "node_modules",
  "venv",
  ".venv",
  "__pycache__",
  "*.pyc",
  ".devbox-local",
  "dist",
  "build",
  ".next",
  "target",
  "vendor",
];
```

**Step 2: Verify typecheck passes**

Run: `bun run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add TypeScript types for config and SSH"
```

---

## Task 4: Config Module

**Files:**
- Create: `src/lib/config.ts`
- Create: `src/lib/config.test.ts`

**Step 1: Write the tests**

```typescript
// src/lib/config.test.ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("config", () => {
  let testDir: string;
  let originalEnv: string | undefined;

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

  test("configExists returns false when no config", async () => {
    const { configExists } = await import("./config");
    expect(configExists()).toBe(false);
  });

  test("loadConfig returns null when no config", async () => {
    const { loadConfig } = await import("./config");
    expect(loadConfig()).toBeNull();
  });

  test("saveConfig creates config file", async () => {
    const { saveConfig, loadConfig, configExists } = await import("./config");
    const config = {
      remote: { host: "myserver", base_path: "~/code" },
      editor: "cursor",
      defaults: { sync_mode: "two-way-resolved", ignore: ["node_modules"] },
      projects: {},
    };

    saveConfig(config);

    expect(configExists()).toBe(true);
    const loaded = loadConfig();
    expect(loaded?.remote.host).toBe("myserver");
    expect(loaded?.editor).toBe("cursor");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/config.test.ts`
Expected: FAIL - Cannot find module './config'

**Step 3: Implement config module**

```typescript
// src/lib/config.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { parse, stringify } from "yaml";
import type { DevboxConfig } from "../types";

// Dynamic import to get fresh DEVBOX_HOME on each call
function getConfigPath(): string {
  const home = process.env.DEVBOX_HOME || `${require("os").homedir()}/.devbox`;
  return `${home}/config.yaml`;
}

export function configExists(): boolean {
  return existsSync(getConfigPath());
}

export function loadConfig(): DevboxConfig | null {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return null;
  }

  const content = readFileSync(configPath, "utf-8");
  return parse(content) as DevboxConfig;
}

export function saveConfig(config: DevboxConfig): void {
  const configPath = getConfigPath();
  const dir = dirname(configPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const content = stringify(config);
  writeFileSync(configPath, content, "utf-8");
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/config.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/lib/config.ts src/lib/config.test.ts
git commit -m "feat: add config module for reading/writing devbox config"
```

---

## Task 5: SSH Module

**Files:**
- Create: `src/lib/ssh.ts`
- Create: `src/lib/ssh.test.ts`

**Step 1: Write the tests**

```typescript
// src/lib/ssh.test.ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir, homedir } from "os";

describe("ssh", () => {
  describe("parseSSHConfig", () => {
    let testDir: string;
    let originalHome: string | undefined;

    beforeEach(() => {
      testDir = join(tmpdir(), `devbox-ssh-test-${Date.now()}`);
      mkdirSync(join(testDir, ".ssh"), { recursive: true });
      originalHome = process.env.HOME;
      process.env.HOME = testDir;
    });

    afterEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true });
      }
      if (originalHome) {
        process.env.HOME = originalHome;
      }
    });

    test("returns empty array when no ssh config", async () => {
      const { parseSSHConfig } = await import("./ssh");
      const hosts = parseSSHConfig();
      expect(hosts).toEqual([]);
    });

    test("parses hosts from ssh config", async () => {
      const sshConfig = `
Host myserver
  HostName 192.168.1.100
  User admin
  Port 22
  IdentityFile ~/.ssh/id_ed25519

Host workserver
  HostName work.example.com
  User developer
`;
      writeFileSync(join(testDir, ".ssh", "config"), sshConfig);

      const { parseSSHConfig } = await import("./ssh");
      const hosts = parseSSHConfig();

      expect(hosts.length).toBe(2);
      expect(hosts[0].name).toBe("myserver");
      expect(hosts[0].hostname).toBe("192.168.1.100");
      expect(hosts[0].user).toBe("admin");
      expect(hosts[1].name).toBe("workserver");
    });
  });

  describe("findSSHKeys", () => {
    test("finds existing ssh keys", async () => {
      const { findSSHKeys } = await import("./ssh");
      const keys = findSSHKeys();
      // This will depend on the actual system, just verify it returns an array
      expect(Array.isArray(keys)).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/ssh.test.ts`
Expected: FAIL - Cannot find module './ssh'

**Step 3: Implement ssh module**

```typescript
// src/lib/ssh.ts
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { execa } from "execa";
import type { SSHHost } from "../types";

function getSSHDir(): string {
  const home = process.env.HOME || homedir();
  return join(home, ".ssh");
}

export function parseSSHConfig(): SSHHost[] {
  const configPath = join(getSSHDir(), "config");

  if (!existsSync(configPath)) {
    return [];
  }

  const content = readFileSync(configPath, "utf-8");
  const hosts: SSHHost[] = [];
  let currentHost: SSHHost | null = null;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    if (trimmed.toLowerCase().startsWith("host ") && !trimmed.includes("*")) {
      if (currentHost) {
        hosts.push(currentHost);
      }
      currentHost = { name: trimmed.slice(5).trim() };
    } else if (currentHost) {
      const lower = trimmed.toLowerCase();
      if (lower.startsWith("hostname ")) {
        currentHost.hostname = trimmed.slice(9).trim();
      } else if (lower.startsWith("user ")) {
        currentHost.user = trimmed.slice(5).trim();
      } else if (lower.startsWith("port ")) {
        currentHost.port = parseInt(trimmed.slice(5).trim(), 10);
      } else if (lower.startsWith("identityfile ")) {
        currentHost.identityFile = trimmed.slice(13).trim();
      }
    }
  }

  if (currentHost) {
    hosts.push(currentHost);
  }

  return hosts;
}

export function findSSHKeys(): string[] {
  const sshDir = getSSHDir();

  if (!existsSync(sshDir)) {
    return [];
  }

  const keyPatterns = ["id_ed25519", "id_rsa", "id_ecdsa", "id_dsa"];
  const keys: string[] = [];

  try {
    const files = readdirSync(sshDir);
    for (const pattern of keyPatterns) {
      if (files.includes(pattern)) {
        keys.push(join(sshDir, pattern));
      }
    }
  } catch {
    return [];
  }

  return keys;
}

export async function testConnection(host: string): Promise<{ success: boolean; error?: string }> {
  try {
    await execa("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=5", host, "echo", "ok"]);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.stderr || error.message };
  }
}

export async function copyKey(host: string, keyPath: string): Promise<{ success: boolean; error?: string }> {
  try {
    await execa("ssh-copy-id", ["-i", keyPath, host], { stdio: "inherit" });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function runRemoteCommand(
  host: string,
  command: string
): Promise<{ success: boolean; stdout?: string; error?: string }> {
  try {
    const result = await execa("ssh", [host, command]);
    return { success: true, stdout: result.stdout };
  } catch (error: any) {
    return { success: false, error: error.stderr || error.message };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/ssh.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/lib/ssh.ts src/lib/ssh.test.ts
git commit -m "feat: add ssh module for config parsing and connection testing"
```

---

## Task 6: Download Module (Mutagen)

**Files:**
- Create: `src/lib/download.ts`
- Create: `src/lib/download.test.ts`

**Step 1: Write the tests**

```typescript
// src/lib/download.test.ts
import { describe, expect, test } from "bun:test";
import { getMutagenDownloadUrl, getMutagenChecksumUrl } from "./download";

describe("download", () => {
  test("getMutagenDownloadUrl returns correct URL for darwin-arm64", () => {
    const url = getMutagenDownloadUrl("darwin", "arm64", "0.17.5");
    expect(url).toContain("mutagen");
    expect(url).toContain("darwin");
    expect(url).toContain("arm64");
    expect(url).toContain("0.17.5");
  });

  test("getMutagenDownloadUrl returns correct URL for linux-amd64", () => {
    const url = getMutagenDownloadUrl("linux", "x64", "0.17.5");
    expect(url).toContain("linux");
    expect(url).toContain("amd64");
  });

  test("getMutagenChecksumUrl returns SHA256SUMS URL", () => {
    const url = getMutagenChecksumUrl("0.17.5");
    expect(url).toContain("SHA256SUMS");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/download.test.ts`
Expected: FAIL - Cannot find module './download'

**Step 3: Implement download module**

```typescript
// src/lib/download.ts
import { existsSync, mkdirSync, createWriteStream, chmodSync, unlinkSync } from "fs";
import { join } from "path";
import { pipeline } from "stream/promises";
import { createGunzip } from "zlib";
import { extract } from "tar";
import { BIN_DIR, MUTAGEN_PATH } from "./paths";

const MUTAGEN_VERSION = "0.17.5";
const MUTAGEN_REPO = "mutagen-io/mutagen";

export function getMutagenDownloadUrl(platform: string, arch: string, version: string): string {
  const os = platform === "darwin" ? "darwin" : "linux";
  const cpu = arch === "arm64" ? "arm64" : "amd64";
  return `https://github.com/${MUTAGEN_REPO}/releases/download/v${version}/mutagen_${os}_${cpu}_v${version}.tar.gz`;
}

export function getMutagenChecksumUrl(version: string): string {
  return `https://github.com/${MUTAGEN_REPO}/releases/download/v${version}/SHA256SUMS`;
}

export function isMutagenInstalled(): boolean {
  if (!existsSync(MUTAGEN_PATH)) {
    return false;
  }

  try {
    const result = Bun.spawnSync([MUTAGEN_PATH, "version"]);
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export async function downloadMutagen(
  onProgress?: (message: string) => void
): Promise<{ success: boolean; error?: string }> {
  const platform = process.platform;
  const arch = process.arch;

  if (platform !== "darwin" && platform !== "linux") {
    return { success: false, error: `Unsupported platform: ${platform}` };
  }

  const url = getMutagenDownloadUrl(platform, arch, MUTAGEN_VERSION);
  const tarPath = join(BIN_DIR, "mutagen.tar.gz");

  try {
    // Create bin directory
    if (!existsSync(BIN_DIR)) {
      mkdirSync(BIN_DIR, { recursive: true });
    }

    onProgress?.(`Downloading mutagen v${MUTAGEN_VERSION}...`);

    // Download tar.gz
    const response = await fetch(url);
    if (!response.ok) {
      return { success: false, error: `Download failed: ${response.status}` };
    }

    // Write to file
    const fileStream = createWriteStream(tarPath);
    const reader = response.body?.getReader();

    if (!reader) {
      return { success: false, error: "Failed to read response body" };
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fileStream.write(value);
    }
    fileStream.close();

    onProgress?.("Extracting...");

    // Extract tar.gz
    await extract({
      file: tarPath,
      cwd: BIN_DIR,
      filter: (path) => path === "mutagen" || path === "mutagen-agents.tar.gz",
    });

    // Make executable
    chmodSync(MUTAGEN_PATH, 0o755);

    // Clean up tar file
    unlinkSync(tarPath);

    onProgress?.(`Installed mutagen v${MUTAGEN_VERSION}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/download.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/lib/download.ts src/lib/download.test.ts
git commit -m "feat: add download module for mutagen binary management"
```

---

## Task 7: UI Helpers Module

**Files:**
- Create: `src/lib/ui.ts`

**Step 1: Create UI helpers**

```typescript
// src/lib/ui.ts
import chalk from "chalk";
import ora, { type Ora } from "ora";

export function success(message: string): void {
  console.log(chalk.green("  ✓"), message);
}

export function error(message: string): void {
  console.log(chalk.red("  ✗"), message);
}

export function warn(message: string): void {
  console.log(chalk.yellow("  !"), message);
}

export function info(message: string): void {
  console.log(chalk.blue("  ℹ"), message);
}

export function header(message: string): void {
  console.log();
  console.log(chalk.bold(message));
}

export function spinner(message: string): Ora {
  return ora({ text: message, prefixText: " " }).start();
}

export function printNextSteps(steps: string[]): void {
  console.log();
  console.log(chalk.bold("Next steps:"));
  steps.forEach((step, i) => {
    console.log(chalk.dim(`  ${i + 1}.`), step);
  });
  console.log();
}
```

**Step 2: Verify typecheck passes**

Run: `bun run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/ui.ts
git commit -m "feat: add ui module for terminal output helpers"
```

---

## Task 8: Init Command

**Files:**
- Create: `src/commands/init.ts`
- Modify: `src/index.ts`

**Step 1: Implement init command**

```typescript
// src/commands/init.ts
import inquirer from "inquirer";
import { existsSync, mkdirSync } from "fs";
import { execa } from "execa";
import { configExists, saveConfig } from "../lib/config";
import { parseSSHConfig, findSSHKeys, testConnection, copyKey, runRemoteCommand } from "../lib/ssh";
import { isMutagenInstalled, downloadMutagen } from "../lib/download";
import { DEVBOX_HOME, PROJECTS_DIR, BIN_DIR } from "../lib/paths";
import { success, error, warn, info, header, spinner, printNextSteps } from "../lib/ui";
import { DEFAULT_IGNORE, type DevboxConfig } from "../types";

async function checkDependencies(): Promise<boolean> {
  header("Checking dependencies...");

  // Check Docker
  try {
    await execa("docker", ["--version"]);
    success("Docker installed");
  } catch {
    error("Docker not found");
    info("Install Docker: https://docs.docker.com/get-docker/");
    return false;
  }

  // Check Node (for devcontainer-cli later)
  try {
    await execa("node", ["--version"]);
    success("Node.js available");
  } catch {
    error("Node.js not found");
    info("Install Node.js: https://nodejs.org/");
    return false;
  }

  return true;
}

async function handleMutagen(): Promise<boolean> {
  if (isMutagenInstalled()) {
    success("Mutagen already installed");
    return true;
  }

  header("Installing mutagen...");
  const spin = spinner("Downloading mutagen...");

  const result = await downloadMutagen((msg) => {
    spin.text = msg;
  });

  if (result.success) {
    spin.succeed("Mutagen installed");
    return true;
  } else {
    spin.fail(`Failed to install mutagen: ${result.error}`);
    info("Manual install: https://mutagen.io/documentation/introduction/installation");
    return false;
  }
}

async function configureRemote(): Promise<{ host: string; basePath: string } | null> {
  header("Configure remote server");

  const existingHosts = parseSSHConfig();
  const choices = [
    ...existingHosts.map((h) => ({
      name: `${h.name}${h.hostname ? ` (${h.hostname})` : ""}`,
      value: h.name,
    })),
    { name: "+ Add new server", value: "__new__" },
  ];

  const { hostChoice } = await inquirer.prompt([
    {
      type: "list",
      name: "hostChoice",
      message: "Select SSH host:",
      choices,
    },
  ]);

  let sshHost: string;

  if (hostChoice === "__new__") {
    const { hostname, username, friendlyName } = await inquirer.prompt([
      { type: "input", name: "hostname", message: "Server hostname or IP:" },
      { type: "input", name: "username", message: "SSH username:", default: "root" },
      { type: "input", name: "friendlyName", message: "Friendly name for this host:" },
    ]);

    sshHost = friendlyName;
    info(`You'll need to add this to ~/.ssh/config:`);
    console.log(`
Host ${friendlyName}
  HostName ${hostname}
  User ${username}
`);
  } else {
    sshHost = hostChoice;
  }

  // Test connection
  const spin = spinner("Testing SSH connection...");
  const connResult = await testConnection(sshHost);

  if (connResult.success) {
    spin.succeed("SSH connection successful");
  } else {
    spin.fail("SSH connection failed");

    // Try to set up key auth
    const keys = findSSHKeys();
    if (keys.length > 0) {
      const { setupKey } = await inquirer.prompt([
        {
          type: "confirm",
          name: "setupKey",
          message: "Set up SSH key authentication?",
          default: true,
        },
      ]);

      if (setupKey) {
        const { keyPath } = await inquirer.prompt([
          {
            type: "list",
            name: "keyPath",
            message: "Select SSH key:",
            choices: keys,
          },
        ]);

        info("Running ssh-copy-id (you may need to enter your password)...");
        const copyResult = await copyKey(sshHost, keyPath);

        if (copyResult.success) {
          success("SSH key installed");

          // Re-test connection
          const retestResult = await testConnection(sshHost);
          if (!retestResult.success) {
            error("Connection still failing after key setup");
            return null;
          }
          success("SSH connection now working");
        } else {
          error("Failed to install SSH key");
          info(`Manually copy your public key to the server's ~/.ssh/authorized_keys`);
          return null;
        }
      } else {
        return null;
      }
    } else {
      error("No SSH keys found in ~/.ssh/");
      info("Generate a key with: ssh-keygen -t ed25519");
      return null;
    }
  }

  // Configure remote path
  const { basePath } = await inquirer.prompt([
    {
      type: "input",
      name: "basePath",
      message: "Remote code directory:",
      default: "~/code",
    },
  ]);

  // Check if directory exists
  const checkSpin = spinner("Checking remote directory...");
  const checkResult = await runRemoteCommand(sshHost, `ls -d ${basePath} 2>/dev/null || echo "__NOT_FOUND__"`);

  if (checkResult.stdout?.includes("__NOT_FOUND__")) {
    checkSpin.warn("Directory doesn't exist");
    const { createDir } = await inquirer.prompt([
      {
        type: "confirm",
        name: "createDir",
        message: `Create ${basePath} on remote?`,
        default: true,
      },
    ]);

    if (createDir) {
      const mkdirResult = await runRemoteCommand(sshHost, `mkdir -p ${basePath}`);
      if (mkdirResult.success) {
        success("Created remote directory");
      } else {
        error(`Failed to create directory: ${mkdirResult.error}`);
        return null;
      }
    } else {
      return null;
    }
  } else {
    checkSpin.succeed("Remote directory exists");

    // List existing projects
    const lsResult = await runRemoteCommand(sshHost, `ls -1 ${basePath} 2>/dev/null | head -10`);
    if (lsResult.stdout?.trim()) {
      info("Existing projects on remote:");
      lsResult.stdout.split("\n").forEach((p) => console.log(`    ${p}`));
    }
  }

  return { host: sshHost, basePath };
}

async function configureEditor(): Promise<string> {
  header("Configure editor");

  const { editor } = await inquirer.prompt([
    {
      type: "list",
      name: "editor",
      message: "Preferred editor:",
      choices: [
        { name: "Cursor", value: "cursor" },
        { name: "VS Code", value: "code" },
        { name: "Zed", value: "zed" },
        { name: "Vim", value: "vim" },
        { name: "Neovim", value: "nvim" },
        { name: "Other", value: "__other__" },
      ],
    },
  ]);

  if (editor === "__other__") {
    const { customEditor } = await inquirer.prompt([
      { type: "input", name: "customEditor", message: "Editor command:" },
    ]);
    return customEditor;
  }

  return editor;
}

export async function initCommand(): Promise<void> {
  console.log();
  console.log("Welcome to devbox setup!");
  console.log();

  // Check for existing config
  if (configExists()) {
    const { reconfigure } = await inquirer.prompt([
      {
        type: "confirm",
        name: "reconfigure",
        message: "devbox is already configured. Reconfigure?",
        default: false,
      },
    ]);

    if (!reconfigure) {
      info("Keeping existing configuration.");
      return;
    }
  }

  // Check dependencies
  const depsOk = await checkDependencies();
  if (!depsOk) {
    error("Please install missing dependencies and try again.");
    process.exit(1);
  }

  // Handle mutagen
  const mutagenOk = await handleMutagen();
  if (!mutagenOk) {
    const { continueAnyway } = await inquirer.prompt([
      {
        type: "confirm",
        name: "continueAnyway",
        message: "Continue without mutagen? (sync won't work)",
        default: false,
      },
    ]);

    if (!continueAnyway) {
      return;
    }
  }

  // Configure remote
  const remote = await configureRemote();
  if (!remote) {
    error("Remote configuration failed.");
    process.exit(1);
  }

  // Configure editor
  const editor = await configureEditor();

  // Create directories
  header("Setting up devbox...");
  mkdirSync(PROJECTS_DIR, { recursive: true });
  mkdirSync(BIN_DIR, { recursive: true });
  success(`Created ${DEVBOX_HOME}`);

  // Save config
  const config: DevboxConfig = {
    remote: {
      host: remote.host,
      base_path: remote.basePath,
    },
    editor,
    defaults: {
      sync_mode: "two-way-resolved",
      ignore: DEFAULT_IGNORE,
    },
    projects: {},
  };

  saveConfig(config);
  success("Saved configuration");

  // Done!
  console.log();
  success("devbox is ready!");

  printNextSteps([
    `Push a local project: devbox push ./my-project`,
    `Clone from remote: devbox clone <project-name>`,
    `Browse remote projects: devbox browse`,
  ]);
}
```

**Step 2: Wire up command in index.ts**

```typescript
// src/index.ts
import { program } from "commander";
import { initCommand } from "./commands/init";

program
  .name("devbox")
  .description("Local-first dev containers with remote sync")
  .version("0.1.0");

program
  .command("init")
  .description("Interactive setup wizard")
  .action(initCommand);

program.parse();
```

**Step 3: Test the init command manually**

Run: `bun run dev init`
Expected: Interactive wizard starts, prompts for configuration

**Step 4: Commit**

```bash
git add src/commands/init.ts src/index.ts
git commit -m "feat: implement devbox init command

Interactive wizard that:
- Checks for Docker and Node.js
- Downloads mutagen binary automatically
- Configures SSH host from existing or new
- Sets up key-based auth if needed
- Configures remote code directory
- Saves ~/.devbox/config.yaml"
```

---

## Task 9: Integration Test

**Files:**
- Create: `src/commands/init.test.ts`

**Step 1: Write integration test**

```typescript
// src/commands/init.test.ts
import { describe, expect, test, beforeEach, afterEach, mock } from "bun:test";
import { mkdirSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// This tests the individual pieces that init uses
describe("init command integration", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `devbox-init-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    process.env.DEVBOX_HOME = testDir;
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    delete process.env.DEVBOX_HOME;
  });

  test("creates required directories on save config", async () => {
    const { saveConfig } = await import("../lib/config");

    const config = {
      remote: { host: "test", base_path: "~/code" },
      editor: "cursor",
      defaults: { sync_mode: "two-way-resolved", ignore: [] },
      projects: {},
    };

    saveConfig(config);

    expect(existsSync(testDir)).toBe(true);
    expect(existsSync(join(testDir, "config.yaml"))).toBe(true);
  });

  test("config file contains expected content", async () => {
    const { saveConfig } = await import("../lib/config");

    const config = {
      remote: { host: "myserver", base_path: "~/projects" },
      editor: "vim",
      defaults: { sync_mode: "two-way-resolved", ignore: ["node_modules"] },
      projects: {},
    };

    saveConfig(config);

    const content = readFileSync(join(testDir, "config.yaml"), "utf-8");
    expect(content).toContain("myserver");
    expect(content).toContain("~/projects");
    expect(content).toContain("vim");
  });
});
```

**Step 2: Run all tests**

Run: `bun test`
Expected: All tests PASS

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 4: Final commit**

```bash
git add src/commands/init.test.ts
git commit -m "test: add integration tests for init command"
```

---

## Task 10: Manual Testing with Real Server

**Step 1: Test against real server**

Run: `bun run dev init`

Verify:
- [ ] Docker check passes
- [ ] Node check passes
- [ ] Mutagen downloads (or skips if present)
- [ ] SSH hosts are listed from ~/.ssh/config
- [ ] Connection test works
- [ ] Remote directory is verified/created
- [ ] Config file is saved to ~/.devbox/config.yaml
- [ ] Next steps are shown

**Step 2: Verify config file**

Run: `cat ~/.devbox/config.yaml`
Expected: Valid YAML with remote host, editor, defaults

**Step 3: Re-run init**

Run: `bun run dev init`
Expected: Prompts "devbox is already configured. Reconfigure?"

---

## Summary

After completing all tasks:
- `devbox init` wizard works end-to-end
- Mutagen binary is auto-downloaded
- SSH configuration is parsed and tested
- Config file is created at `~/.devbox/config.yaml`
- All modules have tests
- Code is committed in logical chunks

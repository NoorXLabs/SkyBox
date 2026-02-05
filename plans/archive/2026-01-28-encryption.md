# Encryption (Optional, Per-Layer) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add configurable encryption for synced project files on remote and/or local config/credentials. Users can independently enable encryption per layer using a user-provided key. Toggleable per project or globally.

**Architecture:** Two encryption layers: (1) **Sync encryption** — encrypt files before pushing to remote using `age` (modern, simple CLI tool). Mutagen syncs encrypted files; a pre-sync hook encrypts, post-sync hook decrypts. (2) **Config encryption** — encrypt `config.yaml` sensitive fields (SSH keys, passwords) using `age` with a master key stored in OS keychain or env var. Config is stored in YAML with encrypted values as `ENC[...]` markers.

**Tech Stack:** `age` encryption CLI (simple, modern alternative to GPG), existing config.ts, new `src/lib/encryption.ts` module.

**Note:** This is a complex feature. This plan covers the foundation (config encryption). Sync encryption is a follow-up.

---

### Task 1: Create encryption library module

**Files:**
- Create: `src/lib/encryption.ts`
- Create: `src/lib/__tests__/encryption.test.ts`

**Step 1: Write failing tests**

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("encryption", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = join(tmpdir(), `skybox-enc-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	test("deriveKey produces consistent output for same passphrase", async () => {
		const { deriveKey } = await import("./encryption.ts");
		const key1 = deriveKey("test-passphrase", "salt123");
		const key2 = deriveKey("test-passphrase", "salt123");
		expect(key1).toBe(key2);
	});

	test("deriveKey produces different output for different passphrases", async () => {
		const { deriveKey } = await import("./encryption.ts");
		const key1 = deriveKey("passphrase-a", "salt123");
		const key2 = deriveKey("passphrase-b", "salt123");
		expect(key1).not.toBe(key2);
	});

	test("encrypt and decrypt round-trip", async () => {
		const { encrypt, decrypt, deriveKey } = await import("./encryption.ts");
		const key = deriveKey("test-passphrase", "salt123");
		const plaintext = "sensitive SSH key content";
		const ciphertext = encrypt(plaintext, key);
		expect(ciphertext).not.toBe(plaintext);
		expect(ciphertext.startsWith("ENC[")).toBe(true);
		expect(ciphertext.endsWith("]")).toBe(true);

		const decrypted = decrypt(ciphertext, key);
		expect(decrypted).toBe(plaintext);
	});

	test("isEncrypted detects encrypted values", async () => {
		const { isEncrypted } = await import("./encryption.ts");
		expect(isEncrypted("ENC[abc123]")).toBe(true);
		expect(isEncrypted("plain text")).toBe(false);
	});
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test src/lib/__tests__/encryption.test.ts`
Expected: FAIL — module not found

**Step 3: Implement encryption module**

```typescript
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const ITERATIONS = 100000;
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

export function deriveKey(passphrase: string, salt: string): Buffer {
	return pbkdf2Sync(passphrase, salt, ITERATIONS, KEY_LENGTH, "sha512");
}

export function encrypt(plaintext: string, key: Buffer): string {
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv);
	const encrypted = Buffer.concat([
		cipher.update(plaintext, "utf-8"),
		cipher.final(),
	]);
	const tag = cipher.getAuthTag();
	const payload = Buffer.concat([iv, tag, encrypted]).toString("base64");
	return `ENC[${payload}]`;
}

export function decrypt(ciphertext: string, key: Buffer): string {
	const payload = ciphertext.slice(4, -1); // strip ENC[...]
	const data = Buffer.from(payload, "base64");
	const iv = data.subarray(0, IV_LENGTH);
	const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
	const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
	const decipher = createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(tag);
	return decipher.update(encrypted) + decipher.final("utf-8");
}

export function isEncrypted(value: string): boolean {
	return value.startsWith("ENC[") && value.endsWith("]");
}
```

**Step 4: Run tests**

Run: `bun test src/lib/__tests__/encryption.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/encryption.ts src/lib/__tests__/encryption.test.ts
git commit -m "feat: add encryption library with AES-256-GCM"
```

---

### Task 2: Add encryption config options

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add encryption config types**

```typescript
export interface EncryptionConfig {
	enabled: boolean;
	salt?: string;
}

// Add to SkyboxConfigV2:
export interface SkyboxConfigV2 {
	editor: string;
	defaults: SyncDefaults;
	remotes: Record<string, RemoteEntry>;
	projects: Record<string, ProjectConfigV2>;
	templates?: Record<string, string>;
	encryption?: EncryptionConfig;
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add encryption config interface"
```

---

### Task 3: Add config encryption toggle command

**Files:**
- Modify: `src/commands/config.ts`

**Step 1: Add encryption subcommand handling**

In `configCommand()`, add a case for `encryption`:

```typescript
case "encryption": {
	if (arg1 === "enable") {
		await enableEncryption();
	} else if (arg1 === "disable") {
		await disableEncryption();
	} else {
		info("Usage: skybox config encryption <enable|disable>");
	}
	break;
}
```

**Step 2: Implement enable/disable functions**

```typescript
import { password } from "@inquirer/prompts";
import { randomBytes } from "node:crypto";

async function enableEncryption(): Promise<void> {
	const config = loadConfig();
	if (config.encryption?.enabled) {
		info("Encryption is already enabled.");
		return;
	}

	const passphrase = await password({
		message: "Enter encryption passphrase:",
	});

	const salt = randomBytes(16).toString("hex");
	config.encryption = { enabled: true, salt };
	saveConfig(config);
	success("Encryption enabled. Remember your passphrase — it cannot be recovered.");
}

async function disableEncryption(): Promise<void> {
	const config = loadConfig();
	if (!config.encryption?.enabled) {
		info("Encryption is not enabled.");
		return;
	}
	config.encryption = { enabled: false };
	saveConfig(config);
	success("Encryption disabled.");
}
```

**Step 3: Run all tests**

Run: `bun test`
Expected: PASS

**Step 4: Commit**

```bash
git add src/commands/config.ts
git commit -m "feat(config): add encryption enable/disable subcommand"
```

---

### Task 4: Run full check suite

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Create encryption library with AES-256-GCM and tests |
| 2 | Add encryption config types |
| 3 | Add config encryption toggle command |
| 4 | Full check suite |

## Future Follow-Up Plans

- **Sync encryption**: Encrypt files before Mutagen sync (requires Mutagen hooks or wrapper)
- **Per-project encryption toggle**: `skybox config encryption enable --project <name>`
- **Keychain integration**: Store passphrase in macOS Keychain / Linux secret-service

// src/commands/status.test.ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execa } from "execa";

describe("status command helpers", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `devbox-status-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe("getGitInfo", () => {
    test("returns null for non-git directory", async () => {
      const { getGitInfo } = await import("./status");
      const result = await getGitInfo(testDir);
      expect(result).toBeNull();
    });

    test("returns branch and clean status for git repo", async () => {
      // Initialize git repo
      await execa("git", ["init"], { cwd: testDir });
      await execa("git", ["config", "user.email", "test@test.com"], { cwd: testDir });
      await execa("git", ["config", "user.name", "Test"], { cwd: testDir });
      writeFileSync(join(testDir, "README.md"), "# Test");
      await execa("git", ["add", "."], { cwd: testDir });
      await execa("git", ["commit", "-m", "init"], { cwd: testDir });

      const { getGitInfo } = await import("./status");
      const result = await getGitInfo(testDir);

      expect(result).not.toBeNull();
      expect(result!.branch).toBeTruthy();
      expect(result!.status).toBe("clean");
      expect(result!.ahead).toBe(0);
      expect(result!.behind).toBe(0);
    });

    test("returns dirty status for uncommitted changes", async () => {
      // Initialize git repo
      await execa("git", ["init"], { cwd: testDir });
      await execa("git", ["config", "user.email", "test@test.com"], { cwd: testDir });
      await execa("git", ["config", "user.name", "Test"], { cwd: testDir });
      writeFileSync(join(testDir, "README.md"), "# Test");
      await execa("git", ["add", "."], { cwd: testDir });
      await execa("git", ["commit", "-m", "init"], { cwd: testDir });

      // Make uncommitted change
      writeFileSync(join(testDir, "new.txt"), "new file");

      const { getGitInfo } = await import("./status");
      const result = await getGitInfo(testDir);

      expect(result).not.toBeNull();
      expect(result!.status).toBe("dirty");
    });
  });
});

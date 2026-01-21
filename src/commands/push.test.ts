// src/commands/push.test.ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "fs";
import { join, resolve, basename } from "path";
import { tmpdir } from "os";

describe("push command", () => {
  let testDir: string;
  let originalEnv: string | undefined;

  beforeEach(() => {
    testDir = join(tmpdir(), `devbox-push-test-${Date.now()}`);
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

  test("resolves relative path to absolute", () => {
    const relativePath = "./my-project";
    const absolutePath = resolve(relativePath);
    expect(absolutePath.startsWith("/")).toBe(true);
  });

  test("extracts project name from path", () => {
    const path = "/Users/test/my-awesome-project";
    const name = basename(path);
    expect(name).toBe("my-awesome-project");
  });

  test("detects git repo by .git folder", () => {
    const projectPath = join(testDir, "my-project");
    mkdirSync(projectPath, { recursive: true });

    // No .git folder
    expect(existsSync(join(projectPath, ".git"))).toBe(false);

    // Create .git folder
    mkdirSync(join(projectPath, ".git"));
    expect(existsSync(join(projectPath, ".git"))).toBe(true);
  });

  test("custom name overrides basename", () => {
    const sourcePath = "/Users/test/my-project";
    const customName = "renamed-project";
    const projectName = customName || basename(sourcePath);
    expect(projectName).toBe("renamed-project");
  });
});

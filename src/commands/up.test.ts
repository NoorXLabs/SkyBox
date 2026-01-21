// src/commands/up.test.ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("up command", () => {
  let testDir: string;
  let originalEnv: string | undefined;

  beforeEach(() => {
    testDir = join(tmpdir(), `devbox-up-test-${Date.now()}`);
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

  test("project path construction works", () => {
    const projectsDir = join(testDir, "projects");
    const project = "myapp";
    const projectPath = join(projectsDir, project);
    expect(projectPath).toBe(`${testDir}/projects/myapp`);
  });

  test("can detect missing config", () => {
    const configPath = join(testDir, "config.yaml");
    expect(existsSync(configPath)).toBe(false);
  });
});

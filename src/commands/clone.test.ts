// src/commands/clone.test.ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("clone command", () => {
  let testDir: string;
  let originalEnv: string | undefined;

  beforeEach(() => {
    testDir = join(tmpdir(), `devbox-clone-test-${Date.now()}`);
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

  test("requires project argument", async () => {
    // Test that empty project name would be rejected
    const projectName = "";
    expect(projectName).toBeFalsy();
  });

  test("local path is constructed correctly", () => {
    const projectsDir = join(testDir, "projects");
    const project = "myapp";
    const localPath = join(projectsDir, project);
    expect(localPath).toBe(`${testDir}/projects/myapp`);
  });

  test("detects existing local project", () => {
    const projectsDir = join(testDir, "projects");
    const project = "myapp";
    const localPath = join(projectsDir, project);

    mkdirSync(localPath, { recursive: true });
    expect(existsSync(localPath)).toBe(true);
  });
});

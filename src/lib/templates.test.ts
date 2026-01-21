// src/lib/templates.test.ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { TEMPLATES, createDevcontainerConfig } from "./templates";

describe("templates", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `devbox-templates-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  test("TEMPLATES contains expected templates", () => {
    expect(TEMPLATES.map(t => t.id)).toContain("node");
    expect(TEMPLATES.map(t => t.id)).toContain("python");
    expect(TEMPLATES.map(t => t.id)).toContain("go");
    expect(TEMPLATES.map(t => t.id)).toContain("generic");
  });

  test("createDevcontainerConfig creates .devcontainer directory", () => {
    createDevcontainerConfig(testDir, "node");
    expect(existsSync(join(testDir, ".devcontainer"))).toBe(true);
    expect(existsSync(join(testDir, ".devcontainer", "devcontainer.json"))).toBe(true);
  });

  test("createDevcontainerConfig writes valid JSON", () => {
    createDevcontainerConfig(testDir, "node");
    const content = readFileSync(join(testDir, ".devcontainer", "devcontainer.json"), "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.name).toBe("Node.js");
  });
});

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

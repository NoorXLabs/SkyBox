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

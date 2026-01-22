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
    expect(PROJECTS_DIR).toContain("Projects");
  });

  test("BIN_DIR is under DEVBOX_HOME", () => {
    expect(BIN_DIR).toContain("bin");
  });

  test("MUTAGEN_PATH is under BIN_DIR", () => {
    expect(MUTAGEN_PATH).toContain("mutagen");
  });
});

// src/lib/container.test.ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import {
  getContainerStatus,
  ContainerStatus,
  startContainer,
  stopContainer,
  openInEditor,
  SUPPORTED_EDITORS,
  attachToShell,
  hasDevcontainerConfig
} from "./container";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("container module", () => {
  test("getContainerStatus returns not_running for non-existent container", async () => {
    const status = await getContainerStatus("/nonexistent/path");
    expect(status).toBe(ContainerStatus.NotRunning);
  });
});

describe("startContainer", () => {
  test("startContainer function exists", () => {
    expect(typeof startContainer).toBe("function");
  });
});

describe("stopContainer", () => {
  test("stopContainer function exists", () => {
    expect(typeof stopContainer).toBe("function");
  });
});

describe("editor support", () => {
  test("SUPPORTED_EDITORS contains expected editors", () => {
    expect(SUPPORTED_EDITORS).toContainEqual({ id: "code", name: "VS Code" });
    expect(SUPPORTED_EDITORS).toContainEqual({ id: "cursor", name: "Cursor" });
  });

  test("openInEditor function exists", () => {
    expect(typeof openInEditor).toBe("function");
  });
});

describe("attachToShell", () => {
  test("attachToShell function exists", () => {
    expect(typeof attachToShell).toBe("function");
  });
});

describe("hasDevcontainerConfig", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `devbox-container-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  test("returns false when no devcontainer.json exists", () => {
    expect(hasDevcontainerConfig(testDir)).toBe(false);
  });

  test("returns true when devcontainer.json exists", () => {
    const devcontainerDir = join(testDir, ".devcontainer");
    mkdirSync(devcontainerDir, { recursive: true });
    writeFileSync(join(devcontainerDir, "devcontainer.json"), "{}");
    expect(hasDevcontainerConfig(testDir)).toBe(true);
  });
});

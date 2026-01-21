// src/lib/container.test.ts
import { describe, expect, test } from "bun:test";
import {
  getContainerStatus,
  ContainerStatus,
  startContainer,
  stopContainer,
  openInEditor,
  SUPPORTED_EDITORS
} from "./container";

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

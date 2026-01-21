// src/lib/container.test.ts
import { describe, expect, test } from "bun:test";
import { getContainerStatus, ContainerStatus } from "./container";

describe("container module", () => {
  test("getContainerStatus returns not_running for non-existent container", async () => {
    const status = await getContainerStatus("/nonexistent/path");
    expect(status).toBe(ContainerStatus.NotRunning);
  });
});

// src/__integration__/docker/container-lifecycle.test.ts
/**
 * @file container-lifecycle.test.ts
 * @description Integration test for container lifecycle operations.
 * Tests devcontainer CLI operations (the underlying mechanism used by devbox up/down).
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	createTestConfig,
	createTestRemote,
	writeTestConfig,
} from "@lib/__tests__/test-utils.ts";
import { execa } from "execa";
import {
	createDockerTestContext,
	createMinimalDevcontainer,
	type DockerTestContext,
	getContainerStatus,
	isDevcontainerCliAvailable,
	isDockerAvailable,
	waitForContainer,
} from "../helpers/docker-test-utils.ts";

const dockerAvailable = await isDockerAvailable();
const devcontainerAvailable = await isDevcontainerCliAvailable();

describe.skipIf(!dockerAvailable || !devcontainerAvailable)(
	"container lifecycle",
	() => {
		let ctx: DockerTestContext;

		beforeEach(async () => {
			ctx = createDockerTestContext("lifecycle");
			// Set up a test config with a mock remote
			const config = createTestConfig({
				remotes: { test: createTestRemote("test") },
				projects: { [ctx.projectName]: { remote: "test" } },
			});
			writeTestConfig(ctx.testDir, config);
			createMinimalDevcontainer(ctx.projectDir);
		});

		afterEach(async () => {
			await ctx.cleanup();
		});

		test("devcontainer up starts container and it can be stopped", async () => {
			// Start container using devcontainer CLI (same underlying operation as devbox up)
			await execa("devcontainer", ["up", "--workspace-folder", ctx.projectDir]);

			// Wait for container to be running (find by project path label)
			await waitForContainer(ctx.normalizedProjectDir);

			const runningStatus = await getContainerStatus(ctx.normalizedProjectDir);
			expect(runningStatus).toBe("running");

			// Stop the container (find container ID first)
			const { getContainerIdByProjectPath } = await import(
				"../helpers/docker-test-utils.ts"
			);
			const containerId = await getContainerIdByProjectPath(
				ctx.normalizedProjectDir,
			);
			if (containerId) {
				await execa("docker", ["stop", containerId]);
			}

			const stoppedStatus = await getContainerStatus(ctx.normalizedProjectDir);
			expect(stoppedStatus).toBe("exited");
		}, 60000); // 60 second timeout for container operations
	},
);

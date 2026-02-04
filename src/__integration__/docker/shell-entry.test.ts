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
	isDevcontainerCliAvailable,
	isDockerAvailable,
	waitForContainer,
} from "../helpers/docker-test-utils.ts";

const dockerAvailable = await isDockerAvailable();
const devcontainerAvailable = await isDevcontainerCliAvailable();

describe.skipIf(!dockerAvailable || !devcontainerAvailable)(
	"shell entry",
	() => {
		let ctx: DockerTestContext;

		beforeEach(async () => {
			ctx = createDockerTestContext("shell");
			const config = createTestConfig({
				remotes: { test: createTestRemote("test") },
				projects: { [ctx.projectName]: { remote: "test" } },
			});
			writeTestConfig(ctx.testDir, config);
			createMinimalDevcontainer(ctx.projectDir);

			// Start the container
			await execa("devcontainer", ["up", "--workspace-folder", ctx.projectDir]);
			await waitForContainer(ctx.normalizedProjectDir);
		});

		afterEach(async () => {
			await ctx.cleanup();
		});

		test("can execute command in running container", async () => {
			// Execute a simple command in the container
			const result = await execa("devcontainer", [
				"exec",
				"--workspace-folder",
				ctx.projectDir,
				"echo",
				"hello-from-container",
			]);

			expect(result.stdout).toContain("hello-from-container");
		}, 60000);
	},
);

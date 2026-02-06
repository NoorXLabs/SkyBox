import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
import { TEMPLATES } from "@lib/constants.ts";
import {
	cleanupTestContainers,
	createDockerProjectTestContext,
	type DockerTestContext,
	getContainerIdByProjectPath,
	isDevcontainerCliAvailable,
	isDockerAvailable,
	waitForContainer,
} from "@tests/integration/helpers/docker-test-utils.ts";
import { execa } from "execa";

const dockerAvailable = await isDockerAvailable();
const devcontainerAvailable = await isDevcontainerCliAvailable();

describe.skipIf(!dockerAvailable || !devcontainerAvailable)(
	"devcontainer templates",
	() => {
		// Global cleanup after all template tests
		afterAll(async () => {
			await cleanupTestContainers();
		});

		// Test each template boots successfully
		for (const template of TEMPLATES) {
			describe(template.name, () => {
				let ctx: DockerTestContext;

				beforeEach(() => {
					ctx = createDockerProjectTestContext(
						`template-${template.id}`,
						template.id,
					);
				});

				afterEach(async () => {
					await ctx.cleanup();
				});

				test(`${template.id} template boots successfully`, async () => {
					await execa("devcontainer", [
						"up",
						"--workspace-folder",
						ctx.projectDir,
					]);
					await waitForContainer(ctx.normalizedProjectDir);

					// Verify container is running by finding it via label
					const containerId = await getContainerIdByProjectPath(
						ctx.normalizedProjectDir,
					);
					expect(containerId).not.toBeNull();

					const result = await execa("docker", [
						"inspect",
						"-f",
						"{{.State.Running}}",
						containerId as string,
					]);
					expect(result.stdout.trim()).toBe("true");
				}, 120000); // 2 minute timeout for template tests (image pulls)
			});
		}
	},
);

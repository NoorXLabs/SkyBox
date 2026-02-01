import { realpathSync } from "node:fs";
import { getContainerId } from "@lib/container.ts";
import { getErrorMessage } from "@lib/errors.ts";
import { sessionName } from "@lib/mutagen.ts";
import { getMutagenPath } from "@lib/paths.ts";
import { getProjectPath, projectExists } from "@lib/project.ts";
import { error, info } from "@lib/ui.ts";
import { execa } from "execa";

interface LogsOptions {
	follow?: boolean;
	lines?: string;
	sync?: boolean;
}

export async function logsCommand(
	project: string,
	options: LogsOptions,
): Promise<void> {
	if (!projectExists(project)) {
		error(`Project "${project}" not found locally.`);
		return;
	}

	if (options.sync) {
		await showSyncLogs(project, options);
	} else {
		await showContainerLogs(project, options);
	}
}

function normalizePath(path: string): string {
	try {
		return realpathSync(path);
	} catch {
		return path;
	}
}

async function showContainerLogs(
	project: string,
	options: LogsOptions,
): Promise<void> {
	const projectPath = normalizePath(getProjectPath(project));
	const containerId = await getContainerId(projectPath);

	if (!containerId) {
		error(`No container found for "${project}". Is it running?`);
		return;
	}

	const args = ["logs"];
	if (options.follow) args.push("--follow");
	if (options.lines) args.push("--tail", options.lines);
	args.push(containerId);

	try {
		await execa("docker", args, { stdio: "inherit" });
	} catch (err) {
		error(`Failed to get container logs: ${getErrorMessage(err)}`);
	}
}

async function showSyncLogs(
	project: string,
	_options: LogsOptions,
): Promise<void> {
	const mutagenPath = getMutagenPath();
	const name = sessionName(project);

	const args = ["sync", "monitor", `--label-selector=name=${name}`];

	try {
		info(`Showing sync logs for "${project}"...`);
		await execa(mutagenPath, args, { stdio: "inherit" });
	} catch (err) {
		error(`Failed to get sync logs: ${getErrorMessage(err)}`);
	}
}

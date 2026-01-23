// src/commands/browse.ts
import { configExists, loadConfig } from "../lib/config.ts";
import { getErrorMessage } from "../lib/errors.ts";
import { runRemoteCommand } from "../lib/ssh.ts";
import { error, header, info, spinner } from "../lib/ui.ts";

interface RemoteProject {
	name: string;
	branch: string;
}

async function getRemoteProjects(
	host: string,
	basePath: string,
): Promise<RemoteProject[]> {
	const script = `for d in ${basePath}/*/; do
    [ -d "$d" ] || continue
    name=$(basename "$d")
    branch=$(git -C "$d" branch --show-current 2>/dev/null || echo "-")
    echo "$name|$branch"
  done`;

	const result = await runRemoteCommand(host, script);

	if (!result.success || !result.stdout?.trim()) {
		return [];
	}

	return result.stdout
		.trim()
		.split("\n")
		.filter((line) => line.includes("|"))
		.map((line) => {
			const [name, branch] = line.split("|");
			return { name, branch };
		});
}

function printProjects(
	projects: RemoteProject[],
	host: string,
	basePath: string,
): void {
	header(`Remote projects (${host}:${basePath}):`);
	console.log();

	for (const project of projects) {
		console.log(`  ${project.name}`);
		console.log(`    Branch: ${project.branch}`);
		console.log();
	}

	info("Run 'devbox clone <project>' to clone a project locally.");
}

function printEmpty(): void {
	console.log();
	console.log("No projects found on remote.");
	info("Run 'devbox push ./my-project' to push your first project.");
}

export async function browseCommand(): Promise<void> {
	if (!configExists()) {
		error("devbox not configured. Run 'devbox init' first.");
		process.exit(1);
	}

	const config = loadConfig();
	if (!config) {
		error("Failed to load config.");
		process.exit(1);
	}

	const spin = spinner("Fetching remote projects...");

	try {
		const projects = await getRemoteProjects(
			config.remote.host,
			config.remote.base_path,
		);
		spin.stop();

		if (projects.length === 0) {
			printEmpty();
		} else {
			printProjects(projects, config.remote.host, config.remote.base_path);
		}
	} catch (err: unknown) {
		spin.fail("Failed to connect to remote");
		error(getErrorMessage(err) || "Check your SSH config.");
		process.exit(1);
	}
}

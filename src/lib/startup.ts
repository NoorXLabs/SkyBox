/** Dependency checks run at CLI startup. */
import chalk from "chalk";
import { execaSync } from "execa";

interface DockerStatus {
	installed: boolean;
	running: boolean;
}

function checkDocker(): DockerStatus {
	const status: DockerStatus = { installed: false, running: false };

	// Check if Docker is installed
	try {
		execaSync("docker", ["--version"], { stdio: "pipe" });
		status.installed = true;
	} catch {
		return status;
	}

	// Check if Docker daemon is running
	try {
		execaSync("docker", ["info"], { stdio: "pipe" });
		status.running = true;
	} catch {
		return status;
	}

	return status;
}

function printDockerBanner(status: DockerStatus): void {
	const yellow = chalk.yellow;
	const dim = chalk.dim;
	const bold = chalk.bold;

	console.log();
	console.log(
		yellow("╭─────────────────────────────────────────────────────────╮"),
	);

	if (!status.installed) {
		console.log(
			yellow("│"),
			bold("  Docker is not installed."),
			"                              ",
			yellow("│"),
		);
		console.log(
			yellow("│"),
			"                                                        ",
			yellow("│"),
		);
		console.log(
			yellow("│"),
			"  Install Docker Desktop:                              ",
			yellow("│"),
		);
		console.log(
			yellow("│"),
			dim("    brew install --cask docker"),
			"                        ",
			yellow("│"),
		);
		console.log(
			yellow("│"),
			"                                                        ",
			yellow("│"),
		);
		console.log(
			yellow("│"),
			"  Then start Docker Desktop before using SkyBox.       ",
			yellow("│"),
		);
	} else if (!status.running) {
		console.log(
			yellow("│"),
			bold("  Docker is not running."),
			"                                 ",
			yellow("│"),
		);
		console.log(
			yellow("│"),
			"                                                        ",
			yellow("│"),
		);
		console.log(
			yellow("│"),
			"  Start Docker Desktop before using SkyBox.            ",
			yellow("│"),
		);
	}

	console.log(
		yellow("╰─────────────────────────────────────────────────────────╯"),
	);
	console.log();
}

/**
 * Run startup checks and show banner if Docker is unavailable.
 * Returns true if Docker is ready, false otherwise.
 */
export function runStartupChecks(): boolean {
	const dockerStatus = checkDocker();

	if (!dockerStatus.installed || !dockerStatus.running) {
		printDockerBanner(dockerStatus);
		return false;
	}

	return true;
}

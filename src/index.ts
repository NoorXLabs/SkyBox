// src/index.ts

import { browseCommand } from "@commands/browse.ts";
import { cloneCommand } from "@commands/clone.ts";
import { configCommand } from "@commands/config.ts";
import { dashboardCommand } from "@commands/dashboard.tsx";
import { doctorCommand } from "@commands/doctor.ts";
import { downCommand } from "@commands/down.ts";
import { editorCommand } from "@commands/editor.ts";
import { encryptCommand } from "@commands/encrypt.ts";
import { hookCheckCommand, hookCommand } from "@commands/hook.ts";
import { initCommand } from "@commands/init.ts";
import { listCommand } from "@commands/list.ts";
import { logsCommand } from "@commands/logs.ts";
import { newCommand } from "@commands/new.ts";
import { openCommand } from "@commands/open.ts";
import { pushCommand } from "@commands/push.ts";
import { remoteCommand } from "@commands/remote.ts";
import { rmCommand } from "@commands/rm.ts";
import { shellCommand } from "@commands/shell.ts";
import { statusCommand } from "@commands/status.ts";
import { upCommand } from "@commands/up.ts";
import { updateCommand } from "@commands/update.ts";
import { INSTALL_METHOD } from "@lib/constants.ts";
import { getErrorMessage } from "@lib/errors.ts";
import { installShutdownHandlers } from "@lib/shutdown.ts";
import { runStartupChecks } from "@lib/startup.ts";
import { checkForUpdate, getUpgradeCommand } from "@lib/update-check.ts";
import chalk from "chalk";
import { program } from "commander";
import pkg from "../package.json";

// Install graceful shutdown handlers early
installShutdownHandlers();

// Run Docker check on bare `skybox` (no args) or `skybox init`
// Skip for --help, --version, -v, -h which should always work
const args = process.argv.slice(2);
const command = args[0];
const isHelpOrVersion =
	args.includes("--help") ||
	args.includes("-h") ||
	args.includes("--version") ||
	args.includes("-v");
const showDockerBanner =
	!isHelpOrVersion &&
	(args.length === 0 || // bare `skybox`
		command === "init"); // `skybox init`

if (showDockerBanner) {
	runStartupChecks();
}

program
	.name("skybox")
	.description("Local-first dev containers with remote sync")
	.version(pkg.version, "-v, --version")
	.option("--dry-run", "Preview commands without executing them");

program
	.command("init")
	.description("Interactive setup wizard")
	.action(initCommand);

program
	.command("browse")
	.description("List projects on remote server")
	.action(browseCommand);

program.command("list").description("List local projects").action(listCommand);

program
	.command("clone [project]")
	.description("Clone remote project locally")
	.action(cloneCommand);

program
	.command("push <path> [name]")
	.description("Push local project to remote")
	.action(pushCommand);

program
	.command("up [project]")
	.description("Start a development container")
	.option("-e, --editor", "Open in editor after start")
	.option("-a, --attach", "Attach to shell after start")
	.option("-r, --rebuild", "Force container rebuild")
	.option("--no-prompt", "Non-interactive mode")
	.option("--verbose", "Show detailed output")
	.option("-A, --all", "Start all local projects")
	.action(upCommand);

program
	.command("down [project]")
	.description("Stop a development container")
	.option("-c, --cleanup", "Remove container and volumes")
	.option("-f, --force", "Force stop even on errors")
	.option("--no-prompt", "Non-interactive mode")
	.option("-A, --all", "Stop all local projects")
	.action(downCommand);

program
	.command("editor")
	.description("Change default editor")
	.action(editorCommand);

program
	.command("status [project]")
	.description("Show project status")
	.action(statusCommand);

program
	.command("dashboard")
	.alias("dash")
	.description("Full-screen status dashboard")
	.option("-d, --detailed", "Show detailed view with extra info")
	.action(dashboardCommand);

program
	.command("open [project]")
	.description("Open editor/shell for running container")
	.option("-e, --editor", "Open in editor only")
	.option("-s, --shell", "Attach to shell only")
	.option("--no-prompt", "Non-interactive mode")
	.action(openCommand);

program
	.command("new")
	.description("Create a new project on the remote server")
	.action(newCommand);

program
	.command("rm [project]")
	.description("Remove project locally (keeps remote)")
	.option("-f, --force", "Skip confirmation prompt")
	.option("-r, --remote", "Also delete project from remote server")
	.action(rmCommand);

program
	.command("shell <project>")
	.description("Enter container shell")
	.option("-c, --command <cmd>", "Run a single command and exit")
	.option("-f, --force", "Bypass session check")
	.action(shellCommand);

program
	.command("remote [subcommand] [arg1] [arg2]")
	.description("Manage remote servers")
	.option("-k, --key <path>", "SSH key path")
	.action((subcommand, arg1, arg2, options) =>
		remoteCommand(subcommand, arg1, arg2, options),
	);

program
	.command("config [subcommand] [arg1] [arg2]")
	.description("View or modify configuration")
	.option("--validate", "Test connection to all remotes")
	.action((subcommand, arg1, arg2, options) =>
		configCommand(options, subcommand, arg1, arg2),
	);

program
	.command("logs <project>")
	.description("Show container or sync logs")
	.option("-f, --follow", "follow log output")
	.option("-n, --lines <number>", "number of lines to show", "50")
	.option("-s, --sync", "show sync logs instead of container logs")
	.action(logsCommand);

program
	.command("doctor")
	.description("Diagnose common issues")
	.action(doctorCommand);

program
	.command("update")
	.description("Update Mutagen binary to latest bundled version")
	.action(updateCommand);

program
	.command("encrypt [subcommand] [project]")
	.description("Manage project encryption")
	.action(encryptCommand);

program
	.command("hook [shell]")
	.description("Output shell hook code for auto-up on directory enter")
	.action(hookCommand);

// Hidden command called by shell hooks
program.command("hook-check", { hidden: true }).action(hookCheckCommand);

// Parse and run the command, then check for updates
(async () => {
	try {
		await program.parseAsync();
	} catch (err) {
		// Commander already prints help for unknown commands.
		// Catch unhandled errors from command actions and emit consistent exit.
		const message = getErrorMessage(err);
		console.error(chalk.red(`Error: ${message}`));
		process.exit(1);
	}

	try {
		const currentVersion: string = pkg.version;
		const isBeta = currentVersion.includes("-");
		const newerVersion = await checkForUpdate(currentVersion, isBeta);
		if (newerVersion) {
			const cmd = getUpgradeCommand(INSTALL_METHOD);
			console.log();
			console.log(
				chalk.yellow(`Update available: ${currentVersion} → ${newerVersion}.`),
			);
			console.log(chalk.dim(`Run: ${cmd}`));
		}
	} catch {
		// Update check is non-critical — never crash the CLI
	}
})();

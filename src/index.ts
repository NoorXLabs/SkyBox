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

import { DOCS_URL, INSTALL_METHOD } from "@lib/constants.ts";
import { getErrorMessage } from "@lib/errors.ts";
import { installShutdownHandlers } from "@lib/shutdown.ts";
import { runStartupChecks } from "@lib/startup.ts";
import {
	checkForUpdate,
	getUpgradeCommand,
	isHomebrewInstalled,
} from "@lib/update-check.ts";
import chalk from "chalk";
import { type Command, program } from "commander";
import pkg from "../package.json";

const ROOT_HELP_FOOTER = `
Quick start:
  skybox init                     Set up SkyBox and your first remote
  skybox browse                   See projects available on remote
  skybox clone <project>          Clone a project locally
  skybox up <project>             Start the dev container

Full docs: ${DOCS_URL}
`;

const addCommandHelp = (
	command: Command,
	summary: string,
	description: string,
	examples: string[],
	notes: string[] = [],
): Command => {
	command.summary(summary).description(description);

	let helpText = "\nExamples:\n";
	for (const example of examples) {
		helpText += `  ${example}\n`;
	}

	if (notes.length > 0) {
		helpText += "\nNotes:\n";
		for (const note of notes) {
			helpText += `  ${note}\n`;
		}
	}

	return command.addHelpText("after", `\n${helpText.trimEnd()}`);
};

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
	.option("--dry-run", "Preview commands without executing them")
	.addHelpText("after", `\n${ROOT_HELP_FOOTER.trim()}`);

addCommandHelp(
	program.command("init"),
	"Interactive setup wizard",
	"Run first-time setup for SkyBox config, remotes, and defaults. You can rerun this at any time to update settings.",
	["skybox init"],
	["If SkyBox is already configured, this updates your existing settings."],
).action(initCommand);

addCommandHelp(
	program.command("browse"),
	"List projects on remote server",
	"Connect to a configured remote over SSH and list available projects with their current git branch.",
	["skybox browse"],
	["Use this before 'skybox clone' to discover remote project names."],
).action(browseCommand);

addCommandHelp(
	program.command("list"),
	"List local projects",
	"Show projects in your local SkyBox workspace, including git branch and local path.",
	["skybox list"],
).action(listCommand);

addCommandHelp(
	program.command("clone [project]"),
	"Clone remote project locally",
	"Clone project data from remote to local, configure sync, and optionally start the container. Without a project argument, choose one or more projects interactively.",
	["skybox clone my-api", "skybox clone"],
	["Project names come from 'skybox browse'."],
).action(cloneCommand);

addCommandHelp(
	program.command("push <path> [name]"),
	"Push local project to remote",
	"Upload a local folder as a SkyBox project on a remote, set up sync, and register it locally.",
	["skybox push ./my-api", "skybox push ./my-api my-api"],
	["If the remote project already exists, SkyBox asks before overwriting it."],
).action(pushCommand);

addCommandHelp(
	program.command("up [project]"),
	"Start a development container",
	"Start development container(s), ensure sync is active, and then open your editor or shell if requested. Without a project, SkyBox resolves from cwd or prompts.",
	[
		"skybox up my-api",
		"skybox up --editor",
		"skybox up --attach",
		"skybox up --all",
		"skybox up my-api --no-prompt",
	],
	[
		"Use --rebuild after devcontainer changes.",
		"Use --no-prompt for scripts/automation.",
	],
)
	.option("-e, --editor", "Open in editor after start")
	.option("-a, --attach", "Attach to shell after start")
	.option("-r, --rebuild", "Force container rebuild")
	.option("--no-prompt", "Non-interactive mode")
	.option("--verbose", "Show detailed output")
	.option("-A, --all", "Start all local projects")
	.action(upCommand);

addCommandHelp(
	program.command("down [project]"),
	"Stop a development container",
	"Stop development container(s), flush and pause sync, and end active sessions. Use cleanup mode to also remove containers and volumes.",
	["skybox down my-api", "skybox down --all", "skybox down my-api --cleanup"],
	[
		"With project encryption enabled, remote data is encrypted during shutdown.",
	],
)
	.option("-c, --cleanup", "Remove container and volumes")
	.option("-f, --force", "Force stop even on errors")
	.option("--no-prompt", "Non-interactive mode")
	.option("-A, --all", "Stop all local projects")
	.action(downCommand);

addCommandHelp(
	program.command("editor"),
	"Change default editor",
	"Interactively set the default editor command used by SkyBox when opening projects.",
	["skybox editor"],
).action(editorCommand);

addCommandHelp(
	program.command("status [project]"),
	"Show project status",
	"Show project health including container, sync, git, session, and disk usage. Use a project name for detailed status; omit it for an overview of all local projects.",
	["skybox status", "skybox status my-api"],
).action(statusCommand);

addCommandHelp(
	program.command("dashboard"),
	"Full-screen status dashboard",
	"Open a live, full-screen terminal dashboard for local projects with periodic refresh.",
	["skybox dashboard", "skybox dashboard --detailed"],
	["Controls: arrows move selection, d toggles detail, r refreshes, q exits."],
)
	.alias("dash")
	.option("-d, --detailed", "Show detailed view with extra info")
	.action(dashboardCommand);

addCommandHelp(
	program.command("open [project]"),
	"Open editor/shell for running container",
	"Open editor and/or shell for a running container without restarting it. Without a project, SkyBox resolves from cwd or prompts.",
	[
		"skybox open my-api",
		"skybox open my-api --editor",
		"skybox open my-api --shell",
	],
	["Run 'skybox up' first if the container is not running."],
)
	.option("-e, --editor", "Open in editor only")
	.option("-s, --shell", "Attach to shell only")
	.option("--no-prompt", "Non-interactive mode")
	.action(openCommand);

addCommandHelp(
	program.command("new"),
	"Create a new project on the remote server",
	"Create a new remote project from a template or git URL, then optionally clone it locally.",
	["skybox new"],
).action(newCommand);

addCommandHelp(
	program.command("rm [project]"),
	"Remove project locally (keeps remote)",
	"Remove local project resources (files, container, and sync session). Use --remote to also delete project data from the remote server.",
	["skybox rm my-api", "skybox rm --remote my-api", "skybox rm"],
	["Without a project argument, SkyBox opens interactive project selection."],
)
	.option("-f, --force", "Skip confirmation prompt")
	.option("-r, --remote", "Also delete project from remote server")
	.action(rmCommand);

addCommandHelp(
	program.command("shell <project>"),
	"Enter container shell",
	"Open an interactive shell in a project container, or run a single command and exit.",
	[
		"skybox shell my-api",
		'skybox shell my-api --command "npm test"',
		"skybox shell my-api --force",
	],
	["Session ownership checks are enforced unless --force is set."],
)
	.option("-c, --command <cmd>", "Run a single command and exit")
	.option("-f, --force", "Bypass session check")
	.action(shellCommand);

addCommandHelp(
	program.command("remote [subcommand] [arg1] [arg2]"),
	"Manage remote servers",
	"Manage remote server definitions used for browsing, cloning, and syncing projects.",
	[
		"skybox remote",
		"skybox remote add",
		"skybox remote add prod root@203.0.113.10:~/code --key ~/.ssh/id_ed25519",
		"skybox remote list",
	],
	["Run 'skybox remote' with no subcommand to see all remote subcommands."],
)
	.option("-k, --key <path>", "SSH key path")
	.action((subcommand, arg1, arg2, options) =>
		remoteCommand(subcommand, arg1, arg2, options),
	);

addCommandHelp(
	program.command("config [subcommand] [arg1] [arg2]"),
	"View or modify configuration",
	"Inspect or change SkyBox config, including editor defaults, sync paths, and devcontainer helpers.",
	[
		"skybox config",
		"skybox config --validate",
		"skybox config set editor code",
		"skybox config sync-paths my-api src,package.json",
	],
	["Run 'skybox config' with no subcommand to see current settings."],
)
	.option("--validate", "Test connection to all remotes")
	.action((subcommand, arg1, arg2, options) =>
		configCommand(options, subcommand, arg1, arg2),
	);

addCommandHelp(
	program.command("logs <project>"),
	"Show container or sync logs",
	"Stream container logs or Mutagen sync logs for a local project.",
	[
		"skybox logs my-api",
		"skybox logs my-api --follow",
		"skybox logs my-api --sync",
	],
	["Use --lines to change the number of log lines shown."],
)
	.option("-f, --follow", "follow log output")
	.option("-n, --lines <number>", "number of lines to show", "50")
	.option("-s, --sync", "show sync logs instead of container logs")
	.action(logsCommand);

addCommandHelp(
	program.command("doctor"),
	"Diagnose common issues",
	"Run diagnostics for Docker, Mutagen, config health, remote SSH connectivity, and editor setup.",
	["skybox doctor"],
).action(doctorCommand);

addCommandHelp(
	program.command("update"),
	"Check for and install SkyBox updates",
	"Check for newer SkyBox versions and update in place when supported by your install method.",
	["skybox update"],
	[
		"For package-manager installs, this command prints the correct upgrade command.",
	],
).action(updateCommand);

addCommandHelp(
	program.command("encrypt [subcommand] [project]"),
	"Manage project encryption",
	"Enable or disable project encryption for remote backups. Your passphrase is never stored and cannot be recovered.",
	[
		"skybox encrypt enable my-api",
		"skybox encrypt disable my-api",
		"skybox encrypt enable",
	],
	["Run without a subcommand to see available encrypt actions."],
).action(encryptCommand);

addCommandHelp(
	program.command("hook [shell]"),
	"Output shell hook code for auto-up on directory enter",
	"Print shell integration code that auto-starts project containers when entering project directories.",
	["skybox hook zsh", "skybox hook bash"],
	['Add to shell config: eval "$(skybox hook zsh)"'],
).action(hookCommand);

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

	// Skip passive update check for commands that handle updates themselves
	if (command !== "update") {
		try {
			const currentVersion: string = pkg.version;
			const isBeta = currentVersion.includes("-");
			const newerVersion = await checkForUpdate(currentVersion, isBeta);
			if (newerVersion) {
				const cmd = (await isHomebrewInstalled())
					? getUpgradeCommand("homebrew")
					: getUpgradeCommand(INSTALL_METHOD);
				console.log();
				console.log(
					chalk.yellow(
						`Update available: ${currentVersion} → ${newerVersion}.`,
					),
				);
				console.log(chalk.dim(`Run: ${cmd}`));
			}
		} catch {
			// Update check is non-critical — never crash the CLI
		}
	}
})();

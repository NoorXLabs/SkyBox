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

import {
	COMMAND_MANIFEST,
	GLOBAL_OPTIONS,
	getCommandManifest,
	QUICK_START_COMMANDS,
} from "@lib/command-manifest.ts";
import { INSTALL_METHOD } from "@lib/constants.ts";
import { getErrorMessage } from "@lib/errors.ts";
import { installShutdownHandlers } from "@lib/shutdown.ts";
import { runStartupChecks } from "@lib/startup.ts";
import { shouldTrackInstall, trackInstall } from "@lib/telemetry.ts";
import { checkForUpdate, getUpgradeCommand } from "@lib/update-check.ts";
import chalk from "chalk";
import { type Command, program } from "commander";
import pkg from "../package.json";

const DOCS_URL = "https://skybox.noorxlabs.com";

const ROOT_HELP_FOOTER = [
	"Quick start:",
	...QUICK_START_COMMANDS.map(
		({ command, description }) => `  ${command.padEnd(30)} ${description}`,
	),
	"",
	`Full docs: ${DOCS_URL}`,
].join("\n");

const getGlobalOption = (flags: string) => {
	const option = GLOBAL_OPTIONS.find((entry) => entry.flags === flags);
	if (!option) {
		throw new Error(`Global option not found in manifest: ${flags}`);
	}
	return option;
};

const registerTopLevelCommand = (id: string): Command => {
	const manifest = getCommandManifest(id);
	const command = program.command(manifest.command);

	command.summary(manifest.summary).description(manifest.description);
	command.configureHelp({ showGlobalOptions: true });

	for (const alias of manifest.aliases) {
		command.alias(alias);
	}

	for (const option of manifest.options) {
		if (option.defaultValue !== undefined) {
			command.option(option.flags, option.description, option.defaultValue);
			continue;
		}
		command.option(option.flags, option.description);
	}

	let helpText = "\nExamples:\n";
	for (const example of manifest.examples) {
		helpText += `  ${example}\n`;
	}

	if (manifest.notes.length > 0) {
		helpText += "\nNotes:\n";
		for (const note of manifest.notes) {
			helpText += `  ${note}\n`;
		}
	}

	command.addHelpText("after", `\n${helpText.trimEnd()}`);
	return command;
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
	.option(
		getGlobalOption("--dry-run").flags,
		getGlobalOption("--dry-run").description,
	)
	.addHelpText("after", `\n${ROOT_HELP_FOOTER.trim()}`);

registerTopLevelCommand("init").action(initCommand);
registerTopLevelCommand("browse").action(browseCommand);
registerTopLevelCommand("list").action(listCommand);
registerTopLevelCommand("clone").action(cloneCommand);
registerTopLevelCommand("push").action(pushCommand);
registerTopLevelCommand("up").action(upCommand);
registerTopLevelCommand("down").action(downCommand);
registerTopLevelCommand("editor").action(editorCommand);
registerTopLevelCommand("status").action(statusCommand);
registerTopLevelCommand("dashboard").action(dashboardCommand);
registerTopLevelCommand("open").action(openCommand);
registerTopLevelCommand("new").action(newCommand);
registerTopLevelCommand("rm").action(rmCommand);
registerTopLevelCommand("shell").action(shellCommand);
registerTopLevelCommand("remote").action((subcommand, arg1, arg2, options) =>
	remoteCommand(subcommand, arg1, arg2, options),
);
registerTopLevelCommand("config").action((subcommand, arg1, arg2, options) =>
	configCommand(options, subcommand, arg1, arg2),
);
registerTopLevelCommand("logs").action(logsCommand);
registerTopLevelCommand("doctor").action(doctorCommand);
registerTopLevelCommand("update").action(updateCommand);
registerTopLevelCommand("encrypt").action(encryptCommand);
registerTopLevelCommand("hook").action(hookCommand);

// Hidden command called by shell hooks
program.command("hook-check", { hidden: true }).action(hookCheckCommand);

const manifestCommandIds = new Set(COMMAND_MANIFEST.map((entry) => entry.id));
if (manifestCommandIds.size !== COMMAND_MANIFEST.length) {
	throw new Error("Duplicate command ids detected in command manifest.");
}

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

	// First-run telemetry (fire-and-forget, non-blocking)
	if (shouldTrackInstall()) {
		trackInstall(pkg.version);
	}

	// Skip passive update check for commands that handle updates themselves
	if (command !== "update") {
		try {
			const currentVersion: string = pkg.version;
			const isBeta = currentVersion.includes("-");
			const newerVersion = await checkForUpdate(currentVersion, isBeta);
			if (newerVersion) {
				const cmd = getUpgradeCommand(INSTALL_METHOD);
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

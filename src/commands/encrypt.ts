// src/commands/encrypt.ts

import { randomBytes } from "node:crypto";
import {
	getProjectRemote,
	getRemoteHost,
	getRemotePath,
} from "@commands/remote.ts";
import { confirm, password, select } from "@inquirer/prompts";
import { requireConfig, saveConfig } from "@lib/config.ts";
import { deriveKey } from "@lib/encryption.ts";
import {
	createRemoteArchiveTarget,
	decryptRemoteArchive,
	remoteArchiveExists,
} from "@lib/remote-encryption.ts";
import {
	dryRun,
	error,
	info,
	isDryRun,
	spinner,
	success,
	warn,
} from "@lib/ui.ts";
import chalk from "chalk";

/**
 * Enable encryption for a project
 */
const enableEncryption = async (project?: string): Promise<void> => {
	const config = requireConfig();

	const projectNames = Object.keys(config.projects);
	if (projectNames.length === 0) {
		error("No projects found in config.");
		return;
	}

	if (!project) {
		project = await select({
			message: "Select a project to enable encryption:",
			choices: projectNames.map((name) => ({ name, value: name })),
		});
	}

	const projectConfig = config.projects[project];
	if (!projectConfig) {
		error(`Project '${project}' not found in config.`);
		return;
	}

	if (projectConfig.encryption?.enabled) {
		info(`Encryption is already enabled for '${project}'.`);
		return;
	}

	// Step 1: First confirmation
	console.log();
	warn("Encryption Warning:");
	console.log(
		chalk.yellow("  Your passphrase is NEVER stored. If you forget it, your"),
	);
	console.log(
		chalk.yellow("  encrypted project data CANNOT be recovered. There is no"),
	);
	console.log(chalk.yellow("  reset or recovery mechanism."));
	console.log();
	console.log(
		chalk.yellow(
			"  We recommend saving your passphrase in a password manager.",
		),
	);
	console.log();

	const step1 = await confirm({
		message: "Enable encryption?",
		default: false,
	});

	if (!step1) {
		info("Cancelled.");
		return;
	}

	// Step 2: Second confirmation
	console.log();
	warn("Please confirm you understand:");
	console.log(
		chalk.yellow(
			"  - There is NO way to recover your data without the passphrase",
		),
	);
	console.log(chalk.yellow("  - SkyBox cannot reset or bypass encryption"));
	console.log(
		chalk.yellow(
			"  - You are solely responsible for storing your passphrase safely",
		),
	);
	console.log();

	const step2 = await confirm({
		message: "I understand the risks",
		default: false,
	});

	if (!step2) {
		info("Cancelled.");
		return;
	}

	// Prompt for passphrase
	const passphrase = await password({
		message: "Enter encryption passphrase:",
	});

	if (!passphrase) {
		error("Passphrase is required.");
		return;
	}

	// Generate salt and save
	const salt = randomBytes(16).toString("hex");
	config.projects[project].encryption = { enabled: true, salt };
	saveConfig(config);

	console.log();
	success(
		`Encryption enabled for '${project}'. Keep your passphrase safe — it cannot be recovered.`,
	);
};

/**
 * Disable encryption for a project
 */
const disableEncryption = async (project?: string): Promise<void> => {
	const config = requireConfig();

	// Filter to only projects with encryption enabled
	const encryptedProjects = Object.entries(config.projects)
		.filter(([_, p]) => p.encryption?.enabled)
		.map(([name]) => name);

	if (encryptedProjects.length === 0) {
		info("No projects have encryption enabled.");
		return;
	}

	if (!project) {
		project = await select({
			message: "Select a project to disable encryption:",
			choices: encryptedProjects.map((name) => ({ name, value: name })),
		});
	}

	const projectConfig = config.projects[project];
	if (!projectConfig) {
		error(`Project '${project}' not found in config.`);
		return;
	}

	if (!projectConfig.encryption?.enabled) {
		info(`Encryption is not enabled for '${project}'.`);
		return;
	}

	// Prompt for passphrase to verify access
	const passphrase = await password({
		message: "Enter encryption passphrase to confirm:",
	});

	if (!passphrase) {
		error("Passphrase is required.");
		return;
	}

	// Check if an encrypted archive exists on remote and decrypt it
	const projectRemote = getProjectRemote(project, config);
	if (projectRemote && projectConfig.encryption.salt) {
		const host = getRemoteHost(projectRemote.remote);
		const remotePath = getRemotePath(projectRemote.remote, project);
		const archiveTarget = createRemoteArchiveTarget(project, host, remotePath);

		if (await remoteArchiveExists(archiveTarget)) {
			const decryptSpin = spinner("Decrypting remote archive...");

			try {
				const key = await deriveKey(passphrase, projectConfig.encryption.salt);
				const decryptResult = await decryptRemoteArchive(
					archiveTarget,
					key,
					(message) => {
						decryptSpin.text = message;
					},
				);

				if (!decryptResult.success) {
					decryptSpin.fail("Failed to extract archive on remote");
					error(decryptResult.error || "Unknown error");
					return;
				}

				decryptSpin.succeed("Remote archive decrypted");
			} catch {
				decryptSpin.fail(
					"Failed to decrypt remote archive — incorrect passphrase?",
				);
				return;
			}
		}
	}

	// Remove encryption config
	delete config.projects[project].encryption;
	saveConfig(config);

	console.log();
	success(`Encryption disabled for '${project}'.`);
};

/**
 * Main handler for encrypt command
 */
export const encryptCommand = async (
	subcommand?: string,
	project?: string,
): Promise<void> => {
	if (isDryRun()) {
		if (subcommand === "enable") {
			dryRun(`Would enable encryption for project '${project}'`);
		} else if (subcommand === "disable") {
			dryRun(`Would disable encryption for project '${project}'`);
		} else {
			dryRun("Would show encryption status");
		}
		return;
	}

	if (subcommand === "enable") {
		await enableEncryption(project);
		return;
	}

	if (subcommand === "disable") {
		await disableEncryption(project);
		return;
	}

	if (!subcommand) {
		error(
			"Missing subcommand. Usage: skybox encrypt <enable|disable> [project]",
		);
		console.log();
		console.log(
			`${chalk.bold("Usage:")} skybox encrypt <subcommand> [project]`,
		);
		console.log();
		console.log(chalk.bold("Subcommands:"));
		console.log("  enable [project]    Enable encryption for a project");
		console.log("  disable [project]   Disable encryption for a project");
		console.log();
		return;
	}

	error(`Unknown subcommand: ${subcommand}`);
	info("Available subcommands: enable, disable");
};

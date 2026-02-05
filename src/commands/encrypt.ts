// src/commands/encrypt.ts

import { randomBytes } from "node:crypto";
import {
	getProjectRemote,
	getRemoteHost,
	getRemotePath,
} from "@commands/remote.ts";
import { confirm, password, select } from "@inquirer/prompts";
import { configExists, loadConfig, saveConfig } from "@lib/config.ts";
import { decryptFile, deriveKey } from "@lib/encryption.ts";
import { escapeShellArg } from "@lib/shell.ts";
import { runRemoteCommand } from "@lib/ssh.ts";
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
async function enableEncryption(project?: string): Promise<void> {
	if (!configExists()) {
		error("skybox not configured. Run 'skybox init' first.");
		process.exit(1);
	}

	const config = loadConfig();
	if (!config) {
		error("skybox not configured. Run 'skybox init' first.");
		process.exit(1);
	}

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
}

/**
 * Disable encryption for a project
 */
async function disableEncryption(project?: string): Promise<void> {
	if (!configExists()) {
		error("skybox not configured. Run 'skybox init' first.");
		process.exit(1);
	}

	const config = loadConfig();
	if (!config) {
		error("skybox not configured. Run 'skybox init' first.");
		process.exit(1);
	}

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
		const archiveName = `${project}.tar.enc`;
		const remoteArchivePath = `${remotePath}/${archiveName}`;

		const checkResult = await runRemoteCommand(
			host,
			`test -f ${escapeShellArg(remoteArchivePath)} && echo "EXISTS" || echo "NOT_FOUND"`,
		);

		if (checkResult.success && checkResult.stdout?.includes("EXISTS")) {
			const decryptSpin = spinner("Decrypting remote archive...");

			try {
				const { tmpdir } = await import("node:os");
				const { join } = await import("node:path");
				const { mkdtempSync, rmSync } = await import("node:fs");
				const { execa } = await import("execa");

				const key = await deriveKey(passphrase, projectConfig.encryption.salt);
				// Use mkdtempSync for unpredictable temp directory (prevents symlink attacks)
				const tempDir = mkdtempSync(join(tmpdir(), "skybox-"));
				const localEncPath = join(tempDir, "archive.tar.enc");
				const localTarPath = join(tempDir, "archive.tar");

				try {
					decryptSpin.text = "Downloading encrypted archive...";
					await execa("scp", [`${host}:${remoteArchivePath}`, localEncPath]);

					decryptSpin.text = "Decrypting...";
					decryptFile(localEncPath, localTarPath, key);

					decryptSpin.text = "Uploading decrypted files...";
					const remoteTarPath = `${remotePath}/${project}.tar`;
					await execa("scp", [localTarPath, `${host}:${remoteTarPath}`]);

					decryptSpin.text = "Extracting...";
					const extractResult = await runRemoteCommand(
						host,
						`cd ${escapeShellArg(remotePath)} && tar xf ${escapeShellArg(`${project}.tar`)} && rm -f ${escapeShellArg(`${project}.tar`)} ${escapeShellArg(archiveName)}`,
					);

					if (!extractResult.success) {
						decryptSpin.fail("Failed to extract archive on remote");
						error(extractResult.error || "Unknown error");
						return;
					}

					decryptSpin.succeed("Remote archive decrypted");
				} finally {
					// Clean up entire temp directory
					try {
						rmSync(tempDir, { recursive: true, force: true });
					} catch {}
				}
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
}

/**
 * Main handler for encrypt command
 */
export async function encryptCommand(
	subcommand?: string,
	project?: string,
): Promise<void> {
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
}

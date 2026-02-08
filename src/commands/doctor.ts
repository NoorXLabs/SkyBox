// src/commands/doctor.ts

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { getRemoteHost } from "@commands/remote.ts";
import { configExists, loadConfig } from "@lib/config.ts";
import { MUTAGEN_VERSION } from "@lib/constants.ts";
import { downloadMutagen } from "@lib/download.ts";
import {
	ensureMutagenExtracted,
	needsMutagenExtraction,
} from "@lib/mutagen-extract.ts";
import { getMutagenPath } from "@lib/paths.ts";
import { testConnection } from "@lib/ssh.ts";
import type {
	DoctorCheckResult,
	DoctorCheckStatus,
	DoctorReport,
} from "@typedefs/index.ts";
import chalk from "chalk";

// Check icons
const icons: Record<DoctorCheckStatus, string> = {
	pass: chalk.green("✓"),
	warn: chalk.yellow("!"),
	fail: chalk.red("✗"),
};

// check whether Docker is installed and running
const checkDocker = (): DoctorCheckResult => {
	const name = "Docker";

	// Check if Docker is installed
	try {
		execSync("docker --version", { stdio: "pipe" });
	} catch {
		return {
			name,
			status: "fail",
			message: "Docker is not installed",
			fix: "Install Docker Desktop: brew install --cask docker",
		};
	}

	// Check if Docker daemon is running
	try {
		execSync("docker info", { stdio: "pipe", timeout: 5000 });
	} catch {
		return {
			name,
			status: "fail",
			message: "Docker is installed but not running",
			fix: "Start Docker Desktop application",
		};
	}

	// Check Docker version
	try {
		const result = execSync("docker --version", { encoding: "utf-8" });
		const versionMatch = result.match(/Docker version (\d+\.\d+)/);
		const version = versionMatch ? versionMatch[1] : "unknown";
		return {
			name,
			status: "pass",
			message: `Docker ${version} is running`,
		};
	} catch {
		return {
			name,
			status: "pass",
			message: "Docker is running",
		};
	}
};

// check whether the Mutagen binary is installed, version matches, and attempt repair if needed
const checkMutagen = async (): Promise<DoctorCheckResult> => {
	const name = "Mutagen";
	const mutagenPath = getMutagenPath();
	const missing = !existsSync(mutagenPath);
	const needsExtraction = needsMutagenExtraction();

	// If binary exists and version matches, report pass
	if (!missing && !needsExtraction) {
		try {
			const result = execSync(`"${mutagenPath}" version`, {
				encoding: "utf-8",
				timeout: 5000,
			});
			const version = result.trim().split("\n")[0] || "installed";
			return { name, status: "pass", message: `Mutagen ${version}` };
		} catch {
			// Binary exists but can't run — fall through to repair
		}
	}

	// Attempt auto-repair: re-extract bundled binary
	const issue = missing ? "not installed" : "outdated or corrupted";
	const extractResult = await ensureMutagenExtracted();

	if (extractResult.success) {
		return {
			name,
			status: "pass",
			message: `Mutagen v${MUTAGEN_VERSION} (${missing ? "installed" : "repaired"})`,
		};
	}

	// Bundled extraction failed — try download fallback
	try {
		const dlResult = await downloadMutagen();
		if (dlResult.success) {
			return {
				name,
				status: "pass",
				message: `Mutagen v${MUTAGEN_VERSION} (downloaded)`,
			};
		}
	} catch {
		// Download also failed
	}

	return {
		name,
		status: "fail",
		message: `Mutagen ${issue} — automatic repair failed`,
		fix: "Download Mutagen manually and place at ~/.skybox/bin/mutagen",
	};
};

// check whether the SkyBox config file is valid with remotes configured
const checkConfig = (): DoctorCheckResult => {
	const name = "Configuration";

	try {
		if (!configExists()) {
			return {
				name,
				status: "warn",
				message: "SkyBox not configured",
				fix: "Run 'skybox init' to set up SkyBox",
			};
		}

		const config = loadConfig();
		if (!config) {
			return {
				name,
				status: "fail",
				message: "Config file exists but failed to load",
				fix: "Check ~/.skybox/config.yaml for syntax errors",
			};
		}

		// Check for remotes
		const remoteCount = Object.keys(config.remotes || {}).length;
		if (remoteCount === 0) {
			return {
				name,
				status: "warn",
				message: "No remotes configured",
				fix: "Run 'skybox init' or 'skybox remote add' to add a remote",
			};
		}

		return {
			name,
			status: "pass",
			message: `Config loaded (${remoteCount} remote${remoteCount > 1 ? "s" : ""})`,
		};
	} catch (err) {
		return {
			name,
			status: "fail",
			message: `Config error: ${err instanceof Error ? err.message : "unknown"}`,
			fix: "Check ~/.skybox/config.yaml for errors",
		};
	}
};

// test SSH connectivity to all configured remotes
const checkSSHConnectivity = async (): Promise<DoctorCheckResult[]> => {
	const results: DoctorCheckResult[] = [];

	try {
		if (!configExists()) {
			return []; // Skip if no config
		}

		const config = loadConfig();
		if (!config || !config.remotes) {
			return [];
		}

		for (const [remoteName, remote] of Object.entries(config.remotes)) {
			const name = `SSH: ${remoteName}`;
			try {
				const host = getRemoteHost(remote);
				const result = await testConnection(host, remote.key);

				if (result.success) {
					results.push({
						name,
						status: "pass",
						message: `Connected to ${remote.host}`,
					});
				} else {
					results.push({
						name,
						status: "fail",
						message: `Cannot connect: ${result.error}`,
						fix: `Check SSH key and host configuration for '${remoteName}'`,
					});
				}
			} catch (err) {
				results.push({
					name,
					status: "fail",
					message: `Connection failed: ${err instanceof Error ? err.message : "unknown"}`,
					fix: `Verify SSH access to ${remote.host}`,
				});
			}
		}
	} catch {
		// If we can't load config, skip SSH checks
	}

	return results;
};

// check whether the devcontainer CLI is installed
const checkDevcontainerCLI = (): DoctorCheckResult => {
	const name = "Devcontainer CLI";

	try {
		const result = execSync("devcontainer --version", {
			encoding: "utf-8",
			timeout: 5000,
		});
		const version = result.trim() || "installed";

		return {
			name,
			status: "pass",
			message: `devcontainer ${version}`,
		};
	} catch {
		// Check if Homebrew is available for a better suggestion
		let fix = "npm install -g @devcontainers/cli";
		try {
			execSync("which brew", { encoding: "utf-8", timeout: 2000 });
			fix = "brew install devcontainer";
		} catch {
			// Homebrew not available, keep npm suggestion
		}

		return {
			name,
			status: "warn",
			message: "Devcontainer CLI not found",
			fix,
		};
	}
};

// print a single doctor check result with status icon and fix hint
const printResult = (result: DoctorCheckResult): void => {
	const icon = icons[result.status];
	console.log(`  ${icon} ${result.name}: ${result.message}`);
	if (result.fix && result.status !== "pass") {
		console.log(chalk.dim(`      Fix: ${result.fix}`));
	}
};

// print the full doctor report with pass/warn/fail summary
const printReport = (report: DoctorReport): void => {
	console.log();
	console.log(chalk.bold("SkyBox Doctor"));
	console.log(chalk.dim("─".repeat(40)));
	console.log();

	for (const check of report.checks) {
		printResult(check);
	}

	console.log();
	console.log(chalk.dim("─".repeat(40)));

	const summary = [];
	if (report.passed > 0) summary.push(chalk.green(`${report.passed} passed`));
	if (report.warned > 0)
		summary.push(chalk.yellow(`${report.warned} warnings`));
	if (report.failed > 0) summary.push(chalk.red(`${report.failed} failed`));

	console.log(`  ${summary.join(", ")}`);
	console.log();

	if (report.failed > 0) {
		console.log(
			chalk.red("  Some checks failed. Please fix the issues above."),
		);
	} else if (report.warned > 0) {
		console.log(
			chalk.yellow(
				"  Some checks have warnings. SkyBox should work but may have issues.",
			),
		);
	} else {
		console.log(chalk.green("  All checks passed. SkyBox is ready to use!"));
	}
	console.log();
};

// run diagnostic checks on Docker, Mutagen, config, CLI, and SSH
export const doctorCommand = async (): Promise<void> => {
	const checks: DoctorCheckResult[] = [];

	// Run sync checks
	checks.push(checkDocker());
	checks.push(await checkMutagen());
	checks.push(checkDevcontainerCLI());
	checks.push(checkConfig());

	// Run async checks
	const sshChecks = await checkSSHConnectivity();
	checks.push(...sshChecks);

	// Calculate summary
	const passed = checks.filter((c) => c.status === "pass").length;
	const warned = checks.filter((c) => c.status === "warn").length;
	const failed = checks.filter((c) => c.status === "fail").length;

	const report: DoctorReport = { checks, passed, warned, failed };
	printReport(report);

	// Exit with error code if any checks failed
	if (failed > 0) {
		process.exit(1);
	}
};

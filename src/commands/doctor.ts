// src/commands/doctor.ts

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import chalk from "chalk";
import { configExists, loadConfig } from "../lib/config.ts";
import { getMutagenPath } from "../lib/paths.ts";
import type {
	DoctorCheckResult,
	DoctorCheckStatus,
	DoctorReport,
} from "../types/index.ts";

// Check icons
const icons: Record<DoctorCheckStatus, string> = {
	pass: chalk.green("✓"),
	warn: chalk.yellow("!"),
	fail: chalk.red("✗"),
};

function checkDocker(): DoctorCheckResult {
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
}

function checkMutagen(): DoctorCheckResult {
	const name = "Mutagen";

	// Check if Mutagen binary exists
	try {
		const mutagenPath = getMutagenPath();

		if (!existsSync(mutagenPath)) {
			return {
				name,
				status: "warn",
				message: "Mutagen not installed (will be downloaded on first use)",
				fix: "Run 'devbox init' to download Mutagen",
			};
		}

		// Try to get version
		const result = execSync(`"${mutagenPath}" version`, {
			encoding: "utf-8",
			timeout: 5000,
		});
		const version = result.trim().split("\n")[0] || "installed";

		return {
			name,
			status: "pass",
			message: `Mutagen ${version}`,
		};
	} catch {
		return {
			name,
			status: "warn",
			message: "Mutagen check failed",
			fix: "Run 'devbox init' to reinstall Mutagen",
		};
	}
}

function checkConfig(): DoctorCheckResult {
	const name = "Configuration";

	try {
		if (!configExists()) {
			return {
				name,
				status: "warn",
				message: "DevBox not configured",
				fix: "Run 'devbox init' to set up DevBox",
			};
		}

		const config = loadConfig();
		if (!config) {
			return {
				name,
				status: "fail",
				message: "Config file exists but failed to load",
				fix: "Check ~/.devbox/config.yaml for syntax errors",
			};
		}

		// Check for remotes
		const remoteCount = Object.keys(config.remotes || {}).length;
		if (remoteCount === 0) {
			return {
				name,
				status: "warn",
				message: "No remotes configured",
				fix: "Run 'devbox init' or 'devbox remote add' to add a remote",
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
			fix: "Check ~/.devbox/config.yaml for errors",
		};
	}
}

function printResult(result: DoctorCheckResult): void {
	const icon = icons[result.status];
	console.log(`  ${icon} ${result.name}: ${result.message}`);
	if (result.fix && result.status !== "pass") {
		console.log(chalk.dim(`      Fix: ${result.fix}`));
	}
}

function printReport(report: DoctorReport): void {
	console.log();
	console.log(chalk.bold("DevBox Doctor"));
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
				"  Some checks have warnings. DevBox should work but may have issues.",
			),
		);
	} else {
		console.log(chalk.green("  All checks passed. DevBox is ready to use!"));
	}
	console.log();
}

export async function doctorCommand(): Promise<void> {
	const checks: DoctorCheckResult[] = [];

	// Run all checks
	checks.push(checkDocker());
	checks.push(checkMutagen());
	checks.push(checkConfig());

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
}

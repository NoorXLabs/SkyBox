// src/commands/status.ts

import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { getProjectRemote, getRemoteHost } from "@commands/remote.ts";
import { requireConfig } from "@lib/config.ts";
import { getContainerInfo, getContainerStatus } from "@lib/container.ts";
import { getGitInfo as getSharedGitInfo } from "@lib/git.ts";
import { getSyncStatus, sessionName } from "@lib/mutagen.ts";
import { getProjectsDir } from "@lib/paths.ts";
import { getLocalProjects } from "@lib/project.ts";
import { formatRelativeTime as formatRelativeTimeShared } from "@lib/relative-time.ts";
import {
	checkSessionConflict,
	getMachineName,
	readSession,
	type SessionInfo,
} from "@lib/session.ts";
import { escapeRemotePath } from "@lib/shell.ts";
import { runRemoteCommand } from "@lib/ssh.ts";
import { error, header } from "@lib/ui.ts";
import {
	type ContainerDetails,
	ContainerStatus,
	type GitDetails,
	type ProjectSummary,
	type SyncDetails,
} from "@typedefs/index.ts";
import chalk from "chalk";
import { execa } from "execa";

// get human-readable disk usage for a local directory
export const getDiskUsage = async (path: string): Promise<string> => {
	try {
		const result = await execa("du", ["-sh", path], { timeout: 5000 });
		// Output is like "1.2G\t/path/to/dir"
		const size = result.stdout.trim().split(/\s+/)[0];
		return size || "unknown";
	} catch {
		return "unknown";
	}
};

// get the last activity timestamp from git log or directory mtime
export const getLastActive = async (
	projectPath: string,
): Promise<Date | null> => {
	// Try git log first
	try {
		const result = await execa("git", [
			"-C",
			projectPath,
			"log",
			"-1",
			"--format=%ct",
		]);
		const timestamp = parseInt(result.stdout.trim(), 10);
		if (!Number.isNaN(timestamp)) {
			return new Date(timestamp * 1000);
		}
	} catch {
		// Not a git repo or no commits
	}

	// Fall back to directory mtime
	try {
		const stats = statSync(projectPath);
		return stats.mtime;
	} catch {
		return null;
	}
};

// get shared git info (branch and last commit) for a project
export const getGitInfo = async (
	projectPath: string,
): Promise<GitDetails | null> => {
	return getSharedGitInfo(projectPath);
};

// apply color formatting to a container status string
const colorContainer = (status: string): string => {
	switch (status) {
		case "running":
			return chalk.green(status);
		case "stopped":
			return chalk.dim(status);
		default:
			return chalk.dim(status);
	}
};

// apply color formatting to a sync status string
const colorSync = (status: string): string => {
	switch (status) {
		case "syncing":
			return chalk.green(status);
		case "paused":
			return chalk.yellow(status);
		case "error":
			return chalk.red(status);
		default:
			return chalk.dim(status);
	}
};

// format a session's machine ownership into a display string
const formatSessionStatus = (session: SessionInfo | null): string => {
	if (!session) {
		return "none";
	}
	const currentMachine = getMachineName();
	if (session.machine === currentMachine) {
		return "active here";
	}
	return `active on ${session.machine}`;
};

// gather container status, image, uptime, CPU, and memory for a project
const getContainerDetails = async (
	projectPath: string,
): Promise<ContainerDetails> => {
	const status = await getContainerStatus(projectPath);
	const info = await getContainerInfo(projectPath);

	if (status !== ContainerStatus.Running || !info) {
		return {
			status: status === ContainerStatus.Running ? "running" : "stopped",
			image: info?.image || "-",
			uptime: "-",
			cpu: "-",
			memory: "-",
		};
	}

	// Get stats for running container
	try {
		const statsResult = await execa(
			"docker",
			[
				"stats",
				"--no-stream",
				"--format",
				"{{.CPUPerc}}\t{{.MemUsage}}",
				info.id,
			],
			{ timeout: 5000 },
		);

		const [cpu, memory] = statsResult.stdout.trim().split("\t");

		// Parse uptime from status string (e.g., "Up 2 hours")
		const uptimeMatch = info.rawStatus.match(/Up\s+(.+)/i);
		const uptime = uptimeMatch ? uptimeMatch[1] : "-";

		return {
			status: "running",
			image: info.image,
			uptime,
			cpu: cpu || "-",
			memory: memory || "-",
		};
	} catch {
		return {
			status: "running",
			image: info.image,
			uptime: "-",
			cpu: "-",
			memory: "-",
		};
	}
};

// gather sync session status details for a project
const getSyncDetails = async (projectName: string): Promise<SyncDetails> => {
	const status = await getSyncStatus(projectName);

	if (!status.exists) {
		return {
			status: "no session",
			session: "-",
			pending: "-",
			lastSync: "-",
		};
	}

	return {
		status: status.paused ? "paused" : "syncing",
		session: sessionName(projectName),
		pending: "0 files", // Would need more mutagen parsing for real count
		lastSync: "-", // Would need more mutagen parsing
	};
};

// query remote server for disk usage of a project directory
const getRemoteDiskUsage = async (projectName: string): Promise<string> => {
	try {
		const projectRemote = getProjectRemote(projectName);
		if (!projectRemote) {
			return "unavailable";
		}
		const { remote } = projectRemote;
		const host = getRemoteHost(remote);
		const remotePath = `${remote.path}/${projectName}`;
		const result = await runRemoteCommand(
			host,
			`du -sh ${escapeRemotePath(remotePath)} 2>/dev/null | cut -f1`,
		);
		if (!result.success) return "unavailable";
		return result.stdout?.trim() || "unknown";
	} catch {
		return "unavailable";
	}
};

// gather a high-level summary of container, sync, git, session, and disk status
const getProjectSummary = async (
	projectName: string,
): Promise<ProjectSummary> => {
	const projectPath = join(getProjectsDir(), projectName);

	// Run checks in parallel
	const [containerStatus, syncStatus, gitInfo, diskUsage, lastActive] =
		await Promise.all([
			getContainerStatus(projectPath),
			getSyncStatus(projectName),
			getGitInfo(projectPath),
			getDiskUsage(projectPath),
			getLastActive(projectPath),
		]);

	// Get session status from local session file
	const session = readSession(projectPath);
	const sessionDisplay = formatSessionStatus(session);

	// Map container status
	let container: ProjectSummary["container"] = "unknown";
	if (containerStatus === ContainerStatus.Running) container = "running";
	else if (
		containerStatus === ContainerStatus.Stopped ||
		containerStatus === ContainerStatus.NotFound
	)
		container = "stopped";

	// Map sync status
	let sync: ProjectSummary["sync"] = "unknown";
	if (!syncStatus.exists) sync = "no session";
	else if (syncStatus.status === "paused") sync = "paused";
	else if (syncStatus.status === "syncing") sync = "syncing";
	else if (syncStatus.status === "error") sync = "error";

	return {
		name: projectName,
		container,
		sync,
		branch: gitInfo?.branch || "-",
		session: sessionDisplay,
		lastActive,
		size: diskUsage,
		path: projectPath,
	};
};

// render a formatted table of project summaries to the terminal
const formatOverviewTable = (summaries: ProjectSummary[]): void => {
	// Column headers
	const headers = [
		"NAME",
		"CONTAINER",
		"SYNC",
		"BRANCH",
		"SESSION",
		"LAST ACTIVE",
		"SIZE",
	];

	// Calculate column widths
	const widths = headers.map((h, i) => {
		const values = summaries.map((s) => {
			switch (i) {
				case 0:
					return s.name;
				case 1:
					return s.container;
				case 2:
					return s.sync;
				case 3:
					return s.branch;
				case 4:
					return s.session;
				case 5:
					return formatRelativeTimeShared(s.lastActive, "long");
				case 6:
					return s.size;
				default:
					return "";
			}
		});
		return Math.max(h.length, ...values.map((v) => v.length));
	});

	// Print header
	const headerRow = headers.map((h, i) => h.padEnd(widths[i])).join("  ");
	console.log(chalk.dim(`  ${headerRow}`));

	// Print rows
	for (const s of summaries) {
		// Calculate padding separately to avoid ANSI escape code length issues
		const containerPad = " ".repeat(
			Math.max(0, widths[1] - s.container.length),
		);
		const syncPad = " ".repeat(Math.max(0, widths[2] - s.sync.length));
		const sessionPad = " ".repeat(Math.max(0, widths[4] - s.session.length));

		const row = [
			s.name.padEnd(widths[0]),
			colorContainer(s.container) + containerPad,
			colorSync(s.sync) + syncPad,
			s.branch.padEnd(widths[3]),
			chalk.dim(s.session) + sessionPad,
			formatRelativeTimeShared(s.lastActive, "long").padEnd(widths[5]),
			s.size.padEnd(widths[6]),
		].join("  ");
		console.log(`  ${row}`);
	}
};

// show project status overview or detailed view for a single project
export const statusCommand = async (project?: string): Promise<void> => {
	requireConfig();

	if (project) {
		await showDetailed(project);
	} else {
		await showOverview();
	}
};

// display an overview table of all local projects
const showOverview = async (): Promise<void> => {
	const projectsDir = getProjectsDir();
	if (!existsSync(projectsDir)) {
		printNoProjectsMessage();
		return;
	}

	const projectDirs = getLocalProjects();
	if (projectDirs.length === 0) {
		printNoProjectsMessage();
		return;
	}

	// Gather summaries in parallel
	const summaries = await Promise.all(
		projectDirs.map((project) => getProjectSummary(project)),
	);

	header("Projects:");
	console.log();
	formatOverviewTable(summaries);
	console.log();
};

// print the shared empty-state message when no local projects are available
const printNoProjectsMessage = (): void => {
	console.log();
	console.log(
		"No projects found. Use 'skybox clone' or 'skybox push' to get started.",
	);
};

// display detailed status for a single project
const showDetailed = async (projectName: string): Promise<void> => {
	const projectPath = join(getProjectsDir(), projectName);

	if (!existsSync(projectPath)) {
		error(
			`Project '${projectName}' not found. Run 'skybox list' to see available projects.`,
		);
		process.exit(1);
	}

	// Gather all details
	const [container, sync, git, localDisk, remoteDisk] = await Promise.all([
		getContainerDetails(projectPath),
		getSyncDetails(projectName),
		getGitInfo(projectPath),
		getDiskUsage(projectPath),
		getRemoteDiskUsage(projectName),
	]);

	// Get session status from local file
	const session = readSession(projectPath);
	const conflictResult = checkSessionConflict(projectPath);

	// Print header
	console.log();
	console.log(chalk.bold(`Project: ${projectName}`));
	console.log(chalk.dim("━".repeat(50)));

	// Container section
	console.log();
	console.log(chalk.bold("Container"));
	console.log(`  Status:     ${colorContainer(container.status)}`);
	console.log(`  Image:      ${container.image}`);
	console.log(`  Uptime:     ${container.uptime}`);
	console.log(`  CPU:        ${container.cpu}`);
	console.log(`  Memory:     ${container.memory}`);

	// Sync section
	console.log();
	console.log(chalk.bold("Sync"));
	console.log(`  Status:     ${colorSync(sync.status)}`);
	console.log(`  Session:    ${sync.session}`);
	console.log(`  Pending:    ${sync.pending}`);
	console.log(`  Last sync:  ${sync.lastSync}`);

	// Git section
	console.log();
	console.log(chalk.bold("Git"));
	if (git) {
		const statusColor = git.status === "clean" ? chalk.green : chalk.yellow;
		console.log(`  Branch:     ${git.branch}`);
		console.log(`  Status:     ${statusColor(git.status)}`);
		console.log(`  Ahead:      ${git.ahead} commits`);
		console.log(`  Behind:     ${git.behind} commits`);
	} else {
		console.log(chalk.dim("  Not a git repository"));
	}

	// Session section
	console.log();
	console.log(chalk.bold("Session"));
	if (!session) {
		console.log(`  Status:     ${chalk.dim("none")}`);
	} else if (!conflictResult.hasConflict) {
		// Session exists and belongs to this machine
		console.log(`  Status:     ${chalk.green("active here")}`);
		console.log(`  Machine:    ${session.machine}`);
		console.log(`  User:       ${session.user}`);
		console.log(
			`  Started:    ${formatRelativeTimeShared(new Date(session.timestamp))}`,
		);
		console.log(`  PID:        ${session.pid}`);
	} else {
		// Session belongs to a different machine
		console.log(
			`  Status:     ${chalk.yellow(`active on ${session.machine}`)}`,
		);
		console.log(`  Machine:    ${session.machine}`);
		console.log(`  User:       ${session.user}`);
		console.log(
			`  Started:    ${formatRelativeTimeShared(new Date(session.timestamp))}`,
		);
		console.log(`  PID:        ${session.pid}`);
	}

	// Disk section
	console.log();
	console.log(chalk.bold("Disk Usage"));
	console.log(`  Local:      ${localDisk}`);
	console.log(`  Remote:     ${remoteDisk}`);
	console.log();
};

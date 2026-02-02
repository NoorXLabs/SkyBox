// src/commands/dashboard.tsx

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { getDiskUsage, getGitInfo, getLastActive } from "@commands/status.ts";
import { loadConfig } from "@lib/config.ts";
import { getContainerInfo, getContainerStatus } from "@lib/container.ts";
import { getSyncStatus } from "@lib/mutagen.ts";
import { getProjectsDir } from "@lib/paths.ts";
import { ContainerStatus } from "@typedefs/index.ts";
import { Box, render, Text, useApp, useInput } from "ink";
import type React from "react";
import { useCallback, useEffect, useState } from "react";

interface DashboardProject {
	name: string;
	container: string;
	sync: string;
	branch: string;
	// Detailed fields
	gitStatus: string;
	ahead: number;
	behind: number;
	diskUsage: string;
	lastActive: string;
	image: string;
	remote: string;
	encrypted: boolean;
}

async function gatherProjectData(): Promise<DashboardProject[]> {
	const projectsDir = getProjectsDir();
	if (!existsSync(projectsDir)) return [];

	const config = loadConfig();

	const entries = readdirSync(projectsDir).filter((entry) => {
		const fullPath = join(projectsDir, entry);
		return statSync(fullPath).isDirectory();
	});

	const results: DashboardProject[] = [];

	for (const name of entries) {
		const projectPath = join(projectsDir, name);
		const [
			containerStatus,
			containerInfo,
			syncStatus,
			gitInfo,
			diskUsage,
			lastActive,
		] = await Promise.all([
			getContainerStatus(projectPath),
			getContainerInfo(projectPath),
			getSyncStatus(name),
			getGitInfo(projectPath),
			getDiskUsage(projectPath),
			getLastActive(projectPath),
		]);

		let container = "stopped";
		if (containerStatus === ContainerStatus.Running) container = "running";

		let sync = "none";
		if (syncStatus.exists) sync = syncStatus.paused ? "paused" : "syncing";

		const projectConfig = config?.projects?.[name];

		results.push({
			name,
			container,
			sync,
			branch: gitInfo?.branch || "-",
			gitStatus: gitInfo?.status || "-",
			ahead: gitInfo?.ahead ?? 0,
			behind: gitInfo?.behind ?? 0,
			diskUsage,
			lastActive: lastActive ? formatRelativeTime(lastActive) : "-",
			image: containerInfo?.image || "-",
			remote: projectConfig?.remote || "-",
			encrypted: !!projectConfig?.encryption,
		});
	}

	return results;
}

function formatRelativeTime(date: Date): string {
	const diffMs = Date.now() - date.getTime();
	const diffMins = Math.floor(diffMs / 60_000);
	if (diffMins < 1) return "just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	const diffHours = Math.floor(diffMins / 60);
	if (diffHours < 24) return `${diffHours}h ago`;
	const diffDays = Math.floor(diffHours / 24);
	return `${diffDays}d ago`;
}

function Dashboard({
	initialDetailed,
}: {
	initialDetailed: boolean;
}): React.ReactElement {
	const { exit } = useApp();
	const [projects, setProjects] = useState<DashboardProject[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [detailed, setDetailed] = useState(initialDetailed);

	const refresh = useCallback(async () => {
		setLoading(true);
		const data = await gatherProjectData();
		setProjects(data);
		setLoading(false);
	}, []);

	useEffect(() => {
		refresh();
		const interval = setInterval(refresh, 10_000);
		return () => clearInterval(interval);
	}, [refresh]);

	useInput((input, key) => {
		if (input === "q" || key.escape) {
			exit();
		}
		if (input === "r") {
			refresh();
		}
		if (input === "d") {
			setDetailed((d) => !d);
		}
		if (key.upArrow) {
			setSelectedIndex((i) => Math.max(0, i - 1));
		}
		if (key.downArrow) {
			setSelectedIndex((i) => Math.min(projects.length - 1, i + 1));
		}
	});

	return (
		<Box flexDirection="column">
			<Box justifyContent="center" paddingY={1}>
				<Text bold color="blue">
					DevBox Dashboard
				</Text>
				{detailed && <Text dimColor> (detailed)</Text>}
			</Box>

			{detailed ? <DetailedHeader /> : <SimpleHeader />}

			{loading && projects.length === 0 ? (
				<Box paddingX={2}>
					<Text>Loading...</Text>
				</Box>
			) : projects.length === 0 ? (
				<Box paddingX={2}>
					<Text>
						No projects found. Use &apos;devbox clone&apos; to get started.
					</Text>
				</Box>
			) : (
				projects.map((p, i) =>
					detailed ? (
						<DetailedRow
							key={p.name}
							project={p}
							selected={i === selectedIndex}
						/>
					) : (
						<SimpleRow
							key={p.name}
							project={p}
							selected={i === selectedIndex}
						/>
					),
				)
			)}

			<Box marginTop={1} paddingX={2}>
				<Text dimColor>
					q: quit r: refresh d: {detailed ? "simple" : "detailed"} ↑↓: navigate
					{loading ? " (refreshing...)" : ""}
				</Text>
			</Box>
		</Box>
	);
}

// Simple view columns
const S_NAME = 24;
const S_CONTAINER = 12;
const S_SYNC = 11;

function SimpleHeader(): React.ReactElement {
	return (
		<>
			<Box paddingX={2}>
				<Text dimColor>
					{pad("NAME", S_NAME)}
					{pad("CONTAINER", S_CONTAINER)}
					{pad("SYNC", S_SYNC)}
					BRANCH
				</Text>
			</Box>
			<Box paddingX={2}>
				<Text dimColor>{"─".repeat(60)}</Text>
			</Box>
		</>
	);
}

function SimpleRow({
	project: p,
	selected,
}: {
	project: DashboardProject;
	selected: boolean;
}): React.ReactElement {
	return (
		<Box paddingX={2}>
			<Text color={containerColor(p.container)} inverse={selected}>
				{pad(p.name, S_NAME)}
				{pad(p.container, S_CONTAINER)}
				{pad(p.sync, S_SYNC)}
				{p.branch}
			</Text>
		</Box>
	);
}

// Detailed view columns
const D_NAME = 20;
const D_CONTAINER = 12;
const D_SYNC = 10;
const D_BRANCH = 16;
const D_GIT = 16;
const D_DISK = 10;
const D_ACTIVE = 12;
const D_REMOTE = 14;
const D_IMAGE = 28;

function DetailedHeader(): React.ReactElement {
	return (
		<>
			<Box paddingX={2}>
				<Text dimColor>
					{pad("NAME", D_NAME)}
					{pad("CONTAINER", D_CONTAINER)}
					{pad("SYNC", D_SYNC)}
					{pad("BRANCH", D_BRANCH)}
					{pad("GIT", D_GIT)}
					{pad("DISK", D_DISK)}
					{pad("ACTIVE", D_ACTIVE)}
					{pad("REMOTE", D_REMOTE)}
					{pad("IMAGE", D_IMAGE)}
					ENC
				</Text>
			</Box>
			<Box paddingX={2}>
				<Text dimColor>{"─".repeat(140)}</Text>
			</Box>
		</>
	);
}

function DetailedRow({
	project: p,
	selected,
}: {
	project: DashboardProject;
	selected: boolean;
}): React.ReactElement {
	const gitLabel = p.gitStatus === "dirty" ? "dirty" : "clean";
	const gitExtra =
		p.ahead > 0 || p.behind > 0 ? ` ↑${p.ahead} ↓${p.behind}` : "";

	return (
		<Box paddingX={2}>
			<Text color={containerColor(p.container)} inverse={selected}>
				{pad(p.name, D_NAME)}
				{pad(p.container, D_CONTAINER)}
				{pad(p.sync, D_SYNC)}
				{pad(p.branch, D_BRANCH)}
				{pad(gitLabel + gitExtra, D_GIT)}
				{pad(p.diskUsage, D_DISK)}
				{pad(p.lastActive, D_ACTIVE)}
				{pad(p.remote, D_REMOTE)}
				{pad(p.image, D_IMAGE)}
				{p.encrypted ? "yes" : "no"}
			</Text>
		</Box>
	);
}

function pad(str: string, width: number): string {
	return str.length >= width ? str.slice(0, width) : str.padEnd(width);
}

function containerColor(status: string): string | undefined {
	if (status === "running") return "green";
	if (status === "stopped") return "red";
	return undefined;
}

export async function dashboardCommand(options: {
	detailed?: boolean;
}): Promise<void> {
	const instance = render(
		<Dashboard initialDetailed={options.detailed ?? false} />,
	);
	await instance.waitUntilExit();
}

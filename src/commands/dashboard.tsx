// src/commands/dashboard.tsx

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { getDiskUsage, getGitInfo, getLastActive } from "@commands/status.ts";
import { loadConfig } from "@lib/config.ts";
import { getContainerInfo, getContainerStatus } from "@lib/container.ts";
import { getSyncStatus } from "@lib/mutagen.ts";
import { getProjectsDir } from "@lib/paths.ts";
import { ContainerStatus } from "@typedefs/index.ts";
import { Box, render, Text, useApp, useInput, useStdout } from "ink";
import type React from "react";
import { useCallback, useEffect, useState } from "react";

interface DashboardProject {
	name: string;
	container: string;
	sync: string;
	branch: string;
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

/** Column definition for the table */
interface Column {
	label: string;
	key: string;
	width: number;
	/** Minimum terminal width required to show this column */
	minWidth?: number;
}

const SIMPLE_COLUMNS: Column[] = [
	{ label: "NAME", key: "name", width: 24 },
	{ label: "CONTAINER", key: "container", width: 12 },
	{ label: "SYNC", key: "sync", width: 11 },
	{ label: "BRANCH", key: "branch", width: 20 },
];

const DETAILED_COLUMNS: Column[] = [
	{ label: "NAME", key: "name", width: 20 },
	{ label: "CONTAINER", key: "container", width: 12 },
	{ label: "SYNC", key: "sync", width: 10 },
	{ label: "BRANCH", key: "branch", width: 14 },
	{ label: "GIT", key: "git", width: 16, minWidth: 100 },
	{ label: "DISK", key: "diskUsage", width: 10, minWidth: 110 },
	{ label: "ACTIVE", key: "lastActive", width: 12, minWidth: 120 },
	{ label: "REMOTE", key: "remote", width: 14, minWidth: 135 },
	{ label: "IMAGE", key: "image", width: 28, minWidth: 160 },
	{ label: "ENC", key: "enc", width: 5, minWidth: 165 },
];

function getVisibleColumns(columns: Column[], termWidth: number): Column[] {
	return columns.filter((col) => !col.minWidth || termWidth >= col.minWidth);
}

function getCellValue(p: DashboardProject, key: string): string {
	switch (key) {
		case "git": {
			const label = p.gitStatus === "dirty" ? "dirty" : "clean";
			const extra =
				p.ahead > 0 || p.behind > 0 ? ` ↑${p.ahead} ↓${p.behind}` : "";
			return label + extra;
		}
		case "enc":
			return p.encrypted ? "yes" : "no";
		default:
			return String(p[key as keyof DashboardProject] ?? "-");
	}
}

function TableHeader({
	columns,
}: { columns: Column[] }): React.ReactElement {
	return (
		<Box paddingX={2}>
			{columns.map((col) => (
				<Box key={col.key} width={col.width} overflowX="hidden">
					<Text dimColor wrap="truncate">
						{col.label}
					</Text>
				</Box>
			))}
		</Box>
	);
}

function TableRow({
	project,
	columns,
	selected,
}: {
	project: DashboardProject;
	columns: Column[];
	selected: boolean;
}): React.ReactElement {
	return (
		<Box paddingX={2}>
			{columns.map((col) => (
				<Box key={col.key} width={col.width} overflowX="hidden">
					<Text
						color={containerColor(project.container)}
						inverse={selected}
						wrap="truncate"
					>
						{getCellValue(project, col.key)}
					</Text>
				</Box>
			))}
		</Box>
	);
}

function Separator({
	columns,
}: { columns: Column[] }): React.ReactElement {
	const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);
	return (
		<Box paddingX={2}>
			<Text dimColor>{"─".repeat(totalWidth)}</Text>
		</Box>
	);
}

function Dashboard({
	initialDetailed,
}: {
	initialDetailed: boolean;
}): React.ReactElement {
	const { exit } = useApp();
	const { stdout } = useStdout();
	const [projects, setProjects] = useState<DashboardProject[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [detailed, setDetailed] = useState(initialDetailed);
	const [termWidth, setTermWidth] = useState(stdout?.columns ?? 80);

	useEffect(() => {
		const onResize = () => {
			if (stdout) setTermWidth(stdout.columns);
		};
		stdout?.on("resize", onResize);
		return () => {
			stdout?.off("resize", onResize);
		};
	}, [stdout]);

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

	const columns = getVisibleColumns(
		detailed ? DETAILED_COLUMNS : SIMPLE_COLUMNS,
		termWidth,
	);

	return (
		<Box flexDirection="column">
			<Box justifyContent="center" paddingY={1}>
				<Text bold color="blue">
					DevBox Dashboard
				</Text>
				{detailed && <Text dimColor> (detailed)</Text>}
			</Box>

			<TableHeader columns={columns} />
			<Separator columns={columns} />

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
				projects.map((p, i) => (
					<TableRow
						key={p.name}
						project={p}
						columns={columns}
						selected={i === selectedIndex}
					/>
				))
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

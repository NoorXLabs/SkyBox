// src/commands/dashboard.tsx

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { getGitInfo } from "@commands/status.ts";
import { getContainerStatus } from "@lib/container.ts";
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
}

async function gatherProjectData(): Promise<DashboardProject[]> {
	const projectsDir = getProjectsDir();
	if (!existsSync(projectsDir)) return [];

	const entries = readdirSync(projectsDir).filter((entry) => {
		const fullPath = join(projectsDir, entry);
		return statSync(fullPath).isDirectory();
	});

	const results: DashboardProject[] = [];

	for (const name of entries) {
		const projectPath = join(projectsDir, name);
		const [containerStatus, syncStatus, gitInfo] = await Promise.all([
			getContainerStatus(projectPath),
			getSyncStatus(name),
			getGitInfo(projectPath),
		]);

		let container = "stopped";
		if (containerStatus === ContainerStatus.Running) container = "running";

		let sync = "none";
		if (syncStatus.exists) sync = syncStatus.paused ? "paused" : "syncing";

		results.push({
			name,
			container,
			sync,
			branch: gitInfo?.branch || "-",
		});
	}

	return results;
}

function Dashboard(): React.ReactElement {
	const { exit } = useApp();
	const [projects, setProjects] = useState<DashboardProject[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedIndex, setSelectedIndex] = useState(0);

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
		if (key.upArrow) {
			setSelectedIndex((i) => Math.max(0, i - 1));
		}
		if (key.downArrow) {
			setSelectedIndex((i) => Math.min(projects.length - 1, i + 1));
		}
	});

	const colName = 24;
	const colContainer = 12;
	const colSync = 11;

	return (
		<Box flexDirection="column">
			<Box justifyContent="center" paddingY={1}>
				<Text bold color="blue">
					DevBox Dashboard
				</Text>
			</Box>

			<Box paddingX={2}>
				<Text dimColor>
					{pad("NAME", colName)}
					{pad("CONTAINER", colContainer)}
					{pad("SYNC", colSync)}
					BRANCH
				</Text>
			</Box>
			<Box paddingX={2}>
				<Text dimColor>{"─".repeat(60)}</Text>
			</Box>

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
					<Box key={p.name} paddingX={2}>
						<Text
							color={containerColor(p.container)}
							inverse={i === selectedIndex}
						>
							{pad(p.name, colName)}
							{pad(p.container, colContainer)}
							{pad(p.sync, colSync)}
							{p.branch}
						</Text>
					</Box>
				))
			)}

			<Box marginTop={1} paddingX={2}>
				<Text dimColor>
					q: quit r: refresh ↑↓: navigate
					{loading ? " (refreshing...)" : ""}
				</Text>
			</Box>
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

export async function dashboardCommand(): Promise<void> {
	const instance = render(<Dashboard />);
	await instance.waitUntilExit();
}

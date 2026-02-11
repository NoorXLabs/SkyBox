// src/commands/dashboard.tsx

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { getDiskUsage, getGitInfo, getLastActive } from "@commands/status.ts";
import { loadConfig } from "@lib/config.ts";
import { CARD_GAP, CARD_WIDTH } from "@lib/constants.ts";
import { getContainerInfo, getContainerStatus } from "@lib/container.ts";
import { getSyncStatus } from "@lib/mutagen.ts";
import { getProjectsDir } from "@lib/paths.ts";
import { formatRelativeTime } from "@lib/relative-time.ts";
import { getMachineName, readSession } from "@lib/session.ts";
import type { CardField, DashboardProject } from "@typedefs/index.ts";
import { ContainerStatus } from "@typedefs/index.ts";
import { Box, render, Text, useApp, useInput, useStdout } from "ink";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

// collect status data for all local projects
const gatherProjectData = async (): Promise<DashboardProject[]> => {
	const projectsDir = getProjectsDir();
	if (!existsSync(projectsDir)) return [];

	const config = loadConfig();
	const currentMachine = getMachineName();

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

		// Determine session status from local .skybox/session.lock
		let sessionStatus = "none";
		const session = readSession(projectPath);
		if (session) {
			if (session.machine === currentMachine) {
				sessionStatus = "active here";
			} else {
				sessionStatus = `active on ${session.machine}`;
			}
		}

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
			lastActive: formatRelativeTime(lastActive, "short"),
			containerName: containerInfo?.name || "-",
			uptime: containerInfo?.status || "-",
			remote: projectConfig?.remote || "-",
			encrypted: !!projectConfig?.encryption,
			sessionStatus,
		});
	}

	return results;
};

// return the compact set of card fields for simple view
const getSimpleFields = (p: DashboardProject): CardField[] => {
	return [
		{
			label: "Container",
			value: p.container,
			color: containerColor(p.container),
		},
		{ label: "Sync", value: p.sync, color: syncColor(p.sync) },
		{
			label: "Session",
			value: p.sessionStatus,
			color: sessionColor(p.sessionStatus),
		},
		{ label: "Branch", value: p.branch },
	];
};

// return the full set of card fields for detailed view
const getDetailedFields = (p: DashboardProject): CardField[] => {
	const gitLabel = p.gitStatus === "dirty" ? "dirty" : "clean";
	const gitExtra =
		p.ahead > 0 || p.behind > 0 ? ` ↑${p.ahead} ↓${p.behind}` : "";

	return [
		{
			label: "Container",
			value: p.container,
			color: containerColor(p.container),
		},
		{ label: "Sync", value: p.sync, color: syncColor(p.sync) },
		{
			label: "Session",
			value: p.sessionStatus,
			color: sessionColor(p.sessionStatus),
		},
		{ label: "Branch", value: p.branch },
		{
			label: "Git",
			value: gitLabel + gitExtra,
			color: p.gitStatus === "dirty" ? "yellow" : "green",
		},
		{ label: "Disk", value: p.diskUsage },
		{ label: "Active", value: p.lastActive },
		{ label: "Remote", value: p.remote },
		{ label: "Container Name", value: p.containerName },
		{ label: "Uptime", value: p.uptime },
		{ label: "Encrypted", value: p.encrypted ? "yes" : "no" },
	];
};

// Ink component that renders a single project as a bordered status card
const ProjectCard = ({
	project,
	fields,
	selected,
	width,
}: {
	project: DashboardProject;
	fields: CardField[];
	selected: boolean;
	width: number;
}): React.ReactElement => {
	const borderColor = selected ? "blue" : "gray";
	const innerWidth = width - 4; // account for border + padding

	return (
		<Box
			borderColor={borderColor}
			borderStyle="round"
			flexDirection="column"
			paddingX={1}
			width={width}
		>
			<Box>
				<Text bold color={containerColor(project.container)}>
					{project.name}
				</Text>
			</Box>
			{fields.map((field) => (
				<Box key={field.label} overflowX="hidden" width={innerWidth}>
					<Text dimColor>{field.label}: </Text>
					<Text color={field.color} wrap="truncate">
						{field.value}
					</Text>
				</Box>
			))}
		</Box>
	);
};

// split an array into chunks of size n
const chunk = <T,>(arr: T[], n: number): T[][] => {
	const result: T[][] = [];
	for (let i = 0; i < arr.length; i += n) {
		result.push(arr.slice(i, i + n));
	}
	return result;
};

// Ink component for the main dashboard with grid layout and auto-refresh
const Dashboard = ({
	initialDetailed,
}: {
	initialDetailed: boolean;
}): React.ReactElement => {
	const { exit } = useApp();
	const { stdout } = useStdout();
	const [projects, setProjects] = useState<DashboardProject[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [detailed, setDetailed] = useState(initialDetailed);
	const [termWidth, setTermWidth] = useState(stdout?.columns ?? 80);

	useEffect(() => {
		// on resize
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

	// Calculate how many cards fit per row
	const cardsPerRow = useMemo(() => {
		// Available width minus outer padding (paddingX={2} = 4 chars)
		const available = termWidth - 4;
		const cols = Math.floor((available + CARD_GAP) / (CARD_WIDTH + CARD_GAP));
		return Math.max(1, cols);
	}, [termWidth]);

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
			setSelectedIndex((i) => Math.max(0, i - cardsPerRow));
		}
		if (key.downArrow) {
			setSelectedIndex((i) => Math.min(projects.length - 1, i + cardsPerRow));
		}
		if (key.leftArrow) {
			setSelectedIndex((i) => Math.max(0, i - 1));
		}
		if (key.rightArrow) {
			setSelectedIndex((i) => Math.min(projects.length - 1, i + 1));
		}
	});

	const rows = chunk(projects, cardsPerRow);

	return (
		<Box flexDirection="column">
			<Box justifyContent="center" paddingY={1}>
				<Text bold color="blue">
					SkyBox Dashboard
				</Text>
				{detailed && <Text dimColor> (detailed)</Text>}
			</Box>

			{loading && projects.length === 0 ? (
				<Box paddingX={2}>
					<Text>Loading...</Text>
				</Box>
			) : projects.length === 0 ? (
				<Box paddingX={2}>
					<Text>
						No projects found. Use &apos;skybox clone&apos; to get started.
					</Text>
				</Box>
			) : (
				rows.map((row, rowIdx) => (
					<Box gap={CARD_GAP} key={row[0]?.name ?? rowIdx} paddingX={2}>
						{row.map((p, colIdx) => {
							const globalIdx = rowIdx * cardsPerRow + colIdx;
							const fields = detailed
								? getDetailedFields(p)
								: getSimpleFields(p);
							return (
								<ProjectCard
									fields={fields}
									key={p.name}
									project={p}
									selected={globalIdx === selectedIndex}
									width={CARD_WIDTH}
								/>
							);
						})}
					</Box>
				))
			)}

			<Box marginTop={1} paddingX={2}>
				<Text dimColor>
					q: quit r: refresh d: {detailed ? "simple" : "detailed"}{" "}
					{cardsPerRow > 1 ? "←→↑↓" : "↑↓"}: navigate
					{loading ? " (refreshing...)" : ""}
				</Text>
			</Box>
		</Box>
	);
};

// map container status to a display color
const containerColor = (status: string): string | undefined => {
	if (status === "running") return "green";
	if (status === "stopped") return "red";
	return undefined;
};

// map sync status to a display color
const syncColor = (status: string): string | undefined => {
	if (status === "syncing") return "green";
	if (status === "paused") return "yellow";
	if (status === "error") return "red";
	return undefined;
};

// map session status to a display color
const sessionColor = (status: string): string | undefined => {
	if (status === "active here") return "green";
	if (status.startsWith("active on ")) return "yellow";
	if (status === "none") return "gray";
	return undefined;
};

// render the Ink-based TUI dashboard with optional detailed mode
export const dashboardCommand = async (options: {
	detailed?: boolean;
}): Promise<void> => {
	const instance = render(
		<Dashboard initialDetailed={options.detailed ?? false} />,
	);
	await instance.waitUntilExit();
};

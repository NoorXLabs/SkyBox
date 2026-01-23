// src/types/index.ts

// SSH types
export interface SSHHost {
	name: string;
	hostname?: string;
	user?: string;
	port?: number;
	identityFile?: string;
}

export interface SSHConfigEntry {
	name: string;
	hostname: string;
	user: string;
	identityFile: string;
	port?: number;
}

export interface RemoteConfig {
	host: string;
	base_path: string;
}

export interface SyncDefaults {
	sync_mode: string;
	ignore: string[];
}

export interface ProjectConfig {
	remote?: string;
	ignore?: string[];
	editor?: string;
}

export interface DevboxConfig {
	remote: RemoteConfig;
	editor: string;
	defaults: SyncDefaults;
	projects: Record<string, ProjectConfig>;
}

export enum ContainerStatus {
	Running = "running",
	Stopped = "stopped",
	NotFound = "not_found",
	Error = "error",
}

export interface ContainerResult {
	success: boolean;
	error?: string;
	containerId?: string;
}

export interface ContainerInfo {
	id: string;
	name: string;
	status: string;
	image: string;
}

export const DEFAULT_IGNORE = [
	".git/index.lock",
	".git/*.lock",
	".git/hooks/*",
	"node_modules",
	"venv",
	".venv",
	"__pycache__",
	"*.pyc",
	".devbox-local",
	"dist",
	"build",
	".next",
	"target",
	"vendor",
];

// Status command types
export interface ProjectSummary {
	name: string;
	container: "running" | "stopped" | "unknown";
	sync: "syncing" | "paused" | "no session" | "error" | "unknown";
	branch: string;
	lock: string;
	lastActive: Date | null;
	size: string;
	path: string;
}

export interface ContainerDetails {
	status: "running" | "stopped" | "unknown";
	image: string;
	uptime: string;
	cpu: string;
	memory: string;
}

export interface SyncDetails {
	status: "syncing" | "paused" | "no session" | "error" | "unknown";
	session: string;
	pending: string;
	lastSync: string;
}

export interface GitDetails {
	branch: string;
	status: "clean" | "dirty";
	ahead: number;
	behind: number;
}

export interface DiskDetails {
	local: string;
	remote: string;
}

export interface DetailedStatus {
	name: string;
	path: string;
	container: ContainerDetails;
	sync: SyncDetails;
	git: GitDetails | null;
	lock: string;
	disk: DiskDetails;
}

// Project types
export interface RemoteProject {
	name: string;
	branch: string;
}

export interface LocalProject {
	name: string;
	branch: string;
	path: string;
}

// Command options types
export interface DownOptions {
	cleanup?: boolean;
	force?: boolean;
	noPrompt?: boolean;
}

export interface UpOptions {
	editor?: boolean;
	attach?: boolean;
	rebuild?: boolean;
	noPrompt?: boolean;
	verbose?: boolean;
}

// Template types
export interface Template {
	id: string;
	name: string;
	description: string;
	config: object;
}

// Sync types
export interface SyncStatus {
	exists: boolean;
	paused: boolean;
	status: string;
}

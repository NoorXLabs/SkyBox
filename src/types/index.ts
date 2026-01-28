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
	templates?: Record<string, string>; // name -> git URL
}

// Multi-remote support types (V2)

// New remote entry type (replaces single RemoteConfig)
export interface RemoteEntry {
	host: string; // SSH host (hostname or IP)
	user?: string; // SSH username (undefined = use SSH config default)
	path: string; // Remote projects directory
	key?: string; // Path to SSH private key (undefined = use SSH config default)
}

// Updated config with remotes map
export interface DevboxConfigV2 {
	editor: string;
	defaults: SyncDefaults;
	remotes: Record<string, RemoteEntry>; // name -> remote
	projects: Record<string, ProjectConfigV2>;
	templates?: Record<string, string>;
}

// Updated project config with remote reference
export interface ProjectConfigV2 {
	remote: string; // Name of the remote this project belongs to
	ignore?: string[];
	editor?: string;
}

export enum ContainerStatus {
	Running = "running",
	Stopped = "stopped",
	NotFound = "not_found",
	Error = "error",
	Unknown = "unknown",
}

/** Valid sync status values */
export type SyncStatusValue = "syncing" | "paused" | "none" | "error";

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

export interface RmOptions {
	force?: boolean;
}

// Template types

/**
 * Devcontainer configuration structure.
 * Based on the devcontainer.json specification.
 */
export interface DevcontainerConfig {
	name?: string;
	image?: string;
	features?: Record<string, unknown>;
	customizations?: {
		vscode?: {
			extensions?: string[];
			settings?: Record<string, unknown>;
		};
	};
	mounts?: string[];
	postCreateCommand?: string;
	postStartCommand?: string;
	workspaceFolder?: string;
	workspaceMount?: string;
}

export interface Template {
	id: string;
	name: string;
	description: string;
	config: DevcontainerConfig;
}

// User-defined project templates (git repos)
export interface UserTemplate {
	name: string;
	url: string;
}

// Built-in template definition
export interface BuiltInTemplate {
	id: string;
	name: string;
	url: string;
}

// Sync types
export interface SyncStatus {
	exists: boolean;
	paused: boolean;
	status: SyncStatusValue;
}

// Shell command types
export interface ShellOptions {
	command?: string;
	force?: boolean;
}

export interface OpenOptions {
	editor?: boolean;
	shell?: boolean;
	noPrompt?: boolean;
}

// Lock types
export interface LockInfo {
	machine: string; // hostname of machine holding lock
	user: string; // username
	timestamp: string; // ISO 8601 datetime
	pid: number; // process ID
}

export type LockStatus =
	| { locked: false }
	| { locked: true; ownedByMe: boolean; info: LockInfo };

// Doctor command types
export type DoctorCheckStatus = "pass" | "warn" | "fail";

export interface DoctorCheckResult {
	name: string;
	status: DoctorCheckStatus;
	message: string;
	fix?: string; // Suggested fix for warn/fail
}

export interface DoctorReport {
	checks: DoctorCheckResult[];
	passed: number;
	warned: number;
	failed: number;
}

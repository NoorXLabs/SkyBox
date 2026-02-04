// src/types/index.ts

// SSH types

/** SSH host entry parsed from ~/.ssh/config */
export interface SSHHost {
	name: string;
	hostname?: string;
	user?: string;
	port?: number;
	identityFile?: string;
}

/** Fully resolved SSH config entry with all required connection fields */
export interface SSHConfigEntry {
	name: string;
	hostname: string;
	user: string;
	identityFile: string;
	port?: number;
}

/** V1 remote server configuration (single remote) */
export interface RemoteConfig {
	host: string;
	base_path: string;
}

/** Default sync configuration: mode and ignore patterns */
export interface SyncDefaults {
	sync_mode: string;
	ignore: string[];
	encryption?: boolean;
	auto_up?: boolean;
}

/** V1 per-project configuration with optional overrides */
export interface ProjectConfig {
	remote?: string;
	ignore?: string[];
	editor?: string;
}

/** V1 DevBox configuration (single remote, deprecated) */
export interface DevboxConfig {
	remote: RemoteConfig;
	editor: string;
	defaults: SyncDefaults;
	projects: Record<string, ProjectConfig>;
	templates?: Record<string, string>; // name -> git URL
}

// Multi-remote support types (V2)

/** Named remote server connection details (V2 multi-remote) */
export interface RemoteEntry {
	host: string; // SSH host (hostname or IP)
	user?: string; // SSH username (undefined = use SSH config default)
	path: string; // Remote projects directory
	key?: string; // Path to SSH private key (undefined = use SSH config default)
}

/** Per-project encryption configuration */
export interface ProjectEncryption {
	enabled: boolean;
	salt?: string;
}

/** V2 DevBox configuration with multiple named remotes */
export interface DevboxConfigV2 {
	editor: string;
	defaults: SyncDefaults;
	remotes: Record<string, RemoteEntry>; // name -> remote
	projects: Record<string, ProjectConfigV2>;
	templates?: Record<string, string>;
	encryption?: ProjectEncryption;
}

/** V2 per-project configuration referencing a named remote */
export interface ProjectConfigV2 {
	remote: string; // Name of the remote this project belongs to
	ignore?: string[];
	editor?: string;
	sync_paths?: string[]; // Selective sync: only sync these subdirectories
	encryption?: ProjectEncryption;
	hooks?: HooksConfig;
	auto_up?: boolean; // Auto-start container when entering project directory
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

// Status command types

/** Summary view of a local project for the list command */
export interface ProjectSummary {
	name: string;
	container: "running" | "stopped" | "unknown";
	sync: "syncing" | "paused" | "no session" | "error" | "unknown";
	branch: string;
	session: string;
	lastActive: Date | null;
	size: string;
	path: string;
}

/** Detailed Docker container status and resource usage */
export interface ContainerDetails {
	status: "running" | "stopped" | "unknown";
	image: string;
	uptime: string;
	cpu: string;
	memory: string;
}

/** Mutagen sync session details and current state */
export interface SyncDetails {
	status: "syncing" | "paused" | "no session" | "error" | "unknown";
	session: string;
	pending: string;
	lastSync: string;
}

/** Git repository status: branch, clean/dirty, ahead/behind */
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
	session: string;
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
	all?: boolean;
}

export interface UpOptions {
	editor?: boolean;
	attach?: boolean;
	rebuild?: boolean;
	noPrompt?: boolean;
	verbose?: boolean;
	all?: boolean;
}

export interface RmOptions {
	force?: boolean;
	remote?: boolean;
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

// User local devcontainer template (stored in ~/.devbox/templates/)
export interface UserLocalTemplate {
	name: string;
	config: DevcontainerConfig;
	valid: boolean;
	error?: string;
}

// Result of the unified template selector
export type TemplateSelection =
	| { source: "builtin"; config: DevcontainerConfig }
	| { source: "user"; config: DevcontainerConfig }
	| { source: "git"; url: string };

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

// Doctor command types
export type DoctorCheckStatus = "pass" | "warn" | "fail";

/** Result of a single doctor diagnostic check */
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

// Hook types

/** Valid lifecycle hook event names */
export type HookEvent = "pre-up" | "post-up" | "pre-down" | "post-down";

/** Single hook definition: a shell command with optional context */
export interface HookEntry {
	command: string;
	context?: "host" | "container"; // default: "host"
}

/** Per-project hooks configuration */
export type HooksConfig = Partial<Record<HookEvent, string | HookEntry[]>>;

// Session types

/**
 * Information stored in a local session file.
 */
export interface SessionInfo {
	machine: string; // hostname of machine holding session
	user: string; // username
	timestamp: string; // ISO 8601 datetime when session was created
	pid: number; // process ID
	expires: string; // ISO 8601 datetime when session expires
}

/**
 * Result of checking for session conflicts.
 */
export interface SessionConflictResult {
	hasConflict: boolean;
	existingSession?: SessionInfo;
}

// Install method types
export type InstallMethod = "homebrew" | "github-release" | "npm" | "source";

// Version update check types
export interface UpdateCheckMetadata {
	lastCheck: string; // ISO 8601 datetime of last check
	latestVersion: string | null; // Latest version found, or null if check failed
	latestStableVersion: string | null; // Latest non-prerelease version
}

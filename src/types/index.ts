// src/types/index.ts

// SSH types

// SSH host entry parsed from ~/.ssh/config
export interface SSHHost {
	name: string;
	hostname?: string;
	user?: string;
	port?: number;
	identityFile?: string;
}

// fully resolved SSH config entry with all required connection fields
export interface SSHConfigEntry {
	name: string;
	hostname: string;
	user: string;
	identityFile: string;
	port?: number;
}

// v1 remote server configuration (single remote)
export interface RemoteConfig {
	host: string;
	base_path: string;
}

// default sync configuration: mode and ignore patterns
export interface SyncDefaults {
	sync_mode: "two-way-resolved" | "two-way-safe" | "one-way-replica";
	ignore: string[];
	encryption?: boolean;
	auto_up?: boolean;
}

// v1 per-project configuration with optional overrides
export interface ProjectConfig {
	remote?: string;
	ignore?: string[];
	editor?: string;
}

// v1 SkyBox configuration (single remote, deprecated)
export interface SkyboxConfig {
	remote: RemoteConfig;
	editor: string;
	defaults: SyncDefaults;
	projects: Record<string, ProjectConfig>;
	templates?: Record<string, string>; // name -> git URL
}

// Multi-remote support types (V2)

// named remote server connection details (V2 multi-remote)
export interface RemoteEntry {
	host: string; // SSH host (hostname or IP)
	user?: string; // SSH username (undefined = use SSH config default)
	path: string; // Remote projects directory
	key?: string; // Path to SSH private key (undefined = use SSH config default)
	useKeychain?: boolean; // macOS only: persist passphrase in Keychain
}

// per-project encryption configuration
export interface ProjectEncryption {
	enabled: boolean;
	salt?: string;
	kdf?: "scrypt";
	kdfParamsVersion?: 1;
}

// v2 SkyBox configuration with multiple named remotes
export interface SkyboxConfigV2 {
	editor: string;
	defaults: SyncDefaults;
	remotes: Record<string, RemoteEntry>; // name -> remote
	projects: Record<string, ProjectConfigV2>;
	templates?: Record<string, string>;
	encryption?: ProjectEncryption;
}

// v2 per-project configuration referencing a named remote
export interface ProjectConfigV2 {
	remote: string; // Name of the remote this project belongs to
	ignore?: string[];
	editor?: string;
	sync_paths?: string[]; // Selective sync: only sync these subdirectories
	encryption?: ProjectEncryption;
	hooks?: HooksConfig;
	auto_up?: boolean; // Auto-start container when entering project directory
}

// possible states of a managed Docker container
export enum ContainerStatus {
	Running = "running",
	Stopped = "stopped",
	NotFound = "not_found",
	Error = "error",
	Unknown = "unknown",
}

// valid sync status values
export type SyncStatusValue = "syncing" | "paused" | "none" | "error";

// subset of container states used in status output.
export type ContainerDisplayStatus = Extract<
	`${ContainerStatus}`,
	"running" | "stopped" | "unknown"
>;

// sync states displayed in status output.
export type SyncDisplayStatus =
	| Exclude<SyncStatusValue, "none">
	| "no session"
	| "unknown";

// outcome of a Docker container operation
export interface ContainerResult {
	success: boolean;
	error?: string;
	containerId?: string;
}

// runtime metadata for a Docker container
export interface ContainerInfo {
	id: string;
	name: string;
	status: ContainerStatus;
	rawStatus: string;
	image: string;
}

// Status command types

// summary view of a local project for the list command
export interface ProjectSummary {
	name: string;
	container: ContainerDisplayStatus;
	sync: SyncDisplayStatus;
	branch: string;
	session: string;
	lastActive: Date | null;
	size: string;
	path: string;
}

// detailed Docker container status and resource usage
export interface ContainerDetails {
	status: ContainerDisplayStatus;
	image: string;
	uptime: string;
	cpu: string;
	memory: string;
}

// Mutagen sync session details and current state
export interface SyncDetails {
	status: SyncDisplayStatus;
	session: string;
	pending: string;
	lastSync: string;
}

// git repository status: branch, clean/dirty, ahead/behind
export interface GitDetails {
	branch: string;
	status: "clean" | "dirty";
	ahead: number;
	behind: number;
}

// local and remote disk usage for a project
export interface DiskDetails {
	local: string;
	remote: string;
}

// full detailed status for the status command output
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

// result of project resolution phase (used by up command).
export interface ResolvedProject {
	project: string;
	projectPath: string;
}

// project found on a remote server
export interface RemoteProject {
	name: string;
	branch: string;
}

// project cloned to the local machine
export interface LocalProject {
	name: string;
	branch: string;
	path: string;
}

// Command options types
// CLI options for the down command
export interface DownOptions {
	cleanup?: boolean;
	force?: boolean;
	noPrompt?: boolean;
	all?: boolean;
}

// CLI options for the up command
export interface UpOptions {
	editor?: boolean;
	attach?: boolean;
	rebuild?: boolean;
	noPrompt?: boolean;
	verbose?: boolean;
	all?: boolean;
}

// CLI options for the rm command
export interface RmOptions {
	force?: boolean;
	remote?: boolean;
}

// Template types

// devcontainer configuration structure.
// based on the devcontainer.json specification.
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

// built-in devcontainer template definition
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

// User local devcontainer template (stored in ~/.skybox/templates/)
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
// current state of a Mutagen sync session
export interface SyncStatus {
	exists: boolean;
	paused: boolean;
	status: SyncStatusValue;
}

// Shell command types
// CLI options for the shell command
export interface ShellOptions {
	command?: string;
	force?: boolean;
}

// CLI options for the open command
export interface OpenOptions {
	editor?: boolean;
	shell?: boolean;
	noPrompt?: boolean;
}

// Ownership types
// project ownership metadata stored in .skybox-owner
export interface OwnershipInfo {
	owner: string; // Local OS username who created the project
	created: string; // ISO 8601 timestamp
	machine: string; // Hostname where project was created
}

// result of ownership check
export type OwnershipStatus =
	| { hasOwner: false }
	| { hasOwner: true; isOwner: boolean; info: OwnershipInfo };

// result of setting ownership
export interface SetOwnershipResult {
	success: boolean;
	error?: string;
}

// Doctor command types
// severity level for a doctor diagnostic check
export type DoctorCheckStatus = "pass" | "warn" | "fail";

// result of a single doctor diagnostic check
export interface DoctorCheckResult {
	name: string;
	status: DoctorCheckStatus;
	message: string;
	fix?: string; // Suggested fix for warn/fail
}

// aggregated results of all doctor diagnostic checks
export interface DoctorReport {
	checks: DoctorCheckResult[];
	passed: number;
	warned: number;
	failed: number;
}

// Hook types

// valid lifecycle hook event names
export type HookEvent = "pre-up" | "post-up" | "pre-down" | "post-down";

// single hook definition: a shell command with optional context
export interface HookEntry {
	command: string;
	context?: "host" | "container"; // default: "host"
}

// per-project hooks configuration
export type HooksConfig = Partial<Record<HookEvent, string | HookEntry[]>>;

// Session types

// information stored in a local session file.
export interface SessionInfo {
	machine: string; // hostname of machine holding session
	user: string; // username
	timestamp: string; // ISO 8601 datetime when session was created
	pid: number; // process ID
	expires: string; // ISO 8601 datetime when session expires
	hash?: string; // HMAC-SHA256 integrity hash (set by SkyBox, verified on read)
}

// result of checking for session conflicts.
export interface SessionConflictResult {
	hasConflict: boolean;
	existingSession?: SessionInfo;
}

// Mutagen types

// normalized platform/arch identifiers used for Mutagen release assets.
export interface MutagenPlatformInfo {
	os: "darwin" | "linux";
	cpu: "arm64" | "amd64";
	filename: string;
}

// Validation types

// result of input validation functions. Discriminated union for type safety.
export type ValidationResult =
	| { valid: true }
	| { valid: false; error: string };

// Install method types
// method used to install SkyBox, determines upgrade command
export type InstallMethod = "homebrew" | "github-release" | "source";

// Version update check types
// cached metadata from the last version update check
export interface UpdateCheckMetadata {
	lastCheck: string; // ISO 8601 datetime of last check
	latestVersion: string | null; // Latest version found, or null if check failed
	latestStableVersion: string | null; // Latest non-prerelease version
}

// Error types

// execa-like errors with commonly inspected process fields.
export interface ExecaLikeError {
	exitCode?: number;
	stderr?: string;
	stdout?: string;
	command?: string;
	message?: string;
}

// Audit types

// audit log entry structure
export interface AuditEntry {
	timestamp: string;
	action: string;
	user: string;
	machine: string;
	details: Record<string, unknown>;
}

// narrow devcontainer config used when reading workspace folder from existing config.
export interface DevcontainerWorkspaceConfig {
	workspaceFolder?: string;
}

// Dashboard types

// project status data collected for the dashboard TUI
export interface DashboardProject {
	name: string;
	container: string;
	sync: string;
	branch: string;
	gitStatus: string;
	ahead: number;
	behind: number;
	diskUsage: string;
	lastActive: string;
	containerName: string;
	uptime: string;
	remote: string;
	encrypted: boolean;
	sessionStatus: string; // "active here", "active on <machine>", or "none"
}

// single field displayed on a dashboard project card
export interface CardField {
	label: string;
	value: string;
	color?: string;
}

/**
 * @file constants.ts
 * @description Single source of truth for ALL constants in the codebase.
 * Every hardcoded value — including single-use ones — lives here.
 * Organized by domain. Large structured data at the bottom.
 */

import type { InstallMethod, Template } from "@typedefs/index.ts";

// ── App & GitHub ──

/** How DevBox was installed. Set at build time via DEVBOX_INSTALL_METHOD env var. */
export const INSTALL_METHOD: InstallMethod =
	(process.env.DEVBOX_INSTALL_METHOD as InstallMethod) || "source";

/** GitHub repo coordinates for update checks. */
export const GITHUB_OWNER = "NoorXLabs";
export const GITHUB_REPO = "DevBox";

/** GitHub API URL for release checks. */
export const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;

/** Exit code when user presses Ctrl+C. */
export const CTRL_C_EXIT_CODE = 130;

/** Valid lifecycle hook event names. */
export const HOOK_EVENTS = [
	"pre-up",
	"post-up",
	"pre-down",
	"post-down",
] as const;

// ── Paths & Directories ──

/** Config filename. */
export const CONFIG_FILENAME = "config.yaml";

/** Directory name for lock files on remote server. */
export const LOCKS_DIR_NAME = ".devbox-locks";

/** Default DevBox home directory name. */
export const DEVBOX_HOME_DIR = ".devbox";

/** Projects subdirectory name. */
export const PROJECTS_DIR_NAME = "Projects";

/** Binary directory name. */
export const BIN_DIR_NAME = "bin";

/** Logs directory name. */
export const LOGS_DIR_NAME = "logs";

/** User templates directory name. */
export const TEMPLATES_DIR_NAME = "templates";

/** File that records the extracted Mutagen version. */
export const MUTAGEN_VERSION_FILE = ".mutagen-version";

/** Update check metadata file. */
export const UPDATE_CHECK_FILE = ".update-check.json";

/** Devcontainer directory name. */
export const DEVCONTAINER_DIR_NAME = ".devcontainer";

/** Devcontainer config filename. */
export const DEVCONTAINER_CONFIG_NAME = "devcontainer.json";

/** Container workspace path prefix. */
export const WORKSPACE_PATH_PREFIX = "/workspaces";

/** Alternative devcontainer config filename (root-level). */
export const DEVCONTAINER_ALT_CONFIG_NAME = ".devcontainer.json";

// ── Docker & Containers ──

/**
 * Docker label key used to identify devcontainers.
 * This label is set automatically by devcontainer-cli when starting a container.
 * The value is the absolute path to the local project folder.
 */
export const DOCKER_LABEL_KEY = "devcontainer.local_folder";

// ── Editors ──

/** Default editor preference. */
export const DEFAULT_EDITOR = "vscode";

/** VS Code remote URI prefix for devcontainers. */
export const VSCODE_REMOTE_URI_PREFIX = "vscode-remote://dev-container+";

// ── Sync & Mutagen ──

/**
 * Pinned Mutagen version for binary downloads.
 * @see https://github.com/mutagen-io/mutagen/releases
 */
export const MUTAGEN_VERSION = "0.18.1";

/** Mutagen binary name. */
export const MUTAGEN_BINARY_NAME = "mutagen";

/** GitHub repository path for Mutagen releases. */
export const MUTAGEN_REPO = "mutagen-io/mutagen";

/** Default sync mode for Mutagen sessions. */
export const DEFAULT_SYNC_MODE = "two-way-resolved";

/** Default file ignore patterns for sync. */
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

// ── Encryption ──

/** Encryption algorithm. */
export const ENCRYPTION_ALGORITHM = "aes-256-gcm";

/** Encryption key length in bytes. */
export const ENCRYPTION_KEY_LENGTH = 32;

/** Initialization vector length in bytes. */
export const ENCRYPTION_IV_LENGTH = 16;

/** Authentication tag length in bytes. */
export const ENCRYPTION_TAG_LENGTH = 16;

/** Argon2 memory cost in KiB (64 MiB). */
export const ARGON2_MEMORY_COST = 65536;

/** Argon2 time cost (iterations). */
export const ARGON2_TIME_COST = 2;

/** Argon2 parallelism factor. */
export const ARGON2_PARALLELISM = 1;

/** Filename for the encryption verification marker inside archives. */
export const ENCRYPTION_CHECK_FILENAME = ".devbox-enc-check";

/** Known content for passphrase verification. */
export const ENCRYPTION_CHECK_CONTENT = "devbox-encryption-verify";

// ── SSH ──

/** Default timeout for SSH operations in milliseconds. */
export const SSH_TIMEOUT_MS = 10_000;

/** SSH config keyword prefixes with their lengths for parsing. */
export const SSH_KEYWORDS = {
	HOST: { prefix: "host ", length: 5 },
	HOSTNAME: { prefix: "hostname ", length: 9 },
	USER: { prefix: "user ", length: 5 },
	PORT: { prefix: "port ", length: 5 },
	IDENTITY_FILE: { prefix: "identityfile ", length: 13 },
} as const;

/** SSH config mount path inside containers. */
export const SSH_CONFIG_MOUNT_PATH = "/var/ssh-config";

/** SSH symlink setup command (runs after container starts). */
export const SSH_SYMLINK_COMMAND = `[ ! -L $HOME/.ssh ] && rm -rf $HOME/.ssh && ln -s ${SSH_CONFIG_MOUNT_PATH} $HOME/.ssh || true`;

// ── Update Check ──

/** Update check cooldown interval in milliseconds (24 hours). */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

// ── Templates (large structured data) ──

/** Common devcontainer features for all templates. */
export const COMMON_FEATURES = {
	"ghcr.io/devcontainers/features/common-utils:2": {
		configureZshAsDefaultShell: true,
	},
	"ghcr.io/devcontainers/features/docker-outside-of-docker:1": {
		moby: false,
	},
	"ghcr.io/devcontainers/features/git:1": {},
};

/** Mounts for SSH passthrough. */
export const COMMON_MOUNTS = [
	`source=$\{localEnv:HOME}/.ssh,target=${SSH_CONFIG_MOUNT_PATH},type=bind,readonly`,
];

/** Common VS Code settings for all templates. */
export const COMMON_VSCODE_SETTINGS = {
	"terminal.integrated.defaultProfile.linux": "zsh",
};

/** Supported editor configurations. */
export const SUPPORTED_EDITORS = [
	{ id: "cursor", name: "Cursor" },
	{ id: "code", name: "VS Code" },
	{ id: "code-insiders", name: "VS Code Insiders" },
	{ id: "other", name: "Other (specify command)" },
] as const;

/** Devcontainer template definitions. */
export const TEMPLATES: Template[] = [
	{
		id: "node",
		name: "Node.js",
		description: "Node.js 20 with npm/yarn + Docker support",
		config: {
			name: "Node.js",
			image: "mcr.microsoft.com/devcontainers/javascript-node:20",
			postCreateCommand: "[ -f package.json ] && npm install || true",
			postStartCommand: SSH_SYMLINK_COMMAND,
			features: COMMON_FEATURES,
			mounts: COMMON_MOUNTS,
			customizations: {
				vscode: {
					extensions: ["dbaeumer.vscode-eslint"],
					settings: COMMON_VSCODE_SETTINGS,
				},
			},
		},
	},
	{
		id: "bun",
		name: "Bun",
		description: "Bun runtime with TypeScript + Docker support",
		config: {
			name: "Bun",
			image: "mcr.microsoft.com/devcontainers/javascript-node:20",
			postCreateCommand:
				"curl -fsSL https://bun.sh/install | bash && [ -f package.json ] && bun install || true",
			postStartCommand: SSH_SYMLINK_COMMAND,
			features: COMMON_FEATURES,
			mounts: COMMON_MOUNTS,
			customizations: {
				vscode: {
					extensions: ["oven.bun-vscode"],
					settings: COMMON_VSCODE_SETTINGS,
				},
			},
		},
	},
	{
		id: "python",
		name: "Python",
		description: "Python 3.12 with pip/venv + Docker support",
		config: {
			name: "Python",
			image: "mcr.microsoft.com/devcontainers/python:3.12",
			postCreateCommand:
				"[ -f requirements.txt ] && pip install -r requirements.txt || true",
			postStartCommand: SSH_SYMLINK_COMMAND,
			features: COMMON_FEATURES,
			mounts: COMMON_MOUNTS,
			customizations: {
				vscode: {
					extensions: ["ms-python.python"],
					settings: COMMON_VSCODE_SETTINGS,
				},
			},
		},
	},
	{
		id: "go",
		name: "Go",
		description: "Go 1.22 + Docker support",
		config: {
			name: "Go",
			image: "mcr.microsoft.com/devcontainers/go:1.22",
			postCreateCommand: "[ -f go.mod ] && go mod download || true",
			postStartCommand: SSH_SYMLINK_COMMAND,
			features: COMMON_FEATURES,
			mounts: COMMON_MOUNTS,
			customizations: {
				vscode: {
					extensions: ["golang.go"],
					settings: COMMON_VSCODE_SETTINGS,
				},
			},
		},
	},
	{
		id: "generic",
		name: "Generic",
		description: "Debian with basic dev tools + Docker support",
		config: {
			name: "Development",
			image: "mcr.microsoft.com/devcontainers/base:debian",
			postStartCommand: SSH_SYMLINK_COMMAND,
			features: COMMON_FEATURES,
			mounts: COMMON_MOUNTS,
			customizations: {
				vscode: {
					extensions: [],
					settings: COMMON_VSCODE_SETTINGS,
				},
			},
		},
	},
];

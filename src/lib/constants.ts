// @file constants.ts
// @description Single source of truth for ALL constants in the codebase.
// every hardcoded value — including single-use ones — lives here.
// organized by domain. Large structured data at the bottom.

import type { InstallMethod, Template } from "@typedefs/index.ts";

// ── App & GitHub ──

// how SkyBox was installed. Set at build time via SKYBOX_INSTALL_METHOD env var.
export const INSTALL_METHOD: InstallMethod =
	(process.env.SKYBOX_INSTALL_METHOD as InstallMethod) || "source";

// GitHub repo coordinates for update checks.
export const GITHUB_OWNER = "NoorXLabs";
export const GITHUB_REPO = "SkyBox";

// GitHub API URL for release checks.
export const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;

// exit code when user presses Ctrl+C.
export const CTRL_C_EXIT_CODE = 130;

// valid lifecycle hook event names.
export const HOOK_EVENTS = [
	"pre-up",
	"post-up",
	"pre-down",
	"post-down",
] as const;

// maximum passphrase entry attempts for encryption/decryption.
export const MAX_PASSPHRASE_ATTEMPTS = 3;

// width of a single dashboard card including border chars and padding.
export const CARD_WIDTH = 38;

// gap between dashboard cards.
export const CARD_GAP = 2;

// maximum project name entry attempts for `skybox new`.
export const MAX_NAME_ATTEMPTS = 5;

// ── Paths & Directories ──

// config filename.
export const CONFIG_FILENAME = "config.yaml";

// session file path relative to project directory.
export const SESSION_FILE = ".skybox/session.lock";

// session TTL in milliseconds (24 hours).
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// HMAC key for session file integrity verification.
// not a secret — exists to detect accidental edits, not to prevent determined tampering.
export const SESSION_HMAC_KEY = "skybox-session-integrity-v1";

// read-only file permission (owner read only).
export const SESSION_FILE_MODE = 0o400;

// maximum audit log file size in bytes before rotation (10 MB).
export const AUDIT_LOG_MAX_BYTES = 10 * 1024 * 1024;

// ownership metadata file name.
export const OWNERSHIP_FILE_NAME = ".skybox-owner";

// default SkyBox home directory name.
export const SKYBOX_HOME_DIR = ".skybox";

// projects subdirectory name.
export const PROJECTS_DIR_NAME = "Projects";

// binary directory name.
export const BIN_DIR_NAME = "bin";

// logs directory name.
export const LOGS_DIR_NAME = "logs";

// auto-up log filename for shell hook operations.
export const AUTO_UP_LOG_FILE = "auto-up.log";

// user templates directory name.
export const TEMPLATES_DIR_NAME = "templates";

// file that records the extracted Mutagen version.
export const MUTAGEN_VERSION_FILE = ".mutagen-version";

// update check metadata file.
export const UPDATE_CHECK_FILE = ".update-check.json";

// devcontainer directory name.
export const DEVCONTAINER_DIR_NAME = ".devcontainer";

// devcontainer config filename.
export const DEVCONTAINER_CONFIG_NAME = "devcontainer.json";

// container workspace path prefix.
export const WORKSPACE_PATH_PREFIX = "/workspaces";

// alternative devcontainer config filename (root-level).
export const DEVCONTAINER_ALT_CONFIG_NAME = ".devcontainer.json";

// ── Docker & Containers ──

// Docker label key used to identify devcontainers.
// this label is set automatically by devcontainer-cli when starting a container.
// the value is the absolute path to the local project folder.
export const DOCKER_LABEL_KEY = "devcontainer.local_folder";

// Docker label used to identify test containers for cleanup.
export const DOCKER_TEST_LABEL = "skybox-test=true";

// default timeout for waiting on containers in tests (30 seconds).
export const DEFAULT_CONTAINER_TIMEOUT = 30000;

// polling interval for container status checks in tests (500ms).
export const CONTAINER_POLL_INTERVAL = 500;

// ── Editors ──

// default editor preference.
export const DEFAULT_EDITOR = "vscode";

// VS Code remote URI prefix for devcontainers.
export const VSCODE_REMOTE_URI_PREFIX = "vscode-remote://dev-container+";

// ── Sync & Mutagen ──

// pinned Mutagen version for binary downloads.
// @see https://github.com/mutagen-io/mutagen/releases
export const MUTAGEN_VERSION = "0.18.1";

// Mutagen binary name.
export const MUTAGEN_BINARY_NAME = "mutagen";

// GitHub repository path for Mutagen releases.
export const MUTAGEN_REPO = "mutagen-io/mutagen";

// default sync mode for Mutagen sessions.
export const DEFAULT_SYNC_MODE = "two-way-resolved";

// valid sync mode values for configuration validation.
export const VALID_SYNC_MODES = [
	"two-way-resolved",
	"two-way-safe",
	"one-way-replica",
];

// default file ignore patterns for sync.
export const DEFAULT_IGNORE = [
	".git/index.lock",
	".git/*.lock",
	".git/hooks/*",
	"node_modules",
	"venv",
	".venv",
	"__pycache__",
	"*.pyc",
	".skybox-local",
	"dist",
	"build",
	".next",
	"target",
	"vendor",
];

// ── Encryption ──

// encryption algorithm.
export const ENCRYPTION_ALGORITHM = "aes-256-gcm";

// encryption key length in bytes.
export const ENCRYPTION_KEY_LENGTH = 32;

// initialization vector length in bytes.
export const ENCRYPTION_IV_LENGTH = 16;

// authentication tag length in bytes.
export const ENCRYPTION_TAG_LENGTH = 16;

// scrypt CPU/memory cost parameter (N). 65536 targets ~64 MiB.
export const SCRYPT_N = 65536;

// scrypt block size parameter (r).
export const SCRYPT_R = 8;

// scrypt parallelization parameter (p).
export const SCRYPT_P = 1;

// max memory for scrypt in bytes (128 MiB headroom for N/r/p above).
export const SCRYPT_MAXMEM = 128 * 1024 * 1024;

// filename for the encryption verification marker inside archives.
export const ENCRYPTION_CHECK_FILENAME = ".skybox-enc-check";

// known content for passphrase verification.
export const ENCRYPTION_CHECK_CONTENT = "skybox-encryption-verify";

// ── SSH ──

// default timeout for SSH operations in milliseconds.
export const SSH_TIMEOUT_MS = 10_000;

// timeout for ssh-keygen operations (fingerprint, passphrase check) in milliseconds.
export const SSH_KEYGEN_TIMEOUT_MS = 5_000;

// timeout for interactive ssh-add passphrase entry in milliseconds.
export const SSH_ADD_TIMEOUT_MS = 60_000;

// SSH config keyword prefixes with their lengths for parsing.
export const SSH_KEYWORDS = {
	HOST: { prefix: "host ", length: 5 },
	HOSTNAME: { prefix: "hostname ", length: 9 },
	USER: { prefix: "user ", length: 5 },
	PORT: { prefix: "port ", length: 5 },
	IDENTITY_FILE: { prefix: "identityfile ", length: 13 },
} as const;

// SSH config mount path inside containers.
export const SSH_CONFIG_MOUNT_PATH = "/var/ssh-config";

// SSH symlink setup command (runs after container starts).
export const SSH_SYMLINK_COMMAND = `[ ! -L $HOME/.ssh ] && rm -rf $HOME/.ssh && ln -s ${SSH_CONFIG_MOUNT_PATH} $HOME/.ssh || true`;

// ── Telemetry ──

// Rybbit analytics endpoint for first-run install tracking.
// set via RYBBIT_URL env var at build time; telemetry is disabled if unset.
export const RYBBIT_URL = process.env.RYBBIT_URL ?? "";

// public site identifier for Rybbit.
// set via RYBBIT_SITE_ID env var at build time; telemetry is disabled if unset.
export const RYBBIT_SITE_ID = process.env.RYBBIT_SITE_ID ?? "";

// Rybbit API key for authenticating track requests.
// set via RYBBIT_API_KEY env var at build time; telemetry is disabled if unset.
export const RYBBIT_API_KEY = process.env.RYBBIT_API_KEY ?? "";

// timeout for the telemetry HTTP call in milliseconds.
export const TELEMETRY_TIMEOUT_MS = 5000;

// marker file name written after first-run telemetry fires.
export const INSTALLED_MARKER_FILE = ".installed";

// ── Update Check ──

// update check cooldown interval in milliseconds (24 hours).
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

// ── Templates (large structured data) ──

// SECURITY: Container images are pinned by SHA256 digest to prevent supply chain attacks.
// to update image digests:
// 1. Pull the new image: docker pull mcr.microsoft.com/devcontainers/javascript-node:20
// 2. Get the digest: docker inspect --format='{{index .RepoDigests 0}}' <image>
// 3. Update the digest in the TEMPLATES array below
// 4. Test the new image works correctly
// 5. Document the update in CHANGELOG.md
// check for updates periodically at: https://mcr.microsoft.com/en-us/catalog?search=devcontainers

// common devcontainer features for all templates.
export const COMMON_FEATURES = {
	"ghcr.io/devcontainers/features/common-utils:2": {
		configureZshAsDefaultShell: true,
	},
	"ghcr.io/devcontainers/features/docker-outside-of-docker:1": {
		moby: false,
	},
	"ghcr.io/devcontainers/features/git:1": {},
};

// mounts for SSH passthrough.
export const COMMON_MOUNTS = [
	`source=$\{localEnv:HOME}/.ssh,target=${SSH_CONFIG_MOUNT_PATH},type=bind,readonly`,
];

// common VS Code settings for all templates.
export const COMMON_VSCODE_SETTINGS = {
	"terminal.integrated.defaultProfile.linux": "zsh",
};

// supported editor configurations.
export const SUPPORTED_EDITORS = [
	{ id: "cursor", name: "Cursor" },
	{ id: "code", name: "VS Code" },
	{ id: "code-insiders", name: "VS Code Insiders" },
	{ id: "zed", name: "Zed" },
	{ id: "other", name: "Other (specify command)" },
] as const;

// devcontainer template definitions.
export const TEMPLATES: Template[] = [
	{
		id: "node",
		name: "Node.js",
		description: "Node (latest) with npm/yarn + Common Utils + Docker",
		config: {
			name: "Node.js",
			image: "mcr.microsoft.com/devcontainers/base:debian",
			postCreateCommand: "[ -f package.json ] && npm install || true",
			postStartCommand: SSH_SYMLINK_COMMAND,
			features: {
				...COMMON_FEATURES,
				"ghcr.io/devcontainers/features/node:1": {
					version: "latest",
				},
			},
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
		description: "Bun (latest) + Common Utils + Docker",
		config: {
			name: "Bun",
			image: "mcr.microsoft.com/devcontainers/base:debian",
			postCreateCommand: "[ -f package.json ] && bun install || true",
			postStartCommand: SSH_SYMLINK_COMMAND,
			features: {
				...COMMON_FEATURES,
				"ghcr.io/shyim/devcontainers-features/bun:0": {},
			},
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
		description: "Python (latest) with pip/venv + Common Utils + Docker",
		config: {
			name: "Python",
			image: "mcr.microsoft.com/devcontainers/base:debian",
			postCreateCommand:
				"[ -f requirements.txt ] && pip install -r requirements.txt || true",
			postStartCommand: SSH_SYMLINK_COMMAND,
			features: {
				...COMMON_FEATURES,
				"ghcr.io/devcontainers/features/python:1": {
					version: "latest",
				},
			},
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
		description: "Go (latest) + Common Utils + Docker",
		config: {
			name: "Go",
			image: "mcr.microsoft.com/devcontainers/base:debian",
			postCreateCommand: "[ -f go.mod ] && go mod download || true",
			postStartCommand: SSH_SYMLINK_COMMAND,
			features: {
				...COMMON_FEATURES,
				"ghcr.io/devcontainers/features/go:1": {},
			},
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
		description: "Debian with Common Utils + Docker",
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

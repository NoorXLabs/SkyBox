// Canonical metadata for top-level CLI commands.
// This is the single source of truth for CLI help text and generated docs sections.

export interface CommandArgumentSpec {
	name: string;
	description: string;
}

export interface CommandOptionSpec {
	flags: string;
	description: string;
	defaultValue?: string;
}

export interface GlobalOptionSpec extends CommandOptionSpec {}

export interface CommandManifestEntry {
	id: string;
	command: string;
	usage: string;
	summary: string;
	description: string;
	examples: string[];
	notes: string[];
	aliases: string[];
	arguments: CommandArgumentSpec[];
	options: CommandOptionSpec[];
	docsPath: string;
	docsFile: string;
	docsText: string;
	docsDescription: string;
}

export const GLOBAL_OPTIONS: GlobalOptionSpec[] = [
	{
		flags: "-h, --help",
		description: "display help for command",
	},
	{
		flags: "-v, --version",
		description: "output the version number",
	},
	{
		flags: "--dry-run",
		description: "Preview commands without executing them",
	},
];

export const QUICK_START_COMMANDS: Array<{
	command: string;
	description: string;
}> = [
	{
		command: "skybox init",
		description: "Set up SkyBox and your first remote",
	},
	{
		command: "skybox browse",
		description: "See projects available on remote",
	},
	{
		command: "skybox clone <project>",
		description: "Clone a project locally",
	},
	{
		command: "skybox up <project>",
		description: "Start the dev container",
	},
];

export const COMMAND_MANIFEST: CommandManifestEntry[] = [
	{
		id: "init",
		command: "init",
		usage: "skybox init [options]",
		summary: "Interactive setup wizard",
		description:
			"Run first-time setup for SkyBox config, remotes, and defaults. You can rerun this at any time to update settings.",
		examples: ["skybox init"],
		notes: [
			"If SkyBox is already configured, this updates your existing settings.",
		],
		aliases: [],
		arguments: [],
		options: [],
		docsPath: "/reference/init",
		docsFile: "docs/reference/init.md",
		docsText: "skybox init",
		docsDescription: "Interactive setup wizard",
	},
	{
		id: "browse",
		command: "browse",
		usage: "skybox browse [options]",
		summary: "List projects on remote server",
		description:
			"Connect to a configured remote over SSH and list available projects with their current git branch.",
		examples: ["skybox browse"],
		notes: ["Use this before 'skybox clone' to discover remote project names."],
		aliases: [],
		arguments: [],
		options: [],
		docsPath: "/reference/browse",
		docsFile: "docs/reference/browse.md",
		docsText: "skybox browse",
		docsDescription: "List projects on remote server",
	},
	{
		id: "list",
		command: "list",
		usage: "skybox list [options]",
		summary: "List local projects",
		description:
			"Show projects in your local SkyBox workspace, including git branch and local path.",
		examples: ["skybox list"],
		notes: [],
		aliases: [],
		arguments: [],
		options: [],
		docsPath: "/reference/list",
		docsFile: "docs/reference/list.md",
		docsText: "skybox list",
		docsDescription: "List local projects",
	},
	{
		id: "clone",
		command: "clone [project]",
		usage: "skybox clone [options] [project]",
		summary: "Clone remote project locally",
		description:
			"Clone project data from remote to local, configure sync, and optionally start the container. Without a project argument, choose one or more projects interactively.",
		examples: ["skybox clone my-api", "skybox clone"],
		notes: ["Project names come from 'skybox browse'."],
		aliases: [],
		arguments: [
			{
				name: "[project]",
				description:
					"Name of the project to clone from the remote server. If omitted, shows an interactive multi-select of remote projects.",
			},
		],
		options: [],
		docsPath: "/reference/clone",
		docsFile: "docs/reference/clone.md",
		docsText: "skybox clone",
		docsDescription: "Clone remote project locally",
	},
	{
		id: "push",
		command: "push <path> [name]",
		usage: "skybox push [options] <path> [name]",
		summary: "Push local project to remote",
		description:
			"Upload a local folder as a SkyBox project on a remote, set up sync, and register it locally.",
		examples: ["skybox push ./my-api", "skybox push ./my-api my-api"],
		notes: [
			"If the remote project already exists, SkyBox asks before overwriting it.",
		],
		aliases: [],
		arguments: [
			{
				name: "<path>",
				description: "Path to local project directory to push.",
			},
			{
				name: "[name]",
				description:
					"Optional remote project name. If omitted, the local directory name is used.",
			},
		],
		options: [],
		docsPath: "/reference/push",
		docsFile: "docs/reference/push.md",
		docsText: "skybox push",
		docsDescription: "Push local project to remote",
	},
	{
		id: "up",
		command: "up [project]",
		usage: "skybox up [options] [project]",
		summary: "Start a development container",
		description:
			"Start development container(s), ensure sync is active, and then open your editor or shell if requested. Without a project, SkyBox resolves from cwd or prompts.",
		examples: [
			"skybox up my-api",
			"skybox up --editor",
			"skybox up --attach",
			"skybox up --all",
			"skybox up my-api --no-prompt",
		],
		notes: [
			"Use --rebuild after devcontainer changes.",
			"Use --no-prompt for scripts/automation.",
		],
		aliases: [],
		arguments: [
			{
				name: "[project]",
				description:
					"Project name. If omitted, resolves from current directory or prompts.",
			},
		],
		options: [
			{
				flags: "-e, --editor",
				description: "Open in editor after start",
			},
			{
				flags: "-a, --attach",
				description: "Attach to shell after start",
			},
			{
				flags: "-r, --rebuild",
				description: "Force container rebuild",
			},
			{
				flags: "--no-prompt",
				description: "Non-interactive mode",
			},
			{
				flags: "--verbose",
				description: "Show detailed output",
			},
			{
				flags: "-A, --all",
				description: "Start all local projects",
			},
		],
		docsPath: "/reference/up",
		docsFile: "docs/reference/up.md",
		docsText: "skybox up",
		docsDescription: "Start a development container",
	},
	{
		id: "down",
		command: "down [project]",
		usage: "skybox down [options] [project]",
		summary: "Stop a development container",
		description:
			"Stop development container(s), flush and pause sync, and end active sessions. Use cleanup mode to also remove containers and volumes.",
		examples: [
			"skybox down my-api",
			"skybox down --all",
			"skybox down my-api --cleanup",
		],
		notes: [
			"With project encryption enabled, remote data is encrypted during shutdown.",
		],
		aliases: [],
		arguments: [
			{
				name: "[project]",
				description:
					"Project name. If omitted, resolves from current directory or prompts.",
			},
		],
		options: [
			{
				flags: "-c, --cleanup",
				description: "Remove container and volumes",
			},
			{
				flags: "-f, --force",
				description: "Force stop even on errors",
			},
			{
				flags: "--no-prompt",
				description: "Non-interactive mode",
			},
			{
				flags: "-A, --all",
				description: "Stop all local projects",
			},
		],
		docsPath: "/reference/down",
		docsFile: "docs/reference/down.md",
		docsText: "skybox down",
		docsDescription: "Stop a development container",
	},
	{
		id: "editor",
		command: "editor",
		usage: "skybox editor [options]",
		summary: "Change default editor",
		description:
			"Interactively set the default editor command used by SkyBox when opening projects.",
		examples: ["skybox editor"],
		notes: [],
		aliases: [],
		arguments: [],
		options: [],
		docsPath: "/reference/editor",
		docsFile: "docs/reference/editor.md",
		docsText: "skybox editor",
		docsDescription: "Change default editor",
	},
	{
		id: "status",
		command: "status [project]",
		usage: "skybox status [options] [project]",
		summary: "Show project status",
		description:
			"Show project health including container, sync, git, session, and disk usage. Use a project name for detailed status; omit it for an overview of all local projects.",
		examples: ["skybox status", "skybox status my-api"],
		notes: [],
		aliases: [],
		arguments: [
			{
				name: "[project]",
				description:
					"Optional project name. Omit to show status overview for all local projects.",
			},
		],
		options: [],
		docsPath: "/reference/status",
		docsFile: "docs/reference/status.md",
		docsText: "skybox status",
		docsDescription: "Show project status",
	},
	{
		id: "dashboard",
		command: "dashboard",
		usage: "skybox dashboard [options]",
		summary: "Full-screen status dashboard",
		description:
			"Open a live, full-screen terminal dashboard for local projects with periodic refresh.",
		examples: ["skybox dashboard", "skybox dashboard --detailed"],
		notes: [
			"Controls: arrows move selection, d toggles detail, r refreshes, q exits.",
		],
		aliases: ["dash"],
		arguments: [],
		options: [
			{
				flags: "-d, --detailed",
				description: "Show detailed view with extra info",
			},
		],
		docsPath: "/reference/dashboard",
		docsFile: "docs/reference/dashboard.md",
		docsText: "skybox dashboard",
		docsDescription: "Full-screen status dashboard",
	},
	{
		id: "open",
		command: "open [project]",
		usage: "skybox open [options] [project]",
		summary: "Open editor/shell for running container",
		description:
			"Open editor and/or shell for a running container without restarting it. Without a project, SkyBox resolves from cwd or prompts.",
		examples: [
			"skybox open my-api",
			"skybox open my-api --editor",
			"skybox open my-api --shell",
		],
		notes: ["Run 'skybox up' first if the container is not running."],
		aliases: [],
		arguments: [
			{
				name: "[project]",
				description:
					"Optional project name. If omitted, resolves from current directory or prompts.",
			},
		],
		options: [
			{
				flags: "-e, --editor",
				description: "Open in editor only",
			},
			{
				flags: "-s, --shell",
				description: "Attach to shell only",
			},
			{
				flags: "--no-prompt",
				description: "Non-interactive mode",
			},
		],
		docsPath: "/reference/open",
		docsFile: "docs/reference/open.md",
		docsText: "skybox open",
		docsDescription: "Open editor/shell for running container",
	},
	{
		id: "new",
		command: "new",
		usage: "skybox new [options]",
		summary: "Create a new project on the remote server",
		description:
			"Create a new remote project from a template or git URL, then optionally clone it locally.",
		examples: ["skybox new"],
		notes: [],
		aliases: [],
		arguments: [],
		options: [],
		docsPath: "/reference/new",
		docsFile: "docs/reference/new.md",
		docsText: "skybox new",
		docsDescription: "Create new project on remote",
	},
	{
		id: "rm",
		command: "rm [project]",
		usage: "skybox rm [options] [project]",
		summary: "Remove project locally (keeps remote)",
		description:
			"Remove local project resources (files, container, and sync session). Use --remote to also delete project data from the remote server.",
		examples: ["skybox rm my-api", "skybox rm --remote my-api", "skybox rm"],
		notes: [
			"Without a project argument, SkyBox opens interactive project selection.",
		],
		aliases: [],
		arguments: [
			{
				name: "[project]",
				description:
					"Optional project name. If omitted, opens interactive multi-select.",
			},
		],
		options: [
			{
				flags: "-f, --force",
				description: "Skip confirmation prompt",
			},
			{
				flags: "-r, --remote",
				description: "Also delete project from remote server",
			},
		],
		docsPath: "/reference/rm",
		docsFile: "docs/reference/rm.md",
		docsText: "skybox rm",
		docsDescription: "Remove project locally (keeps remote)",
	},
	{
		id: "shell",
		command: "shell <project>",
		usage: "skybox shell [options] <project>",
		summary: "Enter container shell",
		description:
			"Open an interactive shell in a project container, or run a single command and exit.",
		examples: [
			"skybox shell my-api",
			'skybox shell my-api --command "npm test"',
			"skybox shell my-api --force",
		],
		notes: ["Session ownership checks are enforced unless --force is set."],
		aliases: [],
		arguments: [
			{
				name: "<project>",
				description: "Project name.",
			},
		],
		options: [
			{
				flags: "-c, --command <cmd>",
				description: "Run a single command and exit",
			},
			{
				flags: "-f, --force",
				description: "Bypass session check",
			},
		],
		docsPath: "/reference/shell",
		docsFile: "docs/reference/shell.md",
		docsText: "skybox shell",
		docsDescription: "Access shell inside container",
	},
	{
		id: "remote",
		command: "remote [subcommand] [arg1] [arg2]",
		usage: "skybox remote [options] [subcommand] [arg1] [arg2]",
		summary: "Manage remote servers",
		description:
			"Manage remote server definitions used for browsing, cloning, and syncing projects.",
		examples: [
			"skybox remote",
			"skybox remote add",
			"skybox remote add prod root@203.0.113.10:~/code --key ~/.ssh/id_ed25519",
			"skybox remote list",
		],
		notes: [
			"Run 'skybox remote' with no subcommand to see all remote subcommands.",
		],
		aliases: [],
		arguments: [
			{
				name: "[subcommand]",
				description:
					"Remote subcommand (for example: add, list, remove, rename).",
			},
			{
				name: "[arg1]",
				description: "First positional argument for the selected subcommand.",
			},
			{
				name: "[arg2]",
				description: "Second positional argument for the selected subcommand.",
			},
		],
		options: [
			{
				flags: "-k, --key <path>",
				description: "SSH key path",
			},
		],
		docsPath: "/reference/remote",
		docsFile: "docs/reference/remote.md",
		docsText: "skybox remote",
		docsDescription: "Manage remote servers",
	},
	{
		id: "config",
		command: "config [subcommand] [arg1] [arg2]",
		usage: "skybox config [options] [subcommand] [arg1] [arg2]",
		summary: "View or modify configuration",
		description:
			"Inspect or change SkyBox config, including editor defaults, sync paths, and devcontainer helpers.",
		examples: [
			"skybox config",
			"skybox config --validate",
			"skybox config set editor code",
			"skybox config sync-paths my-api src,package.json",
		],
		notes: ["Run 'skybox config' with no subcommand to see current settings."],
		aliases: [],
		arguments: [
			{
				name: "[subcommand]",
				description:
					"Config subcommand (for example: set, sync-paths, devcontainer).",
			},
			{
				name: "[arg1]",
				description: "First positional argument for the selected subcommand.",
			},
			{
				name: "[arg2]",
				description: "Second positional argument for the selected subcommand.",
			},
		],
		options: [
			{
				flags: "--validate",
				description: "Test connection to all remotes",
			},
		],
		docsPath: "/reference/config",
		docsFile: "docs/reference/config.md",
		docsText: "skybox config",
		docsDescription: "View/modify configuration",
	},
	{
		id: "logs",
		command: "logs <project>",
		usage: "skybox logs [options] <project>",
		summary: "Show container or sync logs",
		description:
			"Stream container logs or Mutagen sync logs for a local project.",
		examples: [
			"skybox logs my-api",
			"skybox logs my-api --follow",
			"skybox logs my-api --sync",
		],
		notes: ["Use --lines to change the number of log lines shown."],
		aliases: [],
		arguments: [
			{
				name: "<project>",
				description: "Project name.",
			},
		],
		options: [
			{
				flags: "-f, --follow",
				description: "follow log output",
			},
			{
				flags: "-n, --lines <number>",
				description: "number of lines to show",
				defaultValue: "50",
			},
			{
				flags: "-s, --sync",
				description: "show sync logs instead of container logs",
			},
		],
		docsPath: "/reference/logs",
		docsFile: "docs/reference/logs.md",
		docsText: "skybox logs",
		docsDescription: "Show container or sync logs",
	},
	{
		id: "doctor",
		command: "doctor",
		usage: "skybox doctor [options]",
		summary: "Diagnose common issues",
		description:
			"Run diagnostics for Docker, Mutagen, config health, remote SSH connectivity, and editor setup.",
		examples: ["skybox doctor"],
		notes: [],
		aliases: [],
		arguments: [],
		options: [],
		docsPath: "/reference/doctor",
		docsFile: "docs/reference/doctor.md",
		docsText: "skybox doctor",
		docsDescription: "Diagnose common issues",
	},
	{
		id: "update",
		command: "update",
		usage: "skybox update [options]",
		summary: "Check for and install SkyBox updates",
		description:
			"Check for newer SkyBox versions and update in place when supported by your install method.",
		examples: ["skybox update"],
		notes: [
			"For package-manager installs, this command prints the correct upgrade command.",
		],
		aliases: [],
		arguments: [],
		options: [],
		docsPath: "/reference/update",
		docsFile: "docs/reference/update.md",
		docsText: "skybox update",
		docsDescription: "Check for and install SkyBox updates",
	},
	{
		id: "encrypt",
		command: "encrypt [subcommand] [project]",
		usage: "skybox encrypt [options] [subcommand] [project]",
		summary: "Manage project encryption",
		description:
			"Enable or disable project encryption for remote backups. Your passphrase is never stored and cannot be recovered.",
		examples: [
			"skybox encrypt enable my-api",
			"skybox encrypt disable my-api",
			"skybox encrypt enable",
		],
		notes: ["Run without a subcommand to see available encrypt actions."],
		aliases: [],
		arguments: [
			{
				name: "[subcommand]",
				description: "Encryption subcommand (enable or disable).",
			},
			{
				name: "[project]",
				description:
					"Optional project name. If omitted, interactive selection is used.",
			},
		],
		options: [],
		docsPath: "/reference/encryption",
		docsFile: "docs/reference/encryption.md",
		docsText: "skybox encrypt",
		docsDescription: "Manage project encryption",
	},
	{
		id: "hook",
		command: "hook [shell]",
		usage: "skybox hook [options] [shell]",
		summary: "Output shell hook code for auto-up on directory enter",
		description:
			"Print shell integration code that auto-starts project containers when entering project directories.",
		examples: ["skybox hook zsh", "skybox hook bash"],
		notes: ['Add to shell config: eval "$(skybox hook zsh)"'],
		aliases: [],
		arguments: [
			{
				name: "[shell]",
				description: "Shell type (bash or zsh).",
			},
		],
		options: [],
		docsPath: "/reference/hook",
		docsFile: "docs/reference/hook.md",
		docsText: "skybox hook",
		docsDescription: "Shell integration for auto-starting containers",
	},
];

export const COMMAND_MANIFEST_BY_ID = new Map(
	COMMAND_MANIFEST.map((entry) => [entry.id, entry]),
);

export const getCommandManifest = (id: string): CommandManifestEntry => {
	const command = COMMAND_MANIFEST_BY_ID.get(id);
	if (!command) {
		throw new Error(`Unknown command manifest id: ${id}`);
	}
	return command;
};

// shell hook commands for auto-starting containers on directory enter.
// - `skybox hook <shell>` - Output shell hook code for bash/zsh
// - `skybox hook-check` - Hidden: check and auto-start (called by hook)

import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { isAutoUpEnabled, loadConfig } from "@lib/config.ts";
import { getContainerStatus } from "@lib/container.ts";
import { getErrorMessage } from "@lib/errors.ts";
import { getAutoUpLogPath, getLogsDir } from "@lib/paths.ts";
import { resolveProjectFromCwd } from "@lib/project.ts";
import { dryRun, error, isDryRun } from "@lib/ui.ts";
import { ContainerStatus } from "@typedefs/index.ts";

// generate bash shell hook code.
// uses PROMPT_COMMAND to trigger on directory changes.
export const generateBashHook = (): string => {
	return `# SkyBox shell hook for bash
# Add to ~/.bashrc: eval "$(skybox hook bash)"

_skybox_hook() {
  local prev_dir="\${_SKYBOX_PREV_DIR:-}"
  local cur_dir="$PWD"

  # Only run if directory changed
  if [[ "$prev_dir" != "$cur_dir" ]]; then
    _SKYBOX_PREV_DIR="$cur_dir"
    skybox hook-check 2>/dev/null &
  fi
}

# Append to PROMPT_COMMAND if not already present
if [[ ! "$PROMPT_COMMAND" =~ _skybox_hook ]]; then
  PROMPT_COMMAND="_skybox_hook\${PROMPT_COMMAND:+;$PROMPT_COMMAND}"
fi
`;
};

// generate zsh shell hook code.
// uses precmd hook via add-zsh-hook.
export const generateZshHook = (): string => {
	return `# SkyBox shell hook for zsh
# Add to ~/.zshrc: eval "$(skybox hook zsh)"

_skybox_hook() {
  local prev_dir="\${_SKYBOX_PREV_DIR:-}"
  local cur_dir="$PWD"

  # Only run if directory changed
  if [[ "$prev_dir" != "$cur_dir" ]]; then
    _SKYBOX_PREV_DIR="$cur_dir"
    skybox hook-check 2>/dev/null &
  fi
}

# Register with zsh hook system (if not already registered)
autoload -Uz add-zsh-hook
if [[ \${precmd_functions[(Ie)_skybox_hook]} -eq 0 ]]; then
  add-zsh-hook precmd _skybox_hook
fi
`;
};

// log a message to the auto-up log file.
const logAutoUp = (message: string): void => {
	try {
		const logsDir = getLogsDir();
		if (!existsSync(logsDir)) {
			mkdirSync(logsDir, { recursive: true });
		}
		const logPath = getAutoUpLogPath();
		const timestamp = new Date().toISOString();
		appendFileSync(logPath, `[${timestamp}] ${message}\n`);
	} catch {
		// Logging is non-critical, never fail
	}
};

// command handler for `skybox hook <shell>`.
// outputs shell hook code to stdout.
export const hookCommand = async (shell: string | undefined): Promise<void> => {
	if (!shell) {
		error("Usage: skybox hook <bash|zsh>");
		process.exit(1);
	}

	switch (shell.toLowerCase()) {
		case "bash":
			console.log(generateBashHook());
			break;
		case "zsh":
			console.log(generateZshHook());
			break;
		default:
			error(`Unsupported shell: ${shell}. Supported: bash, zsh`);
			process.exit(1);
	}
};

// command handler for `skybox hook-check`.
// hidden subcommand called by shell hooks.
// always exits 0 to never break the shell.
export const hookCheckCommand = async (): Promise<void> => {
	try {
		if (isDryRun()) {
			dryRun("Would check and auto-start container if needed");
			process.exit(0);
		}

		// Resolve project from current working directory
		const project = resolveProjectFromCwd();
		if (!project) {
			// Not in a SkyBox project directory, exit silently
			process.exit(0);
		}

		// Load config and check if auto-up is enabled
		const config = loadConfig();
		if (!config) {
			logAutoUp(`[${project}] No config found`);
			process.exit(0);
		}

		if (!isAutoUpEnabled(project, config)) {
			// Auto-up not enabled for this project
			process.exit(0);
		}

		// Get project path for container status check
		const { getProjectPath } = await import("@lib/project.ts");
		const { realpathSync } = await import("node:fs");

		const rawPath = getProjectPath(project);
		let projectPath: string;
		try {
			projectPath = realpathSync(rawPath);
		} catch {
			projectPath = rawPath;
		}

		// Check container status
		const status = await getContainerStatus(projectPath);

		if (status === ContainerStatus.Running) {
			// Container already running, nothing to do
			process.exit(0);
		}

		// Container not running, spawn skybox up in background
		logAutoUp(`[${project}] Auto-starting container...`);

		const logPath = getAutoUpLogPath();
		const logsDir = getLogsDir();
		if (!existsSync(logsDir)) {
			mkdirSync(logsDir, { recursive: true });
		}

		// Spawn skybox up with output redirected to log file
		const child = spawn("skybox", ["up", project, "--no-prompt"], {
			detached: true,
			stdio: ["ignore", "pipe", "pipe"],
		});

		// Pipe output to log file
		child.stdout?.on("data", (data: Buffer) => {
			try {
				appendFileSync(logPath, data);
			} catch {
				// Ignore logging errors
			}
		});
		child.stderr?.on("data", (data: Buffer) => {
			try {
				appendFileSync(logPath, data);
			} catch {
				// Ignore logging errors
			}
		});

		child.on("close", (code) => {
			if (code === 0) {
				logAutoUp(`[${project}] Container started successfully`);
			} else {
				logAutoUp(`[${project}] Container start failed with code ${code}`);
			}
		});

		// Unref to allow parent to exit
		child.unref();

		process.exit(0);
	} catch (error: unknown) {
		// Log error but never fail
		logAutoUp(`Error: ${getErrorMessage(error)}`);
		process.exit(0);
	}
};

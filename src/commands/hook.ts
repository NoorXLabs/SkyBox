/**
 * Shell hook commands for auto-starting containers on directory enter.
 *
 * - `devbox hook <shell>` - Output shell hook code for bash/zsh
 * - `devbox hook-check` - Hidden: check and auto-start (called by hook)
 */

import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { isAutoUpEnabled, loadConfig } from "@lib/config.ts";
import { getContainerStatus } from "@lib/container.ts";
import { getAutoUpLogPath, getLogsDir } from "@lib/paths.ts";
import { resolveProjectFromCwd } from "@lib/project.ts";
import { error } from "@lib/ui.ts";
import { ContainerStatus } from "@typedefs/index.ts";

/**
 * Generate bash shell hook code.
 * Uses PROMPT_COMMAND to trigger on directory changes.
 */
export function generateBashHook(): string {
	return `# DevBox shell hook for bash
# Add to ~/.bashrc: eval "$(devbox hook bash)"

_devbox_hook() {
  local prev_dir="\${_DEVBOX_PREV_DIR:-}"
  local cur_dir="$PWD"

  # Only run if directory changed
  if [[ "$prev_dir" != "$cur_dir" ]]; then
    _DEVBOX_PREV_DIR="$cur_dir"
    devbox hook-check 2>/dev/null &
  fi
}

# Append to PROMPT_COMMAND if not already present
if [[ ! "$PROMPT_COMMAND" =~ _devbox_hook ]]; then
  PROMPT_COMMAND="_devbox_hook\${PROMPT_COMMAND:+;$PROMPT_COMMAND}"
fi
`;
}

/**
 * Generate zsh shell hook code.
 * Uses precmd hook via add-zsh-hook.
 */
export function generateZshHook(): string {
	return `# DevBox shell hook for zsh
# Add to ~/.zshrc: eval "$(devbox hook zsh)"

_devbox_hook() {
  local prev_dir="\${_DEVBOX_PREV_DIR:-}"
  local cur_dir="$PWD"

  # Only run if directory changed
  if [[ "$prev_dir" != "$cur_dir" ]]; then
    _DEVBOX_PREV_DIR="$cur_dir"
    devbox hook-check 2>/dev/null &
  fi
}

# Register with zsh hook system (if not already registered)
autoload -Uz add-zsh-hook
if [[ \${precmd_functions[(Ie)_devbox_hook]} -eq 0 ]]; then
  add-zsh-hook precmd _devbox_hook
fi
`;
}

/**
 * Log a message to the auto-up log file.
 */
function logAutoUp(message: string): void {
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
}

/**
 * Command handler for `devbox hook <shell>`.
 * Outputs shell hook code to stdout.
 */
export async function hookCommand(shell: string | undefined): Promise<void> {
	if (!shell) {
		error("Usage: devbox hook <bash|zsh>");
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
}

/**
 * Command handler for `devbox hook-check`.
 * Hidden subcommand called by shell hooks.
 * Always exits 0 to never break the shell.
 */
export async function hookCheckCommand(): Promise<void> {
	try {
		// Resolve project from current working directory
		const project = resolveProjectFromCwd();
		if (!project) {
			// Not in a DevBox project directory, exit silently
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

		// Container not running, spawn devbox up in background
		logAutoUp(`[${project}] Auto-starting container...`);

		const logPath = getAutoUpLogPath();
		const logsDir = getLogsDir();
		if (!existsSync(logsDir)) {
			mkdirSync(logsDir, { recursive: true });
		}

		// Spawn devbox up with output redirected to log file
		const child = spawn("devbox", ["up", project, "--no-prompt"], {
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
	} catch (err) {
		// Log error but never fail
		const message = err instanceof Error ? err.message : String(err);
		logAutoUp(`Error: ${message}`);
		process.exit(0);
	}
}

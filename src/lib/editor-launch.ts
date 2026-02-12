import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { getErrorMessage } from "@lib/errors.ts";
import { execa, parseCommandString } from "execa";

export interface ParsedEditorCommand {
	command: string;
	args: string[];
}

export interface EditorLaunchResult {
	success: boolean;
	error?: string;
	usedFallback?: boolean;
	fallbackApp?: string;
}

export interface EditorAvailability {
	status: "available" | "fallback" | "missing" | "invalid";
	command?: string;
	fallbackApp?: string;
	error?: string;
}

interface CommandRunResult {
	exitCode?: number;
	stdout?: string;
	stderr?: string;
}

type CommandRunner = (
	command: string,
	args: string[],
	options?: {
		stdio?: "inherit" | "pipe";
		reject?: boolean;
		timeout?: number;
	},
) => Promise<CommandRunResult>;

interface LaunchOptions {
	inheritStdio?: boolean;
	runner?: CommandRunner;
	platform?: NodeJS.Platform;
	isAppInstalled?: (appName: string) => boolean;
}

interface AvailabilityOptions {
	runner?: CommandRunner;
	platform?: NodeJS.Platform;
	isAppInstalled?: (appName: string) => boolean;
}

const MAC_EDITOR_APP_MAP: Record<string, string> = {
	cursor: "Cursor",
	code: "Visual Studio Code",
	"code-insiders": "Visual Studio Code - Insiders",
	zed: "Zed",
};

const URI_CAPABLE_EDITORS = new Set(["cursor", "code", "code-insiders"]);

const stripWrappingQuotes = (token: string): string => {
	if (token.length < 2) return token;
	const first = token[0];
	const last = token[token.length - 1];
	if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
		return token.slice(1, -1);
	}
	return token;
};

const normalizeCommandId = (command: string): string => {
	return basename(command).toLowerCase();
};

const getMacFallbackApp = (
	command: string,
	platform: NodeJS.Platform,
): string | null => {
	if (platform !== "darwin") return null;
	const commandId = normalizeCommandId(command);
	return MAC_EDITOR_APP_MAP[commandId] ?? null;
};

const isMacAppInstalled = (appName: string): boolean => {
	const appBundleName = `${appName}.app`;
	return (
		existsSync(join("/Applications", appBundleName)) ||
		existsSync(join(homedir(), "Applications", appBundleName))
	);
};

const isCommandNotFoundError = (error: unknown): boolean => {
	if (!error || typeof error !== "object") return false;

	const unknownError = error as {
		code?: unknown;
		cause?: { code?: unknown };
		message?: unknown;
	};

	if (unknownError.code === "ENOENT") return true;
	if (unknownError.cause?.code === "ENOENT") return true;

	if (typeof unknownError.message === "string") {
		const message = unknownError.message.toLowerCase();
		return message.includes("enoent") || message.includes("command not found");
	}

	return false;
};

const defaultRunner: CommandRunner = async (command, args, options) => {
	const result = await execa(command, args, options);
	return {
		exitCode: result.exitCode,
		stdout: result.stdout,
		stderr: result.stderr,
	};
};

const tryLaunch = async (
	parsed: ParsedEditorCommand,
	targetArgs: string[],
	options?: LaunchOptions,
): Promise<void> => {
	const runner = options?.runner ?? defaultRunner;
	const stdio = options?.inheritStdio ? "inherit" : "pipe";
	await runner(parsed.command, [...parsed.args, ...targetArgs], { stdio });
};

const buildMissingEditorError = (
	editor: string,
	fallbackApp: string | null,
): string => {
	if (fallbackApp) {
		return `Editor command '${editor}' was not found. Install its CLI command or set 'skybox config set editor "open -a ${fallbackApp}"'.`;
	}

	return `Editor command '${editor}' was not found. Set a valid editor with 'skybox editor' or 'skybox config set editor <command>'.`;
};

export const parseEditorCommand = (editor: string): ParsedEditorCommand => {
	const trimmed = editor.trim();
	if (!trimmed) {
		throw new Error(
			"Editor command is empty. Set a valid editor like 'zed' or 'open -a Zed'.",
		);
	}

	const tokens = parseCommandString(trimmed).map(stripWrappingQuotes);
	const [command, ...args] = tokens;
	if (!command) {
		throw new Error(
			"Editor command is empty. Set a valid editor like 'zed' or 'open -a Zed'.",
		);
	}

	return { command, args };
};

export const isUriCapableEditor = (command: string): boolean => {
	const commandId = normalizeCommandId(command);
	return URI_CAPABLE_EDITORS.has(commandId);
};

const launchWithFallback = async (
	editor: string,
	parsed: ParsedEditorCommand,
	targetArgs: string[],
	fallbackTargetArgs: string[],
	options?: LaunchOptions,
): Promise<EditorLaunchResult> => {
	const platform = options?.platform ?? process.platform;
	const appInstalled = options?.isAppInstalled ?? isMacAppInstalled;

	try {
		await tryLaunch(parsed, targetArgs, options);
		return { success: true };
	} catch (error: unknown) {
		const fallbackApp = getMacFallbackApp(parsed.command, platform);
		if (isCommandNotFoundError(error) && fallbackApp) {
			if (!appInstalled(fallbackApp)) {
				return {
					success: false,
					error: buildMissingEditorError(editor, fallbackApp),
				};
			}

			try {
				const runner = options?.runner ?? defaultRunner;
				await runner("open", ["-a", fallbackApp, ...fallbackTargetArgs], {
					stdio: options?.inheritStdio ? "inherit" : "pipe",
				});
				return { success: true, usedFallback: true, fallbackApp };
			} catch (fallbackError: unknown) {
				return {
					success: false,
					error: `Failed to launch ${fallbackApp} via macOS fallback: ${getErrorMessage(fallbackError)}`,
				};
			}
		}

		if (isCommandNotFoundError(error)) {
			return {
				success: false,
				error: buildMissingEditorError(editor, fallbackApp),
			};
		}

		return { success: false, error: getErrorMessage(error) };
	}
};

export const launchProjectInEditor = async (
	editor: string,
	projectPath: string,
	devcontainerUri: string,
	options?: LaunchOptions,
): Promise<EditorLaunchResult> => {
	let parsed: ParsedEditorCommand;
	try {
		parsed = parseEditorCommand(editor);
	} catch (error: unknown) {
		return { success: false, error: getErrorMessage(error) };
	}

	const useUri = isUriCapableEditor(parsed.command);
	const targetArgs = useUri ? ["--folder-uri", devcontainerUri] : [projectPath];
	const fallbackTargetArgs = useUri
		? ["--args", "--folder-uri", devcontainerUri]
		: [projectPath];

	return launchWithFallback(
		editor,
		parsed,
		targetArgs,
		fallbackTargetArgs,
		options,
	);
};

export const launchFileInEditor = async (
	editor: string,
	filePath: string,
	options?: LaunchOptions,
): Promise<EditorLaunchResult> => {
	let parsed: ParsedEditorCommand;
	try {
		parsed = parseEditorCommand(editor);
	} catch (error: unknown) {
		return { success: false, error: getErrorMessage(error) };
	}

	return launchWithFallback(editor, parsed, [filePath], [filePath], options);
};

const commandExists = async (
	command: string,
	runner: CommandRunner,
): Promise<boolean> => {
	if (command.includes("/")) {
		return existsSync(command);
	}

	try {
		const result = await runner("which", [command], {
			reject: false,
			timeout: 2000,
		});
		return result.exitCode === 0;
	} catch {
		return false;
	}
};

export const checkEditorAvailability = async (
	editor: string,
	options?: AvailabilityOptions,
): Promise<EditorAvailability> => {
	let parsed: ParsedEditorCommand;
	try {
		parsed = parseEditorCommand(editor);
	} catch (error: unknown) {
		return { status: "invalid", error: getErrorMessage(error) };
	}

	const runner = options?.runner ?? defaultRunner;
	const platform = options?.platform ?? process.platform;
	const appInstalled = options?.isAppInstalled ?? isMacAppInstalled;

	if (await commandExists(parsed.command, runner)) {
		return { status: "available", command: parsed.command };
	}

	const fallbackApp = getMacFallbackApp(parsed.command, platform);
	if (fallbackApp && appInstalled(fallbackApp)) {
		return {
			status: "fallback",
			command: parsed.command,
			fallbackApp,
		};
	}

	return {
		status: "missing",
		command: parsed.command,
		fallbackApp: fallbackApp ?? undefined,
	};
};

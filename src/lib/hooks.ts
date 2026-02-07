import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getErrorMessage } from "@lib/errors.ts";
import { info, warn } from "@lib/ui.ts";
import type { HookEntry, HookEvent, HooksConfig } from "@typedefs/index.ts";

const execFileAsync = promisify(execFile);

/** Track whether the hook security warning has been shown this session. */
const hookState = { warningShown: false };

interface HookResult {
	success: boolean;
	errors: string[];
}

/**
 * Normalize a hook config value (string or HookEntry[]) into HookEntry[].
 */
const normalizeHookEntries = (
	value: string | HookEntry[] | undefined,
): HookEntry[] => {
	if (!value) return [];
	if (typeof value === "string") {
		return [{ command: value, context: "host" }];
	}
	return value.map((entry) => ({
		command: entry.command,
		context: entry.context ?? "host",
	}));
};

/**
 * Run all hooks for a given lifecycle event.
 * Hooks are non-fatal: failures are reported but do not stop the parent operation.
 *
 * SECURITY NOTE: Hook commands execute with full shell access.
 * Users are responsible for securing their hook configurations.
 * Hooks should only be defined in trusted config files.
 */
export const runHooks = async (
	event: HookEvent,
	hooks: HooksConfig | undefined,
	cwd: string,
): Promise<HookResult> => {
	if (!hooks) return { success: true, errors: [] };

	const entries = normalizeHookEntries(hooks[event]);
	if (entries.length === 0) return { success: true, errors: [] };

	info(`Running ${event} hooks...`);

	// Show one-time security warning (can be disabled with env var)
	if (!hookState.warningShown && process.env.SKYBOX_HOOK_WARNINGS !== "0") {
		warn("Executing user-defined hooks (see skybox docs for security info)");
		hookState.warningShown = true;
	}

	const errors: string[] = [];

	for (const entry of entries) {
		try {
			if (entry.context === "container") {
				warn(
					`Container-context hooks not yet supported, skipping: ${entry.command}`,
				);
				continue;
			}
			await execFileAsync("sh", ["-c", entry.command], { cwd });
		} catch (err) {
			const msg = `Hook failed (${event}): ${getErrorMessage(err)}`;
			warn(msg);
			errors.push(msg);
		}
	}

	return { success: errors.length === 0, errors };
};

/**
 * Reset hook warning state (for testing purposes).
 * @internal
 */
export const resetHookWarningState = (): void => {
	hookState.warningShown = false;
};

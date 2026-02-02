import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getErrorMessage } from "@lib/errors.ts";
import { info, warn } from "@lib/ui.ts";
import type { HookEntry, HookEvent, HooksConfig } from "@typedefs/index.ts";

const execFileAsync = promisify(execFile);

interface HookResult {
	success: boolean;
	errors: string[];
}

/**
 * Normalize a hook config value (string or HookEntry[]) into HookEntry[].
 */
function normalizeHookEntries(
	value: string | HookEntry[] | undefined,
): HookEntry[] {
	if (!value) return [];
	if (typeof value === "string") {
		return [{ command: value, context: "host" }];
	}
	return value.map((entry) => ({
		command: entry.command,
		context: entry.context ?? "host",
	}));
}

/**
 * Run all hooks for a given lifecycle event.
 * Hooks are non-fatal: failures are reported but do not stop the parent operation.
 */
export async function runHooks(
	event: HookEvent,
	hooks: HooksConfig | undefined,
	cwd: string,
): Promise<HookResult> {
	if (!hooks) return { success: true, errors: [] };

	const entries = normalizeHookEntries(hooks[event]);
	if (entries.length === 0) return { success: true, errors: [] };

	info(`Running ${event} hooks...`);
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
}

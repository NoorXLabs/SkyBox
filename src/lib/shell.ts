// src/lib/shell.ts
/**
 * @file shell.ts
 * @description Utilities for safe shell command construction.
 */

/**
 * Escapes a string for safe use as a shell argument.
 * Uses single quotes and escapes embedded single quotes.
 *
 * The technique wraps the string in single quotes, which prevents
 * shell interpretation of special characters like $, `, \, etc.
 * Single quotes within the string are handled by ending the single-quoted
 * section, adding an escaped single quote, and starting a new section.
 *
 * Example: "it's" becomes "'it'\\''s'"
 * - 'it' - first quoted section
 * - \\' - escaped single quote (outside quotes)
 * - 's' - second quoted section
 */
export function escapeShellArg(arg: string): string {
	return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * Builds a shell command string with safely escaped arguments.
 */
export function buildShellCommand(command: string, args: string[]): string {
	if (args.length === 0) return command;
	return `${command} ${args.map(escapeShellArg).join(" ")}`;
}

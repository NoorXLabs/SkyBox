// shell escaping utilities for safe command construction.

// escapes a string for safe use as a shell argument.
// uses single quotes and escapes embedded single quotes.
// the technique wraps the string in single quotes, which prevents
// shell interpretation of special characters like $, `, \, etc.
// single quotes within the string are handled by ending the single-quoted
// section, adding an escaped single quote, and starting a new section.
// example: "it's" becomes "'it'\\''s'"
// - 'it' - first quoted section
// - \\' - escaped single quote (outside quotes)
// - 's' - second quoted section
export const escapeShellArg = (arg: string): string => {
	return `'${arg.replace(/'/g, "'\\''")}'`;
};

// escape a remote path for use in SSH commands, preserving tilde expansion.
// paths starting with ~/ are split: the ~ is left unquoted for shell expansion,
// and the rest is properly escaped.
export const escapeRemotePath = (path: string): string => {
	// Only ~/... triggers tilde expansion. ~user/... is intentionally single-quoted
	// (no expansion for other users' home directories).
	if (path === "~") {
		return "~";
	}
	if (path.startsWith("~/")) {
		return `~/${escapeShellArg(path.slice(2))}`;
	}
	return escapeShellArg(path);
};

// builds a shell command string with safely escaped arguments.
export const buildShellCommand = (command: string, args: string[]): string => {
	if (args.length === 0) return command;
	return `${command} ${args.map(escapeShellArg).join(" ")}`;
};

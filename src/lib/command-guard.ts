import { error, info } from "@lib/ui.ts";

// exit with error
export function exitWithError(message: string, code = 1): never {
	error(message);
	process.exit(code);
}

// exit with error and info
export function exitWithErrorAndInfo(
	errorMessage: string,
	infoMessage: string,
	code = 1,
): never {
	error(errorMessage);
	info(infoMessage);
	process.exit(code);
}

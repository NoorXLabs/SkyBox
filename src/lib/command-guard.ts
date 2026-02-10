import { requireConfig } from "@lib/config.ts";
import { error, info } from "@lib/ui.ts";
import type { SkyboxConfigV2 } from "@typedefs/index.ts";

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

// require loaded config or exit
export const requireLoadedConfigOrExit = (): SkyboxConfigV2 => {
	return requireConfig();
};

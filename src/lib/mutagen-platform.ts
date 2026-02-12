import type { MutagenPlatformInfo } from "@typedefs/index.ts";

// normalize platform/arch into mutagen release naming components.
export const getMutagenPlatformInfo = (
	platform: string,
	arch: string,
	version: string,
): MutagenPlatformInfo => {
	const os = platform === "darwin" ? "darwin" : "linux";
	const cpu = arch === "arm64" ? "arm64" : "amd64";
	return {
		os,
		cpu,
		filename: `mutagen_${os}_${cpu}_v${version}.tar.gz`,
	};
};

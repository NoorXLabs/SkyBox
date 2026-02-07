import type { GitDetails } from "@typedefs/index.ts";
import { execa } from "execa";

export const getGitBranch = async (projectPath: string): Promise<string> => {
	try {
		const result = await execa("git", [
			"-C",
			projectPath,
			"branch",
			"--show-current",
		]);
		return result.stdout.trim() || "-";
	} catch {
		return "-";
	}
};

export const getGitInfo = async (
	projectPath: string,
): Promise<GitDetails | null> => {
	try {
		await execa("git", ["-C", projectPath, "rev-parse", "--git-dir"]);
	} catch {
		return null;
	}

	try {
		const branchResult = await execa("git", [
			"-C",
			projectPath,
			"rev-parse",
			"--abbrev-ref",
			"HEAD",
		]);
		const branch = branchResult.stdout.trim() || "HEAD";

		const statusResult = await execa("git", [
			"-C",
			projectPath,
			"status",
			"--porcelain",
		]);
		const status = statusResult.stdout.trim() ? "dirty" : "clean";

		let ahead = 0;
		let behind = 0;
		try {
			const countResult = await execa("git", [
				"-C",
				projectPath,
				"rev-list",
				"--left-right",
				"--count",
				"@{upstream}...HEAD",
			]);
			const [behindStr, aheadStr] = countResult.stdout.trim().split(/\s+/);
			behind = parseInt(behindStr, 10) || 0;
			ahead = parseInt(aheadStr, 10) || 0;
		} catch {
			// No upstream configured.
		}

		return { branch, status: status as "clean" | "dirty", ahead, behind };
	} catch {
		return null;
	}
};

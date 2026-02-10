import { describe, expect, test } from "bun:test";
import {
	checkEditorAvailability,
	isUriCapableEditor,
	launchFileInEditor,
	launchProjectInEditor,
	parseEditorCommand,
} from "@lib/editor-launch.ts";

interface RunnerCall {
	command: string;
	args: string[];
	options?: {
		stdio?: "inherit" | "pipe";
		reject?: boolean;
		timeout?: number;
	};
}

type RunnerHandler = (call: RunnerCall) => Promise<{ exitCode?: number }>;

const createRunner = (handlers: RunnerHandler[]) => {
	const calls: RunnerCall[] = [];
	const runner = async (
		command: string,
		args: string[],
		options?: {
			stdio?: "inherit" | "pipe";
			reject?: boolean;
			timeout?: number;
		},
	): Promise<{ exitCode?: number }> => {
		const call = { command, args, options };
		calls.push(call);
		const handler = handlers.shift();
		if (handler) {
			return handler(call);
		}
		return { exitCode: 0 };
	};

	return { runner, calls };
};

describe("parseEditorCommand", () => {
	test("parses single-token command", () => {
		expect(parseEditorCommand("zed")).toEqual({ command: "zed", args: [] });
	});

	test("parses command with flags", () => {
		expect(parseEditorCommand("code --reuse-window")).toEqual({
			command: "code",
			args: ["--reuse-window"],
		});
	});

	test("rejects empty command", () => {
		expect(() => parseEditorCommand("   ")).toThrow("Editor command is empty");
	});
});

describe("isUriCapableEditor", () => {
	test("returns true for VS Code family", () => {
		expect(isUriCapableEditor("code")).toBe(true);
		expect(isUriCapableEditor("/usr/local/bin/code-insiders")).toBe(true);
	});

	test("returns false for non-URI editors", () => {
		expect(isUriCapableEditor("zed")).toBe(false);
		expect(isUriCapableEditor("vim")).toBe(false);
	});
});

describe("launchProjectInEditor", () => {
	test("uses --folder-uri for URI-capable editors", async () => {
		const { runner, calls } = createRunner([async () => ({ exitCode: 0 })]);
		const result = await launchProjectInEditor(
			"code --reuse-window",
			"/tmp/project",
			"vscode-remote://dev-container+abc/workspaces/project",
			{ runner },
		);

		expect(result.success).toBe(true);
		expect(calls[0]).toEqual({
			command: "code",
			args: [
				"--reuse-window",
				"--folder-uri",
				"vscode-remote://dev-container+abc/workspaces/project",
			],
			options: { stdio: "pipe" },
		});
	});

	test("uses project path for non-URI editors", async () => {
		const { runner, calls } = createRunner([async () => ({ exitCode: 0 })]);
		const result = await launchProjectInEditor(
			"zed",
			"/tmp/project",
			"vscode-remote://dev-container+abc/workspaces/project",
			{ runner },
		);

		expect(result.success).toBe(true);
		expect(calls[0]).toEqual({
			command: "zed",
			args: ["/tmp/project"],
			options: { stdio: "pipe" },
		});
	});

	test("falls back to macOS app when command is missing", async () => {
		const { runner, calls } = createRunner([
			async () => {
				throw new Error("spawn zed ENOENT", {
					cause: { code: "ENOENT" },
				});
			},
			async () => ({ exitCode: 0 }),
		]);

		const result = await launchProjectInEditor(
			"zed",
			"/tmp/project",
			"vscode-remote://dev-container+abc/workspaces/project",
			{
				runner,
				platform: "darwin",
				isAppInstalled: () => true,
			},
		);

		expect(result).toEqual({
			success: true,
			usedFallback: true,
			fallbackApp: "Zed",
		});
		expect(calls[1]).toEqual({
			command: "open",
			args: ["-a", "Zed", "/tmp/project"],
			options: { stdio: "pipe" },
		});
	});

	test("returns error when custom command is missing", async () => {
		const { runner } = createRunner([
			async () => {
				throw { code: "ENOENT", message: "command not found" };
			},
		]);

		const result = await launchProjectInEditor(
			"my-editor",
			"/tmp/project",
			"uri",
			{ runner, platform: "darwin" },
		);

		expect(result.success).toBe(false);
		expect(result.error).toContain("my-editor");
	});
});

describe("launchFileInEditor", () => {
	test("appends file path to custom command args", async () => {
		const { runner, calls } = createRunner([async () => ({ exitCode: 0 })]);
		const result = await launchFileInEditor(
			"open -a Zed",
			"/tmp/devcontainer.json",
			{
				runner,
			},
		);

		expect(result.success).toBe(true);
		expect(calls[0]).toEqual({
			command: "open",
			args: ["-a", "Zed", "/tmp/devcontainer.json"],
			options: { stdio: "pipe" },
		});
	});
});

describe("checkEditorAvailability", () => {
	test("reports available when command is on PATH", async () => {
		const { runner } = createRunner([async () => ({ exitCode: 0 })]);
		const result = await checkEditorAvailability("zed", { runner });
		expect(result).toEqual({ status: "available", command: "zed" });
	});

	test("reports fallback when command is missing but app exists", async () => {
		const { runner } = createRunner([async () => ({ exitCode: 1 })]);
		const result = await checkEditorAvailability("zed", {
			runner,
			platform: "darwin",
			isAppInstalled: () => true,
		});

		expect(result).toEqual({
			status: "fallback",
			command: "zed",
			fallbackApp: "Zed",
		});
	});

	test("reports missing when command and fallback are unavailable", async () => {
		const { runner } = createRunner([async () => ({ exitCode: 1 })]);
		const result = await checkEditorAvailability("zed", {
			runner,
			platform: "darwin",
			isAppInstalled: () => false,
		});

		expect(result).toEqual({
			status: "missing",
			command: "zed",
			fallbackApp: "Zed",
		});
	});

	test("reports invalid for empty command", async () => {
		const { runner } = createRunner([]);
		const result = await checkEditorAvailability("   ", { runner });
		expect(result.status).toBe("invalid");
		expect(result.error).toContain("Editor command is empty");
	});
});

// tests/unit/lib/gitignore.test.ts
import { beforeEach, describe, expect, mock, test } from "bun:test";

// Mock modules before importing the function under test
const mockRunRemoteCommand = mock(
	(_host: string, _command: string, _identityFile?: string) =>
		Promise.resolve({
			success: true as boolean,
			stdout: "" as string | undefined,
		}),
);
const mockWarn = mock(() => {});

mock.module("@lib/ssh.ts", () => ({
	runRemoteCommand: mockRunRemoteCommand,
}));

mock.module("@lib/ui.ts", () => ({
	warn: mockWarn,
}));

// Import after mocking
const { ensureGitignoreSkybox } = await import("@lib/remote.ts");

describe("ensureGitignoreSkybox", () => {
	const testHost = "test-host";
	const testProjectPath = "/home/user/project";

	beforeEach(() => {
		mockRunRemoteCommand.mockReset();
		mockWarn.mockReset();
	});

	test("creates .gitignore when none exists", async () => {
		mockRunRemoteCommand.mockResolvedValue({
			success: true,
			stdout: "CREATED",
		});

		const result = await ensureGitignoreSkybox(testHost, testProjectPath);

		expect(result).toEqual({ success: true, action: "created" });
		expect(mockRunRemoteCommand).toHaveBeenCalledTimes(1);
		const command = mockRunRemoteCommand.mock.calls[0][1];
		expect(command).toContain("if [ -f");
		expect(command).toContain("/home/user/project/.gitignore");
		expect(mockWarn).not.toHaveBeenCalled();
	});

	test("appends to existing .gitignore", async () => {
		mockRunRemoteCommand.mockResolvedValue({
			success: true,
			stdout: "APPENDED",
		});

		const result = await ensureGitignoreSkybox(testHost, testProjectPath);

		expect(result).toEqual({ success: true, action: "appended" });
		expect(mockRunRemoteCommand).toHaveBeenCalledTimes(1);
		expect(mockWarn).not.toHaveBeenCalled();
	});

	test("no-ops when .skybox/* is already present", async () => {
		mockRunRemoteCommand.mockResolvedValue({
			success: true,
			stdout: "EXISTS",
		});

		const result = await ensureGitignoreSkybox(testHost, testProjectPath);

		expect(result).toEqual({ success: true, action: "exists" });
		expect(mockRunRemoteCommand).toHaveBeenCalledTimes(1);
		expect(mockWarn).not.toHaveBeenCalled();
	});

	test("handles SSH failure gracefully", async () => {
		mockRunRemoteCommand.mockResolvedValue({
			success: false,
			stdout: undefined,
		});

		const result = await ensureGitignoreSkybox(testHost, testProjectPath);

		expect(result).toEqual({ success: false });
		expect(mockRunRemoteCommand).toHaveBeenCalledTimes(1);
		expect(mockWarn).toHaveBeenCalledTimes(1);
		expect(mockWarn).toHaveBeenCalledWith(
			"Could not update .gitignore on remote",
		);
	});

	test("handles thrown errors gracefully", async () => {
		mockRunRemoteCommand.mockRejectedValue(new Error("SSH connection timeout"));

		const result = await ensureGitignoreSkybox(testHost, testProjectPath);

		expect(result).toEqual({ success: false });
		expect(mockRunRemoteCommand).toHaveBeenCalledTimes(1);
		expect(mockWarn).toHaveBeenCalledTimes(1);
		expect(mockWarn).toHaveBeenCalledWith(
			"Could not update .gitignore on remote",
		);
	});

	test("handles unexpected stdout values gracefully", async () => {
		mockRunRemoteCommand.mockResolvedValue({
			success: true,
			stdout: "UNEXPECTED_OUTPUT",
		});

		const result = await ensureGitignoreSkybox(testHost, testProjectPath);

		// Function returns success: true without action field for unexpected output
		expect(result).toEqual({ success: true });
		expect(mockWarn).not.toHaveBeenCalled();
	});

	test("trims whitespace from stdout", async () => {
		mockRunRemoteCommand.mockResolvedValue({
			success: true,
			stdout: "  CREATED  \n",
		});

		const result = await ensureGitignoreSkybox(testHost, testProjectPath);

		expect(result).toEqual({ success: true, action: "created" });
	});

	test("handles undefined stdout gracefully", async () => {
		mockRunRemoteCommand.mockResolvedValue({
			success: true,
			stdout: undefined,
		});

		const result = await ensureGitignoreSkybox(testHost, testProjectPath);

		expect(result).toEqual({ success: true });
		expect(mockWarn).not.toHaveBeenCalled();
	});
});

import { describe, expect, test } from "bun:test";
import {
	isPathTraversal,
	validatePath,
	validateRemotePath,
	validateRemoteProjectPath,
	validateSSHHost,
} from "@lib/validation.ts";

describe("validation", () => {
	describe("isPathTraversal", () => {
		test("detects ../etc/passwd", () => {
			expect(isPathTraversal("../etc/passwd")).toBe(true);
		});

		test("detects foo/../../../etc/passwd", () => {
			expect(isPathTraversal("foo/../../../etc/passwd")).toBe(true);
		});

		test("detects ..\\windows\\system32", () => {
			expect(isPathTraversal("..\\windows\\system32")).toBe(true);
		});

		test("allows my-project", () => {
			expect(isPathTraversal("my-project")).toBe(false);
		});

		test("allows src/lib/config.ts", () => {
			expect(isPathTraversal("src/lib/config.ts")).toBe(false);
		});

		test("detects bare ..", () => {
			expect(isPathTraversal("..")).toBe(true);
		});
	});

	describe("validatePath", () => {
		test("accepts valid project name", () => {
			const result = validatePath("my-project");
			expect(result.valid).toBe(true);
		});

		test("rejects path traversal", () => {
			const result = validatePath("../secret");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("path traversal");
			}
		});

		test("rejects absolute path", () => {
			const result = validatePath("/etc/passwd");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("absolute");
			}
		});

		test("rejects empty string", () => {
			const result = validatePath("");
			expect(result.valid).toBe(false);
		});
	});

	describe("validateRemotePath", () => {
		test("accepts valid absolute paths", () => {
			expect(validateRemotePath("/home/user/code").valid).toBe(true);
			expect(validateRemotePath("/var/projects").valid).toBe(true);
		});

		test("accepts tilde paths", () => {
			expect(validateRemotePath("~/code").valid).toBe(true);
			expect(validateRemotePath("~/projects/skybox").valid).toBe(true);
		});

		test("rejects command substitution with $()", () => {
			const result = validateRemotePath("/home/$(rm -rf /)/code");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("command substitution");
			}
		});

		test("rejects command substitution with backticks", () => {
			const result = validateRemotePath("/home/`whoami`/code");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("command substitution");
			}
		});

		// biome-ignore lint/suspicious/noTemplateCurlyInString: testing literal ${} in paths
		test("rejects variable expansion with ${}", () => {
			// biome-ignore lint/suspicious/noTemplateCurlyInString: testing literal ${USER} injection
			const result = validateRemotePath("/home/${USER}/code");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("command substitution");
			}
		});

		test("rejects semicolon command chaining", () => {
			const result = validateRemotePath("/home/user; rm -rf /");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("shell metacharacter");
			}
		});

		test("rejects pipe command chaining", () => {
			const result = validateRemotePath("/home/user | cat /etc/passwd");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("shell metacharacter");
			}
		});

		test("rejects ampersand command chaining", () => {
			const result = validateRemotePath("/home/user && rm -rf /");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("shell metacharacter");
			}
		});

		test("rejects newlines", () => {
			const result = validateRemotePath("/home/user\nrm -rf /");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("shell metacharacter");
			}
		});

		test("rejects empty paths", () => {
			const result = validateRemotePath("");
			expect(result.valid).toBe(false);
		});

		test("rejects paths with only whitespace", () => {
			const result = validateRemotePath("   ");
			expect(result.valid).toBe(false);
		});
	});

	describe("validateSSHHost", () => {
		test("accepts simple hostname", () => {
			expect(validateSSHHost("myserver").valid).toBe(true);
		});

		test("accepts user@host", () => {
			expect(validateSSHHost("deploy@myserver").valid).toBe(true);
		});

		test("accepts FQDN", () => {
			expect(validateSSHHost("server.example.com").valid).toBe(true);
		});

		test("accepts IPv4 address", () => {
			expect(validateSSHHost("192.168.1.100").valid).toBe(true);
		});

		test("accepts IPv6 address", () => {
			expect(validateSSHHost("::1").valid).toBe(true);
		});

		test("rejects empty string", () => {
			const result = validateSSHHost("");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("empty");
			}
		});

		test("rejects leading dash (option injection)", () => {
			const result = validateSSHHost("-oProxyCommand=evil");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("dash");
			}
		});

		test("rejects whitespace in host", () => {
			const result = validateSSHHost("host name");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("whitespace");
			}
		});

		test("rejects tab character", () => {
			const result = validateSSHHost("host\tname");
			expect(result.valid).toBe(false);
		});

		test("rejects newline in host", () => {
			const result = validateSSHHost("host\nevil");
			expect(result.valid).toBe(false);
		});

		test("rejects carriage return in host", () => {
			const result = validateSSHHost("host\revil");
			expect(result.valid).toBe(false);
		});

		test("rejects null byte (control character)", () => {
			const result = validateSSHHost("host\x00evil");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("control");
			}
		});

		test("rejects bell character (control character)", () => {
			const result = validateSSHHost("host\x07evil");
			expect(result.valid).toBe(false);
		});
	});

	describe("validateRemoteProjectPath", () => {
		test("accepts valid project name", () => {
			expect(validateRemoteProjectPath("my-project").valid).toBe(true);
		});

		test("accepts alphanumeric with hyphens and underscores", () => {
			expect(validateRemoteProjectPath("my_project-123").valid).toBe(true);
		});

		test("rejects empty string", () => {
			const result = validateRemoteProjectPath("");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("empty");
			}
		});

		test("rejects path traversal with ..", () => {
			const result = validateRemoteProjectPath("../etc");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("traversal");
			}
		});

		test("rejects bare ..", () => {
			const result = validateRemoteProjectPath("..");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("traversal");
			}
		});

		test("rejects forward slash", () => {
			const result = validateRemoteProjectPath("foo/bar");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("separator");
			}
		});

		test("rejects backslash", () => {
			const result = validateRemoteProjectPath("foo\\bar");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("separator");
			}
		});

		test("rejects leading dash", () => {
			const result = validateRemoteProjectPath("-rf");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("dash");
			}
		});
	});
});

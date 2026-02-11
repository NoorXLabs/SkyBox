import { describe, expect, test } from "bun:test";
import {
	isPathTraversal,
	sshFieldValidator,
	toInquirerValidator,
	validatePath,
	validateRemotePath,
	validateRemoteProjectPath,
	validateSSHField,
	validateSSHHost,
} from "@lib/validation.ts";
import type { ValidationResult } from "@typedefs/index.ts";

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

		test("rejects whitespace-only input", () => {
			const result = validatePath("   ");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("empty");
			}
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
				expect(result.error).toContain("alphanumeric");
			}
		});

		test("rejects bare ..", () => {
			const result = validateRemoteProjectPath("..");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("alphanumeric");
			}
		});

		test("rejects forward slash", () => {
			const result = validateRemoteProjectPath("foo/bar");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("alphanumeric");
			}
		});

		test("rejects backslash", () => {
			const result = validateRemoteProjectPath("foo\\bar");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("alphanumeric");
			}
		});

		test("rejects leading dash", () => {
			const result = validateRemoteProjectPath("-rf");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("hyphen or underscore");
			}
		});

		test("rejects leading underscore", () => {
			const result = validateRemoteProjectPath("_tmp");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("hyphen or underscore");
			}
		});
	});

	describe("validateSSHField", () => {
		test("rejects empty input", () => {
			const result = validateSSHField("", "hostname");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("cannot be empty");
			}
		});

		test("rejects whitespace-only input", () => {
			const result = validateSSHField("   ", "hostname");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("cannot be empty");
			}
		});

		test("rejects input with newline character", () => {
			const result = validateSSHField("host\nevil", "hostname");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("cannot contain newlines");
			}
		});

		test("rejects input with carriage return", () => {
			const result = validateSSHField("host\revil", "hostname");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("cannot contain newlines");
			}
		});

		test("rejects input with spaces", () => {
			const result = validateSSHField("host name", "hostname");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("contains invalid characters");
			}
		});

		test("rejects input with semicolons", () => {
			const result = validateSSHField("host;evil", "hostname");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("contains invalid characters");
			}
		});

		test("rejects input with ampersands", () => {
			const result = validateSSHField("host&evil", "hostname");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("contains invalid characters");
			}
		});

		test("rejects input with backticks", () => {
			const result = validateSSHField("`whoami`", "username");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("contains invalid characters");
			}
		});

		test("accepts alphanumeric input", () => {
			expect(validateSSHField("myserver123", "hostname").valid).toBe(true);
		});

		test("accepts input with @ symbol", () => {
			expect(validateSSHField("user@host", "hostname").valid).toBe(true);
		});

		test("accepts input with dots", () => {
			expect(validateSSHField("server.example.com", "hostname").valid).toBe(
				true,
			);
		});

		test("accepts input with underscores", () => {
			expect(validateSSHField("my_server", "hostname").valid).toBe(true);
		});

		test("accepts input with tilde", () => {
			expect(validateSSHField("~/.ssh/id_ed25519", "identityFile").valid).toBe(
				true,
			);
		});

		test("accepts input with colons", () => {
			expect(validateSSHField("host:22", "hostname").valid).toBe(true);
		});

		test("accepts input with hyphens", () => {
			expect(validateSSHField("my-server", "hostname").valid).toBe(true);
		});

		test("accepts input with forward slashes", () => {
			expect(
				validateSSHField("/home/user/.ssh/key", "identityFile").valid,
			).toBe(true);
		});

		test("field name appears in empty error message", () => {
			const result = validateSSHField("", "HostName");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("HostName");
			}
		});

		test("field name appears in newline error message", () => {
			const result = validateSSHField("bad\nvalue", "User");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("User");
			}
		});

		test("field name appears in invalid characters error message", () => {
			const result = validateSSHField("bad value!", "IdentityFile");
			expect(result.valid).toBe(false);
			if (!result.valid) {
				expect(result.error).toContain("IdentityFile");
			}
		});
	});

	describe("sshFieldValidator", () => {
		test("returns true for valid SSH field input", () => {
			const validator = sshFieldValidator("hostname");
			expect(validator("myserver.example.com")).toBe(true);
		});

		test("returns true for valid path input", () => {
			const validator = sshFieldValidator("identityFile");
			expect(validator("~/.ssh/id_ed25519")).toBe(true);
		});

		test("returns error string for empty input", () => {
			const validator = sshFieldValidator("hostname");
			const result = validator("");
			expect(typeof result).toBe("string");
			expect(result).toContain("cannot be empty");
		});

		test("returns error string for input with newlines", () => {
			const validator = sshFieldValidator("hostname");
			const result = validator("bad\nvalue");
			expect(typeof result).toBe("string");
			expect(result).toContain("cannot contain newlines");
		});

		test("returns error string for input with invalid characters", () => {
			const validator = sshFieldValidator("hostname");
			const result = validator("bad value!");
			expect(typeof result).toBe("string");
			expect(result).toContain("contains invalid characters");
		});

		test("error string includes the field name", () => {
			const validator = sshFieldValidator("RemoteHost");
			const result = validator("");
			expect(typeof result).toBe("string");
			expect(result as string).toContain("RemoteHost");
		});
	});

	describe("toInquirerValidator", () => {
		test("converts a valid ValidationResult to true", () => {
			const alwaysValid = (_input: string): ValidationResult => ({
				valid: true,
			});
			const validator = toInquirerValidator(alwaysValid);
			expect(validator("anything")).toBe(true);
		});

		test("converts an invalid ValidationResult to error string", () => {
			const alwaysInvalid = (_input: string): ValidationResult => ({
				valid: false,
				error: "Something went wrong",
			});
			const validator = toInquirerValidator(alwaysInvalid);
			expect(validator("anything")).toBe("Something went wrong");
		});

		test("works with a real validator function", () => {
			const noEmpty = (input: string): ValidationResult => {
				if (!input || input.trim() === "") {
					return { valid: false, error: "Input cannot be empty" };
				}
				return { valid: true };
			};
			const validator = toInquirerValidator(noEmpty);

			expect(validator("hello")).toBe(true);
			expect(validator("")).toBe("Input cannot be empty");
			expect(validator("   ")).toBe("Input cannot be empty");
		});

		test("passes input through to the underlying validator", () => {
			const exactMatch = (input: string): ValidationResult => {
				if (input === "secret") {
					return { valid: true };
				}
				return { valid: false, error: `Expected "secret", got "${input}"` };
			};
			const validator = toInquirerValidator(exactMatch);

			expect(validator("secret")).toBe(true);
			expect(validator("wrong")).toBe('Expected "secret", got "wrong"');
		});

		test("works with validateSSHField via partial application", () => {
			const hostnameValidator = toInquirerValidator((input: string) =>
				validateSSHField(input, "hostname"),
			);

			expect(hostnameValidator("myserver.com")).toBe(true);
			expect(hostnameValidator("")).toContain("cannot be empty");
			expect(hostnameValidator("bad value")).toContain(
				"contains invalid characters",
			);
		});
	});
});

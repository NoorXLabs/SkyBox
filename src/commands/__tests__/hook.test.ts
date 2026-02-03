// src/commands/__tests__/hook.test.ts
import { describe, expect, test } from "bun:test";
import { generateBashHook, generateZshHook } from "@commands/hook.ts";

describe("generateBashHook", () => {
	test("returns a string containing _devbox_hook function", () => {
		const hook = generateBashHook();
		expect(hook).toContain("_devbox_hook()");
	});

	test("contains PROMPT_COMMAND setup", () => {
		const hook = generateBashHook();
		expect(hook).toContain("PROMPT_COMMAND");
		// Verify it appends to existing PROMPT_COMMAND
		expect(hook).toContain('PROMPT_COMMAND="_devbox_hook');
	});

	test("contains devbox hook-check invocation", () => {
		const hook = generateBashHook();
		expect(hook).toContain("devbox hook-check");
	});

	test("contains _DEVBOX_PREV_DIR tracking", () => {
		const hook = generateBashHook();
		expect(hook).toContain("_DEVBOX_PREV_DIR");
		// Verify both reading and setting the variable
		// biome-ignore lint/suspicious/noTemplateCurlyInString: Testing shell variable syntax
		expect(hook).toContain("${_DEVBOX_PREV_DIR:-}");
		expect(hook).toContain('_DEVBOX_PREV_DIR="$cur_dir"');
	});

	test("runs hook-check in background with &", () => {
		const hook = generateBashHook();
		expect(hook).toContain("devbox hook-check 2>/dev/null &");
	});

	test("redirects stderr with 2>/dev/null", () => {
		const hook = generateBashHook();
		expect(hook).toContain("2>/dev/null");
	});

	test("contains helpful comments", () => {
		const hook = generateBashHook();
		expect(hook).toContain("# DevBox shell hook for bash");
		expect(hook).toContain("# Add to ~/.bashrc");
		expect(hook).toContain("# Only run if directory changed");
		expect(hook).toContain("# Append to PROMPT_COMMAND");
	});

	test("output is valid shell syntax", () => {
		const hook = generateBashHook();
		// Check for balanced braces in function definition
		expect(hook).toContain("_devbox_hook() {");
		expect(hook).toMatch(/_devbox_hook\(\) \{[\s\S]*\}/);
		// Check for proper if statement structure
		expect(hook).toContain("if [[");
		expect(hook).toContain("then");
		expect(hook).toContain("fi");
	});
});

describe("generateZshHook", () => {
	test("returns a string containing _devbox_hook function", () => {
		const hook = generateZshHook();
		expect(hook).toContain("_devbox_hook()");
	});

	test("contains add-zsh-hook precmd setup", () => {
		const hook = generateZshHook();
		expect(hook).toContain("add-zsh-hook precmd _devbox_hook");
		// Verify autoload is called
		expect(hook).toContain("autoload -Uz add-zsh-hook");
	});

	test("contains devbox hook-check invocation", () => {
		const hook = generateZshHook();
		expect(hook).toContain("devbox hook-check");
	});

	test("contains _DEVBOX_PREV_DIR tracking", () => {
		const hook = generateZshHook();
		expect(hook).toContain("_DEVBOX_PREV_DIR");
		// Verify both reading and setting the variable
		// biome-ignore lint/suspicious/noTemplateCurlyInString: Testing shell variable syntax
		expect(hook).toContain("${_DEVBOX_PREV_DIR:-}");
		expect(hook).toContain('_DEVBOX_PREV_DIR="$cur_dir"');
	});

	test("runs hook-check in background with &", () => {
		const hook = generateZshHook();
		expect(hook).toContain("devbox hook-check 2>/dev/null &");
	});

	test("redirects stderr with 2>/dev/null", () => {
		const hook = generateZshHook();
		expect(hook).toContain("2>/dev/null");
	});

	test("contains helpful comments", () => {
		const hook = generateZshHook();
		expect(hook).toContain("# DevBox shell hook for zsh");
		expect(hook).toContain("# Add to ~/.zshrc");
		expect(hook).toContain("# Only run if directory changed");
		expect(hook).toContain(
			"# Register with zsh hook system (if not already registered)",
		);
	});

	test("output is valid shell syntax", () => {
		const hook = generateZshHook();
		// Check for balanced braces in function definition
		expect(hook).toContain("_devbox_hook() {");
		expect(hook).toMatch(/_devbox_hook\(\) \{[\s\S]*\}/);
		// Check for proper if statement structure
		expect(hook).toContain("if [[");
		expect(hook).toContain("then");
		expect(hook).toContain("fi");
	});
});

describe("bash and zsh hooks shared behavior", () => {
	test("both hooks contain the same core logic", () => {
		const bashHook = generateBashHook();
		const zshHook = generateZshHook();

		// Both should have the same function body structure
		// biome-ignore lint/suspicious/noTemplateCurlyInString: Testing shell variable syntax
		const coreLogic = [
			'local prev_dir="${_DEVBOX_PREV_DIR:-}"',
			'local cur_dir="$PWD"',
			'if [[ "$prev_dir" != "$cur_dir" ]]',
			'_DEVBOX_PREV_DIR="$cur_dir"',
			"devbox hook-check 2>/dev/null &",
		];

		for (const line of coreLogic) {
			expect(bashHook).toContain(line);
			expect(zshHook).toContain(line);
		}
	});

	test("both hooks differ only in shell-specific setup", () => {
		const bashHook = generateBashHook();
		const zshHook = generateZshHook();

		// Bash uses PROMPT_COMMAND
		expect(bashHook).toContain("PROMPT_COMMAND");
		expect(zshHook).not.toContain("PROMPT_COMMAND");

		// Zsh uses add-zsh-hook
		expect(zshHook).toContain("add-zsh-hook");
		expect(bashHook).not.toContain("add-zsh-hook");
	});

	test("both hooks return non-empty strings", () => {
		expect(generateBashHook().length).toBeGreaterThan(0);
		expect(generateZshHook().length).toBeGreaterThan(0);
	});
});

// src/lib/__tests__/download.test.ts
import { describe, expect, test } from "bun:test";
import {
	getMutagenChecksumUrl,
	getMutagenDownloadUrl,
	parseSHA256Sums,
} from "../download.ts";

describe("download", () => {
	test("getMutagenDownloadUrl returns correct URL for darwin-arm64", () => {
		const url = getMutagenDownloadUrl("darwin", "arm64", "0.17.5");
		expect(url).toContain("mutagen");
		expect(url).toContain("darwin");
		expect(url).toContain("arm64");
		expect(url).toContain("0.17.5");
	});

	test("getMutagenDownloadUrl returns correct URL for linux-amd64", () => {
		const url = getMutagenDownloadUrl("linux", "x64", "0.17.5");
		expect(url).toContain("linux");
		expect(url).toContain("amd64");
	});

	test("getMutagenChecksumUrl returns SHA256SUMS URL", () => {
		const url = getMutagenChecksumUrl("0.17.5");
		expect(url).toContain("SHA256SUMS");
	});

	test("getMutagenDownloadUrl maps darwin platform correctly", () => {
		const url = getMutagenDownloadUrl("darwin", "x64", "0.17.5");
		expect(url).toContain("darwin_amd64");
	});

	test("getMutagenDownloadUrl maps non-darwin to linux", () => {
		const url = getMutagenDownloadUrl("linux", "arm64", "0.17.5");
		expect(url).toContain("linux_arm64");
	});

	test("getMutagenDownloadUrl maps non-arm64 arch to amd64", () => {
		const url = getMutagenDownloadUrl("darwin", "x64", "0.17.5");
		expect(url).toContain("amd64");
		expect(url).not.toContain("x64");
	});

	test("getMutagenDownloadUrl includes version in filename", () => {
		const url = getMutagenDownloadUrl("darwin", "arm64", "1.2.3");
		expect(url).toBe(
			"https://github.com/mutagen-io/mutagen/releases/download/v1.2.3/mutagen_darwin_arm64_v1.2.3.tar.gz",
		);
	});

	test("getMutagenChecksumUrl includes version", () => {
		const url = getMutagenChecksumUrl("1.2.3");
		expect(url).toBe(
			"https://github.com/mutagen-io/mutagen/releases/download/v1.2.3/SHA256SUMS",
		);
	});

	describe("parseSHA256Sums", () => {
		test("returns hash for matching filename", () => {
			const content =
				"abc123  mutagen_darwin_arm64_v0.17.5.tar.gz\ndef456  mutagen_linux_amd64_v0.17.5.tar.gz";
			const result = parseSHA256Sums(
				content,
				"mutagen_darwin_arm64_v0.17.5.tar.gz",
			);
			expect(result).toBe("abc123");
		});

		test("returns null when filename not found", () => {
			const content = "abc123  other_file.tar.gz";
			const result = parseSHA256Sums(content, "nonexistent.tar.gz");
			expect(result).toBeNull();
		});
	});
});

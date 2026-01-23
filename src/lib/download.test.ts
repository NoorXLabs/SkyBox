// src/lib/download.test.ts
import { describe, expect, test } from "bun:test";
import { getMutagenChecksumUrl, getMutagenDownloadUrl } from "./download.ts";

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
});

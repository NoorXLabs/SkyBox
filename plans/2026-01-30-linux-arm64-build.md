# Linux ARM64 Binary + Build Optimizations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add linux-arm64 as a release target and fix build optimizations and a stale Mutagen version constant.

**Architecture:** Add a fourth compile target (`bun-linux-arm64`) to the GitHub Actions release workflow, add `--minify --sourcemap --bytecode` flags to all build commands, update the Homebrew formula to serve linux-arm64, and fix `download.ts` to use the canonical `MUTAGEN_VERSION` from `constants.ts`.

**Tech Stack:** Bun compiler, GitHub Actions, Homebrew formula, TypeScript

---

### Task 1: Fix stale MUTAGEN_VERSION in download.ts

**Files:**
- Modify: `src/lib/download.ts:1-15`
- Test: `src/lib/__tests__/download.test.ts`

**Step 1: Write a failing test that asserts download.ts uses the canonical version**

```typescript
// In src/lib/__tests__/download.test.ts — add this test
import { MUTAGEN_VERSION } from "../../lib/constants.ts";
import { getMutagenDownloadUrl } from "../../lib/download.ts";

test("getMutagenDownloadUrl uses canonical MUTAGEN_VERSION from constants", () => {
	const url = getMutagenDownloadUrl("darwin", "arm64", MUTAGEN_VERSION);
	expect(url).toContain(`v${MUTAGEN_VERSION}`);
	// The version in constants.ts is 0.18.1, NOT the old pinned 0.17.5
	expect(url).not.toContain("0.17.5");
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/__tests__/download.test.ts`
Expected: Test may pass since `getMutagenDownloadUrl` takes version as a param. The real issue is that `downloadMutagen()` uses the local `MUTAGEN_VERSION` (0.17.5) not the canonical one. Check the existing tests to see if `downloadMutagen` is tested with version assertions.

**Step 3: Fix the import**

In `src/lib/download.ts`:
- Delete line 15: `export const MUTAGEN_VERSION = "0.17.5";`
- Add to the existing imports: `import { MUTAGEN_VERSION } from "./constants.ts";`
- Keep the export so any downstream consumers still work: `export { MUTAGEN_VERSION } from "./constants.ts";`

**Step 4: Run all tests to verify nothing breaks**

Run: `bun test`
Expected: All tests pass. The `downloadMutagen()` function and any imports of `MUTAGEN_VERSION` from `download.ts` now resolve to `0.18.1`.

**Step 5: Commit**

```bash
git add src/lib/download.ts src/lib/__tests__/download.test.ts
git commit -m "fix: use canonical MUTAGEN_VERSION from constants.ts in download.ts"
```

---

### Task 2: Add --minify, --sourcemap, and --bytecode to release build commands

**Files:**
- Modify: `.github/workflows/release.yml:33-36`

**Step 1: Update the three existing build lines**

Replace the "Build all platforms" step in `.github/workflows/release.yml` with:

```yaml
      - name: Build all platforms
        run: |
          bun build ./src/index.ts --compile --minify --sourcemap --bytecode --define "process.env.DEVBOX_INSTALL_METHOD='github-release'" --target=bun-darwin-arm64 --outfile=devbox-darwin-arm64
          bun build ./src/index.ts --compile --minify --sourcemap --bytecode --define "process.env.DEVBOX_INSTALL_METHOD='github-release'" --target=bun-darwin-x64 --outfile=devbox-darwin-x64
          bun build ./src/index.ts --compile --minify --sourcemap --bytecode --define "process.env.DEVBOX_INSTALL_METHOD='github-release'" --target=bun-linux-x64 --outfile=devbox-linux-x64
```

**Step 2: Verify YAML is valid**

Run: `bun x yaml-lint .github/workflows/release.yml 2>/dev/null || python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))"`
Expected: No errors.

**Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "chore: add --minify --sourcemap --bytecode to release build commands"
```

---

### Task 3: Add linux-arm64 build target to release workflow

**Files:**
- Modify: `.github/workflows/release.yml`

**Step 1: Add the fourth build line**

In the "Build all platforms" step, append:

```
          bun build ./src/index.ts --compile --minify --sourcemap --bytecode --define "process.env.DEVBOX_INSTALL_METHOD='github-release'" --target=bun-linux-arm64 --outfile=devbox-linux-arm64
```

**Step 2: Add tarball creation**

In the "Create tarballs" step, append:

```
          tar -czvf devbox-linux-arm64.tar.gz devbox-linux-arm64
```

**Step 3: Add to release assets**

In the "Create Release" `files:` list, add:

```
            devbox-linux-arm64.tar.gz
```

**Step 4: Add SHA256 computation**

In the "Compute SHA256 hashes" step, append:

```
          echo "linux_arm64=$(shasum -a 256 devbox-linux-arm64.tar.gz | cut -d' ' -f1)" >> $GITHUB_OUTPUT
```

**Step 5: Add to Homebrew formula env vars**

In the "Update Homebrew formula" step `env:` block, add:

```
          SHA_LINUX_ARM64: ${{ steps.sha.outputs.linux_arm64 }}
```

**Step 6: Add Homebrew formula on_linux/on_arm block**

In the formula template, after the `on_linux`/`on_intel` block (line ~99), add:

```ruby
              on_arm do
                url "https://github.com/NoorXLabs/DevBox/releases/download/vVERSION_PLACEHOLDER/devbox-linux-arm64.tar.gz"
                sha256 "SHA_LINUX_ARM64_PLACEHOLDER"
              end
```

And in the `def install` section, add before the final `end`:

```ruby
              elsif OS.linux? && Hardware::CPU.arm?
                bin.install "devbox-linux-arm64" => "devbox"
```

**Step 7: Add sed replacement for the new placeholder**

After the existing `sed` commands, add:

```bash
          sed -i'' -e "s/SHA_LINUX_ARM64_PLACEHOLDER/${SHA_LINUX_ARM64}/g" Formula/devbox.rb
```

**Step 8: Verify YAML is valid**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))"`
Expected: No errors.

**Step 9: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "feat: add linux-arm64 release binary"
```

---

### Task 4: Run full validation

**Step 1: Run typecheck**

Run: `bun run typecheck`
Expected: No errors.

**Step 2: Run linter**

Run: `bun run check`
Expected: No errors.

**Step 3: Run all tests**

Run: `bun test`
Expected: All tests pass.

**Step 4: Verify local build works (optional smoke test)**

Run: `bun build ./src/index.ts --compile --minify --sourcemap --bytecode --outfile=/tmp/devbox-test && /tmp/devbox-test --version`
Expected: Prints the current version.

**Step 5: Final commit if any formatting changes**

```bash
git add -A
git commit -m "chore: formatting fixes from lint"
```

---

### Task 5: Update CHANGELOG.md

**Files:**
- Modify: `CHANGELOG.md`

**Step 1: Add a new unreleased section at the top of the changelog**

Insert after the "adheres to Semantic Versioning" line (line 6) and before the `## [0.7.2]` entry:

```markdown

## [Unreleased]

### Added

- Linux ARM64 (`devbox-linux-arm64`) release binary for AWS Graviton, Raspberry Pi, and other ARM servers
- Build optimizations: `--minify`, `--sourcemap`, and `--bytecode` flags for smaller, faster binaries

### Fixed

- Mutagen download used stale pinned version (0.17.5) instead of canonical version from constants (0.18.1)
```

**Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: add changelog entries for linux-arm64 and build optimizations"
```

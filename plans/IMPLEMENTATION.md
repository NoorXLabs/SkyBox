# DevBox - Implementation Tracker

> **Version:** 0.5.1-beta
>
> **Started:** 2025 (CLI Development)
>
> **Progress:** 14/14 commands complete | 21/55 code quality tasks complete

---

## Table of Contents

1. [Completed Work](#completed-work)
2. [Phase 1: Critical Security Fixes](#phase-1-critical-security-fixes)
3. [Phase 2: High Priority Improvements](#phase-2-high-priority-improvements)
4. [Phase 3: Code Quality & Refactoring](#phase-3-code-quality--refactoring)
5. [Phase 4: Testing Improvements](#phase-4-testing-improvements)
6. [Phase 5: Documentation & Configuration](#phase-5-documentation--configuration)
7. [Future Features](#future-features)
8. [Pre-Production Checklist](#pre-production-checklist)
9. [Commits Log](#commits-log)

---

## Completed Work

### Commands (14/14 Complete)

- [x] `devbox init` - Interactive setup wizard
- [x] `devbox browse` - List projects on remote server
- [x] `devbox list` - List local projects
- [x] `devbox clone` - Clone remote project locally
- [x] `devbox push` - Push local project to remote
- [x] `devbox up` - Start container with lock acquisition
- [x] `devbox down` - Stop container with sync flush and lock release
- [x] `devbox status` - Show detailed project status
- [x] `devbox editor` - Configure default editor
- [x] `devbox rm` - Remove local project
- [x] `devbox shell` - Enter container shell
- [x] `devbox new` - Create new project on remote
- [x] `devbox config` - View/modify configuration
- [x] `devbox remote` - Manage multiple remote servers

### Core Features

- [x] Multi-remote support (multiple SSH remotes per config)
- [x] Lock system (multi-machine coordination)
- [x] Mutagen sync (bidirectional with auto-download)
- [x] Devcontainer templates (Node.js, Python, Go, Bun)
- [x] Editor integration (Cursor, VS Code, Vim, Zed)
- [x] Config migration (v1 to v2 format auto-migration)
- [x] VitePress documentation
- [x] CI/CD pipelines (GitHub Actions)
- [x] Pre-commit hooks (Lefthook integration)

---

## Phase 1: Critical Security Fixes

> **Priority:** IMMEDIATE - Must fix before any release

### Security Vulnerabilities

- [x] **Task 1:** Fix shell injection vulnerability in lock.ts
  - Location: `src/lib/lock.ts:104, 130`
  - JSON string with special characters can break shell command
  - Fix: Use base64 encoding or proper shell escaping
  - Commit: `f2910a5`

- [x] **Task 2:** Quote all paths in shell commands
  - Locations: `src/lib/lock.ts:52, 149`, `src/commands/clone.ts`, `src/commands/push.ts:140`
  - Paths with spaces or special chars break commands
  - Fix: Always wrap paths in double quotes
  - Commit: `f30c765`

- [x] **Task 3:** Fix conflicting TypeScript compiler options
  - Location: `tsconfig.json:11, 13`
  - `declaration: true` conflicts with `noEmit: true`
  - Fix: Choose one approach (either emit declarations or don't emit)
  - Commit: `6a3a098`

---

## Phase 2: High Priority Improvements

> **Priority:** This Sprint

### Code Duplication

- [x] **Task 4:** Extract Docker label constant
  - Location: `src/lib/container.ts:59, 78, 106, 153, 181, 212, 252`
  - Magic string `devcontainer.local_folder` repeated 7 times
  - Fix: Create `DOCKER_LABEL_KEY` constant and `getDockerLabelFilter()` helper
  - Commit: `304a43b`

- [x] **Task 5:** Extract `checkRemoteProjectExists` to shared module
  - Locations: `src/commands/clone.ts:18-28`, `src/commands/push.ts:16-26`
  - Identical function in both files
  - Fix: Move to `src/lib/remote.ts`
  - Commit: `383f1c3`

- [~] **Task 6:** Extract lock status checking pattern
  - Locations: `src/commands/rm.ts:65-95`, `src/commands/down.ts`, `src/commands/status.ts`, `src/commands/up.ts`
  - Review: Patterns differ significantly (check/release, acquire/takeover, display-only) - extraction not beneficial
  - Status: Skipped after review

- [x] **Task 7:** Extract SSH config magic numbers
  - Location: `src/lib/ssh.ts:33, 37, 39, 41, 43`
  - Hard-coded slice lengths (5, 9, 13, etc.)
  - Fix: Create `SSH_KEYWORDS` constant object with prefixes and lengths
  - Commit: `80de7a7`

- [x] **Task 8:** Extract Mutagen command execution pattern
  - Location: `src/lib/mutagen.ts` (5+ functions)
  - Same try/catch pattern repeated
  - Fix: Create `executeMutagenCommand()` helper
  - Commit: `80de7a7`

### Configuration

- [x] **Task 9:** Fix Biome VCS settings
  - Location: `biome.json:6`
  - VCS disabled, `.gitignore` not respected
  - Fix: Enable VCS with `clientKind: "git"` and `useIgnoreFile: true`
  - Commit: `7d5e7e8`

### Type Safety

- [x] **Task 10:** Add proper type for Template.config
  - Location: `src/types/index.ts:192`
  - Uses loose `object` type
  - Fix: Create `DevcontainerConfig` interface
  - Commit: `e09275d`

- [x] **Task 11:** Use ContainerStatus enum consistently
  - Location: `src/types/index.ts:70-75, 110, 120`
  - Enum exists but not used in `ProjectSummary` and `ContainerDetails`
  - Fix: Add `Unknown` to enum, use in interfaces
  - Commit: `80de7a7`

- [x] **Task 12:** Create SyncStatusValue type
  - Location: `src/types/index.ts:212`
  - `status: string` is too vague
  - Fix: Create union type `"syncing" | "paused" | "none" | "error"`
  - Commit: `80de7a7`

### Reliability

- [x] **Task 13:** Add timeout to SSH test connection
  - Location: `src/lib/ssh.ts:84`
  - No execa timeout option
  - Fix: Add `{ timeout: 10000 }` to execa call
  - Commit: `80de7a7`

- [x] **Task 14:** Fix TOCTOU race condition in lock acquisition
  - Location: `src/lib/lock.ts:89-138`
  - Time-of-check-to-time-of-use vulnerability
  - Fix: Use atomic test-and-set with shell command
  - Commit: `029ec0b`

---

## Phase 3: Code Quality & Refactoring

> **Priority:** Next Sprint

### Function Complexity

- [ ] **Task 15:** Refactor `upCommand` (234 lines)
  - Location: `src/commands/up.ts:35-268`
  - Complex nested conditions
  - Fix: Extract `handleLockAcquisition()`, `handleContainerStartup()`, `handlePostStart()`

- [ ] **Task 16:** Refactor `handlePostStart` (109 lines)
  - Location: `src/commands/up.ts:320-428`
  - Complex multi-branch logic
  - Fix: Extract `determinePostStartAction()` and `executePostStartAction()`

### Path Management

- [x] **Task 17:** Centralize DEVBOX_HOME computation
  - Locations: `src/lib/paths.ts:5-6`, `src/lib/config.ts:14-16`, `src/lib/project.ts:8`
  - Same path computed in 3 different files
  - Fix: Use `src/lib/paths.ts` as single source of truth
  - Commit: (pending)

- [x] **Task 18:** Use getters for dynamic paths
  - Location: `src/lib/paths.ts:5-11`
  - Paths computed at module load time, become stale
  - Fix: Convert to `getDevboxHome()`, `getConfigPath()`, etc.
  - Commit: (pending)

### Error Handling

- [x] **Task 19:** Add YAML parse error handling
  - Location: `src/lib/config.ts:30`
  - Can throw on invalid YAML without user-friendly message
  - Fix: Wrap in try/catch, throw descriptive error
  - Commit: (pending)

- [x] **Task 20:** Fix unsafe HOME environment fallback
  - Location: `src/commands/init.ts:158`
  - Empty string fallback if HOME not set
  - Fix: Use `homedir()` from `node:os`
  - Commit: (pending)

- [x] **Task 21:** Add filesystem error handling in init
  - Location: `src/commands/init.ts:447-448`
  - `mkdirSync` calls without try/catch
  - Fix: Wrap in try/catch with user-friendly error message
  - Commit: (pending)

- [x] **Task 22:** Fix race condition in list.ts
  - Location: `src/commands/list.ts:33-42`
  - File could be deleted between readdir and stat
  - Fix: Wrap in try/catch, continue on error
  - Commit: (pending)

- [x] **Task 23:** Add stream error handling in download.ts
  - Location: `src/lib/download.ts:73-84`
  - Write errors not handled
  - Fix: Use promise wrapper with error event listener
  - Commit: (pending)

### Validation

- [ ] **Task 24:** Add project name validation
  - Location: Multiple files
  - No validation for path traversal, special chars
  - Fix: Create `validateProjectName()` in `src/lib/validation.ts`

- [ ] **Task 25:** Add type guards for execa errors
  - Location: `src/lib/errors.ts:32-38`
  - `hasExitCode` doesn't properly type narrow
  - Fix: Create proper `isExecaError` type guard

### Consistency

- [ ] **Task 26:** Standardize null vs undefined
  - Location: `src/types/index.ts:49, 51`
  - `user: string | null` but `key?: string | null`
  - Fix: Pick one convention (prefer undefined for optional)

- [ ] **Task 27:** Standardize process exit vs return
  - Locations: `src/commands/init.ts:415-416, 438-439` and others
  - Inconsistent error handling patterns
  - Fix: Throw errors, handle at top-level CLI

### Additional Refactoring

- [ ] **Task 28:** Extract common VSCode settings in templates
  - Location: `src/lib/templates.ts:44, 66, 87, 107`
  - Same terminal setting repeated in 4 templates
  - Fix: Create `COMMON_VSCODE_SETTINGS` constant

- [ ] **Task 29:** Extract Docker query helper
  - Location: `src/lib/container.ts` (6 variations)
  - Similar Docker query pattern repeated
  - Fix: Create `queryDocker()` helper function

- [ ] **Task 30:** Extract confirmation prompt helper
  - Location: `src/commands/clone.ts:72-98`, `src/commands/push.ts:111-137`
  - Double-confirmation pattern duplicated
  - Fix: Create `confirmDestructiveAction()` in `src/lib/ui.ts`

- [ ] **Task 31:** Fix recursive call in newCommand
  - Location: `src/commands/new.ts:59-60`
  - Unbounded recursion if user keeps entering existing names
  - Fix: Add retry counter or use loop with MAX_ATTEMPTS

- [ ] **Task 32:** Add cleanup on partial clone failure
  - Location: `src/commands/clone.ts:103-144`
  - Empty directory left behind on failure
  - Fix: Add cleanup in catch block

- [ ] **Task 33:** Sanitize Mutagen session names
  - Location: `src/lib/mutagen.ts:7-9`
  - Project names with special chars could fail
  - Fix: Sanitize to DNS-compatible labels

---

## Phase 4: Testing Improvements

> **Priority:** Ongoing

### Test Infrastructure

- [x] **Task 34:** Extract shared test setup to test-utils.ts
  - Problem: 15+ test files with identical beforeEach/afterEach
  - Fix: Create `createTestContext()` helper
  - Commit: `0af385f`

- [ ] **Task 35:** Unify mock detection logic
  - Locations: `container.test.ts`, `container-id-isolated.test.ts`, `status.test.ts`
  - Three different implementations
  - Fix: Create `isExecaMocked()` in test-utils.ts

- [ ] **Task 36:** Extract common config factory
  - Problem: Similar config objects in 10+ test files
  - Fix: Create `createTestConfig()` and `createTestRemote()` helpers

- [ ] **Task 37:** Extract git repository setup
  - Problem: Identical git init pattern in multiple files
  - Fix: Create `createTestGitRepo()` helper

### Test Coverage

- [ ] **Task 38:** Strengthen weak assertions
  - Location: `src/commands/__tests__/clone.test.ts:29-33`
  - Trivial assertion `expect(projectName).toBeFalsy()`
  - Fix: Actually test command behavior with mocked console

- [ ] **Task 39:** Add error path tests
  - Problem: Many happy paths tested, few error paths
  - Fix: Add tests for malformed YAML, missing fields, etc.

- [ ] **Task 40:** Add tests for projectTemplates.ts
  - Location: `src/lib/__tests__/projectTemplates.test.ts`
  - Only `validateProjectName` tested
  - Fix: Add tests for `getBuiltInTemplates()`, `getUserTemplates()`, `getAllTemplates()`

- [ ] **Task 41:** Add test for invalid YAML config loading
  - Location: `src/lib/__tests__/config.test.ts`
  - Missing test for invalid YAML syntax handling

### Test Isolation

- [ ] **Task 42:** Fix module-level mock pollution
  - Locations: `shell-docker-isolated.test.ts:12`, `lock.test.ts:7-10`
  - Global mocks affect subsequent tests
  - Fix: Reset mocks in afterEach or use dependency injection

---

## Phase 5: Documentation & Configuration

> **Priority:** Backlog

### Package.json

- [ ] **Task 43:** Add missing package.json fields
  - Add: description, license, author, homepage, repository, engines, keywords

### TypeScript Config

- [ ] **Task 44:** Add stricter TypeScript flags
  - Add: `forceConsistentCasingInFileNames`, `noUnusedLocals`, `noUnusedParameters`, `exactOptionalPropertyTypes`

### Lefthook

- [ ] **Task 45:** Add glob filter to test hook
  - Location: `lefthook.yml`
  - Tests run on all changes
  - Fix: Add `glob: "src/**/*.{ts,test.ts}"`

### Code Documentation

- [ ] **Task 46:** Add JSDoc to complex types
  - Location: `src/types/index.ts`
  - Types lack documentation
  - Fix: Add JSDoc comments with examples

- [ ] **Task 47:** Add file-level documentation
  - Each library file should have header comment
  - Explain purpose, examples, related files

- [ ] **Task 48:** Document constants and magic values
  - Location: Various files
  - Magic numbers and strings unexplained
  - Fix: Add comments explaining purpose

### Security Enhancements

- [ ] **Task 49:** Create shell escaping utility
  - Create `src/lib/shell.ts` with `escapeShellArg()` and `buildShellCommand()`

- [ ] **Task 50:** Add path traversal prevention
  - Create `isPathTraversal()` and `validatePath()` in validation.ts

- [ ] **Task 51:** Implement download checksum verification
  - Location: `src/lib/download.ts`
  - `getMutagenChecksumUrl` exists but unused
  - Fix: Verify checksums after download

### Minor Fixes

- [ ] **Task 52:** Fix inconsistent inquirer separators
  - Location: `src/commands/new.ts:135, 150`
  - Different separator styles in same function

- [ ] **Task 53:** Add debug logging for silent errors
  - Location: `src/commands/list.ts:11-23` (`getGitBranch`)
  - Errors swallowed silently
  - Fix: Add `process.env.DEBUG` conditional logging

- [ ] **Task 54:** Document error message function usage
  - Location: `src/lib/ssh.ts:104, 122`
  - Both `getErrorMessage` and `getExecaErrorMessage` used
  - Fix: Add JSDoc explaining when to use each

- [ ] **Task 55:** Notify user of config auto-migration
  - Location: `src/lib/config.ts:33-37`
  - Config silently migrated
  - Fix: Log migration or create backup

---

## Future Features

### High Priority

- [ ] **Status Dashboard (TUI):** Full-screen terminal UI with real-time sync status, container resources, one-key actions
- [ ] **Selective Sync:** Sync specific subdirectories for large monorepos
- [ ] **Hooks System:** Pre/post sync and container start hooks for custom workflows
- [ ] **Health Check Command:** `devbox doctor` to diagnose common issues

### Medium Priority

- [ ] **Offline Mode:** Explicit offline/online toggle with queued changes
- [ ] **Snapshots/Backups:** Point-in-time recovery on remote server
- [ ] **Sync Profiles:** Named sync configurations (minimal, full, custom)
- [ ] **Logs Command:** `devbox logs` for container and sync logs
- [ ] **Auto-Up on Directory Enter:** Shell hook to auto-start container
- [ ] **Project Aliases:** Short aliases for frequently used projects
- [ ] **Batch Operations:** `devbox up --all` to start multiple projects
- [ ] **Update Command:** `devbox update` for Mutagen binary and CLI updates
- [ ] **Export/Import Config:** Share config between machines easily

### Lower Priority

- [ ] **GUI / Menu Bar App:** System tray with sync status, notifications
- [ ] **Team Features:** Shared configs, project permissions
- [ ] **Resource Limits:** CPU/memory constraints per project
- [ ] **Verbose Mode:** Global `--verbose` flag for debugging
- [ ] **Dry Run Mode:** `--dry-run` to preview commands
- [ ] **JSON Output:** `--json` flag for scriptable output
- [ ] **Shell Completions:** bash/zsh/fish completions
- [ ] **Watch Mode:** `devbox status --watch` for real-time updates

### Exploratory

- [ ] Custom Sync Engine (replace Mutagen)
- [ ] Cloud Storage Backend (S3/GCS/B2)
- [ ] End-to-end Encryption
- [ ] Metrics/Analytics (local-only)

---

## Pre-Production Checklist

### Code Quality

- [x] Run full test suite: `bun test`
- [x] Type check passes: `bun run typecheck`
- [x] Linting passes: `bun run lint`
- [x] Format check: `bun run format`
- [x] No console.log in production code
- [x] Error messages are user-friendly
- [x] Pre-commit hooks configured (Lefthook)

### Feature Completion

- [x] All 14 commands implemented and working
- [x] Multi-remote support functional
- [x] Lock system prevents conflicts
- [x] Sync works bidirectionally
- [x] Editor integration works
- [x] Devcontainer templates available

### Testing (Manual)

- [ ] Fresh install on new machine (no prior config)
- [ ] Test with password-protected SSH server
- [ ] Test with existing key auth
- [ ] Push new local project to empty remote
- [ ] Clone existing remote project
- [ ] Test with project without devcontainer config
- [ ] Test with custom devcontainer config
- [ ] Test with large project (1GB+)
- [ ] Git operations: commit, branch, checkout
- [ ] Work offline for 30 min, reconnect
- [ ] Test lock takeover between two computers
- [ ] Multiple projects running simultaneously
- [ ] macOS (Intel and ARM)
- [ ] Linux (Ubuntu, Debian)

### Documentation

- [x] README.md is accurate
- [x] VitePress documentation site built
- [ ] Installation instructions tested on clean machine
- [ ] All commands documented with examples
- [ ] Configuration options documented
- [x] Troubleshooting section added

### Repository Cleanup

- [x] Remove `SPEC.md` (consolidated into PROJECT.md)
- [x] Remove `REMAINING-WORK.md` (consolidated into PROJECT.md)
- [x] Archive old plans
- [ ] Clean up worktrees after merging
- [x] Update package.json repository URL
- [x] Verify LICENSE file

### Release Preparation

- [x] Version number set (0.5.1-beta)
- [x] CHANGELOG.md maintained
- [x] CI/CD pipeline configured
- [x] Binary distribution setup (GitHub releases)
- [ ] npm registry publication configured
- [ ] Homebrew formula updated

---

## Commits Log

| Commit | Message | Tasks |
|--------|---------|-------|
| `f2910a5` | fix(security): prevent shell injection in lock.ts | Task 1 |
| `f30c765` | fix(security): quote all paths in shell commands | Task 2 |
| `6a3a098` | fix(config): remove conflicting tsconfig options | Task 3 |
| `304a43b` | refactor: extract Docker label key to constants | Task 4 |
| `383f1c3` | refactor: extract checkRemoteProjectExists to shared module | Task 5 |
| `7d5e7e8` | fix(config): enable gitignore support in Biome | Task 9 |
| `e09275d` | feat(types): add DevcontainerConfig interface | Task 10 |
| `0af385f` | feat(test): add shared test utilities module | Task 34 |
| `029ec0b` | fix(security): prevent TOCTOU race in lock acquisition | Task 14 |
| `80de7a7` | refactor: improve type safety and reduce duplication | Tasks 7, 8, 11, 12, 13 |

---

## Notes

- **Test coverage:** 26 test files with ~529 test/describe blocks
- **Environment variables:** `DEVBOX_HOME`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- **Template repos:** Placeholder URLs in `src/lib/projectTemplates.ts` need real repos or removal

---

## Files Reference

### Files with Most Issues

| File | Issue Count | Priority |
|------|-------------|----------|
| `src/lib/lock.ts` | 6 | Security |
| `src/commands/up.ts` | 8 | Complexity |
| `src/lib/container.ts` | 9 | Duplication |
| `src/lib/ssh.ts` | 7 | Magic numbers |
| `src/lib/mutagen.ts` | 5 | Duplication |
| `src/types/index.ts` | 7 | Type safety |

### New Modules to Create

- `src/lib/remote.ts` - Remote project operations
- `src/lib/validation.ts` - Input validation
- `src/lib/shell.ts` - Shell escaping utilities
- `src/lib/constants.ts` - Shared constants

---

*Last updated: 2026-01-27*

# Changelog

All notable changes to SkyBox will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.8.1] - 2026-02-10

### Added

- **SSH Passphrase-Protected Key Support**: Automatic ssh-agent integration detects passphrase-protected keys and prompts users to load them before SSH operations. Includes macOS Keychain persistence (`useKeychain` config option), no-agent detection with helpful guidance, and guards on all 8 SSH-dependent commands (up, down, clone, browse, push, status, rm, doctor).
- **Open Source Contribution Framework**: Added GitHub issue forms (bug/feature/docs), pull request template, governance docs (`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`), CODEOWNERS, and label taxonomy/automation workflows for triage and path-based PR auto-labeling.
- **Multi-Select Down**: `skybox down` now supports checkbox multi-select when run without arguments, with batch stop and batch cleanup prompts

### Changed

- **CLI Help UX**: `skybox help <command>` now includes practical descriptions, examples, and notes; top-level `skybox help` now includes a quick-start command sequence.
- **Documentation SEO**: Added frontmatter metadata, Open Graph/Twitter Card meta tags, canonical URLs, and social sharing images across all documentation pages
- Removed "From Source" installation method from documentation; updated devcontainer CLI link to official install script
- **Internal Refactor**: Consolidated shared sync finalization and start-container prompt flows across `clone`, `push`, and `new` for consistency, without changing CLI behavior.
- **Internal Refactor**: Reduced duplication in encryption/archive/download internals and test context lifecycle helpers, with no user-facing behavior changes.

### Fixed

- Remaining `escapeShellArg()` calls on remote paths replaced with `escapeRemotePath()` across clone, config-devcontainer, push, rm, ownership, remote-encryption, and remote modules
- Container rebuild used non-existent `--rebuild-if-exists` flag — replaced with correct `--remove-existing-container`
- `skybox new` encryption setup now requires passphrase re-entry confirmation before enabling encryption
- Unreliable editor launching on macOS — new `editor-launch` module with process management, fallback paths, and `skybox doctor` editor check

## [0.8.0] - 2026-02-07

### Added

- **Dry-Run Mode** (`--dry-run`): Global flag to preview what any command would do without executing side effects (SSH, Docker, filesystem writes, sync sessions)
- **Security Hardening**: Audit logging (`SKYBOX_AUDIT=1`) with detail sanitization and auto-rotation, runtime config schema validation, Mutagen binary checksum verification, lockfile integrity verification
- **Integration & E2E Test Suites**: Layered Docker integration and remote E2E test infrastructure with CI workflows and security hardening
- **Interactive Remote Delete**: Multi-select flow for `skybox rm --remote` — select a remote, pick projects via checkbox, confirm, and optionally clean up local copies
- **Shell Integration**: Auto-start containers on `cd` into project directories (`skybox hook bash/zsh`, `auto_up` config option, background execution)
- **LLMs.txt**: Machine-readable documentation for AI tools, sitemap, and robots.txt
- **Input Validation Hardening**: SSH host validation (option injection prevention), SSH config field validation (newline/metacharacter injection), remote project path validation, Docker container ID format validation, and inquirer validator adapters (`toInquirerValidator`, `sshFieldValidator`)
- **Shell Escaping**: `escapeRemotePath()` for tilde-preserving remote path escaping, `secureScp()` for SCP with argument injection prevention via `--` separator
- **Config Helpers**: `requireConfig()` replaces repetitive config-exists + load + null-check pattern across all commands
- **Self-Update for GitHub Release Installs** (`skybox update`): Downloads and installs new SkyBox versions directly with checksum verification, atomic binary replacement, and automatic rollback on failure
- **Session Integrity Checking**: Session lock files protected with HMAC-SHA256 to detect tampering
- **First-Run Telemetry**: Tracks SkyBox installations via Rybbit analytics on first run (opt-out with `SKYBOX_TELEMETRY=0`), fire-and-forget with zero latency impact

### Changed

- **DevBox → SkyBox**: Complete project rename across CLI binary, commands, documentation, configuration, and tests
- **Local Sessions**: Replaced remote SSH-based lock system with local file-based sessions (synced via Mutagen) for simpler multi-machine conflict detection
- **Feature-Based Templates**: Unified devcontainer templates to feature-based architecture with dev container features
- All exported functions converted to arrow syntax for consistency
- `isMutagenInstalled()` is now async (uses `execa` instead of `Bun.spawnSync`)
- `ContainerInfo.status` uses `ContainerStatus` enum instead of raw string, with `rawStatus` for display
- `SyncDefaults.sync_mode` narrowed from `string` to `"two-way-resolved" | "two-way-safe" | "one-way-replica"`
- Types centralized in `src/types/index.ts` (`AuditEntry`, `ResolvedProject`, `DevcontainerWorkspaceConfig`, `ValidationResult`)
- Remote paths use `escapeRemotePath()` instead of `escapeShellArg()` for proper tilde expansion
- CLI `--help` and `--version` flags skip Docker startup check
- Dynamic imports in `up` and `down` commands replaced with static imports
- Analytics configuration moved to environment variables
- Doctor command suggests `brew install devcontainer` on macOS when Homebrew is available
- Bumped dependencies (ora, @biomejs/biome, @types/react)
- `skybox doctor` now auto-repairs Mutagen installation (extracts bundled binary or downloads) instead of only warning
- Session files are now read-only (0o400) to prevent accidental modification
- `skybox update` no longer triggers the passive update-check notification
- Removed npm install method — SkyBox is distributed via GitHub Releases, Homebrew, or source only

### Fixed

- Insecure file permissions on config (now 0o600) and directories (now 0o700)
- Predictable temp directory paths vulnerable to symlink attacks
- Missing shell argument escaping in remote SSH commands
- Weak Argon2 parameters — strengthened to OWASP minimums
- Inconsistent project name validation across commands
- Missing remote path validation for shell metacharacters
- Duplicate template prompt in `skybox new` workflow
- SSH key not passed to `getRemoteProjects` for remotes with explicit key files
- SSH option injection — added `--` separator before positional args in all SSH and SCP calls
- SSH config injection — field values validated before writing to `~/.ssh/config`
- SCP argument injection — direct `execa("scp")` calls replaced with `secureScp()`
- Path traversal in clone — defense-in-depth check ensures resolved path stays within projects directory
- Unvalidated remote-sourced project names in interactive clone flow
- Unredacted credentials and home directory paths in audit log details
- Unbounded audit log growth — auto-rotates at 10 MB
- Unhandled errors in CLI entry point now caught with consistent error output
- Null-safety in `down` command — TypeScript narrowing guard replaces `project ?? ""` fallbacks
- SSH authentication error matching now case-insensitive

### Removed

- `skybox locks` command (replaced by local session system)
- Remote SSH-based lock polling
- Architecture pages from public documentation (now internal-only)
- GPG signature verification with key fingerprint pinning for Mutagen downloads (feature removed; checksum verification retained)

## [0.7.7] - 2026-02-01

### Fixed

- CI release builds failed due to `--bytecode` flag incompatible with top-level `await` in ink/yoga-layout

## [0.7.6] - 2026-02-01

### Added

- **TUI Dashboard** (`skybox dashboard`): Full-screen terminal UI with real-time container/sync status, keyboard navigation, and detailed view toggle (Ink/React)
- **Hooks System**: Pre/post lifecycle hooks for `up` and `down` commands with shell command execution
- **Multi-Select Up**: Checkbox multi-select when `skybox up` is run without arguments, with sequential start and post-start editor prompt
- **Interactive Clone**: Checkbox multi-select when `skybox clone` is run without arguments, filtering already-cloned projects
- GitHub Release notes now populated from CHANGELOG.md entries

### Fixed

- Lock ownership check enforced before release — prevents releasing another machine's lock
- Atomic lock takeover with force flag to prevent race conditions in team sync

### Changed

- Renamed internal command files from noor to skybox
- Renamed SKILL.md files to command files
- Task display uses numbered tables with free-text selection

## [0.7.5] - 2026-02-01

### Fixed

- CI release build hung on `linux-arm64` due to `--bytecode` cross-compilation issue

## [0.7.4] - 2026-02-01

### Fixed

- Mutagen download script matched `MUTAGEN_VERSION_FILE` instead of `MUTAGEN_VERSION`, causing 404 errors in CI release builds

## [0.7.3] - 2026-02-01

### Added

- Linux ARM64 (`skybox-linux-arm64`) release binary for AWS Graviton, Raspberry Pi, and other ARM servers
- Build optimizations: `--minify`, `--sourcemap`, and `--bytecode` flags for smaller, faster binaries

### Changed

- Migrated all imports to TypeScript path aliases (`@commands/*`, `@lib/*`, `@typedefs/*`)
- Consolidated all constants to single source of truth in `src/lib/constants.ts`
- Migrated hookify to native stop hook and added release skills

### Fixed

- Mutagen download used stale pinned version (0.17.5) instead of canonical version from constants (0.18.1)
- Circular scrolling disabled in template picker for better UX

## [0.7.2] - 2026-01-30

### Fixed

- Fix release workflow: add `setup-node` for `argon2` native addon postinstall scripts
- Upgrade GitHub Actions (`checkout`, `setup-node`) to v6
- Use Node 25 in CI and release workflows

## [0.7.1] - 2026-01-30

### Fixed

- Suppress Biome warnings for devcontainer variable placeholders (e.g., `${localWorkspaceFolder}`)

## [0.7.0] - 2026-01-30

### Added

- **Version Update Notification**: One-line footer after commands when a newer SkyBox version is available on GitHub Releases. Checks once per day (cached to `~/.skybox/.update-check.json`). Channel-aware: stable users see stable releases only, beta users see all releases.
- **Install Method Detection**: `INSTALL_METHOD` constant embedded at build time (`homebrew`, `github-release`, `npm`, `source`). Used by update notification to show the correct upgrade command.
- **Bundled Mutagen**: Platform-specific Mutagen binary is now embedded inside the compiled SkyBox binary. Extracted to `~/.skybox/bin/mutagen` on first run or after version mismatch. Removes the need for `skybox update` end-user flow.
- **Custom Local Templates**: Store reusable `devcontainer.json` files in `~/.skybox/templates/`. Filename becomes display name (e.g., `bun.json` → "bun"). Unified `selectTemplate()` component replaces fragmented template logic. CLI flow to scaffold new templates with required fields, editor options, and validation.

### Changed

- Bumped Commander.js to 14.0.3
- Updated `GITHUB_OWNER` constant for new org
- Unified VitePress sidebar and command overview from a single source
- Reorganized implementation docs: split into active tracker (`plans/IMPLEMENTATION.md`) and archive (`plans/archive/ARCHIVED-IMPLEMENTATION.md`)
- Archived completed design and plan documents

## [0.6.0-beta] - 2026-01-28

### Added

- **New Commands**:
  - `skybox logs` — Show container or sync logs with follow mode and filtering
  - `skybox update` — Update Mutagen binary to latest bundled version
  - `skybox doctor` — Diagnose common issues (Docker, Mutagen, SSH, config)
  - `skybox open` — Open editor/shell for a running container
- **Batch Operations**: `up --all` and `down --all` to start/stop all projects at once
- **Interactive rm**: Multi-select checkbox UI when `skybox rm` is called without arguments
- **Remote Delete**: `rm --remote` flag with double confirmation to delete project from remote server
- **Selective Sync**: `config sync-paths` for per-project directory-level sync control
- **Encryption**: `config encryption enable/disable` for AES-256-GCM config file encryption
- **Project Encryption at Rest**: `skybox encrypt enable/disable` for per-project archive encryption using Argon2id + AES-256-GCM, integrated into `up`/`down`/`clone`/`new`/`init` flows
- **Devcontainer Repair**: `config devcontainer edit/reset` for editing or regenerating devcontainer.json
- **Non-interactive Mode**: `--no-prompt` flag on `up`, `down`, and `open` commands
- **Verbose Mode**: `up --verbose` for detailed error output during container startup
- **Input Validation**: Path traversal prevention across all user inputs

### Changed

- Test infrastructure unified with shared helpers (`createTestContext`, `isExecaMocked`)
- Comprehensive documentation update across all command references

## [0.5.1-beta] - 2026-01-27

### Added

- **Shell Lock Check**: Shell command now checks lock status before granting access
  - Warns if no lock is held
  - Blocks if project is locked by another machine
  - `--force` flag to bypass lock check
- **Type Safety Improvements**:
  - `SyncStatusValue` type for sync status values (`"syncing" | "paused" | "none" | "error"`)
  - `ContainerStatus.Unknown` enum variant
  - `DevcontainerConfig` interface for devcontainer.json structure

### Changed

- Template URLs documented as placeholders requiring setup
- Extracted shared code into new modules:
  - `src/lib/constants.ts` - Shared constants (Docker labels, etc.)
  - `src/lib/remote.ts` - Remote project operations
  - `src/lib/shell.ts` - Shell escaping utilities
- Improved SSH module with keyword constants and 10s timeout
- Mutagen module uses `executeMutagenCommand()` helper to reduce duplication

### Fixed

- **Security**: TOCTOU race condition in lock acquisition now uses atomic test-and-set
- **Security**: Conflicting TypeScript compiler options (`declaration` vs `noEmit`)
- Biome now respects `.gitignore` patterns

## [0.5.0] - 2026-01-25

### Added

- **Remote Command** (`skybox remote`): Manage multiple remote servers
  - `skybox remote add <name> <url>` - Add a remote
  - `skybox remote list` - List configured remotes
  - `skybox remote remove <name>` - Remove a remote
  - `skybox remote rename <old> <new>` - Rename a remote
- **Multi-Remote Support**: Configure multiple SSH remotes per config file
- **Config Command Enhancements** (`skybox config`):
  - `--validate` flag to test connection to all remotes
  - View and modify configuration values

### Changed

- Config format migrated from v1 (single remote) to v2 (multi-remote)
- Automatic config migration on first load

## [0.4.0] - 2026-01-23

### Added

- **New Command** (`skybox new`): Create new projects on remote server from templates
  - Interactive project type selection (empty directory vs template)
  - Template browser with built-in and user templates
  - Project name validation
  - Template cloning to remote server
- **Shell Command** (`skybox shell`): Enter an interactive shell in a running container
- **VitePress Documentation Site**: Comprehensive documentation with:
  - Getting started guide
  - Command reference for all 10 commands
  - Architecture documentation with codebase guide and design decisions
  - Workflow tutorials for new projects, daily development, and team sharing
  - Configuration reference

### Changed

- Removed bun.lock from version control

## [0.3.0] - 2026-01-22

### Added

- **Status Command** (`skybox status`): Display detailed project status
  - Overview table with colored output
  - Git info, disk usage, and last active helpers
  - Detailed view with all sections
  - Real lock status display
- **Remove Command** (`skybox rm`): Remove local project directories
- **Lock System**: Multi-machine coordination for shared remotes
  - Lock acquisition on container start (`up`)
  - Lock release and sync flush on container stop (`down`)
  - Lock status types and operations

### Changed

- Refactored type definitions into centralized `types/index.ts`
- Moved test files to `__tests__` directories
- Centralized error handling with improved error messages
- Added Biome config for linting and formatting
- Improved prompt handling and container path normalization

### Fixed

- Case sensitivity in paths test

## [0.2.0] - 2026-01-21

### Added

- **Up Command** (`skybox up`): Start development container
  - Container status detection
  - Container start/stop functions
  - Editor opening support
  - Shell attach function
  - Devcontainer config detection
  - Devcontainer templates
  - Project resolution helpers
- **Down Command** (`skybox down`): Stop development container
- **Editor Command** (`skybox editor`): Open project in configured editor
- **Clone Command** (`skybox clone`): Clone remote project to local machine
  - Mutagen module for sync operations
- **Push Command** (`skybox push`): Push local changes to remote
- **Browse Command** (`skybox browse`): Browse remote projects
- **List Command** (`skybox list`): List local projects

### Fixed

- SSH key prompt before connection test for new servers
- User@host format for new server SSH operations
- Custom SSH key path support in init wizard

## [0.1.0] - 2026-01-20

### Added

- **Initial Release**
- **Init Command** (`skybox init`): Initialize SkyBox configuration
  - Interactive setup wizard
  - SSH config parsing and connection testing
  - Mutagen binary download and management
  - Configuration file read/write
- Core infrastructure:
  - TypeScript types for config and SSH
  - Paths module for SkyBox directory constants
  - UI module for terminal output helpers
  - Commander CLI setup
- Project documentation:
  - SPEC.md with project specification
  - Design documents for commands
  - Implementation plans

[0.8.1]: https://github.com/NoorXLabs/SkyBox/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/NoorXLabs/SkyBox/compare/v0.7.7...v0.8.0
[0.7.7]: https://github.com/NoorXLabs/SkyBox/compare/v0.7.6...v0.7.7
[0.7.6]: https://github.com/NoorXLabs/SkyBox/compare/v0.7.5...v0.7.6
[0.7.5]: https://github.com/NoorXLabs/SkyBox/compare/v0.7.4...v0.7.5
[0.7.4]: https://github.com/NoorXLabs/SkyBox/compare/v0.7.3...v0.7.4
[0.7.3]: https://github.com/NoorXLabs/SkyBox/compare/v0.7.2...v0.7.3
[0.7.2]: https://github.com/NoorXLabs/SkyBox/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/NoorXLabs/SkyBox/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/NoorXLabs/SkyBox/compare/v0.6.0-beta...v0.7.0
[0.6.0-beta]: https://github.com/NoorXLabs/SkyBox/compare/v0.5.1-beta...v0.6.0-beta
[0.5.1-beta]: https://github.com/NoorXLabs/SkyBox/compare/v0.5.0...v0.5.1-beta
[0.5.0]: https://github.com/NoorXLabs/SkyBox/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/NoorXLabs/SkyBox/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/NoorXLabs/SkyBox/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/NoorXLabs/SkyBox/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/NoorXLabs/SkyBox/releases/tag/v0.1.0

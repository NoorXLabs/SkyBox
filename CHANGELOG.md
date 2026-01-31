# Changelog

All notable changes to DevBox will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

- **Version Update Notification**: One-line footer after commands when a newer DevBox version is available on GitHub Releases. Checks once per day (cached to `~/.devbox/.update-check.json`). Channel-aware: stable users see stable releases only, beta users see all releases.
- **Install Method Detection**: `INSTALL_METHOD` constant embedded at build time (`homebrew`, `github-release`, `npm`, `source`). Used by update notification to show the correct upgrade command.
- **Bundled Mutagen**: Platform-specific Mutagen binary is now embedded inside the compiled DevBox binary. Extracted to `~/.devbox/bin/mutagen` on first run or after version mismatch. Removes the need for `devbox update` end-user flow.
- **Custom Local Templates**: Store reusable `devcontainer.json` files in `~/.devbox/templates/`. Filename becomes display name (e.g., `bun.json` → "bun"). Unified `selectTemplate()` component replaces fragmented template logic. CLI flow to scaffold new templates with required fields, editor options, and validation.

### Changed

- Bumped Commander.js to 14.0.3
- Updated `GITHUB_OWNER` constant for new org
- Unified VitePress sidebar and command overview from a single source
- Reorganized implementation docs: split into active tracker (`plans/IMPLEMENTATION.md`) and archive (`plans/archive/ARCHIVED-IMPLEMENTATION.md`)
- Archived completed design and plan documents

## [0.6.0-beta] - 2026-01-28

### Added

- **New Commands**:
  - `devbox logs` — Show container or sync logs with follow mode and filtering
  - `devbox update` — Update Mutagen binary to latest bundled version
  - `devbox doctor` — Diagnose common issues (Docker, Mutagen, SSH, config)
  - `devbox open` — Open editor/shell for a running container
- **Batch Operations**: `up --all` and `down --all` to start/stop all projects at once
- **Interactive rm**: Multi-select checkbox UI when `devbox rm` is called without arguments
- **Remote Delete**: `rm --remote` flag with double confirmation to delete project from remote server
- **Selective Sync**: `config sync-paths` for per-project directory-level sync control
- **Encryption**: `config encryption enable/disable` for AES-256-GCM config file encryption
- **Project Encryption at Rest**: `devbox encrypt enable/disable` for per-project archive encryption using Argon2id + AES-256-GCM, integrated into `up`/`down`/`clone`/`new`/`init` flows
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

- **Remote Command** (`devbox remote`): Manage multiple remote servers
  - `devbox remote add <name> <url>` - Add a remote
  - `devbox remote list` - List configured remotes
  - `devbox remote remove <name>` - Remove a remote
  - `devbox remote rename <old> <new>` - Rename a remote
- **Multi-Remote Support**: Configure multiple SSH remotes per config file
- **Config Command Enhancements** (`devbox config`):
  - `--validate` flag to test connection to all remotes
  - View and modify configuration values

### Changed

- Config format migrated from v1 (single remote) to v2 (multi-remote)
- Automatic config migration on first load

## [0.4.0] - 2026-01-23

### Added

- **New Command** (`devbox new`): Create new projects on remote server from templates
  - Interactive project type selection (empty directory vs template)
  - Template browser with built-in and user templates
  - Project name validation
  - Template cloning to remote server
- **Shell Command** (`devbox shell`): Enter an interactive shell in a running container
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

- **Status Command** (`devbox status`): Display detailed project status
  - Overview table with colored output
  - Git info, disk usage, and last active helpers
  - Detailed view with all sections
  - Real lock status display
- **Remove Command** (`devbox rm`): Remove local project directories
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

- **Up Command** (`devbox up`): Start development container
  - Container status detection
  - Container start/stop functions
  - Editor opening support
  - Shell attach function
  - Devcontainer config detection
  - Devcontainer templates
  - Project resolution helpers
- **Down Command** (`devbox down`): Stop development container
- **Editor Command** (`devbox editor`): Open project in configured editor
- **Clone Command** (`devbox clone`): Clone remote project to local machine
  - Mutagen module for sync operations
- **Push Command** (`devbox push`): Push local changes to remote
- **Browse Command** (`devbox browse`): Browse remote projects
- **List Command** (`devbox list`): List local projects

### Fixed

- SSH key prompt before connection test for new servers
- User@host format for new server SSH operations
- Custom SSH key path support in init wizard

## [0.1.0] - 2026-01-20

### Added

- **Initial Release**
- **Init Command** (`devbox init`): Initialize DevBox configuration
  - Interactive setup wizard
  - SSH config parsing and connection testing
  - Mutagen binary download and management
  - Configuration file read/write
- Core infrastructure:
  - TypeScript types for config and SSH
  - Paths module for DevBox directory constants
  - UI module for terminal output helpers
  - Commander CLI setup
- Project documentation:
  - SPEC.md with project specification
  - Design documents for commands
  - Implementation plans

[0.7.2]: https://github.com/NoorXLabs/DevBox/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/NoorXLabs/DevBox/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/NoorXLabs/DevBox/compare/v0.6.0-beta...v0.7.0
[0.6.0-beta]: https://github.com/NoorXLabs/DevBox/compare/v0.5.1-beta...v0.6.0-beta
[0.5.1-beta]: https://github.com/NoorXLabs/DevBox/compare/v0.5.0...v0.5.1-beta
[0.5.0]: https://github.com/NoorXLabs/DevBox/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/NoorXLabs/DevBox/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/NoorXLabs/DevBox/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/NoorXLabs/DevBox/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/NoorXLabs/DevBox/releases/tag/v0.1.0

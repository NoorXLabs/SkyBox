# Changelog

All notable changes to DevBox will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.5.1-beta]: https://github.com/NoorChasib/DevBox/compare/v0.5.0...v0.5.1-beta
[0.5.0]: https://github.com/NoorChasib/DevBox/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/NoorChasib/DevBox/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/NoorChasib/DevBox/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/NoorChasib/DevBox/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/NoorChasib/DevBox/releases/tag/v0.1.0

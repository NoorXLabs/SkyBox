# Changelog

All notable changes to DevBox will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.4.0]: https://github.com/owner/devbox/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/owner/devbox/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/owner/devbox/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/owner/devbox/releases/tag/v0.1.0

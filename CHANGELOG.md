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

[0.8.1]: https://github.com/NoorXLabs/SkyBox/compare/v0.8.0...v0.8.1

# Changelog

All notable changes to SkyBox will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.8.7] - 2026-02-11

### Changed

- Encryption key derivation switched from Argon2id to built-in `node:crypto.scrypt` (`N=65536`, `r=8`, `p=1`, `maxmem=128 MiB`).
- Project encryption metadata now records `kdf: "scrypt"` and `kdfParamsVersion: 1` when enabling encryption.

### Removed

- Removed the `argon2` runtime dependency and legacy Argon2 fallback decryption paths.

## [0.8.5] - 2026-02-11

### Fixed

- Fixed direct installer checksum verification failures caused by ambiguous checksum matches (for example, `skybox-linux-arm64` also matching `skybox-linux-arm64.tar.gz`).
- Release packaging now keeps `checksums.txt` binary-only and publishes `checksums-all.txt` for full artifact hashes.

## [0.8.4] - 2026-02-11

### Fixed

- Release workflow now generates `checksums.txt` before creating the GitHub release so all listed assets upload reliably.
- `scripts/release.sh` now pushes only the current release tag instead of all tags to ensure tag-triggered release workflows run consistently.

## [0.8.3] - 2026-02-11

### Changed

- Release housekeeping for `v0.8.3` with basic release metadata updates.

## [0.8.2] - 2026-02-10

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

[0.8.2]: https://github.com/NoorXLabs/SkyBox/compare/v0.8.1...v0.8.2
[0.8.3]: https://github.com/NoorXLabs/SkyBox/compare/v0.8.2...v0.8.3
[0.8.4]: https://github.com/NoorXLabs/SkyBox/compare/v0.8.3...v0.8.4
[0.8.5]: https://github.com/NoorXLabs/SkyBox/compare/v0.8.4...v0.8.5
[0.8.7]: https://github.com/NoorXLabs/SkyBox/compare/v0.8.6...v0.8.7
[Unreleased]: https://github.com/NoorXLabs/SkyBox/compare/v0.8.7...HEAD

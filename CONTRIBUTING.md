# Contributing to SkyBox

Thanks for taking the time to contribute.

## Before You Start

- Read the [Code of Conduct](CODE_OF_CONDUCT.md).
- Search existing [issues](https://github.com/NoorXLabs/SkyBox/issues) and [discussions](https://github.com/NoorXLabs/SkyBox/discussions) before opening a new thread.
- Use issue forms for bugs, feature requests, and docs improvements.

## Development Setup

1. Fork and clone the repository.
2. Install dependencies:

```bash
bun install
```

3. Run local checks before opening a PR:

```bash
bun run check:ci
bun run typecheck
bun run test
```

Use `bun run test:integration` and `bun run test:e2e` when your changes affect Docker, SSH, remote workflows, or release behavior.

## Branches and Commits

- Keep changes focused and scoped to one topic.
- Follow conventional commits:
  - `feat: ...`
  - `fix: ...`
  - `docs: ...`
  - `refactor: ...`
  - `test: ...`
  - `chore: ...`
- Write PR titles with the same prefixes to help auto-labeling.

## Pull Request Expectations

- Fill out the PR template completely.
- Link related issues (`Closes #123`).
- Include testing evidence and relevant command output.
- Update docs for any user-facing behavior change.
- Update `CHANGELOG.md` for user-facing changes (skip docs-only or internal-only changes).

## Reporting Bugs and Requesting Features

- Bug reports: use the Bug Report issue form.
- Feature requests: use the Feature Request issue form.
- Documentation updates: use the Documentation Improvement issue form.
- Questions/support: use [GitHub Discussions](https://github.com/NoorXLabs/SkyBox/discussions).

## Security Issues

Do not open public issues for vulnerabilities. Follow [SECURITY.md](SECURITY.md) and report privately.


# DevBox Remaining Work Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete all remaining work items from PROJECT.md to prepare DevBox for production release.

**Architecture:** This plan covers code improvements (lock checking in shell, template cleanup), documentation updates (CHANGELOG, troubleshooting), and repository cleanup (removing obsolete files, archiving plans).

**Tech Stack:** TypeScript/Bun, Commander.js, VitePress, Git

---

## Task 1: Add Lock Status Check to Shell Command

**Files:**
- Modify: `src/commands/shell.ts:42-48`
- Modify: `src/types/index.ts` (add ShellOptions.force)
- Test: `src/commands/__tests__/shell.test.ts`

**Step 1: Write the failing test for lock check behavior**

Add to `src/commands/__tests__/shell.test.ts`:

```typescript
describe("lock status checking", () => {
	test("ShellOptions type includes force flag", () => {
		// Type-level test - if this compiles, the type is correct
		const options: ShellOptions = { force: true };
		expect(options.force).toBe(true);
	});
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/commands/__tests__/shell.test.ts`
Expected: FAIL with type error "force does not exist on type ShellOptions"

**Step 3: Add force option to ShellOptions type**

In `src/types/index.ts`, update ShellOptions:

```typescript
// Shell command types
export interface ShellOptions {
	command?: string;
	force?: boolean;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/commands/__tests__/shell.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/index.ts src/commands/__tests__/shell.test.ts
git commit -m "$(cat <<'EOF'
feat(shell): add force option type for lock bypass
EOF
)"
```

---

## Task 2: Implement Lock Check in Shell Command

**Files:**
- Modify: `src/commands/shell.ts:1-50`
- Modify: `src/index.ts` (add --force option)

**Step 1: Update shell.ts imports and add lock check**

Replace `src/commands/shell.ts` lines 1-49 with:

```typescript
// src/commands/shell.ts

import { execa } from "execa";
import inquirer from "inquirer";
import { configExists, loadConfig, getProjectRemote } from "../lib/config.ts";
import {
	getContainerId,
	getContainerStatus,
	getDevcontainerConfig,
} from "../lib/container.ts";
import { createLockRemoteInfo, getLockStatus } from "../lib/lock.ts";
import { getProjectPath, projectExists } from "../lib/project.ts";
import { error, header, info, warning } from "../lib/ui.ts";
import { ContainerStatus, type ShellOptions } from "../types/index.ts";
import { upCommand } from "./up.ts";

export async function shellCommand(
	project: string,
	options: ShellOptions,
): Promise<void> {
	// Step 1: Check config exists
	if (!configExists()) {
		error("devbox not configured. Run 'devbox init' first.");
		process.exit(1);
	}

	const config = loadConfig();
	if (!config) {
		error("Failed to load config.");
		process.exit(1);
	}

	// Step 2: Verify project exists locally
	if (!projectExists(project)) {
		error(
			`Project '${project}' not found. Run 'devbox clone ${project}' first.`,
		);
		process.exit(1);
	}

	const projectPath = getProjectPath(project);

	// Step 3: Check lock status
	if (!options.force) {
		const remote = getProjectRemote(project);
		if (remote) {
			const remoteInfo = createLockRemoteInfo(remote);
			const lockStatus = await getLockStatus(project, remoteInfo);

			if (lockStatus.locked && !lockStatus.ownedByMe) {
				error(
					`Project '${project}' is locked by ${lockStatus.info.machine} (${lockStatus.info.user}).`,
				);
				info("Use --force to bypass lock check (use with caution).");
				process.exit(1);
			}

			if (!lockStatus.locked) {
				warning(
					"No lock held. Run 'devbox up' first to acquire lock for safe editing.",
				);
			}
		}
	}
```

**Step 2: Register --force option in index.ts**

Find the shell command registration in `src/index.ts` and add the force option:

```typescript
program
	.command("shell")
	.description("Open shell in running container")
	.argument("<project>", "project name")
	.option("-c, --command <cmd>", "run single command instead of interactive shell")
	.option("-f, --force", "bypass lock check")
	.action(async (project: string, options: ShellOptions) => {
		await shellCommand(project, options);
	});
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS (no type errors)

**Step 4: Run tests**

Run: `bun test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/commands/shell.ts src/index.ts
git commit -m "$(cat <<'EOF'
feat(shell): add lock status check with --force bypass

- Check lock before allowing shell access
- Warn if no lock is held
- Block if locked by another machine
- Add --force flag to bypass check
EOF
)"
```

---

## Task 3: Handle Template Repository Decision

**Files:**
- Modify: `src/lib/projectTemplates.ts`

**Step 1: Update template URLs to mark as placeholders clearly**

Replace the template definitions in `src/lib/projectTemplates.ts`:

```typescript
// src/lib/projectTemplates.ts

import type { BuiltInTemplate, UserTemplate } from "../types/index.ts";
import { loadConfig } from "./config.ts";

// Built-in project templates
// Note: These templates require creating actual repos at these URLs,
// or users should define their own templates via config.
// See: devbox config templates.mytemplate https://github.com/user/template
export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
	{
		id: "node",
		name: "Node.js",
		url: "https://github.com/devbox-templates/node-starter",
	},
	{
		id: "bun",
		name: "Bun",
		url: "https://github.com/devbox-templates/bun-starter",
	},
	{
		id: "python",
		name: "Python",
		url: "https://github.com/devbox-templates/python-starter",
	},
	{
		id: "go",
		name: "Go",
		url: "https://github.com/devbox-templates/go-starter",
	},
];
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/projectTemplates.ts
git commit -m "$(cat <<'EOF'
docs(templates): clarify template URLs are placeholders

Templates require creating actual repos or users should define
their own via devbox config
EOF
)"
```

---

## Task 4: Update CHANGELOG for v0.5.x

**Files:**
- Modify: `CHANGELOG.md`

**Step 1: Add v0.5.0 and v0.5.1-beta entries**

Add after the header and before [0.4.0]:

```markdown
## [0.5.1-beta] - 2026-01-27

### Added

- **Shell Lock Check**: Shell command now checks lock status before granting access
  - Warns if no lock is held
  - Blocks if project is locked by another machine
  - `--force` flag to bypass lock check

### Changed

- Template URLs documented as placeholders requiring setup

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
```

**Step 2: Update version links at bottom**

Add links:

```markdown
[0.5.1-beta]: https://github.com/owner/devbox/compare/v0.5.0...v0.5.1-beta
[0.5.0]: https://github.com/owner/devbox/compare/v0.4.0...v0.5.0
```

**Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "$(cat <<'EOF'
docs: update CHANGELOG for v0.5.x releases

- Add v0.5.0 with remote command and multi-remote support
- Add v0.5.1-beta with shell lock checking
EOF
)"
```

---

## Task 5: Add Troubleshooting Section to Docs

**Files:**
- Create: `docs/guide/troubleshooting.md`
- Modify: `docs/.vitepress/config.ts` (add to sidebar)

**Step 1: Create troubleshooting guide**

Create `docs/guide/troubleshooting.md`:

```markdown
# Troubleshooting

Common issues and solutions for DevBox.

## Connection Issues

### SSH Connection Failed

**Symptoms:**
- `devbox init` fails to connect
- `devbox browse` times out

**Solutions:**

1. **Test SSH manually:**
   ```bash
   ssh your-host
   ```

2. **Check SSH config:**
   ```bash
   cat ~/.ssh/config
   ```

3. **Verify host is reachable:**
   ```bash
   ping your-host
   ```

4. **Check SSH key permissions:**
   ```bash
   chmod 600 ~/.ssh/id_rsa
   chmod 644 ~/.ssh/id_rsa.pub
   ```

### Permission Denied

**Symptoms:**
- `Permission denied (publickey)`

**Solutions:**

1. **Add key to SSH agent:**
   ```bash
   ssh-add ~/.ssh/id_rsa
   ```

2. **Specify key in devbox config:**
   ```bash
   devbox remote add myserver user@host --key ~/.ssh/specific_key
   ```

## Container Issues

### Container Won't Start

**Symptoms:**
- `devbox up` hangs or fails
- Container status shows "error"

**Solutions:**

1. **Check Docker is running:**
   ```bash
   docker ps
   ```

2. **Rebuild container:**
   ```bash
   devbox up myproject --rebuild
   ```

3. **Check devcontainer.json:**
   ```bash
   cat ~/.devbox/Projects/myproject/.devcontainer/devcontainer.json
   ```

### Container Not Found

**Symptoms:**
- `devbox shell` says container not found

**Solutions:**

1. **Start the container first:**
   ```bash
   devbox up myproject
   ```

2. **Check container status:**
   ```bash
   devbox status myproject
   ```

## Sync Issues

### Sync Not Working

**Symptoms:**
- Files not appearing on remote
- `devbox status` shows sync errors

**Solutions:**

1. **Check Mutagen status:**
   ```bash
   ~/.devbox/bin/mutagen sync list
   ```

2. **Restart sync session:**
   ```bash
   devbox down myproject
   devbox up myproject
   ```

3. **Check ignored files:**
   Review `defaults.ignore` in `~/.devbox/config.yaml`

### Sync Conflicts

**Symptoms:**
- Mutagen reports conflicts

**Solutions:**

1. **Check Mutagen conflicts:**
   ```bash
   ~/.devbox/bin/mutagen sync list --long
   ```

2. **Resolve manually:**
   Choose which version to keep and delete the other

## Lock Issues

### Project Locked by Another Machine

**Symptoms:**
- `devbox up` fails with lock error
- Message: "Project is locked by [machine]"

**Solutions:**

1. **Proper handoff:** On the other machine:
   ```bash
   devbox down myproject
   ```

2. **Force takeover (use with caution):**
   ```bash
   devbox up myproject --force
   ```

### Stale Lock

**Symptoms:**
- Lock from crashed session
- Machine listed no longer exists

**Solutions:**

1. **Force acquire lock:**
   ```bash
   devbox up myproject --force
   ```

## Configuration Issues

### Config File Corrupted

**Symptoms:**
- YAML parse errors
- Commands fail immediately

**Solutions:**

1. **Validate config:**
   ```bash
   devbox config --validate
   ```

2. **Reset config:**
   ```bash
   rm ~/.devbox/config.yaml
   devbox init
   ```

### Missing Remote

**Symptoms:**
- "Remote 'xxx' not found"

**Solutions:**

1. **List remotes:**
   ```bash
   devbox remote list
   ```

2. **Add missing remote:**
   ```bash
   devbox remote add myremote user@host
   ```

## Getting Help

If these solutions don't help:

1. **Check logs:**
   ```bash
   devbox status myproject --detailed
   ```

2. **Run with verbose:**
   ```bash
   DEVBOX_DEBUG=1 devbox up myproject
   ```

3. **Report an issue:**
   [GitHub Issues](https://github.com/owner/devbox/issues)
```

**Step 2: Run docs build to verify**

Run: `bun run docs:build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add docs/guide/troubleshooting.md
git commit -m "$(cat <<'EOF'
docs: add troubleshooting guide

Covers common issues:
- SSH connection problems
- Container issues
- Sync problems
- Lock conflicts
- Configuration errors
EOF
)"
```

---

## Task 6: Update VitePress Sidebar for Troubleshooting

**Files:**
- Modify: `docs/.vitepress/config.ts`

**Step 1: Read current config**

Read the VitePress config to understand sidebar structure.

**Step 2: Add troubleshooting to sidebar**

Add under the Guide section:

```typescript
{
  text: 'Troubleshooting',
  link: '/guide/troubleshooting'
}
```

**Step 3: Run docs:dev to verify**

Run: `bun run docs:dev`
Expected: Troubleshooting appears in sidebar

**Step 4: Commit**

```bash
git add docs/.vitepress/config.ts
git commit -m "$(cat <<'EOF'
docs: add troubleshooting to sidebar
EOF
)"
```

---

## Task 7: Repository Cleanup - Remove Obsolete Files

**Files:**
- Delete: `SPEC.md` (if exists)
- Delete: `REMAINING-WORK.md` (if exists)

**Step 1: Check if files exist and remove**

```bash
ls -la SPEC.md REMAINING-WORK.md 2>/dev/null || echo "Files already removed"
```

**Step 2: Remove if they exist**

```bash
git rm SPEC.md REMAINING-WORK.md 2>/dev/null || echo "No files to remove"
```

**Step 3: Commit if changes made**

```bash
git diff --cached --quiet || git commit -m "$(cat <<'EOF'
chore: remove obsolete spec files

Content consolidated into PROJECT.md
EOF
)"
```

---

## Task 8: Archive Old Design Plans

**Files:**
- Move: `design/plans/*.md` to `design/plans/archive/`
- Move: `docs/plans/*.md` to `docs/plans/archive/`

**Step 1: Create archive directories**

```bash
mkdir -p design/plans/archive docs/plans/archive
```

**Step 2: Move design plans to archive**

```bash
git mv design/plans/*.md design/plans/archive/ 2>/dev/null || echo "No design plans to move"
```

**Step 3: Move docs plans to archive (except this plan)**

```bash
cd docs/plans && for f in *.md; do
  if [ "$f" != "2026-01-27-remaining-work.md" ]; then
    git mv "$f" archive/ 2>/dev/null
  fi
done
```

**Step 4: Commit**

```bash
git add design/plans/ docs/plans/
git commit -m "$(cat <<'EOF'
chore: archive completed implementation plans

Move historical plans to archive subdirectories
EOF
)"
```

---

## Task 9: Update package.json Repository URL

**Files:**
- Modify: `package.json`

**Step 1: Read current package.json**

Check if repository field exists and needs updating.

**Step 2: Add/update repository field**

Add to package.json:

```json
{
  "repository": {
    "type": "git",
    "url": "git+https://github.com/NoorChasib/DevBox.git"
  },
  "bugs": {
    "url": "https://github.com/NoorChasib/DevBox/issues"
  },
  "homepage": "https://github.com/NoorChasib/DevBox#readme"
}
```

**Step 3: Verify JSON is valid**

Run: `bun run check`
Expected: No JSON syntax errors

**Step 4: Commit**

```bash
git add package.json
git commit -m "$(cat <<'EOF'
chore: add repository metadata to package.json
EOF
)"
```

---

## Task 10: Verify LICENSE File

**Files:**
- Verify: `LICENSE`

**Step 1: Check LICENSE exists and is valid**

Run: `head -5 LICENSE`
Expected: Apache License header

**Step 2: No changes needed if valid**

LICENSE file contains Apache 2.0 - no updates required.

---

## Task 11: Update PROJECT.md Remaining Work Section

**Files:**
- Modify: `PROJECT.md`

**Step 1: Mark completed items in Section 6**

Update the checkboxes to mark items complete:

```markdown
### Minor Improvements

- [x] Add lock status check in `shell` command (currently bypassed)
- [ ] Create actual template repositories or remove template feature
- [x] Add `--force` flag to `shell` to bypass lock check

### Documentation Updates

- [x] Update CHANGELOG.md for v0.5.x changes (remote, config commands)
- [ ] Review and update VitePress docs for accuracy
- [x] Add troubleshooting section to docs
```

**Step 2: Update Code TODOs table**

Remove completed items or mark with ✅

**Step 3: Commit**

```bash
git add PROJECT.md
git commit -m "$(cat <<'EOF'
docs: update PROJECT.md with completed items
EOF
)"
```

---

## Summary

| Task | Description | Priority |
|------|-------------|----------|
| 1 | Add force option type to ShellOptions | High |
| 2 | Implement lock check in shell command | High |
| 3 | Document template URLs as placeholders | Medium |
| 4 | Update CHANGELOG for v0.5.x | Medium |
| 5 | Create troubleshooting guide | Medium |
| 6 | Add troubleshooting to sidebar | Medium |
| 7 | Remove obsolete SPEC.md/REMAINING-WORK.md | Low |
| 8 | Archive old design plans | Low |
| 9 | Update package.json repository URL | Low |
| 10 | Verify LICENSE file | Low |
| 11 | Update PROJECT.md completed items | Low |

**Total: 11 tasks**

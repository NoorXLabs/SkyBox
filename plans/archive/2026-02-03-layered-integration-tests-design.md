# Layered Integration Tests Design

**Date:** 2026-02-03
**Status:** Approved
**Author:** Claude + Noor

## Overview

Add real integration and E2E tests to SkyBox to complement the existing unit test suite. The goal is to catch bugs that mocked tests miss, prevent regressions, validate releases, and harden CI/CD — without sacrificing speed or creating maintenance burden.

## Test Tiers

| Tier | Runs Against | When | Speed |
|------|--------------|------|-------|
| **Unit** (existing) | Mocks/filesystem | Every commit, pre-commit | ~5s |
| **Integration** | Real Docker locally | CI + manual | ~60s |
| **E2E** | Real remote server | CI nightly or pre-release | ~3-5min |

## Integration Tier (Local Docker Tests)

### Purpose

Verify real Docker/devcontainer operations work — not mocked, but without needing network access.

### What Gets Tested

- Container lifecycle: `skybox up` actually starts a container, `skybox down` stops it
- Shell entry: `skybox shell` opens a real shell in the running container
- Devcontainer config: Templates produce working containers
- Editor integration: `skybox open` launches with correct paths

### Test Isolation Strategy

- Each test uses a unique project name: `test-{timestamp}-{random}`
- Containers labeled with `skybox-test=true` for easy cleanup
- Cleanup runs in `afterEach` AND a global `afterAll` sweeper catches orphans
- Test projects live in temp directory, not `~/.skybox`

### File Structure

```
src/__integration__/
  docker/
    container-lifecycle.test.ts   # up/down/status
    shell-entry.test.ts           # shell command
    devcontainer-templates.test.ts # each template boots
  helpers/
    docker-test-utils.ts          # cleanup, wait-for-ready, etc.
```

### Skip Conditions

- Tests skip gracefully if Docker isn't running (`skipIf(!isDockerAvailable())`)
- CI runners with Docker run these; local runs are opt-in via `bun test:integration`

### Estimated Run Time

~60 seconds for full suite (containers boot in 5-10s each, run 6-8 tests)

## E2E Tier (Remote Server Tests)

### Purpose

Verify the full SkyBox workflow against a real remote server — SSH, locks, Mutagen sync, and multi-machine scenarios.

### What Gets Tested

- Remote operations: `push`, `clone`, `browse`, `new` actually work over SSH
- Lock system: Locks are created, detected, and released on the real remote
- Mutagen sync: Files actually sync bidirectionally
- Full workflow: `init → push → clone → up → edit file → sync → down`

### Test Isolation Strategy

- Dedicated test directory on remote: `~/skybox-e2e-tests/`
- Each test run gets a timestamped subfolder: `~/skybox-e2e-tests/run-{timestamp}/`
- Config uses a test-specific remote entry (not your real `work` remote)
- Cleanup script runs via SSH in `afterAll` — removes test directory entirely

### File Structure

```
src/__e2e__/
  remote/
    push-clone.test.ts        # push project, clone it back
    lock-system.test.ts       # acquire, detect, release locks
    browse-list.test.ts       # browse remote projects
  sync/
    mutagen-sync.test.ts      # file changes sync both ways
  workflow/
    full-lifecycle.test.ts    # init → push → clone → up → down
  helpers/
    e2e-test-utils.ts         # SSH cleanup, remote setup, retry logic
    test-config.ts            # test remote configuration
```

### Retry Logic for Flakiness

- SSH operations retry 3 times with exponential backoff
- Mutagen sync waits for "watching for changes" status before asserting
- Timeouts are generous (30s per operation) but fail fast on clear errors

### Estimated Run Time

~3-5 minutes (SSH latency + Mutagen startup + container boot)

## CI/CD Integration

### Workflow Structure

```
.github/workflows/
  ci.yml           # existing: unit tests on every push
  integration.yml  # new: Docker tests on PR + main
  e2e.yml          # new: full E2E on nightly + manual trigger
```

### When Each Tier Runs

| Trigger | Unit | Integration | E2E |
|---------|------|-------------|-----|
| Push to feature branch | ✅ | ❌ | ❌ |
| PR opened/updated | ✅ | ✅ | ❌ |
| Merge to main | ✅ | ✅ | ❌ |
| Nightly schedule | ✅ | ✅ | ✅ |
| Manual dispatch | ✅ | ✅ | ✅ |
| Pre-release tag | ✅ | ✅ | ✅ |

### Self-Hosted Runner Requirements

- Docker installed and running
- SSH key for test server (stored as `E2E_SSH_KEY` secret)
- Network access to your remote server
- Bun installed (or use setup-bun action)

### Security Handling

- SSH private key stored as GitHub encrypted secret
- Key written to temp file during E2E job, removed after
- Test remote config uses environment variables: `E2E_HOST`, `E2E_USER`, `E2E_PATH`
- No credentials in code or logs

### NPM Scripts Added

```bash
bun test              # unit only (existing)
bun test:integration  # Docker tests
bun test:e2e          # remote server tests
bun test:all          # everything
```

## Cleanup & Pollution Prevention

### Local Docker Cleanup (Integration Tier)

```typescript
// docker-test-utils.ts
export async function cleanupTestContainers() {
  // Kill all containers with test label
  await execa("docker", ["rm", "-f",
    "$(docker ps -aq --filter label=skybox-test=true)"
  ], { shell: true, reject: false });
}

export async function cleanupTestVolumes() {
  // Remove dangling test volumes
  await execa("docker", ["volume", "prune", "-f",
    "--filter", "label=skybox-test=true"
  ], { reject: false });
}
```

### Cleanup Hooks

- `afterEach`: Remove test project's container by name
- `afterAll`: Sweep for any orphaned test containers/volumes
- **CI job `post` step**: Runs cleanup even if tests fail or timeout

### Remote Server Cleanup (E2E Tier)

```typescript
// e2e-test-utils.ts
export async function cleanupRemoteTestDir(runId: string) {
  await runRemoteCommand(
    testRemote,
    `rm -rf ~/skybox-e2e-tests/run-${runId}`
  );
}

export async function cleanupStaleLocks() {
  await runRemoteCommand(
    testRemote,
    `find ~/.skybox-locks -name "test-*" -delete`
  );
}
```

### Defense in Depth

- Test project names always prefixed with `test-`
- Lock files for tests use `test-` prefix — easy to identify and purge
- Nightly job includes a "cleanup stale" step that removes anything older than 24h
- Remote test directory is completely separate from real projects

## Test Utilities Extension

### New Utilities Added to Existing File

```typescript
// src/lib/__tests__/test-utils.ts (extended)

// Integration tier helpers
export async function createDockerTestContext(name: string) {
  const ctx = createTestContext(name);
  const containerName = `skybox-test-${name}-${Date.now()}`;

  return {
    ...ctx,
    containerName,
    async cleanup() {
      await execa("docker", ["rm", "-f", containerName], { reject: false });
      ctx.cleanup();
    }
  };
}

export async function waitForContainer(name: string, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const { stdout } = await execa("docker", ["inspect", "-f", "{{.State.Running}}", name], { reject: false });
    if (stdout.trim() === "true") return;
    await Bun.sleep(500);
  }
  throw new Error(`Container ${name} not ready within ${timeout}ms`);
}
```

### E2E-Specific Utilities (New File)

```typescript
// src/__e2e__/helpers/e2e-test-utils.ts

export function createE2ETestContext(name: string) {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const testRemote = getTestRemoteConfig();

  return {
    runId,
    testRemote,
    projectName: `test-${name}-${runId}`,
    remotePath: `~/skybox-e2e-tests/run-${runId}`,
    async setup() {
      await runRemoteCommand(testRemote, `mkdir -p ${this.remotePath}`);
    },
    async cleanup() {
      await runRemoteCommand(testRemote, `rm -rf ${this.remotePath}`);
      await cleanupStaleLocks();
    }
  };
}

export function getTestRemoteConfig(): RemoteEntry {
  return {
    host: process.env.E2E_HOST || "localhost",
    user: process.env.E2E_USER || "test",
    path: process.env.E2E_PATH || "~/skybox-e2e-tests",
    key: process.env.E2E_SSH_KEY_PATH,
  };
}
```

### Retry Wrapper for Flaky Operations

```typescript
export async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts = 3, delay = 1000 } = {}
): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === attempts - 1) throw e;
      await Bun.sleep(delay * (i + 1)); // exponential backoff
    }
  }
  throw new Error("unreachable");
}
```

## Example Test Cases

### Integration Test Example (Container Lifecycle)

```typescript
// src/__integration__/docker/container-lifecycle.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { createDockerTestContext, waitForContainer, isDockerAvailable } from "../helpers/docker-test-utils.ts";

describe.skipIf(!isDockerAvailable())("container lifecycle", () => {
  let ctx: Awaited<ReturnType<typeof createDockerTestContext>>;

  beforeEach(async () => {
    ctx = await createDockerTestContext("lifecycle");
    await writeTestConfig(ctx.testDir, createTestConfig());
    await createMinimalDevcontainer(ctx.testDir); // node template
  });

  afterEach(() => ctx.cleanup());

  test("skybox up starts container and skybox down stops it", async () => {
    // Start
    await execa("bun", ["run", "src/index.ts", "up", ctx.projectName]);
    await waitForContainer(ctx.containerName);

    const running = await getContainerStatus(ctx.containerName);
    expect(running).toBe("running");

    // Stop
    await execa("bun", ["run", "src/index.ts", "down", ctx.projectName]);

    const stopped = await getContainerStatus(ctx.containerName);
    expect(stopped).toBe("exited");
  });
});
```

### E2E Test Example (Push/Clone Workflow)

```typescript
// src/__e2e__/remote/push-clone.test.ts
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { createE2ETestContext, withRetry } from "../helpers/e2e-test-utils.ts";

describe("push and clone workflow", () => {
  let ctx: Awaited<ReturnType<typeof createE2ETestContext>>;

  beforeAll(async () => {
    ctx = await createE2ETestContext("push-clone");
    await ctx.setup();
  });

  afterAll(() => ctx.cleanup());

  test("push project to remote, then clone it back", async () => {
    // Create local project with a marker file
    const localDir = join(ctx.testDir, ctx.projectName);
    mkdirSync(localDir, { recursive: true });
    writeFileSync(join(localDir, "marker.txt"), "test-content");

    // Push to remote
    await withRetry(() =>
      execa("bun", ["run", "src/index.ts", "push", ctx.projectName])
    );

    // Verify on remote
    const { stdout } = await runRemoteCommand(
      ctx.testRemote,
      `cat ${ctx.remotePath}/${ctx.projectName}/marker.txt`
    );
    expect(stdout.trim()).toBe("test-content");

    // Clone to different local path
    const cloneDir = join(ctx.testDir, "cloned");
    await withRetry(() =>
      execa("bun", ["run", "src/index.ts", "clone", ctx.projectName, "--dest", cloneDir])
    );

    // Verify clone
    const clonedContent = readFileSync(join(cloneDir, "marker.txt"), "utf-8");
    expect(clonedContent).toBe("test-content");
  });
});
```

## Implementation Order

1. **Test utilities first** — Build helpers, verify cleanup works
2. **One integration test** — Container lifecycle as proof of concept
3. **CI workflow for integration** — Get it running on self-hosted runner
4. **Remaining integration tests** — Shell, templates, editor
5. **E2E utilities** — Remote context, SSH key handling
6. **One E2E test** — Push/clone workflow as proof of concept
7. **CI workflow for E2E** — Nightly schedule, secrets configured
8. **Remaining E2E tests** — Locks, sync, full lifecycle

## Deliverables

| Item | Description |
|------|-------------|
| `src/__integration__/` | Docker tests (~6-8 test files) |
| `src/__e2e__/` | Remote server tests (~5-6 test files) |
| `docker-test-utils.ts` | Integration test helpers |
| `e2e-test-utils.ts` | E2E test helpers with retry logic |
| `.github/workflows/integration.yml` | PR/main Docker tests |
| `.github/workflows/e2e.yml` | Nightly/manual E2E tests |
| `package.json` scripts | `test:integration`, `test:e2e`, `test:all` |

## Estimated Effort

2-3 sessions of focused work

## What Stays Unchanged

- Existing unit tests untouched
- `test-utils.ts` extended, not rewritten
- Pre-commit hooks still run unit tests only (fast)

## Documentation Updates Required

- Update `CLAUDE.md` with new test commands and patterns
- Add testing section to docs if user-facing documentation exists

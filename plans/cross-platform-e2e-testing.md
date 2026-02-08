# Cross-Platform E2E Testing Infrastructure

> **Date:** 2026-02-07
> **Status:** Design approved, ready for implementation

---

## Problem

SkyBox builds binaries for 4 platforms (darwin-arm64, darwin-x64, linux-x64, linux-arm64) but only tests on the developer's local macOS machine. The E2E tests require manual environment variable setup and a real SSH server, so they rarely run. There's no CI coverage for Linux, no automated SSH server for E2E, and no cross-platform validation.

## Goals

1. Run unit tests, lint, and typecheck on every push via self-hosted Linux runners
2. Run full E2E lifecycle tests (init → up → push → clone → status → shell → down → rm) on Linux (self-hosted) and macOS (GitHub-hosted) on every PR to main + nightly
3. Provide an ephemeral SSH server for E2E tests via Docker Compose — no manual setup needed
4. Make local E2E testing trivial: `docker compose up` + `bun test:e2e`

## Non-Goals

- Windows testing (no Windows binary shipped)
- macOS-in-Docker (legal/practical issues with Docker-OSX)
- Persistent SSH test server (ephemeral is cleaner)

---

## Architecture

### CI Workflows

```
.github/workflows/
├── test-unit.yml     # Unit + lint + typecheck — every push/PR
├── test-e2e.yml      # Full E2E lifecycle — PR to main + nightly
└── release.yml       # Existing release workflow (unchanged)
```

### Runner Matrix

| Workflow | Runner | OS Label | Triggers |
|----------|--------|----------|----------|
| Unit | `self-hosted` | linux-x64 | Every push, every PR |
| E2E | `self-hosted` | linux-x64 | PR to main, nightly |
| E2E | `macos-15-intel` | macos-x64 | PR to main, nightly |
| E2E | `macos-latest` | macos-arm64 | PR to main, nightly |
| Release | `self-hosted` | — | Tag push (unchanged) |

### E2E Infrastructure

Each E2E job:
1. Generates a fresh ed25519 SSH keypair
2. Starts an ephemeral sshd container via Docker Compose (port 2222)
3. Installs Docker via Colima on macOS runners (Linux has it natively)
4. Runs the full E2E test suite against localhost:2222
5. Tears down the container on completion (even on failure)

---

## Detailed Design

### 1. SSH Server Container

**`tests/e2e/docker/sshd/Dockerfile`**

Minimal Ubuntu 24.04 image with openssh-server, rsync, curl, and git. A `testuser` account is created with key-based auth only (no password). The public key is injected at runtime via a volume mount.

```dockerfile
FROM ubuntu:24.04

RUN apt-get update && apt-get install -y \
    openssh-server rsync curl git \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir /run/sshd

RUN useradd -m -s /bin/bash testuser \
    && mkdir -p /home/testuser/.ssh \
    && chmod 700 /home/testuser/.ssh

RUN sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config \
    && sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config

EXPOSE 22
CMD ["/usr/sbin/sshd", "-D", "-e"]
```

### 2. Docker Compose

**`tests/e2e/docker/docker-compose.yml`**

```yaml
services:
  sshd:
    build:
      context: ./sshd
    ports:
      - "2222:22"
    volumes:
      - ${SSH_PUBKEY_PATH:?}:/home/testuser/.ssh/authorized_keys:ro
    tmpfs:
      - /tmp
    healthcheck:
      test: ["CMD", "pgrep", "sshd"]
      interval: 2s
      timeout: 5s
      retries: 5
```

**Local usage:**

```bash
ssh-keygen -t ed25519 -f /tmp/skybox-e2e-key -N "" -q
SSH_PUBKEY_PATH=/tmp/skybox-e2e-key.pub docker compose -f tests/e2e/docker/docker-compose.yml up -d --build --wait
E2E_HOST=localhost E2E_PORT=2222 E2E_USER=testuser E2E_SSH_KEY_PATH=/tmp/skybox-e2e-key bun test:e2e
docker compose -f tests/e2e/docker/docker-compose.yml down -v
```

### 3. CI Workflow — Unit Tests

**`.github/workflows/test-unit.yml`**

```yaml
name: Tests (Unit)
on:
  push:
    branches: [main]
  pull_request:

jobs:
  unit:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v6
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run check:ci
      - run: bun run typecheck
      - run: bun test
```

### 4. CI Workflow — E2E Tests

**`.github/workflows/test-e2e.yml`**

```yaml
name: Tests (E2E)
on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * *'

jobs:
  e2e:
    strategy:
      fail-fast: false
      matrix:
        include:
          - runner: self-hosted
            os: linux-x64
            docker-setup: none
          - runner: macos-15-intel
            os: macos-x64
            docker-setup: colima
          - runner: macos-latest
            os: macos-arm64
            docker-setup: colima

    runs-on: ${{ matrix.runner }}
    name: E2E (${{ matrix.os }})

    steps:
      - uses: actions/checkout@v6
      - uses: oven-sh/setup-bun@v2

      - name: Install Docker via Colima (macOS)
        if: matrix.docker-setup == 'colima'
        run: |
          brew install docker colima docker-compose
          colima start --cpu 2 --memory 4
          sudo ln -sf $HOME/.colima/default/docker.sock /var/run/docker.sock

      - name: Generate SSH keypair
        run: ssh-keygen -t ed25519 -f /tmp/skybox-e2e-key -N "" -q

      - name: Start SSH server
        run: |
          SSH_PUBKEY_PATH=/tmp/skybox-e2e-key.pub \
            docker compose -f tests/e2e/docker/docker-compose.yml up -d --build --wait

      - name: Install dependencies
        run: bun install

      - name: Run E2E tests
        env:
          E2E_HOST: localhost
          E2E_PORT: "2222"
          E2E_USER: testuser
          E2E_SSH_KEY_PATH: /tmp/skybox-e2e-key
        run: bun test:e2e

      - name: Teardown
        if: always()
        run: |
          docker compose -f tests/e2e/docker/docker-compose.yml down -v
          rm -f /tmp/skybox-e2e-key /tmp/skybox-e2e-key.pub
```

### 5. Code Changes

#### 5a. Add `port` to `RemoteEntry` type

**File:** `src/types/index.ts`

Add optional `port?: number` to `RemoteEntry`. This is a user-facing feature too (SSH servers on non-standard ports).

#### 5b. Add port support to `runRemoteCommand`

**File:** `src/lib/ssh.ts`

Add optional `port` parameter. When provided, prepend `-p ${port}` to the SSH args. Also update `secureScp` to accept port (uses `-P` flag for SCP).

#### 5c. Update E2E test config

**File:** `tests/e2e/helpers/test-config.ts`

Read `E2E_PORT` from environment, parse as number, add to the returned `RemoteEntry`.

#### 5d. Update E2E test helpers

**File:** `tests/e2e/helpers/e2e-test-utils.ts`

- `runTestRemoteCommand`: pass `remote.port` to `runRemoteCommand`
- `getRsyncSshArgs`: include `-p ${port}` in the SSH command string when port is set
- `rsyncToRemote` / `rsyncFromRemote`: port flows through automatically via `getRsyncSshArgs`

---

## Files Created

| File | Purpose |
|------|---------|
| `tests/e2e/docker/sshd/Dockerfile` | Ephemeral SSH test server image |
| `tests/e2e/docker/docker-compose.yml` | Compose orchestration for E2E infra |
| `.github/workflows/test-unit.yml` | Unit test CI workflow |
| `.github/workflows/test-e2e.yml` | Cross-platform E2E CI workflow |

## Files Modified

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `port?: number` to `RemoteEntry` |
| `src/lib/ssh.ts` | Add port support to `runRemoteCommand` and `secureScp` |
| `tests/e2e/helpers/test-config.ts` | Read `E2E_PORT` env var |
| `tests/e2e/helpers/e2e-test-utils.ts` | Pass port through to SSH/rsync commands |

## Documentation Updates Required

| Doc | Update |
|-----|--------|
| `docs/reference/configuration.md` | Document `port` field on remote entries |
| `CLAUDE.md` | Add `E2E_PORT` to environment variables table |
| `README.md` | Add CI badges for test workflows (optional) |

---

## Testing the Testing Infrastructure

Before merging:
1. Run `docker compose up` locally and verify SSH connectivity to localhost:2222
2. Run `bun test:e2e` locally against the compose sshd container
3. Push to a PR branch and verify all 3 matrix jobs pass (linux-x64, macos-x64, macos-arm64)
4. Verify nightly schedule triggers correctly (can be tested with `workflow_dispatch`)

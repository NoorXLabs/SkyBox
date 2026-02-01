#!/usr/bin/env bash
# Stop hook: runs `bun run check` only if code files were modified during the session.
# Returns {"continue": true} with a reason if check fails, so Claude fixes lint issues.

set -euo pipefail

cd "$(dirname "$0")/../.."

# Check if any .ts or .json files have uncommitted changes (staged, unstaged, or untracked)
changed_files=$(git diff --name-only HEAD 2>/dev/null; git diff --name-only --cached 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null)
code_changed=$(echo "$changed_files" | grep -E '\.(ts|json)$' || true)

if [ -z "$code_changed" ]; then
  exit 0
fi

# Run biome check
output=$(bun run check 2>&1) && exit_code=0 || exit_code=$?

if [ "$exit_code" -ne 0 ]; then
  # Return JSON telling Claude to continue and fix the issues
  escaped=$(echo "$output" | jq -Rs .)
  cat <<EOF
{"decision": "block", "reason": $escaped}
EOF
  exit 2
fi

exit 0

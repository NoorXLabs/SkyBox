#!/usr/bin/env bash
# Download Mutagen binaries for bundling into the compiled DevBox binary.
# Usage: ./scripts/download-mutagen.sh [version]
# Downloads tarballs for all supported platforms into vendor/mutagen/

set -euo pipefail

# Read default version from the single source of truth in constants.ts
DEFAULT_VERSION=$(grep 'MUTAGEN_VERSION' src/lib/constants.ts | head -1 | sed 's/.*"\(.*\)".*/\1/')
VERSION="${1:-$DEFAULT_VERSION}"
VENDOR_DIR="vendor/mutagen"
REPO="mutagen-io/mutagen"
BASE_URL="https://github.com/${REPO}/releases/download/v${VERSION}"

PLATFORMS=(
	"darwin_arm64"
	"darwin_amd64"
	"linux_arm64"
	"linux_amd64"
)

mkdir -p "$VENDOR_DIR"

for plat in "${PLATFORMS[@]}"; do
	filename="mutagen_${plat}_v${VERSION}.tar.gz"
	url="${BASE_URL}/${filename}"
	dest="${VENDOR_DIR}/${filename}"

	if [ -f "$dest" ]; then
		echo "Already exists: ${filename}"
		continue
	fi

	echo "Downloading: ${filename}..."
	curl -fSL --retry 3 -o "$dest" "$url"
done

echo "Done. Assets in ${VENDOR_DIR}/"

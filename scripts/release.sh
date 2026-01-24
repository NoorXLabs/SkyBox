#!/bin/bash
set -euo pipefail

# Release DevBox
#
# Usage: ./scripts/release.sh <version>
# Example: ./scripts/release.sh 0.5.0
# Example: ./scripts/release.sh 0.5.0-beta

# Check if script is run from root directory
if [[ ! -f "package.json" ]]; then
    echo "Error: This script must be run from the root directory of the project."
    exit 1
fi

# Check if version is provided
VERSION="${1:-}"

if [[ -z "$VERSION" ]]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 0.5.0"
    exit 1
fi

# Remove 'v' prefix if provided
VERSION="${VERSION#v}"

TAG="v${VERSION}"

# Check for uncommitted changes
if [[ -n "$(git status --porcelain)" ]]; then
    echo "Error: You have uncommitted changes. Commit or stash them first."
    exit 1
fi

# Check if tag already exists
if git rev-parse "$TAG" >/dev/null 2>&1; then
    echo "Error: Tag $TAG already exists."
    exit 1
fi

# Update version in package.json
sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"${VERSION}\"/" package.json

# Commit version bump
git add package.json
git commit -m "chore: bump version to ${VERSION}"

# Create and push tag
git tag "$TAG"
git push
git push --tags

echo ""
echo "Released ${TAG}"
echo ""
echo "Watch the build at:"
echo "  https://github.com/noorchasib/DevBox/actions"
echo ""
echo "Release will appear at:"
echo "  https://github.com/noorchasib/DevBox/releases/tag/${TAG}"

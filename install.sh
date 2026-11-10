#!/usr/bin/env sh
# harness-kit installer for macOS, Linux, WSL and Git Bash.
#   curl -fsSL https://raw.githubusercontent.com/7binh/harness-kit/main/install.sh | sh
#   curl -fsSL https://raw.githubusercontent.com/7binh/harness-kit/main/install.sh | sh -s -- --dir docs/workflow
set -e

if ! command -v node >/dev/null 2>&1; then
  echo "harness-kit needs Node.js 18 or newer. Install it from https://nodejs.org and run this again." >&2
  exit 1
fi

major=$(node -p "process.versions.node.split('.')[0]")
if [ "$major" -lt 18 ]; then
  echo "harness-kit needs Node.js 18 or newer; found $(node -v)." >&2
  exit 1
fi

exec npx --yes github:7binh/harness-kit init "$@"

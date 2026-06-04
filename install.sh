#!/bin/sh
set -e

# Ξ epistemic installer
# Usage: curl -fsSL https://raw.githubusercontent.com/moralespanitz/epistemic/master/install.sh | sh
#
# Options:
#   --ref <ref>    Install a specific tag, branch, or commit
#   -r <ref>       Shorthand for --ref
#   --dir <path>   Install to a custom directory (default: ~/.epistemic)

REPO="moralespanitz/epistemic"
INSTALL_DIR="${EPISTEMIC_DIR:-$HOME/.epistemic}"
BIN_DIR="${EPISTEMIC_BIN_DIR:-$HOME/.local/bin}"

# Parse arguments
REF=""
while [ $# -gt 0 ]; do
    case "$1" in
        --ref|-r)
            shift
            if [ -z "$1" ]; then echo "Missing value for --ref"; exit 1; fi
            REF="$1"; shift ;;
        --ref=*)
            REF="${1#*=}"; shift ;;
        --dir)
            shift
            if [ -z "$1" ]; then echo "Missing value for --dir"; exit 1; fi
            INSTALL_DIR="$1"; shift ;;
        *)
            echo "Unknown option: $1"; exit 1 ;;
    esac
done

has() { command -v "$1" >/dev/null 2>&1; }

# Require Node.js >= 18
require_node() {
    if ! has node; then
        echo "Node.js is required. Install it from https://nodejs.org (v18 or newer)."
        exit 1
    fi
    NODE_MAJOR=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
    if [ "$NODE_MAJOR" -lt 18 ]; then
        echo "Node.js v18 or newer is required. Current: $(node --version)"
        exit 1
    fi
}

# Require npm
require_npm() {
    if ! has npm; then
        echo "npm is required. It ships with Node.js — reinstall from https://nodejs.org."
        exit 1
    fi
}

require_node
require_npm

# Clone or update
if [ -d "$INSTALL_DIR/.git" ]; then
    echo "Updating existing install at $INSTALL_DIR..."
    git -C "$INSTALL_DIR" fetch --quiet origin
    if [ -n "$REF" ]; then
        git -C "$INSTALL_DIR" checkout --quiet "$REF"
    else
        git -C "$INSTALL_DIR" pull --quiet --ff-only
    fi
else
    echo "Installing epistemic to $INSTALL_DIR..."
    if [ -n "$REF" ]; then
        git clone --quiet --depth 1 --branch "$REF" "https://github.com/${REPO}.git" "$INSTALL_DIR" 2>/dev/null || {
            git clone --quiet "https://github.com/${REPO}.git" "$INSTALL_DIR"
            git -C "$INSTALL_DIR" checkout --quiet "$REF"
        }
    else
        git clone --quiet --depth 1 "https://github.com/${REPO}.git" "$INSTALL_DIR"
    fi
fi

# Install dependencies
echo "Installing dependencies..."
npm --prefix "$INSTALL_DIR" install --quiet --no-fund --no-audit

# Symlink the binary
mkdir -p "$BIN_DIR"
ln -sfn "$INSTALL_DIR/bin/epistemic.mjs" "$BIN_DIR/epistemic"
chmod +x "$INSTALL_DIR/bin/epistemic.mjs"

echo ""
echo "✓ epistemic installed"

# Check PATH
case ":$PATH:" in
    *":$BIN_DIR:"*) echo "Run 'epistemic' to get started." ;;
    *)
        echo ""
        echo "Add $BIN_DIR to your PATH:"
        echo "  export PATH=\"\$PATH:$BIN_DIR\""
        echo ""
        echo "Or add it permanently to your shell config (~/.bashrc, ~/.zshrc, etc.)."
        ;;
esac

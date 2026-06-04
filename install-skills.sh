#!/bin/sh
set -e

# Ξ epistemic skills-only installer
# Installs the research methodology skills without the full TUI.
# Works with Claude Code, Codex, and any agent that reads ~/.claude/skills/.
#
# Usage: curl -fsSL https://raw.githubusercontent.com/moralespanitz/epistemic/master/install-skills.sh | sh
#
# Options:
#   --hf           Also install the optional Hugging Face skills
#   --dir <path>   Clone to a custom directory (default: ~/.epistemic)

REPO="moralespanitz/epistemic"
CLONE_DIR="${EPISTEMIC_DIR:-$HOME/.epistemic}"
SKILLS_DIR="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"

INSTALL_HF=""
while [ $# -gt 0 ]; do
    case "$1" in
        --hf) INSTALL_HF=1; shift ;;
        --dir)
            shift
            if [ -z "$1" ]; then echo "Missing value for --dir"; exit 1; fi
            CLONE_DIR="$1"; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

has() { command -v "$1" >/dev/null 2>&1; }

if ! has git; then
    echo "git is required."
    exit 1
fi

# Clone or update
if [ -d "$CLONE_DIR/.git" ]; then
    echo "Updating skill source at $CLONE_DIR..."
    git -C "$CLONE_DIR" pull --quiet --ff-only
else
    echo "Cloning epistemic to $CLONE_DIR..."
    git clone --quiet --depth 1 "https://github.com/${REPO}.git" "$CLONE_DIR"
fi

# Symlink core methodology skills
mkdir -p "$SKILLS_DIR"

CORE_SKILLS="using-epistemic epistemic research-question preregistration baseline-reproduction \
  experiment-execution statistical-rigor falsification-review surprise-triage \
  kill-or-ship verification-before-publication"

HF_SKILLS="huggingface-papers hf-cli huggingface-datasets \
  huggingface-community-evals huggingface-trackio huggingface-llm-trainer"

echo "Linking core methodology skills..."
for s in $CORE_SKILLS; do
    ln -sfn "$CLONE_DIR/skills/$s" "$SKILLS_DIR/$s"
done

if [ -n "$INSTALL_HF" ]; then
    echo "Linking Hugging Face skills..."
    for s in $HF_SKILLS; do
        ln -sfn "$CLONE_DIR/skills/$s" "$SKILLS_DIR/$s"
    done
fi

echo ""
echo "✓ epistemic skills installed to $SKILLS_DIR"
echo ""
echo "Skills are active in Claude Code immediately — no restart needed."
if [ -z "$INSTALL_HF" ]; then
    echo "To also install the Hugging Face skills: re-run with --hf"
fi

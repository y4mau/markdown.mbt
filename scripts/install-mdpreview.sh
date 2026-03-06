#!/usr/bin/env bash
# Install the mdpreview skill and shell function for markdown.mbt playground.
#
# Usage:
#   ./scripts/install-mdpreview.sh
#
# What it does:
#   1. Symlinks .claude/skills/mdpreview into ~/.claude/skills/mdpreview
#   2. Appends the mdpreview shell function to ~/.bashrc (if not already present)

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SKILL_SRC="${REPO_DIR}/.claude/skills/mdpreview"
SKILL_DST="${HOME}/.claude/skills/mdpreview"

# --- 1. Install Claude Code skill ---
if [ -L "$SKILL_DST" ]; then
  current_target="$(readlink -f "$SKILL_DST")"
  if [ "$current_target" = "$(readlink -f "$SKILL_SRC")" ]; then
    echo "Skill already linked: ${SKILL_DST} -> ${SKILL_SRC}"
  else
    echo "Updating symlink: ${SKILL_DST} -> ${SKILL_SRC}"
    ln -sfn "$SKILL_SRC" "$SKILL_DST"
  fi
elif [ -d "$SKILL_DST" ]; then
  echo "Warning: ${SKILL_DST} already exists as a directory."
  echo "Back it up and re-run, or remove it manually:"
  echo "  rm -rf ${SKILL_DST}"
  exit 1
else
  mkdir -p "$(dirname "$SKILL_DST")"
  ln -sfn "$SKILL_SRC" "$SKILL_DST"
  echo "Linked skill: ${SKILL_DST} -> ${SKILL_SRC}"
fi

# --- 2. Install shell function ---
MARKER="# markdown.mbt mdpreview"
SHELL_RC="${HOME}/.bashrc"

if grep -qF "$MARKER" "$SHELL_RC" 2>/dev/null; then
  echo "Shell function already present in ${SHELL_RC}"
else
  cat >> "$SHELL_RC" << 'BASHEOF'

# markdown.mbt mdpreview
# Open a markdown file in the markdown.mbt playground browser preview
function mdpreview () {
    local abs
    abs=$(realpath "$1" 2>/dev/null)
    if [[ -z "$abs" || ! -f "$abs" ]]; then
        echo "mdpreview: file not found: $1" >&2
        return 1
    fi
    local url="http://localhost:5173/?file=${abs}"
    if command -v xdg-open &>/dev/null; then
        xdg-open "$url"
    elif command -v cmd.exe &>/dev/null; then
        cmd.exe /c start "" "$url" 2>/dev/null
    else
        echo "$url"
    fi
}
BASHEOF
  echo "Added mdpreview function to ${SHELL_RC}"
  echo "Run 'source ~/.bashrc' or open a new terminal to use it."
fi

echo "Done."

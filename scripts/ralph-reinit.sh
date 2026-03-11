#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# ralph-reinit.sh — Re-initialize ralph project
#
# Builds ralph, runs `ralph init`, then shows a diff of what changed so you
# can interactively decide what to keep or discard.
#
# Usage:
#   ./ralph-reinit.sh
# ============================================================================

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RESET='\033[0m'

echo -e "${BOLD}=== Ralph Re-Init ===${RESET}"

# Build first to pick up any init.ts changes
echo -e "${CYAN}Building ralph...${RESET}"
pnpm build

# Run init interactively
echo -e "${CYAN}Running ralph init...${RESET}"
node "$PROJECT_DIR/dist/ralph/bin.js" init

# Show what changed
echo ""
if git -C "$PROJECT_DIR" diff --quiet 2>/dev/null; then
  echo -e "${GREEN}No changes detected.${RESET}"
else
  echo -e "${BOLD}Changes from re-init:${RESET}"
  git -C "$PROJECT_DIR" diff --stat
  echo ""
  git -C "$PROJECT_DIR" diff
  echo ""
  echo -e "${BOLD}Review the diff above. You can:${RESET}"
  echo -e "  git checkout -p .   # interactively discard hunks"
  echo -e "  git checkout -- <file>   # discard a specific file"
  echo -e "  git add -p .        # stage what you want to keep"
fi

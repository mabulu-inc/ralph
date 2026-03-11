#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# ralph-evolve.sh — Self-evolution loop
#
# Runs ralph on its own codebase, rebuilding between each task so that
# code changes (e.g. refactored loop.ts, new parser fields) take effect
# before the next iteration picks them up.
#
# Usage:
#   ./ralph-evolve.sh              # Run all remaining tasks (rebuild between each)
#   ./ralph-evolve.sh -n 5         # Run at most 5 tasks
#   ./ralph-evolve.sh -v           # Verbose — stream Claude output
#   ./ralph-evolve.sh --dry-run    # Print what would happen
#   ./ralph-evolve.sh --skip-check # Skip pnpm check after rebuild
# ============================================================================

MAX_TASKS=0  # 0 = unlimited
VERBOSE=false
DRY_RUN=false
SKIP_CHECK=false
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RALPH_SCRIPT="$PROJECT_DIR/scripts/ralph.sh"

# --- Colors ---
BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

# --- Parse args ---
RALPH_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -n|--tasks)       MAX_TASKS="$2"; shift 2 ;;
    -v|--verbose)     VERBOSE=true; RALPH_ARGS+=("--verbose"); shift ;;
    --dry-run)        DRY_RUN=true; shift ;;
    --skip-check)     SKIP_CHECK=true; shift ;;
    -h|--help)
      echo "Usage: ./ralph-evolve.sh [-n max_tasks] [-v] [--dry-run] [--skip-check]"
      echo ""
      echo "Runs ralph on itself, rebuilding between each task so changes"
      echo "to ralph's own code take effect before the next iteration."
      echo ""
      echo "Options:"
      echo "  -n, --tasks       Max tasks to complete (default: unlimited)"
      echo "  -v, --verbose     Stream Claude output to terminal"
      echo "  --dry-run         Print plan and exit"
      echo "  --skip-check      Skip pnpm check after rebuild"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# --- Helpers ---
timestamp() { date '+%Y-%m-%dT%H:%M:%S'; }

get_next_task() {
  local tasks_dir="$PROJECT_DIR/docs/tasks"
  local todo_tasks=()
  for f in "$tasks_dir"/T-*.md; do
    [[ -f "$f" ]] || continue
    if grep -q '^\- \*\*Status\*\*: TODO' "$f" 2>/dev/null; then
      todo_tasks+=("$f")
    fi
  done

  for f in "${todo_tasks[@]}"; do
    local deps
    deps=$(grep '^\- \*\*Depends\*\*:' "$f" 2>/dev/null | sed 's/.*: //' || true)
    if [[ "$deps" == "(none)" || "$deps" == "none" || -z "$deps" ]]; then
      basename "$f" .md
      return
    fi
    local all_met=true
    for dep in $(echo "$deps" | sed 's/,/ /g; s/  */ /g; s/^ //; s/ $//'); do
      local dep_file="$tasks_dir/${dep}.md"
      if [[ ! -f "$dep_file" ]] || ! grep -q '^\- \*\*Status\*\*: DONE' "$dep_file" 2>/dev/null; then
        all_met=false
        break
      fi
    done
    if $all_met; then
      basename "$f" .md
      return
    fi
  done
  echo "none"
}

count_todo() {
  local count=0
  for f in "$PROJECT_DIR/docs/tasks"/T-*.md; do
    [[ -f "$f" ]] || continue
    grep -q '^\- \*\*Status\*\*: TODO' "$f" 2>/dev/null && count=$((count + 1))
  done
  echo "$count"
}

# --- Pre-flight ---
if ! command -v claude &>/dev/null; then
  echo -e "${RED}Error: 'claude' CLI not found.${RESET}"
  exit 1
fi

next=$(get_next_task)
remaining=$(count_todo)

echo -e "${BOLD}=== Ralph Self-Evolution ===${RESET}"
echo -e "  Project:   $PROJECT_DIR"
echo -e "  Max tasks: $([ "$MAX_TASKS" -eq 0 ] && echo 'unlimited' || echo "$MAX_TASKS")"
echo -e "  Next task: $next"
echo -e "  Remaining: ${YELLOW}${remaining}${RESET}"
echo -e "${BOLD}============================${RESET}"

if $DRY_RUN; then
  echo "(dry run — exiting)"
  exit 0
fi

# --- Evolution loop ---
completed=0
loop_start=$(date +%s)

while true; do
  next=$(get_next_task)
  if [[ "$next" == "none" ]]; then
    echo -e "\n${GREEN}[$(timestamp)] All tasks complete. Evolution finished.${RESET}"
    break
  fi

  if [[ "$MAX_TASKS" -gt 0 && "$completed" -ge "$MAX_TASKS" ]]; then
    echo -e "\n${YELLOW}[$(timestamp)] Reached task limit ($MAX_TASKS). Stopping.${RESET}"
    break
  fi

  completed=$((completed + 1))
  echo ""
  echo -e "${BOLD}[$(timestamp)] === Evolution step $completed — $next ===${RESET}"

  # Run exactly one iteration of ralph
  if $VERBOSE; then
    bash "$RALPH_SCRIPT" -n 1 -v
  else
    bash "$RALPH_SCRIPT" -n 1
  fi

  # Rebuild so the next iteration uses updated ralph code
  echo -e "${CYAN}[$(timestamp)] Rebuilding ralph...${RESET}"
  if ! pnpm build 2>&1; then
    echo -e "${RED}[$(timestamp)] Build failed after $next. Stopping evolution.${RESET}"
    exit 1
  fi
  echo -e "${GREEN}[$(timestamp)] Rebuild successful.${RESET}"

  # Optionally run full quality check
  if ! $SKIP_CHECK; then
    echo -e "${CYAN}[$(timestamp)] Running pnpm check...${RESET}"
    if ! pnpm check 2>&1; then
      echo -e "${RED}[$(timestamp)] Quality check failed after $next. Stopping evolution.${RESET}"
      exit 1
    fi
    echo -e "${GREEN}[$(timestamp)] Quality check passed.${RESET}"
  fi
done

# --- Summary ---
elapsed=$(( $(date +%s) - loop_start ))
mins=$((elapsed / 60))
secs=$((elapsed % 60))
remaining=$(count_todo)

echo ""
echo -e "${BOLD}=== Evolution Complete ===${RESET}"
echo -e "  Tasks completed: ${GREEN}${completed}${RESET}"
echo -e "  Tasks remaining: ${YELLOW}${remaining}${RESET}"
echo -e "  Total time:      ${mins}m ${secs}s"
echo -e "${BOLD}=========================${RESET}"

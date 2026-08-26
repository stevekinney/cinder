#!/usr/bin/env bash
# NOT CURRENTLY WIRED. As of 2026-08-14 there is no entry in
# .claude/settings.json invoking this script, so nothing calls it and it has
# no effect on any tool call. It is kept in the tree, unmodified, as the
# mechanism to reactivate if a future session wants machine enforcement of
# the review board back -- see "The adversarial review board" in CLAUDE.md
# for the current, opt-in state of that requirement. The description below
# is accurate for what this script DOES when invoked, not for whether
# anything currently invokes it.
#
# PreToolUse gate: blocks an Edit or Write to ROADMAP.md or ROADMAP.local.md
# unless the adversarial review board has signed off on THIS exact body of
# reviewable work. Everything else passes through untouched -- this only
# gates the moment something gets marked done in the roadmap.
#
# Previously wired to Stop, where it fired on every turn end regardless of
# what changed, over a hash computed across the whole shared working tree.
# That meant any concurrent session's unrelated WIP blocked every other
# session's Stop, repeatedly, even when neither session had touched the
# other's files. Narrowing the trigger to these two files removes that
# cross-session noise without weakening the review requirement itself: you
# still cannot mark something done without a sign-off, you just are not
# nagged about it on every unrelated turn.
#
# Everything here fails closed except three enumerated allow paths, and the
# enumeration is the point of this comment -- an earlier version claimed there
# was exactly one and there were three:
#   1. a tool call whose target file is determined and positively confirmed NOT
#      to be one of the two gated files (the design's intended exception);
#   2. genuinely not a git repository, where there is nothing to gate;
#   3. no substantive reviewable work in flight, where there is nothing to sign.
# Every other case -- jq missing, the project directory unresolvable, malformed
# input, the field absent, git failing for any reason OTHER than not-a-repo, a
# corrupt index, a missing helper -- blocks. A gate that cannot tell
# whether an edit targets the gated files must not guess "no": that guess is
# indistinguishable from a silent bypass to anything relying on this gate.
set -uo pipefail

emit_deny() {
  if command -v jq >/dev/null 2>&1; then
    jq -n --arg r "$1" '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $r}}'
  else
    local esc=${1//\\/\\\\}
    esc=${esc//\"/\\\"}
    esc=${esc//$'\n'/\\n}
    printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$esc"
  fi
  exit 0
}

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null ||
  emit_deny "The roadmap gate could not enter the project directory, so it cannot confirm whether this edit targets ROADMAP.md or ROADMAP.local.md."

input="$(cat)"
file_path=""
if command -v jq >/dev/null 2>&1; then
  file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
fi
[ -n "$file_path" ] ||
  emit_deny "The roadmap gate could not determine which file this tool call targets (jq unavailable, malformed input, or the field was absent), so it cannot confirm whether this edit targets ROADMAP.md or ROADMAP.local.md."

is_gated=0
if [ "$file_path" = "$PWD/ROADMAP.md" ] || [ "$file_path" = "$PWD/ROADMAP.local.md" ] ||
  [ "$file_path" = "ROADMAP.md" ] || [ "$file_path" = "ROADMAP.local.md" ]; then
  is_gated=1
fi
[ "$is_gated" = "1" ] || exit 0 # positively confirmed NOT a gated file: the one case that allows

target="${file_path##*/}"

# From here on this IS a gated file, so every error path below must block --
# the same fail-closed rule the old Stop-hook gate followed.
command -v git >/dev/null 2>&1 ||
  emit_deny "The roadmap gate needs git to determine what changed, and git is not available."

if ! git_dir_check=$(git rev-parse --git-dir 2>&1); then
  case "$git_dir_check" in
    *"not a git repository"*) exit 0 ;; # genuinely not a repo: nothing to gate
    *) emit_deny "The roadmap gate could not determine whether this is a git repository: ${git_dir_check}

Until that is resolved, ${target} cannot be updated." ;;
  esac
fi

helper="$(dirname "${BASH_SOURCE[0]}")/work-hash.sh"
[ -r "$helper" ] ||
  emit_deny "The roadmap gate is missing its helper (${helper}). It cannot evaluate this work, and a gate that cannot see the work must not clear it."
# shellcheck source=./work-hash.sh
. "$helper" ||
  emit_deny "The roadmap gate could not load ${helper}."

compute_work_hash
work_hash="$WORK_HASH"
if [ -n "$WORK_ERROR" ]; then
  emit_deny "The roadmap gate could not evaluate this work: ${WORK_ERROR}

Until that is resolved, ${target} cannot be updated."
fi
[ -z "$work_hash" ] && exit 0 # no substantive reviewable work in flight to gate

signoff="${SIGNOFF_DIR}/${work_hash}.signoff"

if [ -f "$signoff" ]; then
  # Parse only the verdict block; notes after the sentinel are free text and
  # must never be scanned, or a PASS line pasted into a note would count.
  verdicts=$(awk -v s="$NOTES_SENTINEL" 'index($0, s) {exit} {print}' "$signoff" 2>/dev/null)
  waived_ground=$(printf '%s\n' "$verdicts" | sed -n 's/^WAIVED: \([a-z-]*\)$/\1/p' | head -1)
  if [ -n "$waived_ground" ]; then
    for g in "${WAIVER_GROUNDS[@]}"; do
      [ "$waived_ground" = "$g" ] && exit 0
    done
  fi
  missing=()
  for r in "${REVIEW_BOARD[@]}"; do
    [ "$(printf '%s\n' "$verdicts" | grep -cE "^${r}: PASS$")" = "1" ] || missing+=("$r")
  done
  if [ ${#missing[@]} -eq 0 ]; then exit 0; fi
  emit_deny "A review-board sign-off exists for this exact work, but it is incomplete. Still missing a PASS from: ${missing[*]}.

All four members have veto power and all four must PASS before ${target} can record this as done. Convene the missing reviewers via the review-board skill, resolve what they find, and record their verdicts."
fi

emit_deny "This body of work has not been through the adversarial review board, so ${target} cannot record it as done yet.

Run the \`review-board\` skill. It convenes four reviewers in parallel, each with veto power:
  - test-integrity-auditor: proves every new or changed test actually fails when the behavior it pins is broken
  - harness-skeptic: challenges whether each finding is real or a happy-dom / testing-library artifact
  - contract-auditor: checks docs, types, READMEs, changesets, and issue state still match the code
  - a11y-ssr-auditor: keyboard reachability, focus, announcements, and hydration

All four must return PASS on the work as it currently stands. Findings are resolved by fixing them, or by refuting them with evidence you can show; a finding is never resolved by restating it.

If a reviewer genuinely cannot be satisfied -- a harness limitation makes something unprovable, say -- that is reportable, not skippable: name the reviewer, the criterion, what you tried, and what would settle it, then ask the user how to proceed."

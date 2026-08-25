#!/usr/bin/env bash
# Record an adversarial review board sign-off for the current body of work.
#
# Usage:
#   review-board-signoff.sh --pass <reviewer> [--pass <reviewer> ...] [--note "text"]
#   review-board-signoff.sh --waive --grounds <ground> --reason "text"
#   review-board-signoff.sh --initialize
#
# Each run truncates the sign-off file, so name all four reviewers in one
# invocation; sequential --pass runs discard the earlier ones.
#
# Every board member must be passed explicitly. There is deliberately no
# "--all" flag: signing off is four separate assertions, each claiming a
# specific reviewer examined this exact work.
#
# --initialize REFUSES whenever sign-offs already exist on disk, whatever state
# the baseline file is in -- missing OR unresolvable -- since either means this
# repo was gated before and the file was lost rather than never written. It also
# refuses when combined with --pass, when a baseline still resolves, and when
# work is already in flight (reachable on an unborn HEAD, where work_baseline
# returns the empty tree without setting WORK_ERROR). It re-establishes only for
# a repo that has never been gated.
#
# A waiver advances the baseline exactly as a full sign-off does: waived work
# becomes the new cleared point and leaves the reviewable set.

set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || { echo "not in a project" >&2; exit 1; }

# shellcheck source=./work-hash.sh
. "$(dirname "${BASH_SOURCE[0]}")/work-hash.sh"

passed=()
note=""
initialize=""
waive=""
grounds=""
reason=""
while [ $# -gt 0 ]; do
  # Every value-taking flag checks for its value before shifting twice: `shift 2`
  # with one argument left FAILS and leaves $# unchanged, so the loop spins
  # forever at full CPU printing nothing at all.
  case "$1" in
    --pass|--note|--grounds|--reason)
      if [ $# -lt 2 ]; then echo "$1 needs a value." >&2; exit 1; fi
      case "$1" in
        --pass) passed+=("$2") ;;
        --note) note="$2" ;;
        --grounds) grounds="$2" ;;
        --reason) reason="$2" ;;
      esac
      shift 2 ;;
    --initialize) initialize=1; shift ;;
    --waive) waive=1; shift ;;
    *) echo "unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [ -n "$initialize" ]; then
  if [ ${#passed[@]} -gt 0 ]; then
    echo "--initialize records no verdicts; do not combine it with --pass." >&2
    exit 1
  fi
  # An UNRESOLVABLE baseline is the one case where re-initializing is the repair
  # rather than a bypass. `work_baseline` tells the user to run --initialize when
  # history has been rewritten or the state file is damaged, and this refusal
  # used to reject exactly that -- while --waive also failed, because it computes
  # the hash from the same broken baseline. The gate blocked, and no documented
  # path could clear it. Refusing on a baseline that still resolves keeps the
  # bypass shut; refusing on one that does not was a dead end.
  if [ -f "$LAST_CLEARED_FILE" ]; then
    existing=$(cat "$LAST_CLEARED_FILE" 2>/dev/null)
    if [ -n "$existing" ] && git rev-parse --verify --quiet "${existing}^{commit}" >/dev/null 2>&1; then
      echo "A baseline already exists (${LAST_CLEARED_FILE})." >&2
      echo "Re-initializing would clear whatever is currently in flight with no reviewer and no record, which is strictly weaker than a waiver. If this work genuinely does not need the board, waive it with --waive --grounds <ground> --reason \"...\" so the call is auditable." >&2
      exit 1
    fi
    if [ -d "$SIGNOFF_DIR" ] && [ -n "$(ls -A "$SIGNOFF_DIR" 2>/dev/null)" ]; then
      echo "The recorded baseline (${existing:-empty}) no longer resolves, but sign-offs exist in ${SIGNOFF_DIR}, so this repo has been gated before." >&2
      echo "Re-establishing here would clear whatever is in flight with no reviewer and no record. Restore the baseline to a commit that resolves, or waive the work explicitly." >&2
      exit 1
    fi
    echo "The recorded baseline (${existing:-empty}) no longer resolves; re-establishing it." >&2
  elif [ -d "$SIGNOFF_DIR" ] && [ -n "$(ls -A "$SIGNOFF_DIR" 2>/dev/null)" ]; then
    # No baseline file, but sign-offs exist: this repo HAS been gated, so the
    # baseline did not go missing on its own. Deleting one gitignored file and
    # running the --initialize that work_baseline's own error text prints was a
    # complete bypass -- it cleared committed unreviewed work with no reviewer
    # and no record, which is strictly weaker than a waiver, while four places
    # claimed that hole was shut.
    echo "The baseline file is missing but sign-offs exist in ${SIGNOFF_DIR}, so this repo has been gated before." >&2
    echo "Re-initializing here would clear whatever is in flight with no reviewer and no record. Restore the baseline file. Waiving does not work either: it resolves the same baseline first." >&2
    exit 1
  fi
  compute_work_hash
  if [ -z "$WORK_ERROR" ] && [ -n "$WORK_HASH" ]; then
    echo "There is already work in flight relative to HEAD, and --initialize would clear it unrecorded." >&2
    echo "Commit or set it aside first, or waive it explicitly." >&2
    exit 1
  fi
  if ! git rev-parse --verify --quiet HEAD >/dev/null 2>&1; then
    echo "No commit yet, so there is nothing to baseline from. Make the first commit, then initialize." >&2
    exit 1
  fi
  mark_cleared || { echo "could not write ${LAST_CLEARED_FILE}" >&2; exit 1; }
  echo "Baseline established at $(git rev-parse --short HEAD)."
  echo "Work from here forward requires a full board sign-off."
  exit 0
fi

if [ -z "$waive" ] && { [ -n "$grounds" ] || [ -n "$reason" ]; }; then
  echo "--grounds/--reason only apply to a waiver. Add --waive, or drop them." >&2
  exit 1
fi

if [ -n "$waive" ]; then
  if [ ${#passed[@]} -gt 0 ]; then
    echo "--waive records no verdicts; do not combine it with --pass." >&2; exit 1
  fi
  known=""
  for g in "${WAIVER_GROUNDS[@]}"; do [ "$grounds" = "$g" ] && known=1; done
  if [ -z "$known" ]; then
    if [ -z "$grounds" ]; then
      echo "--waive needs --grounds naming why the board is disproportionate here." >&2
    else
      echo "unrecognized ground: ${grounds}" >&2
    fi
    echo "expected one of: ${WAIVER_GROUNDS[*]}" >&2
    exit 1
  fi
  if [ -z "$reason" ]; then
    echo "--waive needs --reason explaining the call in your own words." >&2
    echo "A ground without a reason is a bypass button; with one it is a judgement someone can audit." >&2
    exit 1
  fi
  # The ground is self-asserted and nothing verifies it against the diff, so the
  # one class of mistake that cannot be undone later -- shipping a rendered
  # surface with no a11y or hydration review -- is refused outright.
  # Plainly, never $(...): a subshell would discard WORK_ERROR and every error
  # path would read as "nothing forbidden".
  waiver_forbidden_paths
  if [ -n "$WORK_ERROR" ]; then
    echo "Cannot waive: ${WORK_ERROR}" >&2
    exit 1
  fi
  if [ -n "$WAIVER_FORBIDDEN" ]; then
    echo "This work is not waivable: it changes a rendered surface or the config that decides one." >&2
    printf '%s' "$WAIVER_FORBIDDEN" | sed 's/^/  /' >&2
    echo "Grounds are self-asserted and never checked against the diff, so anything" >&2
    echo "that reaches the browser, or decides what does, convenes the board. Run it: /review-board" >&2
    exit 1
  fi
fi

compute_work_hash
work_hash="$WORK_HASH"
if [ -n "$WORK_ERROR" ]; then
  echo "Cannot sign off: ${WORK_ERROR}" >&2
  exit 1
fi
if [ -z "$work_hash" ]; then
  echo "No substantive work in flight. Nothing to sign off." >&2
  exit 1
fi

# Reject anything that is not a board member, so a typo cannot look like a PASS
# the gate will never find.
for p in "${passed[@]+"${passed[@]}"}"; do
  known=""
  for r in "${REVIEW_BOARD[@]}"; do [ "$p" = "$r" ] && known=1; done
  [ -n "$known" ] || { echo "not a board member: $p" >&2; echo "expected one of: ${REVIEW_BOARD[*]}" >&2; exit 1; }
done

missing=()
for r in "${REVIEW_BOARD[@]}"; do
  found=""
  for p in "${passed[@]+"${passed[@]}"}"; do [ "$p" = "$r" ] && found=1; done
  [ -n "$found" ] || missing+=("$r")
done

mkdir -p "$SIGNOFF_DIR" || { echo "could not create ${SIGNOFF_DIR}" >&2; exit 1; }
signoff="${SIGNOFF_DIR}/${work_hash}.signoff"

if [ -n "$waive" ]; then
  {
    echo "# Review board WAIVED — no reviewer examined this work"
    echo "work-hash: ${work_hash}"
    echo "recorded: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    echo "branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
    echo "grounds: ${grounds}"
    echo
    # The gate accepts a waiver only via this exact line, and it is written here
    # rather than derived from free text, so a reason cannot forge one.
    echo "WAIVED: ${grounds}"
    echo
    echo "$NOTES_SENTINEL"
    printf '%s\n' "$reason" | sed 's/^/# /'
  } > "$signoff"
  mark_cleared
  compute_work_hash
  if [ -z "$WORK_ERROR" ] && [ -n "$WORK_HASH" ] && [ "$WORK_HASH" != "$work_hash" ]; then
    cp "$signoff" "${SIGNOFF_DIR}/${WORK_HASH}.signoff"
  fi
  echo "Waived on grounds: ${grounds}"
  echo "Recorded: $signoff"
  echo "No reviewer examined this work. The waiver is auditable — make sure the reason would convince someone reading it later."
  exit 0
fi

{
  echo "# Adversarial review board sign-off"
  echo "work-hash: ${work_hash}"
  echo "recorded: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
  echo
  for r in "${REVIEW_BOARD[@]}"; do
    found=""
    for p in "${passed[@]+"${passed[@]}"}"; do [ "$p" = "$r" ] && found=1; done
    if [ -n "$found" ]; then echo "${r}: PASS"; else echo "${r}: NOT RECORDED"; fi
  done
  echo
  # Everything below is ignored by the gate, so free text cannot forge a verdict.
  echo "$NOTES_SENTINEL"
  [ -n "$note" ] && printf '%s\n' "$note" | sed 's/^/# /'
} > "$signoff"

echo "Recorded: $signoff"
if [ ${#missing[@]} -eq 0 ]; then
  # Advance the baseline, THEN re-record at the hash the gate will now compute.
  # Advancing alone was a self-invalidating sign-off: it moved the baseline the
  # hash was derived from, so the gate recomputed a different hash and blocked
  # again, one line after printing that the work was cleared.
  mark_cleared
  compute_work_hash
  if [ -z "$WORK_ERROR" ] && [ -n "$WORK_HASH" ] && [ "$WORK_HASH" != "$work_hash" ]; then
    cp "$signoff" "${SIGNOFF_DIR}/${WORK_HASH}.signoff"
    echo "Also recorded at the post-baseline hash ${WORK_HASH:0:12}."
  fi
  echo "All four members passed. This work is cleared."
  exit 0
fi
echo
echo "Incomplete — still missing a PASS from: ${missing[*]}"
echo "The gate will keep blocking until every member has passed on this exact work."
exit 1

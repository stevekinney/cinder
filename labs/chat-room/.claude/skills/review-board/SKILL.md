---
name: review-board
description: "Convene the adversarial review board over the current body of work. Four reviewers with veto power must all PASS before anything is marked complete. Trigger on 'review board', 'convene the board', or before declaring work done. (There is no hook enforcing this — invoke it proactively and regularly, since nothing else will prompt you.)"
allowed-tools: Read, Bash, Grep, Glob, Agent, Edit, Write
---

No body of work in this repo is complete until four adversarial reviewers have each returned PASS on the work **as it currently stands**. You are convening them now.

They are adversaries by design. Their job is to find the reason this is not done, and a round that finds nothing should make you suspicious rather than relieved. This repo's whole purpose is finding real defects; a board that rubber-stamps is worse than no board, because it converts "unreviewed" into "approved".

## Convene

First, establish what is under review. The body of work is everything that differs from the last commit the board cleared (`.claude/.review-board-state/last-cleared`, established via `--initialize`)—committed or not, on this branch or parked on another, or stashed—except `CLAUDE.md`, `AGENTS.md`, `README.md`, `ROADMAP.md`, and the board's own state directory — **not** `docs` or `.vscode`, which were on that list until the bundler turned out to resolve imports into them — which the `WORK_DENY` list in `.claude/hooks/work-hash.sh` excludes by name. That exclusion is CONDITIONAL for the state directory: its own bookkeeping is out of scope, but a file `is_source` recognises there — anything that renders or decides what renders — makes both `compute_work_hash` and `waiver_forbidden_paths` refuse by name rather than clear. It is the one directory on the list, so leaving it unconditional would make it a permanent home for unreviewed components, which is exactly why `docs` and `.vscode` came off. That list is a specific denylist, not a category — do not generalize it to "documentation", because markdown under `.claude/agents` and `.claude/skills` is fully in scope. Editing an agent's operating instructions changes behavior, and calling that a documentation edit is how you talk yourself out of a review you owe. Everything else is in scope, including `.claude/hooks` and this file. Summarize it in a couple of sentences so each reviewer knows what they are looking at.

Then spawn all four **in parallel**, in a single message with multiple tool calls. They are independent and reviewing serially wastes their independence:

- `test-integrity-auditor`
- `harness-skeptic`
- `contract-auditor`
- `a11y-ssr-auditor`

Give each the same brief: what changed, why, which ROADMAP item it serves if any, and how to run the suites. Do not tell them what you believe is correct, and do not pre-empt their findings — a reviewer primed with your conclusion is not an independent one.

## Resolve

A `VERDICT: FAIL` is resolved exactly two ways.

**Fix it.** Make the change, then re-run that reviewer against the updated work. Findings from one reviewer frequently invalidate another's PASS, so if you changed source or tests, re-run every reviewer whose area you touched.

**Refute it with evidence.** Reviewers are wrong sometimes, and three findings were correctly disputed in this repo's history — each time by running an experiment that showed the claim did not hold, not by arguing. If you refute, state the experiment and its output, and record the refutation in the sign-off so the reasoning survives.

What never resolves a finding: rewording it, narrowing the test until it passes, marking it out of scope because the diff is already large, or asserting that it is fine.

If a reviewer cannot be satisfied because of a genuine limitation — the harness cannot exercise the path, the fix needs a decision only the user can make — that is reportable, not skippable. Say which reviewer, which criterion, what you tried, and what would settle it, then ask the user how to proceed. Do not write a sign-off around it.

## Record the sign-off

Only once all four have returned PASS on the current state of the work. Record one flag per
member, so that four members is four separate assertions:

```bash
bash .claude/hooks/review-board-signoff.sh \
  --pass test-integrity-auditor --pass harness-skeptic \
  --pass contract-auditor --pass a11y-ssr-auditor \
  --note "one line per finding: fixed how, or refuted with what evidence"
```

There is no `--all`, and the script is not interactive — it records exactly the members you name
and reports which are still missing. Notes are written below a sentinel the gate never parses, so
free text cannot forge a verdict. A complete sign-off also advances the baseline, so the next body
of work is measured from here.

Do not hand-write the sign-off file. The sign-off exists to protect the work, and forging it is the one
failure mode nobody else will catch — there is no hook reading it at all now, so the sign-off file is
the only durable record that a board ever met.

## When the board is disproportionate

Not every change earns four agents. If it genuinely does not, waive it rather than convening a
board you do not believe in:

```bash
bash .claude/hooks/review-board-signoff.sh --waive \
  --grounds comments-only --reason "reworded a docblock; no executable line touched"
```

Grounds: `formatting-only`, `comments-only`, `revert-of-cleared`, `generated-artifact`,
`advisor-approved`. Both the ground and a written reason are required, and the waiver is recorded
beside the sign-offs so the judgement is auditable.

A waiver is refused outright, on every ground, when the work touches a rendered surface —
`WAIVER_NEVER` in `.claude/hooks/work-hash.sh`; see CLAUDE.md's "adversarial review board" section
for the current list rather than re-enumerating it here, since two copies of one array is exactly
how this drifted before — and reaching work hidden by an external ignore source, a `git mv` out of
`src/`, a non-ASCII path, or an in-tree `.gitignore` rule — but those are shapes that keep a
_rendered_ path visible, not independent triggers: a `notes.txt` hidden any of those ways is still
waivable. Separately and unconditionally,
**any stash at all refuses a waiver** — the guard cannot see inside one, so it
refuses rather than measuring less than it claims, even for a stash holding
nothing that renders. **An ignored directory that exceeds the file cap also refuses
unconditionally** — a waiver cannot verify what it did not finish reading, so it refuses rather
than silently proceeding with a truncated, possibly-incomplete file list. **A gitlink (embedded
repo) carrying ANY untracked, modified, or ignored-but-present content also refuses unconditionally**
— rather than try to classify what's inside it, which runs into a real ambiguity that
`work-hash.sh` documents at the gitlink handling itself, the waiver refuses the whole gitlink
outright the moment it has anything unverifiable in it. **A literal newline byte in a hidden or ignored path also
refuses unconditionally** — the byte cannot be represented safely on the newline-delimited channels
this file's helpers use internally, so `compute_work_hash` sets `WORK_ERROR` and refuses outright
rather than silently dropping the path from what it measures, and a waiver inherits that same
refusal since it calls the same helper. A waiver also advances
the baseline, so waived work becomes the new cleared point. The grounds are self-asserted and
nothing checks them against the diff, so this is the one class of mistake the script refuses to
let you make rather than trusting you not to. If you hit any of these refusals, convene the board;
it is not a bug.

`advisor-approved` is the escape hatch for being stuck: you may ask the user at any point what to
do to keep moving, and their answer is legitimate grounds. Prefer asking over grinding, and prefer
asking over waiving something you are unsure about.

Waiving work that touches behavior is how this mechanism becomes theatre. If you are reaching for
a waiver because the board would be slow or would probably find something, that is the case where
you convene it.

If the work changes after a sign-off, the hash changes and the sign-off no longer applies. That is intended. Re-run the reviewers whose areas moved. Nothing will tell you this has happened — there is no hook to notice for you — so check it yourself before claiming a batch is cleared.

## Report to the user

State each reviewer's verdict, the findings that were fixed and how, the findings that were refuted and with what evidence, and anything left unresolved with the reason. If the board found nothing at all, say so plainly and note what they examined, so a thin review is visible as a thin review rather than a clean bill of health.

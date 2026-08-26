# Roadmap execution plan

Batch order for working `ROADMAP.md` to completion. Written before any code was touched; revised only when a batch discovers something that invalidates the grouping, with the revision noted in `ROADMAP_PROGRESS.md`.

> [!NOTE] Revised once, and the original is kept below
> The fifteen batches this file was written with are superseded by the **eight** in "The consolidated batches" — a `contract-auditor` finding caught that `ROADMAP_PROGRESS.md` had announced the consolidation while this file still enumerated `B1`–`B15`, so the two disagreed about what the plan was. The original fifteen are preserved under "The original batches" because the ordering arguments in them still hold and the consolidation is a regrouping, not a rethink.

## The consolidated batches

Two forces drove the regrouping. The board is the dominant cost per batch, and most of the fifteen would have spent a full four-reviewer round on a diff too small to earn one. And the first several hours produced four board rounds that had examined only prose, shell, and config — not one line of `src/` — which is the failure mode the split was creating.

| Batch | Items                                  | Was              |
| ----- | -------------------------------------- | ---------------- |
| A     | `CA-1`, `CA-2`, `CA-3`, `CA-5`, `RE-1` | `B0`, `B1`, `B6` |
| B     | `HS-3`, `HS-4`, `TI-1`, `A11Y-1`       | `B2`, `B3`, `B4` |
| C     | `A11Y-2`, `A11Y-3`                     | `B5`             |
| D     | `RE-2`, `RE-3`, `RE-4`                 | `B7`, `B8`       |
| E     | `DV-1`, `DV-2`, `DV-3`, `ME-1`         | `B9`–`B11`       |
| F     | `I-1`, `TI-2`, `HS-1`, `HS-2`          | `B12`, `B13`     |
| G     | `X-1`, `X-2`, `X-3`                    | `B14`            |
| H     | `A11Y-4`, filed and fixed together     | `B5` + `B15`     |

**`A11Y-4`'s filing moves back to `H`, reversing the earlier split.** `B5` was going to file the six issues early on the argument that filing takes minutes and shares nothing with a release. That argument assumed filing and fixing could be separated — and under this run's operating instruction ("if you encounter upstream issues, you must fix them upstream and cut a release before continuing"), it cannot: a filed issue creates an immediate obligation to fix it before moving on. Filing at `C` would therefore drag `H`'s six upstream loops into `C`, hostaging four otherwise-independent batches to the item this plan itself calls the most likely to stall. File-and-fix become one campaign, at the end, where the original ordering put them.

Batch A additionally absorbed three upstream loops that were not in any batch because they had not been found yet: `cinder#1288` (released as `@lostgradient/editor@0.9.1`), and `cinder#1291`/`#1292`, both surfaced by the board reviewing `RE-1`.

## The original batches

Twenty-eight items carry an ID in `ROADMAP.md`. Two (`I-2`, `CA-4`) are already marked **done**; the remaining twenty-six are grouped below into fifteen batches, `B1` through `B15`. (`B0` is listed with them for sequencing but is not a roadmap item and holds none of the twenty-six.)

## How these were grouped

Three forces set the order.

**Reviewer domain.** The board is four reviewers, and a batch whose findings all land in one reviewer's area is cheaper to resolve than one spread across all four. `CA-1`/`CA-2`/`CA-3`/`CA-5` are all `contract-auditor` findings about stale documentation; `A11Y-2`/`A11Y-3` are both `a11y-ssr-auditor` findings about the same class of defect.

**Shared files.** Two items that edit the same file belong in one batch, because reviewing them separately means reviewing the same file twice and merging the second on top of an already-cleared first. `HS-3` and `HS-4` both edit `playwright.config.ts`. `TI-1` and `A11Y-1` both edit `hydration.e2e.ts`, and are deliberately _not_ merged — see the ordering note below.

**Blast radius, earliest.** Anything that changes how every later batch is verified goes first. The Playwright config decides which engines run and whether a failure leaves a trace; running fourteen later batches without that and then adding it means re-verifying fourteen batches under a matrix they were never run against.

## Ordering notes worth stating

`TI-1` runs before `A11Y-1` even though both touch `hydration.e2e.ts`. `A11Y-1` adds roughly twenty routes to `HYDRATING_ROUTES`, and `hydration.e2e.ts` currently has a bare `waitForTimeout(1000)` in the shared helper every one of those routes would pay. Removing the sleep first means the expansion multiplies a poll rather than a guess.

The upstream-bound _fix_ work is deliberately adjacent at the tail (`B10`, `B14`, `B15`); filing is not, and `A11Y-4`'s six issues are filed at `B5` for the reason recorded there. `DV-2`, `X-1`, `X-2`, `X-3`, and all six of `A11Y-4` may each end in a filed `stevekinney/cinder` issue that has to be driven to a published release. Batching them adjacently lets several fixes share one release cycle instead of forcing a separate version-and-publish round trip per finding.

`A11Y-4` is last because it is six full upstream loops — file, fix in a worktree, PR to green, merge, release, confirm on npm, sync back — and it is the item most likely to stall on something only a human can decide. Putting it last means a stall there leaves the maximum number of other items finished. Its six defects are a11y and UX behavior in `@lostgradient/editor`; the imperative surfaces `RE-1` through `RE-4`, `DV-1`, and `ME-1` exercise are close to orthogonal to them, so the sync-back is unlikely to invalidate much of what those batches pin. Where it does, `ROADMAP.md`'s own rule applies: a behavior change arriving as a failing assertion is this repo working as intended.

## The batches

### B0: baseline reconciliation — not a roadmap item

The review-board gate blocks on work already in the tree at `HEAD` (`34ecf2e`, the round-7 gate hardening) whose recorded four-PASS sign-off is keyed to a work hash that no longer matches. `--initialize` refuses while sign-offs exist, which is correct. This has to be resolved before any roadmap batch, or every batch's board sees 1,600 lines of unrelated hook internals on top of its own diff.

Deliverable: a cleared baseline, by whatever route survives scrutiny.

### B1: contract drift — `CA-1`, `CA-2`, `CA-3`, `CA-5`

Four stale-documentation findings, all from the same reviewer sweep. `CA-1` and `CA-2` land in `WORK_DENY` files (`CLAUDE.md`, `README.md`) and so are outside what the gate measures; `CA-3` edits `.claude/skills/sync-cinder/SKILL.md`, which is fully reviewable work. `CA-5` is verification rather than editing: two pointers in `ROADMAP.md` itself need confirming against `../cinder` before anything relies on them, and `I-1` in `B12` depends on the answer.

### B2: Playwright harness config — `HS-3`, `HS-4`

Both edit `playwright.config.ts`. Trace retention on failure, and a `projects` array adding WebKit (and Firefox where it earns its place), scoped per the acceptance criteria rather than applied blanket to the whole suite. Highest blast radius of anything here, so it goes early; the same property makes it the batch most likely to surface a real cross-engine defect and trigger an upstream detour.

### B3: fixed-sleep removal — `TI-1`

Converts genuine fixed sleeps to polls in `review-modes.e2e.ts`, `review-comment-creation.e2e.ts`, `review-anchoring.e2e.ts`, and `hydration.e2e.ts`. The first three cite a documented plugin debounce; the fourth cites nothing, and its acceptance criterion allows documenting why a fixed wait is unavoidable if no mechanism can be found.

### B4: hydration coverage — `A11Y-1`

Adds every unconditionally-SSR'd exercise route to `HYDRATING_ROUTES`. Cheap to write, and the item most likely in the first half of this plan to find a real upstream hydration mismatch.

### B5: accessibility fixes — `A11Y-2`, `A11Y-3`, and the filing half of `A11Y-4`

Focus restoration when the artifact panel closes, and seven error banners converted to permanently-mounted live regions. Same reviewer domain, same class of defect. `A11Y-2` may belong upstream in `ArtifactPanel` rather than here, which its acceptance criteria already anticipate.

**Also here: file all six `A11Y-4` issues**, adopted from an `a11y-ssr-auditor` finding against the first draft of this plan. The original grouping put all of `A11Y-4` at `B15` and justified it by shared release cycles — but that argument covers fix, merge, and release, and says nothing about _filing_, which takes minutes and shares nothing with a release. One of the six is a WCAG 2.1.2 Level A keyboard trap in `@lostgradient/editor` with no issue recording it anywhere; if this run stalls before `B15` — and this plan itself calls `B15` the batch most likely to stall — there would still be none. `A11Y-4`'s own acceptance criteria already split the halves ("labels are updated to reference the filed issue, and removed once each fix ships"), so the criteria separated file-now from fix-later while the batching did not. Filing moves here; the fix and release loops stay at `B15`.

### B6: `RE-1` — thread and comment mutation (moved into B1)

Done as part of B1 rather than on its own, after four board rounds had examined only prose, shell, and config. New `/exercises/review-imperative` route plus spec, covering eight mutation methods, both anchor coordinate spaces, and the readonly guard for each. See `ROADMAP_PROGRESS.md`.

### B7: `RE-2` — export surface

`exportUnifiedDiff` verified git-appliable through a real `git apply --check` in a temp repo, with and without YAML front matter, plus `exportMarkdownSummary` orphan handling and byte-stability.

### B8: `RE-3`, `RE-4` — content replacement, reset, scroll and focus

Grouped because both are imperative-surface items on the same component and the same new exercise area, and because `RE-3`'s readonly question and `RE-4`'s orphan-guard question are the same kind of undecided contract that the exercise is meant to encode rather than dodge.

### B9: `DV-1`, `DV-3` — DiffViewer standalone and window-level keys

`DV-3` needs a standalone DiffViewer mount to test against, and specifically needs two on one page, so it cannot precede `DV-1` and gains nothing from following it in a separate batch.

### B10: `DV-2` — slot semantics divergence

Pins the current behavior of Chat's `renderDefault` against DiffViewer's total-replacement `toolbar`, then records a judgement. Separate from `B9` because its outcome may be an upstream reconciliation rather than a local test.

### B11: `ME-1` — MarkdownEditor standalone

New exercise and spec for all seven imperative methods, both coordinate spaces on `getSelection`, and the plugin seam.

### B12: `I-1`, `TI-2` — real-browser row reconciliation, stale ids through the UI

Both are "the existing coverage tests the wrong layer" findings: `I-1` because happy-dom cannot reconcile the keyed `{#each}` at all, `TI-2` because the reducer is tested directly rather than through the component event. Depends on `CA-5`'s verification of `I-1`'s two acceptance criteria, which is why `B1` comes first.

### B13: `HS-1`, `HS-2` — real streaming, real approval round trip

Both concern `src/routes/+page.svelte`'s production path: the multi-chunk streaming fixture and the `/api/chat/resume` signature-verification round trip. One local HTTP fixture serves both.

### B14: `X-1`, `X-2`, `X-3` — carried over from cinder#1285

Three investigations that each end in a recorded judgement or a filed issue: per-keystroke diff cost measured frame-by-frame, the dual normalizer's divergence, and the sidebar's quiet-failure paths.

### B15: `A11Y-4` — six pinned bugs through the upstream loop

Six defects in `@lostgradient/editor` currently pinned as permanent local regression tests. **Filing moved to `B5`** (see above), so what remains here is the expensive half: each gets fixed in a worktree, driven to green, merged, released, confirmed on npm, and synced back, with the "(pinned known bug)" labels removed as each fix lands.

## What "done" means for a batch

`ROADMAP.md` already defines it and this plan does not relax it: every acceptance criterion holds, `bun run lint && bun run check && bun run test:e2e` is clean, any upstream defect the batch surfaced has been driven through the loop in `CLAUDE.md`, and all four board members have returned PASS on the work as it finally stands. Only then does the `ROADMAP.md` checkbox move.

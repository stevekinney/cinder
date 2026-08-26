# Roadmap execution log

Running status for the batches defined in `ROADMAP_PLAN.md`. Read this first when resuming — it is the memory across sessions.

`ROADMAP.md` has no checkboxes; it carries a per-item status word (`todo`, `wip`, `done`, `blocked`). "Checked off" here means that word moved to **done**, which happens only after the board has returned four PASSes on the batch containing it.

## Status board

Batches are the **eight** in `ROADMAP_PLAN.md`'s "consolidated batches", not the original fifteen. The old `B0`–`B15` labels appear throughout the log below, written when they were current; the mapping is in the plan.

| Batch | Items                                      | Status   | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----- | ------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | `CA-1`, `CA-2`, `CA-3`, `CA-5`, **`RE-1`** | **done** | was `B0`+`B1`+`B6`; also absorbed three upstream loops; four prior rounds never produced a recorded sign-off — board round 5 reviewed it fresh and returned four PASS, recorded in `.claude/.review-board-state/signoffs/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| B     | `HS-3`, `HS-4`, `TI-1`, `A11Y-1`           | **done** | `HS-3`/`HS-4` both `done` — `playwright.config.ts` already had the three-engine `projects` array and `trace`/`screenshot`/`video: retain-on-failure`, `ROADMAP.md` just hadn't caught up; `TI-1` fully resolved across all four files (`review-anchoring`, `review-modes`, `review-comment-creation`, `hydration`), see its own log entry; `A11Y-1` confirmed against the filesystem, all 31 routes present. All four board-reviewed and passed in the round below.                                                                                                                                                                                                                                   |
| C     | `A11Y-2`, `A11Y-3`                         | **done** | both `done` in `ROADMAP.md`; `A11Y-2`'s upstream fix (cinder#1299, in `@lostgradient/chat` — `ArtifactPanel` ships from chat, not editor) published in `chat@0.9.3`, synced through `0.9.4`, and the chatroom-side focus assertion board-round-5-verified live, three cycles deep                                                                                                                                                                                                                                                                                                                                                                                                                     |
| D     | `RE-2`, `RE-3`, `RE-4`                     | **done** | written by the parallel authoring run below, reviewed for the first time and passed in board round 5. `RE-2` was `done` throughout. `RE-3`/`RE-4` were briefly `done` after that round, then demoted back to `wip` once a later sync surfaced a real regression in the same source area (`RE-3`'s own `setMarkdown`/`reset` interaction broke, filed as cinder#1328) — that regression is now fixed, released, and synced, and both items passed a fresh board round on the current state (`scrollToThread`'s two bugs, #1316/#1317, were also long since fixed and closed throughout)                                                                                                                |
| E     | `DV-1`, `DV-2`, `DV-3`, `ME-1`             | **done** | written by the parallel authoring run below, reviewed for the first time in board round 5; `DV-2`/`DV-3` needed a full upstream loop (cinder#1309/#1310) mid-round before passing — see below                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| F     | `I-1`, `TI-2`, `HS-1`, `HS-2`              | **done** | written by the parallel authoring run below, reviewed for the first time and passed in board round 5; `TI-2`'s original premise turned out unsatisfiable — see its log entry — and was resolved rather than left failing                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| G     | `X-1`, `X-2`, `X-3`                        | **done** | was `B14`; `X-2` and `X-3` both driven to a full upstream fix-and-release cycle (cinder#1307/#1318 for `X-2`, #1319/#1320 for `X-3`, all closed, released in `@lostgradient/editor@0.11.0`, synced, pinned tests retargeted to agreement); `X-1` measured once the `#1324`/`#1325` batch settled the diff-stats/export path it depends on — not acceptable (median ~30ms recompute, ~1.8x the 16.67ms frame budget, on a 304-line document), filed as cinder#1336 (confirmed OPEN), then fixed, merged, released, and synced as `@lostgradient/editor@0.12.1` (memoized normalization of the unchanging `original`, ~48% reduction measured) — see its own `ROADMAP.md` entry and the log entry below |
| H     | `A11Y-4`, filed and fixed together         | **done** | all eight originally-pinned bugs (cinder#1301–#1306, #1316, #1317) plus #1307/#1318/#1319/#1320 fixed and released together as `@lostgradient/editor@0.11.0` across four PRs (#1321, #1322, #1323, #1327); synced into chatroom; all pinned tests retargeted. The sync itself exposed a **new**, previously-latent regression — `RE-3`'s `reset`/`setMarkdown` interaction, filed as [stevekinney/cinder#1328](https://github.com/stevekinney/cinder/issues/1328) — which is **also now fixed, released (`@lostgradient/editor@0.12.0`), and synced**; see the campaign log below                                                                                                                     |

Already **done** in `ROADMAP.md` before this run started, and not re-verified as part of any batch: `I-2` and `CA-4`.

## Log

### B0: baseline reconciliation

The review-board Stop gate blocks on entry to this session. The cause is not anything this run did. **(That premise stopped holding partway through B1 — the gate was unwired on 2026-08-14; see "The review-board Stop gate was unwired mid-run" below. Everything in this B0 entry describes the state as it was when the session started.)**

`.claude/.review-board-state/last-cleared` is `1d2b810`. `HEAD` is `34ecf2e` ("Fix round-7 review board findings"), whose content carries a recorded four-PASS sign-off — the sign-off's note describes exactly the fixes in that commit message. But the sign-off is keyed to work hash `1795663a…`, and the tree now computes `2b895fd2…`, so the gate does not recognize it.

What was ruled out before concluding the drift is mechanical rather than a content change:

- No source file has an mtime later than the sign-off. `find . -newer .claude/.review-board-state/last-cleared` over the tree (excluding `node_modules`, `.git`, `.svelte-kit`, `test-results`) returns only a second sign-off file, which lives in the state directory and does not reach the hash. At the time that was true for an incidental reason rather than the assumed one; `CHR-19` below made `WORK_DENY` the operative reason, so the assumption is now correct as well as the conclusion.
- Committing is not the cause. Verified directly in a throwaway repo using this repo's own `work-hash.sh`: a baseline commit, a dirty tree, hash; then commit that tree and hash again — identical both times (`df4ddbcb…`). `CLAUDE.md`'s claim that committing after a PASS does not invalidate it holds.
- The hash is stable now: three consecutive `compute_work_hash` calls return the same value, so this is not a nondeterministic hash.
- There are no stashes, no linked worktrees, and one ref.

Two sign-off files exist on disk with identical contents but differently-named keys (`1795663a….signoff` and `ca1b8b83….signoff`), both recorded at the same second. That is **not** a livelock fingerprint, as first suspected — `review-board-signoff.sh:229-239` writes the second copy deliberately: on a complete sign-off it advances the baseline, recomputes the hash from the new baseline, and re-records the same verdict block under the new key, precisely so the gate does not block one line after printing "cleared".

`--initialize` refuses while sign-offs exist, which is the right refusal and not something to work around.

**Resolution: fold into B1's review with disclosure.** The sign-off flow is not structurally broken — verified end to end in a throwaway repo with this repo's own scripts: baseline, work, four `--pass` flags, and the gate then clears with no output. So the exact cause of the prior session's drift is unrecoverable without its tree, and chasing it further buys nothing. The round-7 diff at `HEAD` goes to the board as part of B1, disclosed in the brief rather than hidden in it, so the reviewers know which surface is new and which was reviewed before. A dedicated board round on 1,600 lines of already-reviewed hook internals is how this becomes round 8 and consumes the session.

Along the way, one real defect surfaced and is **not** fixed here — it was carried as a held-open finding and fixed later, under `CHR-19` below.

### B1: contract drift — `CA-1`, `CA-2`, `CA-3`, `CA-5`

**Status: in review, when this was written. Now `done`** — batch A (which absorbed B1, see the status board above) closed with a recorded four-PASS sign-off in board round 5. Left as "in review" below is a snapshot of B1 as its own batch, before the consolidation into A; the status board is the current source of truth.

- **`CA-1`**: corrected. The installed `@lostgradient/chat@0.9.2` declares `peerDependencies` of exactly `@lostgradient/cinder`, `@lostgradient/markdown`, and `svelte`; `conversationalist@^0.6.1` and `zod@4.4.3` are its own regular dependencies. `CLAUDE.md`'s "As of Cinder 0.16" paragraph now says that, names `@lostgradient/markdown`, and ties the correction back to the cinder#753 fix documented lower in the same file.
- **`CA-2`**: rewritten. `README.md` described a `bun link` setup against local `../cinder`/`../agent-bureau` checkouts and a `sync:cinder` that "re-links" — the exact workflow `CLAUDE.md` deliberately removed because it hid the cinder#756 hydration mismatch. It now describes published-package consumption and why, names both `Chat` and `ReviewEditor` as the components under test, and adds `check:peers` to the scripts table. `AGENTS.md` carried the same "`../cinder` link and workflow" phrasing in its first sentence and was corrected with it.
- **`CA-3`**: corrected. `.claude/skills/sync-cinder/SKILL.md` claimed the script bumps two packages; `scripts/sync-cinder.ts`'s `packages` array bumps five. Both the frontmatter `description` and the step list now name all five, and the step list also picks up `check:peers`, which the script runs (`scripts/sync-cinder.ts:77`) and the doc omitted.
- **`CA-5`**: verified, and **both pointers hold as written** — the finding was wrong. Local `../cinder` `main` is two commits behind `origin/main` and is missing the merge of PR #1285 (merged 2026-08-13), which is where both answers landed. The happy-dom keyed-`{#each}` trap is documented in `packages/chat/src/lib/test/happy-dom.ts` on `origin/main` under an explicit `## Known limitation` heading; it is a test-only helper and is correctly absent from the published tarball. The focus backstop exists by that name in `chat.svelte`, describes its rendered-set effect in the same docblock, and — unlike the helper — **does** ship: it is in the installed `@lostgradient/chat@0.9.2` dist. So `I-1`'s acceptance criteria are coherent and testable against the package this repo consumes, which unblocks B12.

Verification for this batch: `lint`, `check` (830 files, 0 errors), `check:peers`, and `check:upstream` all clean. `test:e2e` clean at **296 passed in 40.2s**, independently reproduced by a reviewer at 296 passed in 40.4s.

Recorded here as the pre-B2 baseline, **with the conditions that make it comparable** — a bare number would be worthless to B2 without them. It is a _single-project_ run: `playwright.config.ts` declares no `projects` array, so this is Chromium only, which is exactly what B2 changes. Both `webServer` entries were already warm, so it excludes a cold `npm run build`. Compare B2 against it on those same terms.

### B2 through B15

Not started, when this was written. **Superseded** — the old `B2`–`B15` labels map onto the lettered batches `C` through `H` (see `ROADMAP_PLAN.md`'s "consolidated batches" table), and the status board above is the current source of truth for each: `C`, `D` (except `RE-4`), `E`, and `F` are `done`; `B`, `G`, and `H` remain in progress. This line is left as a record of the plan's starting point, not a live status.

## Advisor consultations

**Before B0/B1, on batch order and the blocked gate.** The advisor challenged the hash-drift diagnosis rather than the plan, pointing at one candidate not yet ruled out: that `WORK_DENY` is a git pathspec applied free to the diff but needing manual re-application on the ignored-content walk, which — if true for `.claude/.review-board-state/` — would mean recording a sign-off moves the hash away from the one just approved, and no board round could ever clear the gate. It gave the exact probe.

The probe found a real defect but not that failure mode: a `.signoff` write leaves the hash untouched while a `.ts` with identical content in the same directory moves it. That defect was held open for several rounds and is fixed now — see the `CHR-19` section below. Three other things came from the same consultation and were adopted: fold the round-7 diff into B1 rather than spend a dedicated board round on it; time the e2e suite before B2 lands, since fifteen batches will pay it (40.2s, so B2's matrix is affordable); and probe upstream publish capability early rather than discovering at B15 that the loop cannot finish.

## Upstream detours

**[cinder#1288](https://github.com/stevekinney/cinder/issues/1288), filed and worked during B1/RE-1.** Filed with a wrong mechanism, refuted in review, corrected in place with a superseded banner on the original body, then amended twice more (scoping "permanently" to selection-only changes; a worse resync-window severity finding). See "Board round 1, continued" below for the full arc.

**Closed out from under this batch, mid-round-3.** While the round-3 board was running, the issue was closed (`stateReason: COMPLETED`, by the repo owner) — merged as [stevekinney/cinder#1289](https://github.com/stevekinney/cinder/pull/1289), "fix(editor): use live Milkdown selection updates", `notifySelectionChange` now takes Milkdown's live selection as a second argument instead of re-reading `view.state`, exactly the requested fix. Verified rather than assumed: `origin/main` has the merge commit and the changed function. The version claim here was corrected once already — `packages/editor/package.json`'s workspace version on `origin/main` is actually `0.9.0`, matching npm's published latest, **not** `0.8.1` as an earlier draft of this paragraph said. What actually makes the fix unreleased is that `#1289` shipped only a changeset (`@lostgradient/editor: patch`, consumed by no subsequent `chore: version packages` commit) — the version number did not move because nothing has bumped it past `#1289` yet. `npm view @lostgradient/editor version` still returns `0.9.0`, and the installed `@lostgradient/editor@0.9.0` in this repo (predating `#1289`) still has the bug — confirmed directly by grepping the installed `dist/editor/editor.js` for the new `liveSelection` parameter, which returns nothing. So the `upstream:` marker, the pinned tests, and the drag workaround in `review-imperative.e2e.ts` are all still correct as they stand — nothing here needs to change yet.

`bun run check:upstream` then correctly went red — the marker points at a closed issue. Per `CLAUDE.md`'s exact rule ("If the problem still reproduces despite the closed issue: reopen it... and leave the marker in place"), reconfirmed the installed package still lacks the fix (`grep` for the new `liveSelection` parameter in `node_modules/@lostgradient/editor/dist/editor/editor.js` returns nothing) and reopened with a note explaining why — verified `OPEN` afterward. `check:upstream` clean again.

Not driven further in this batch, deliberately: `sync:cinder` would bump five packages mid-board-round, and every prior config change mid-round in this session cost a full re-review cycle. The release → sync → cleanup steps (per `CLAUDE.md`'s loop) are logged here as the next piece of work, not started — flagged to the user rather than launched unilaterally, since publishing a release is exactly the kind of action this session should not decide alone.

**Resolved: the release was cut, and the loop closed.** The user's instruction opening the next session — "If you encounter upstream issues, you must fix them upstream and cut a release before continuing" — is the authorization the paragraph above was waiting for, so the flag is discharged rather than still standing. What happened, in order:

- **Merged** `chore: version packages` ([cinder#1290](https://github.com/stevekinney/cinder/pull/1290)), which consumed #1289's changeset and bumped `@lostgradient/editor` to `0.9.1`. It reported `mergeStateStatus: BLOCKED` with every required check green (`unit-tests`, `typecheck`, `playwright`, `Pre-1.0 changeset bump guard`) and no review requested; the repo carries a `copilot_code_review` ruleset alongside classic protection, and `enforce_admins` is off. Merged with `--admin`, the same way the previous release PR (#1287) landed with zero reviews. Worth knowing rather than rediscovering: an admin merge here bypasses a review ruleset, **not** the test gates, which were all green first.
- **Confirmed the publish reached npm** before syncing — `npm view @lostgradient/editor version` → `0.9.1` — rather than trusting the merge. The release job gates its publish steps behind a `Wait for main-green source validation` step that waits on cinder's ~24-minute `browser-tests`, so "merged" and "published" were about half an hour apart.
- **Synced.** `bun run sync:cinder` moved exactly one package (`editor 0.9.0 → 0.9.1`); the other four were already latest. `lint`, `check` (833 files, 0 errors), `check:upstream`, and `check:peers` clean after the bump.
- **The two pinned tests failed, and only those two** — the repo working as intended. Retargeted to the fixed contract rather than deleted, in the same change as the marker removal.
- **Closed [cinder#1288](https://github.com/stevekinney/cinder/issues/1288)** with what shipped, and verified `CLOSED`/`COMPLETED` afterwards rather than assuming the close held.

### What the retarget actually changed

The fix is `notifySelectionChange` taking Milkdown's live selection as argument 2 instead of re-reading `view.state` — present in the installed tarball at `dist/editor/editor.js:107` and in `dist/server`. Both of #1288's symptoms are gone, and both are now pinned from the fixed side:

- `a single programmatic selection through getView() is enough to anchor` (was `createThread returns null for a programmatic selection`). One dispatch through the public `getView()` — the path `CLAUDE.md`'s `bind:this` guidance implies — now returns an id and anchors at exactly 44..53, quote `dashboard`.
- `the anchor covers exactly the text a native drag highlighted` (was `the anchor does NOT match the selection it was made from`). Equality, where 0.9.0 anchored 15..86 for a 15..89 drag.

`dragSelectFirstParagraph` **survives, against its own former advice**, and this is the one judgement in the batch worth arguing with. Its docblock said the helper should disappear entirely once the fix shipped, on the premise that the drag existed only to out-run the lag. It did — so the shared `createAnchored` no longer drags, which is why the spec dropped from 20.1s to 12.6s. But the drag is also the only test here that exercises Milkdown's real pointer-driven selection pipeline, and the native path is where #1288's severity was worst: it did not refuse, it silently anchored text nobody selected. Deleting the last native assertion because the bug that motivated it was fixed is how that regression returns unnoticed. One caller keeps it; everything else takes the deterministic path.

The coordinate-space test also got stronger for a reason worth recording: with a deterministic selection it can assert 44 / 53 / 42 as literals. Those are three independent arithmetic claims about one selection, derived by hand in the page's fixture comment, not three readouts of the same number — which is exactly the failure mode the old version had. A drag cannot name its own range, so this was not available before.

**Load-bearing, proven rather than asserted.** Reverting `liveSelection ?? view.state.selection` to `view.state.selection` in both the client and server dist turns **11 of 19** red — the two named above plus every test routed through `createAnchored`, which now takes the single-dispatch path. Servers killed and `node_modules/.vite` cleared first, since Playwright reuses a running `webServer` and a warm preview build silently serves the old code. Dist restored from backup and md5-verified identical (`faf04726…`, `bc11b576…`).

## The review-board Stop gate was unwired mid-run

**2026-08-14, during B1.** A concurrent interactive session in this same tree (`chatroom-51`) removed the `Stop` hook entry that invoked `.claude/hooks/review-board-gate.sh` from `.claude/settings.json`. Not this session's change, and not requested by this session.

**Why.** That session's user asked for it. This repo's work hash covers the whole tree, so this run's uncommitted B1 work was blocking that session's every turn — it reported 17 consecutive identical blocks. The coupling is real and there is no way for either session to scope it.

**What actually changed.** Exactly one array element. The cinder-nudge `Stop` hook is intact, `.claude/hooks/review-board-gate.sh` is present and executable, `git diff HEAD -- .claude/hooks/` is empty, and its 108-probe suite passes. Only the wiring is gone. `.claude/.review-board-state/` was not touched: `last-cleared` still reads `1d2b810` and the directory still holds three files.

**What was done about it.** Not reverted. A peer session cannot authorize a config change, and undoing one that peer's user asked for, on that peer's say-so, is the same error mirrored. It was surfaced to this session's user instead, who responded by asking that the `review-board` skill keep being invoked before each `ROADMAP.md` change — an endorsement of manual invocation, not of restoring the hook. **If the hook should come back, restoring that one array element is all it takes; nothing else needs undoing.**

**What it changes about how this run operates: nothing about the obligation, everything about what catches a lapse.** The four-PASS requirement lives in `CLAUDE.md`, not in the hook. `AGENTS.md` already described this exact posture for agents that cannot load the hook — "The bar is the same regardless… State plainly in your summary which checks you performed and which you could not." Worth recording that `CLAUDE.md` predicted this precisely, calling removal of the `Stop` entry "a fail-open in a mechanism whose stated design is to fail closed," written down "so the next reader finds it."

Five documents described the gate as live and have been corrected: `CLAUDE.md` (two passages), `ROADMAP.md`, `AGENTS.md`, and `.claude/skills/review-board/SKILL.md` (three). A `contract-auditor` round found all five plus the fact that the removal was recorded nowhere in the tree, which is what this section fixes.

## Incidental fix: an unsatisfied `zod` peer range

Surfaced by a `contract-auditor` finding against a `README.md` sentence, but the sentence was the smaller problem. `armorer` and `conversationalist` each declare `zod@^4.4.3` as a **peer**, and neither ships a nested copy — so both resolved against chatroom's root `zod`, which was pinned at **4.4.1**. An unsatisfied peer range, live in the tree.

`bun run check:peers` does not catch this class: its `CHECKS` array holds one entry, testing that chatroom's re-declared `conversationalist` range matches chat's. It verifies one declared range, not peer satisfaction generally.

Fixed by bumping `zod` to `4.4.3` in `package.json` and reinstalling; root `zod` now resolves 4.4.3 and both peers are satisfied. Documented in `README.md` rather than left as folklore. Not a `ROADMAP.md` item and not scope creep — writing documentation _about_ peer dependencies around a live peer violation would have been the wrong trade.

Worth someone's judgement later, not taken unilaterally here: whether `check:peers` should grow into a general peer-satisfaction check. It would have caught this.

## B1 (revised): the contract-drift docs, the gate fixtures, and `RE-1`

**Resumed.** The other session confirmed it is finished and the tree is stable again. Two changes to how this run is being driven, both in response to direct feedback that the first several hours produced no roadmap coverage:

- **The plan is consolidated from fifteen batches to roughly six.** The board is the dominant cost and most of those rounds were overhead rather than review value.
- **B1 no longer ships on its own.** Four board rounds had by that point examined only prose, shell, and config — not one `.svelte` file or line of `src/`. Spending a fifth on documentation alone would have repeated that, so B1's doc fixes were folded into the first real code batch instead.

### `RE-1` — thread and comment mutation

New route `/exercises/review-imperative` plus spec, driving all eight mutation methods through `bind:this` against an editable and a `readonly` instance. 11 tests, added to `HYDRATING_ROUTES` with the route rather than by a later sweep.

**Found and filed: [cinder#1288](https://github.com/stevekinney/cinder/issues/1288) (verified OPEN).** Original mechanism claim below is **superseded** — see "Board round 1, continued" further down for the correction. `ReviewEditor.createThread` returns `null` for any selection that did not come from a native user gesture. It guards on `currentSelection`, fed only by the inner MarkdownEditor's `onselectionchange`, so a consumer following `CLAUDE.md`'s documented `bind:this` guidance — set a selection through the public `getView()`, then call `createThread` — gets a silent null. Confirmed in a real browser across three paths: a ProseMirror transaction (null), a DOM Range (null), and a real mouse drag (succeeds). `createDocumentThread` and `createBlockThread` are unaffected from the identical code path. The component already contains the fix and applies it elsewhere — its popover path deliberately reads the view directly, with a comment saying `currentSelection` "may not be updated yet". Pinned by a test that will fail when the fix lands.

Four behaviors worth recording, none of them guessable from the types:

- These methods are **requests, not mutations**. Each fires a callback and changes nothing; `threads` moves only because the page owns a reducer. Every early probe reported `threads: 0` while the calls returned perfectly good request ids.
- `lastKnownOffset` is a `doc.textBetween()` offset and `from` is a ProseMirror position — **13 vs 15** for the same selection here. The spec asserts the component's value against an independent derivation taken straight from ProseMirror, not against another number the component produced.
- `createBlockThread` gets **no distinct anchor type** — it reports `text` and covers the block's full text range.
- `clearAllThreads` fires `onthreaddelete` **once per thread**, not one bulk notification.

And one answer to a question `RE-3` calls undecided: **all eight mutation methods guard on `mode === 'readonly'`; `setMarkdown` and `reset` do not.** A readonly editor is programmatically mutable — measured, 235 chars to 36. Pinned as current behavior rather than asserted as correct.

**Test integrity.** The coordinate-space test was proven load-bearing by breaking `buildAnchorFromSelection` to return a ProseMirror position where a textBetween offset belongs — the exact confusion `RE-1` exists to catch. It failed alone; nothing else failed spuriously; `anchoring.js` restored and md5-verified.

### The gate fixtures

`review-board-gate.test.sh` was left at 62/108 by the other session's `Stop` → `PreToolUse` rewrite: the fixtures fed the old stdin shape with no `tool_input.file_path`, so the gate exited early before reaching `compute_work_hash`. Repaired centrally — a `GATE_STDIN` constant, 16 invocations rewired, 4 output-shape assertions updated. Back to 108/108, deterministic across runs, and re-proven load-bearing by deleting the symlink-escape guard (4 failures, exactly the set a reviewer got previously) and the `showUntrackedFiles` flag (2 failures, including a demonstrated live fail-open). `work-hash.sh` restored md5-verified both times.

### Board round 1: four FAILs, and one of them refuted my own upstream issue

All four reviewers returned FAIL. The findings were real and this section records what changed, because two of them corrected things that were publicly wrong.

**cinder#1288's mechanism was wrong, and `harness-skeptic` refuted it.** I filed it claiming `createThread` fails "for any selection not produced by a native user gesture". Both halves are false: two programmatic dispatches succeed, and one real `Shift+ArrowRight` fails. The actual mechanism, which I then verified independently in the source: `notifySelectionChange` (`dist/editor/editor.js`) reads `view.state.selection`, but Milkdown fires it from its listener plugin's `state.apply(tr)` — inside `EditorState.apply`, before `view.updateState()`. So it reads the **pre-transaction** state, and `currentSelection` lags by exactly one selection-changing transaction, permanently. Milkdown passes the live selection as argument 2; the callback ignores it.

The severity is also worse than I filed. On purely native paths the method does not merely return null — it **silently anchors the wrong text**: an 8-step drag selecting 15..89 produced an anchor of 15..86. My own first probe contained that evidence and I misattributed it to imprecise drag arithmetic. The issue was corrected in place (title, mechanism, severity table, and the requested fix moved from `createThread` to `notifySelectionChange`), and re-verified OPEN.

**The flagship test passed against the defect it demonstrates.** Both of its comparisons took the anchor as their input — the rendered span against the anchor's own quote, and `lastKnownOffset` against a probe derived from the anchor's own `from` — so they held perfectly while the anchor described text nobody selected. A new test now asserts the anchor against the selection captured at call time, and pins the mismatch as the bug.

**The readonly test could not fail.** `readonlyThreads` was empty and the readonly instance wired no callbacks, so the five void methods no-opped on an empty id whether or not a guard existed. The instance is now seeded with a document thread and its callbacks wired to the same reducers, so deleting any guard turns the test red. Separately, the `createThread` arm bailed at the _selection_ guard and never reached the readonly guard it named — it now dispatches twice to get past the lag.

**A real flake, measured.** `beforeEach` waited only for hydration, not for the editors. `harness-skeptic` measured 3/8 and 7/55 failures. With the readiness gate every other `review-*` spec uses, `--repeat-each=8` is **104/104**.

Also fixed: two vacuous polls that matched on their first sample and would have passed against a component that never re-anchors; `updateComment`'s body never reaching an assertion; a `delete-comment-hard` button no test clicked; a duplicate `<h1 id="release-plan">` from mounting the same fixture in both editors; and no perceivable outcome for the nine readonly controls, now a polite live region that exists before the action rather than being mounted by it.

### Verification

`lint`, `check` (833 files, 0 errors), `check:peers`, `check:upstream` clean. The new spec is **19 tests** (grew across the review rounds below; treat any earlier count in this file as a snapshot of that round, not the current total), and `--list` reports **316 total in 27 files**.

**A number worth not repeating.** The previously-recorded "307 passed, 11 new tests" was wrong twice over: the spec was 11 tests but the batch added 12 (the extra `HYDRATING_ROUTES` entry is a parameterized case), and a 307 pass against a 308-test suite means something did not run. Both were caught by `contract-auditor`. Full-suite runs during this batch were also unreliable for reasons outside it — a peer session's `webServer` colliding on 4173/5175, external `SIGKILL`s of `npm run preview`, and load averages of 10–20 — and one apparent 4-test failure turned out to be a stale preview server serving an old build, since Playwright reuses an existing `webServer`. **Clear strays before trusting a suite number**: `lsof -nP -iTCP:4173 -iTCP:5175 -sTCP:LISTEN -t | xargs kill`.

One `harness-skeptic` observation is **unclassified and deliberately not dismissed**: a single run failed with `lastKnownOffset` 15 against a probe of 13, which the arithmetic says should be impossible unless the two readouts were computed against different `from` values. They could not reproduce it in ~30 attempts, and it has not recurred in 104 repeats since the readiness gate landed — consistent with a readout race the gate closed, but that is a hypothesis, not a finding. Left open.

### Board round 1, continued: the gate's own new arm was unprobed

`test-integrity-auditor` proved **12 of 13** component tests load-bearing (the spec has since grown to 14) by breaking what each pins and watching it fail — and then found the thing this batch actually got wrong.

**My fixture repair restored the wrong coverage.** Taking the suite from 62/108 back to 108/108 restored coverage of _what_ the gate evaluates and added none of _when_ — the arm that had just changed. `GATE_STDIN` was one constant at all 17 sites, so no fixture ever varied `file_path`. Breaking both halves of the new trigger at once — making `is_gated=1` unconditional, and turning the fail-closed missing-path arm into `exit 0` — left the suite at **108 passed, 0 failed**. A silent fail-open in the gate's one deliberate refusal fired no probe.

Nine probes added for the trigger itself, driven through a new `gate_with_stdin` helper so the stdin can vary: a non-gated path allows; all four gated spellings (relative and absolute, both filenames) deny; an absent `file_path`, malformed JSON, and an empty `file_path` each **deny rather than allow**; and a fully signed-off tree allows the roadmap edit through, so the deny probes cannot pass for the wrong reason. Re-running the reviewer's exact break now fails **4** probes instead of 0. Suite is **117 passed, 0 failed**.

**One assertion was recorded as UNPROVEN here, and that is now out of date — it is a genuine pin.** The block thread's "survives an edit elsewhere" position check originally could not be falsified: the fixture appended to paragraph three, which _is_ the anchored block, so it could never distinguish survival from inertia. Rewritten to insert _before_ the block and assert an exact shift, it then survived three drift injections, which is what this paragraph reported.

Two of those three negative results were artifacts, and the spec's own comment at the test already records the correction: there are **two** `handleAnchorsUpdate` implementations and the exported one is dead code, and `vite dev` serves the package from a pre-bundled cache that a dependency edit does not invalidate. Breaking the live implementation (`review-editor-impl.svelte`, `from/to + 3`) under `build && preview` reddens it — a round-1 `test-integrity-auditor` reproduced exactly that, `Expected: 196 Received: 199`. The error here was conservative, claiming less coverage than exists, which is the safe direction to be wrong in and still worth correcting.

Also removed: an `expect(second).toBe(second)` tautology, replaced by asserting the _survivor's identity_ after `deleteThread` — a count alone would pass if the wrong thread were removed.

**Two findings recorded and deliberately not fixed**, both pre-existing rather than introduced here. The waiver-side ref sweep in `waiver_forbidden_paths` is unprobed: deleting the "work parked on another branch" loop leaves 117/117, so a component parked on a branch or tag becomes waivable, contradicting `CLAUDE.md`'s "Work parked on another branch or in a stash still counts" — the stash half is pinned, the branch half is not. And the narrowed `PreToolUse` trigger means work that never touches `ROADMAP.md` reaches a stop with no review at all. Both are gate work rather than roadmap items; flagged for a decision instead of absorbed.

### Superseded: "pending, and blocked by the gate on purpose"

**The stated blocker did not survive, and the reason it is worth recording is that it was wrong before this section was written.** A round-1 `contract-auditor` found it: `.claude/settings.json` wires only `PostToolUse` and `Stop`, neither of which touches the gate, and `.claude/hooks/review-board-gate.sh:2` opens with "NOT CURRENTLY WIRED". So these corrections were not blocked by anything — they were simply unmade, and this section explained that away with a mechanism that had already been removed. The same auditor also found that the `Bash`-write claim below is false: `CLAUDE.md` documents no such hole.

All of the corrections listed here have since been made, along with the rest of the round-1 contract findings. The list stays as the record of what was owed:

- `:291`/`:293` — "20 of 24 SSR'd exercise routes" and "lists six routes" are now 25 and seven.
- `:52` — `RE-1`'s criterion asks for `updateComment` "with and without an explicit `deletedAt`". No `updateComment` surface has one; the reducer takes `editedAt`. That half is unsatisfiable as written and needs amending to say what was actually decided.
- `:76` — `RE-3` still calls the readonly question "currently undecided"; the tree now pins it.
- `:28`/`:38` — coverage counts still describe the pre-`RE-1` state.

**Also wrong, and left visible rather than deleted:** this paragraph used to say that editing `ROADMAP.md` through `python3` heredocs "bypasses the gate entirely", and called that "the `Bash`-write hole now documented in `CLAUDE.md`". `CLAUDE.md` documents no such hole — `grep -n "Bash" CLAUDE.md` returns two hits, both about `cp` restores in the file-modified-notice section. A claim that a safety mechanism has a named, documented hole is exactly the kind of thing a later reader would act on, so the correction matters more than the tidiness of removing it.

## Superseded: the pause

**2026-08-14, during B1's third review round. Read this first on resume.**

A concurrent session (`chatroom-51`) has now made three changes to shared review-board infrastructure while this run was mid-cycle:

1. Removed the `Stop` hook entry invoking `review-board-gate.sh` (recorded above).
2. Rewrote `.claude/hooks/review-board-gate.sh` in place — same filename, trigger changed from `Stop` to `PreToolUse`, output changed from `{decision, reason}` to `{hookSpecificOutput: {permissionDecision: "deny"}}`.
3. Added a `PreToolUse` entry to `.claude/settings.json` denying Edit/Write to `ROADMAP.md` unless a sign-off or waiver exists for the current work hash.

Verified independently: `git diff --stat HEAD -- .claude/hooks/` shows only `review-board-gate.sh` (58+/40-); `work-hash.sh` and `review-board-signoff.sh` are clean; `last-cleared` is still `1d2b810`; `settings.json` now carries `PreToolUse`, `PostToolUse`, and `Stop`.

**The gate's own suite is now 62 passed, 46 failed.** All 46 share one root cause: the fixtures feed the old Stop-hook stdin with no `tool_input.file_path`, so the rewritten gate exits early before reaching `compute_work_hash`. The `work-hash.sh` hardening those probes protect is unexercised, not broken. This regression belongs to the other session, which has said so and offered to fix the fixtures.

**Why this paused the run rather than merely annoying it.** A full board cycle here takes roughly twenty minutes. The tree changed twice inside one cycle. Concretely:

- Four reviewers were launched and had to be killed mid-flight, because two of their briefs asserted things that had just become false (`git diff HEAD -- .claude/hooks/` empty, suite at 108/108). Before being stopped, two had independently flagged the rewrite — one observing the gate now reads stdin, finds no `file_path`, and `exit 0`s silently.
- The previous round's entire output is stale in the opposite direction. Change 1 produced a `contract-auditor` FAIL for five documents describing enforcement that no longer existed; those five were corrected to say "unwired"; change 2 rewired it. Those corrections are now wrong again.
- The sign-off is keyed to a hash of the reviewed work, by design. That cannot converge against a tree changing every few minutes — and change 3 makes it binding: `ROADMAP.md` writes are now denied until a sign-off matches the current hash, which cannot be obtained while the hash keeps moving.

**Nothing was reverted.** A peer session cannot authorize a config change, and undoing one its user requested, on that peer's say-so, is the same error mirrored. The 46 failing probes were also left alone — that is the other session's regression and its user's call.

**State at pause.** B1's substance is complete and green: `lint`, `check` (830 files, 0 errors), `check:peers`, `check:upstream` all clean, `test:e2e` 296 passed in 45.3s after the zod bump. What is missing is a valid four-PASS sign-off, and `ROADMAP.md`'s `CA-1`/`CA-2`/`CA-3`/`CA-5` are correctly still at `wip` rather than `done`. Nothing has been marked complete that was not reviewed.

**To resume:** get the two sessions decoupled (a `git worktree` for one of them, per `CLAUDE.md`) or have one stand down, then re-run all four reviewers against a tree that will hold still, correct the enforcement passages a third time to match whatever the gate then is, and record the sign-off.

## Board round 4: two more upstream defects, and one of my own filings was wrong

The round that reviewed the retargeted `RE-1` returned **two PASS, two FAIL**. Both PASSes came with corrections worth more than the verdicts.

### What the passing reviewers changed anyway

`harness-skeptic` ran the spec in **all three engines — 19/19 Chromium, Firefox, and WebKit** — which is the first cross-engine evidence this repo has, and it settles `HS-3`'s open question for this spec specifically: the claims survive outside the engine that produced them. It also confirmed the installed package is byte-identical to a freshly downloaded `@lostgradient/editor@0.9.1` tarball, so nothing here rests on a locally-mutated `node_modules`.

Two of its wording corrections are now in the tree, and both were overreach rather than error:

- **"`createBlockThread` gets no distinct anchor type" was too strong.** The component leaves `anchor.type` undefined for text anchors _too_ — the `'text'` the spec reads back is this page's own `?? 'text'` normalisation. And a block anchor does carry a distinguishing field, `blockId`, which the page's serialiser was dropping. Both `rawType` and `blockId` are now exposed and asserted, in the block test and in the text test, so the pair cannot drift to the same value and stay green.
- **"`threads` only moves because the page owns a reducer" is false as an absolute.** True of the eight mutation methods; not true of the re-anchoring pass, which writes the bound array itself — as this batch's own orphaning test proves. The page's inline comment already scoped it correctly; the summary prose did not.

`test-integrity-auditor` proved all 19 (now 22) tests load-bearing individually and found **a second dead-code trap**, alongside the `review-editor-anchors.svelte.js` one the spec already documents: `review-editor.svelte`'s public wrapper redeclares `deleteComment`'s `soft = true` default and passes it explicitly, so the impl's own default is unreachable. Breaking the impl to test a defaulted parameter produces a false negative. Anyone break-testing a default here must break the wrapper.

### Two collisions in one shared tree, and neither was an attack

Both break-and-restore reviewers ran concurrently against the same `node_modules`, and each detected the other as an unexplained write. `test-integrity-auditor` logged a "mystery" write at 09:39:49 applying the exact `#1288` revert and declined to attribute it; `harness-skeptic` found its own probe marker renamed and an earlier revert silently restored mid-run, discarded a **19/19-green result that would have refuted this batch**, and rebuilt every experiment in an APFS clone on isolated ports.

They are each other. Recorded because an unexplained write cannot be left standing in this repo's threat model, and this one is fully accounted for. **No "file was modified" notice fires for `node_modules`**, so only hashing caught it — which is exactly what `CLAUDE.md` says to rely on. Structural fix for the next round: give the two break-and-restore reviewers isolated clones, or run `test-integrity-auditor` alone.

### The two blocking a11y findings went upstream

Both were reproduced independently in live Chromium before filing, via CDP, rather than taken on the reviewer's word — `#1288`'s first mechanism claim was wrong and cost a public correction, which is the standard this had to clear.

**[cinder#1291](https://github.com/stevekinney/cinder/issues/1291)** — deleting a thread from inside its own popover drops focus on `<body>`. Mechanism, read at source rather than inferred: `createFocusTrap` captures the focused element on activation and hands it to `restoreFocusTo` on deactivation, **discarding the boolean that helper returns**. `restoreFocusTo` correctly refuses to focus a disconnected node — and that refusal was the end of it. Why it survived until now is the part worth keeping: it only bites a consumer that _applies_ `onthreaddelete`. Every other `review-*` route here is notification-only, so its sidebar item survives the delete and the existing restore path still finds its target. `/exercises/review-imperative` is the first consumer that honours the callback.

**[cinder#1292](https://github.com/stevekinney/cinder/issues/1292)** — a `readonly` editor is announced as an ordinary editable textbox. `contenteditable="false"` stops edits without conveying read-only-ness; Chromium computed `readonly: false, settable: true`, the same state the editable instance reports. The same component gets it right in _source_ mode, where the `<textarea>` carries the native attribute.

**My own issue proposed the wrong fix, and measuring caught it.** The body asked for `aria-readonly` on the WYSIWYG host `<div>`. Injecting it there and re-reading the accessibility tree changes nothing: the textbox role lives on the ProseMirror node and ARIA states do not inherit down to it. Only `view.dom` works — the same reason `aria-label` is already applied there.

| where `aria-readonly` goes       | resulting textbox state           |
| -------------------------------- | --------------------------------- |
| nowhere (before)                 | `settable: true, readonly: false` |
| on the `role="application"` host | `settable: true, readonly: false` |
| on the ProseMirror node          | `readonly: true`                  |

The lesson generalises past this issue: a filed _mechanism_ gets verified before it ships, and a filed _fix_ deserves the same treatment.

### The bot review round found four real things in my own fix

Worked rather than merged over, per `CLAUDE.md`. The P1 was mine and it was fair: my new test used a bounded 100-attempt poll to wait for the popover's async positioning, which is a guessed threshold wearing a poll's clothes. It is now a `MutationObserver` on the flag the component already renders — no cap, no timer, and never-ready fails the test rather than being waited out.

The other three: a restore counted as successful whenever `.focus()` did not throw, which is also true of a connected-but-`disabled` element; a server-backed `onthreaddelete` reopens the whole bug, because the opener is still mounted while the request is in flight, so `preferRestoreFallback` reorders the candidates once a delete is requested; and the fallback selector interpolated a consumer-supplied `id` that may legally contain `"` or `\`. That last one is now resolved by `getElementById` against an id the toggle carries, which parses nothing — the failure mode is gone rather than escaped around.

**One of those fixes is deliberately unpinned, and said so rather than quietly skipped.** happy-dom focuses _every_ element handed to it — measured across a disabled button, a hidden button, an inert button, a plain `<div>`, and a `<div>` whose `tabindex` was removed, all five reporting success where a real browser refuses all five. So the "did focus actually land" branch is unreachable under that harness, and any test of it would be measuring happy-dom. Recorded as a known limitation in `packages/components/src/test/happy-dom.ts`, which is where cinder already keeps this class of note. The _disconnected_ half — the case the bug was filed for — is pinned.

### The local half

Three findings were this repo's own and are fixed here: four buttons inherited `select()`'s `view.focus()` and silently relocated focus twenty-odd tab stops into the contenteditable; `clearAllThreads` was the one void method not routed through `recordVoid`, so it announced "completed" for a call that bailed at `threads.length === 0`; and two `#` fixtures put three sibling `h1`s on the page after hydration, invisible to SSR and therefore to the hydration spec. All three are pinned, and all three were proven load-bearing by reverting them.

## Batch B: the harness matrix, and what a second engine was worth

`HS-3` and `HS-4` landed in `playwright.config.ts`, and `HS-3` paid for itself immediately: **16 failures, 12 WebKit, 4 Firefox, 0 Chromium.** Triaged one failure per investigator, with anything claimed as a real upstream defect handed to an adversarial refuter — which correctly killed one of the three such claims.

| class | count | meaning                                                     |
| ----- | ----- | ----------------------------------------------------------- |
| B     | 8     | the test encoded a Chromium-specific assumption             |
| C     | 6     | platform behavior — WebKit's Tab policy — not the component |
| A     | 2     | real component defect, both the same root cause             |

### The single most useful thing the matrix found

Two of the class-B assertions **were passing in Chromium for reasons unrelated to what they claimed**, which no amount of Chromium-only running would ever have surfaced.

`snapshotMode suppresses the caret and the selection highlight` read `user-select: none` off `.ProseMirror` and called that proof the `[data-snapshot-mode] *` rule reached it. It never has, in any engine: inside a Svelte `<style>` the `*` compiles to `:where(.svelte-…)`, and `.milkdown`/`.ProseMirror` are created at runtime by Milkdown with no scope class, so `element.matches(<compiled selector>)` is false **in Chromium too**. What Chromium was showing is Blink inheriting `user-select`, which css-ui-4 defines as non-inherited and Gecko implements as such — so Firefox's `auto` is the spec-correct value and Firefox is simply the engine that noticed. Filed as [cinder#1298](https://github.com/stevekinney/cinder/issues/1298), with the behavioral half that matters: a real drag inside a `snapshotMode` editor still selects and still repaints in **both** engines, so the documented "no selection highlights, pixel-stable" claim is not delivered for editor content anywhere. The assertion now pins the rule's true boundary, `.markdown-editor-wrapper` — the last scope-classed ancestor — which also catches a regression in the container rule that the old read could not distinguish from inheritance.

`currentUserId="" … refuses the submit` asserted `toHaveCount(0)` on the selection popover after the refusal. The refusal calls `clear()`, which is not a close-latch — visibility is derived from a live selection that still holds `dashboard`, so the 20ms debounce re-mounts the popover collapsed. Per-frame sampling put the absent window at ~16–27ms in every engine (chromium 24–40ms, webkit 50–69ms, firefox 63–80ms); Chromium happened to sample inside it. It now pins the durable claim — the composer is gone and the typed body discarded, while the affordance remains offered.

A third: `Escape closes the popover and restores focus to the sidebar item` had a Chromium-only precondition stated as fact in its own comment ("the sidebar button had focus from the click that opened the popover"). WebKit does not focus a button on mousedown, so the restore path was only ever exercised in two engines. It now opens the popover by keyboard, which is engine-independent **and** the path the keyboard user this test is about would take.

### WebKit's Tab policy, measured rather than assumed

The six class-C failures share one cause, established on a static page carrying **no component code** — an `<a href>`, three `<button>`s, an `<input>`, a `<textarea>`, and a contenteditable `<div>`:

```
webkit   Tab      INPUT -> TEXTAREA -> DIV[contenteditable] -> BODY -> …
webkit   Alt+Tab  BUTTON -> BODY -> A -> BUTTON -> INPUT -> BUTTON -> TEXTAREA
chromium Tab      A -> BUTTON -> INPUT -> BUTTON -> TEXTAREA -> DIV -> BUTTON
firefox  Tab      A -> BUTTON -> INPUT -> BUTTON -> TEXTAREA -> DIV -> BUTTON
```

Playwright's macOS WebKit honours Full Keyboard Access, which is off by default, so plain Tab visits neither buttons nor links. That produced two different correct responses, and the distinction is the whole of `src/routes/exercises/keyboard.ts`:

- Tests asserting **where one Tab lands** translate the keystroke. Every assertion stays byte-identical; only the input changes to what "next tab stop" means on that platform. This is not loosening — the expectation does not move.
- Tests asserting **an exact sequence of stops** cannot be rescued that way, because WebKit's `Alt+Tab` order genuinely differs (it includes `<body>`). Those skip WebKit with the measurement quoted in the skip reason.

Three tests skip in WebKit, and the control-bar test was **split** rather than skipped whole, so its `role="group"` / `role="toolbar"` assertions keep running there. That half is what catches a revert to `role="toolbar"` — precisely the regression the original pin was too weak to see — and losing it to protect a stop count would have repeated the mistake the test was rewritten to fix.

`virtualization` was a third kind: a fixed `15 × 2000px` wheel budget encoding "one wheel event applies its full delta", true in Chromium and WebKit, false in Firefox, which caps a wheel event at just under one scrollport height. Firefox needed 21 ticks where Chromium needed 5. Now goal-seeking, with the assertion untouched.

### A page change, not just test changes

`review-ssr-and-a11y/+page.svelte` gained a `tab-order-end` sentinel. Tabbing forward out of the editor used to run off the end of the document, where engines disagree — Chromium parks on `<body>` and wraps, Firefox hands focus to the browser chrome where the test cannot see it. Naming the element focus arrives at is engine-independent and strictly stronger than asserting it reached nothing in particular.

### Worth knowing before trusting a suite number

Three `virtualization` tests failed under `--workers=5` and passed 18/18 under `--workers=1`, on tests this batch did not touch. This machine was also running a 16-agent triage fleet at the time — load average peaked at **209** with 43 browser processes. A `vite.config.ts` warmup change was drafted, measured under that load, and **reverted**: the numbers were worthless, and shipping a config change on contaminated evidence is the failure mode `no-timeout-bumps-for-ci-failures` exists to prevent. Re-measure on a quiet machine before concluding anything about the cold-start behaviour described under `A11Y-1` below.

### `A11Y-1`, and the one thing still open in this batch

`HYDRATING_ROUTES` went from 7 routes to 27 at the time this was written — every directory under `src/routes/exercises/` plus `/`, stated in the file as an invariant so a new exercise gets added as a matter of course. **Route count is stale; the cold-start finding is not.** The list has since grown to 30 as more exercises landed (`ROADMAP.md`'s `A11Y-1` entry has the current count and confirms all 30 are present), but the measurement below was never re-taken at that size and the question it left open is still open. **All 27 passed on a warm dev server (24.7s) at the time, so no route had an actual hydration mismatch.** On a cold Vite cache the later routes timed out waiting for the beacon, because the dev server compiles each route on first request and that cost lands inside the per-test budget. Unresolved, deliberately: the fix is to move the compile out of the test budget, not to widen it, and the measurement to choose between the candidates has to happen on an idle machine — now against 30 routes, not 27.

`TI-1` removed the `waitForTimeout(1000)` from `hydration.e2e.ts` on a settled mechanism rather than a guess — `hydration_mismatch` is emitted only while Svelte's `hydrating` flag is true, and that flag is set and cleared synchronously around the mount while the beacon's `$effect` flushes on a later microtask, so every warning that will fire already has by the time the beacon is observable. Warnings are now collected two independent ways (an init script that wraps `console.warn` before any page script, and the CDP `console` listener) and both are asserted empty, so a disagreement between them is itself a finding. The predicate also widened to catch `Failed to hydrate`, a separate emission the old regex missed entirely. The remaining `TI-1` sleeps in `review-anchoring`, `review-modes`, and `review-comment-creation` are not done.

## Batch C: `A11Y-3` done, and `A11Y-2` turned out not to be ours

**`A11Y-3` — seven error banners, now permanently mounted.** Six were gated on `{#if error}`; the seventh reached the same outcome by a different route, living inside a `{#snippet failed}` boundary that does not exist until the boundary has already activated. All seven now follow the pattern Chat's own `chat-status-announcer.svelte` documents and states the reason for: _"Always rendered so the browser has registered the live region before content is injected; mounting with pre-existing text is not reliably announced."_

The boundary one needed a different fix from the other six. Its error is mirrored out through `svelte:boundary`'s `onerror` into a permanently-mounted `cinder-sr-only` region, and the in-snippet paragraph **lost its `role="alert"`** — it keeps the visible text, but two live regions describing one error would announce it twice, which is worse than the silence this item set out to fix.

Pinned by a new spec, `src/routes/exercises/error-live-regions.e2e.ts`, collecting all seven in one place because it is one invariant — a per-spec version would be five assertions that each look incidental, and the next banner added would have no obvious home. It asserts present-AND-empty-AND-`role="alert"` before any error can occur, which is the half the specs that drive those errors structurally cannot see. Proven load-bearing: re-gating one banner behind `{#if}` turns it red.

**Honest test fallout, and worth reading before the next one:** two `page.svelte.e2e.ts` tests asserted "no error surfaced" via `getByRole('alert')).toHaveCount(0)`. A permanently-mounted region makes that count 1 forever, so they would have reported a failure the user never saw. They now assert the region is **empty**, which is what the claim was always about — the count was a proxy that only worked while the region was conditional.

**`A11Y-2` — the fix belongs upstream, which its own acceptance criteria anticipated.** `ArtifactPanel` focuses its Close button on mount (deliberate and right — a keyboard user should land in the panel) and restored nothing on unmount, so closing left focus on `<body>`. Reproduced identically in Chromium, Firefox, and WebKit, so never an engine quirk. Filed as [cinder#1299](https://github.com/stevekinney/cinder/issues/1299) and fixed in the same PR as #1295 and #1298. The chatroom-side assertion (`artifacts.e2e.ts` asserting the post-close focus target) is deliberately **not** added yet: it would be knowingly red until the sync, and this repo's rule about failing assertions is about behavior changes arriving from upstream, not about committing a test that cannot pass.

## The upstream campaign, and where it stalled

Six issues filed this run, five of them found by work in this session:

| issue                                                      | found by                | state                                                                             |
| ---------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------- |
| [#1288](https://github.com/stevekinney/cinder/issues/1288) | `RE-1`                  | released `editor@0.9.1`, synced, **closed**                                       |
| [#1291](https://github.com/stevekinney/cinder/issues/1291) | board round on `RE-1`   | merged, released `cinder@0.24.3` (2026-08-14T18:57), synced, **closed**           |
| [#1292](https://github.com/stevekinney/cinder/issues/1292) | board round on `RE-1`   | merged, released `editor@0.9.2` (2026-08-14T18:57), synced, **closed**            |
| [#1295](https://github.com/stevekinney/cinder/issues/1295) | `HS-3`'s WebKit matrix  | merged (PR #1300), released `editor@0.9.3` (2026-08-14T20:22), synced, **closed** |
| [#1298](https://github.com/stevekinney/cinder/issues/1298) | `HS-3`'s Firefox matrix | merged (PR #1300), released `editor@0.9.3` (2026-08-14T20:22), synced, **closed** |
| [#1299](https://github.com/stevekinney/cinder/issues/1299) | `A11Y-2`                | merged (PR #1300), released `chat@0.9.3` (2026-08-14T20:22), synced, **closed**   |

The last three were batched into one PR rather than three release cycles, which is what the same-repo batching rule asks for — none of them had released at the time. **All six confirmed closed** (`gh issue view <n> --repo stevekinney/cinder --json state,stateReason` → `CLOSED`/`COMPLETED` for each). `#1291`/`#1292` published together as one batch (`cinder@0.24.3`, `editor@0.9.2`); `#1295`/`#1298`/`#1299` published together roughly ninety minutes later as a second batch via [#1300](https://github.com/stevekinney/cinder/pull/1300) — `editor@0.9.3` and `chat@0.9.3` together, with no accompanying `cinder` bump, confirming both landed at the package level rather than in cinder core. Verified against npm's own publish timestamps (`npm view <pkg> time --json`), not just the merge record. This tree is synced to all three current versions.

**The stall was real and is worth recording, because the symptom pointed the wrong way.** `editor@0.9.2` / `cinder@0.24.3` merged but did not publish, and npm kept reporting the old versions. The cause was not the release workflow: cinder's `main-green` failed on the version-packages commit, the `release` job gates its publish steps on `Wait for main-green source validation`, and that step failed — so the release job "completed" without ever publishing, and an auto-filed [#1297](https://github.com/stevekinney/cinder/issues/1297) recorded `main` as red.

Diagnosed rather than re-run blindly: the version-packages commit touches only `bun.lock`, generated `components.json`, CHANGELOGs, and version fields — **no source** — and the parent commit with identical source had passed `main-green` 27 minutes earlier. The failure itself was `TimeoutError: goto: Timeout 30000ms exceeded` against the consumer fixture's own server, not a hydration mismatch. Re-running turned it green, which confirms the reading. The release job then had to be re-run separately, because its own failure was already recorded.

Worth carrying forward: **a merged release PR is not a published release, and the gap can be silent.** `npm view <pkg> version` is the only check that catches it, which is exactly why `CLAUDE.md`'s loop puts it before the sync.

## Two verification lessons, both learned the hard way this run

**`0 fail` is not `green`.** I reported cinder's editor suite as `676 pass / 1 skip / 0 fail` and CI failed the PR anyway. The same run had also printed `2 errors` — Bun counts an unhandled error _between_ tests separately from assertions, and I had grepped only the pass/fail lines. The mechanism: Svelte 5's `flushSync` effect-teardown trips a happy-dom `removeChild` divergence on unmount, and the `DOMException` escapes through a Promise executor. Attributed rather than assumed — a clean `origin/main` worktree runs that suite with **no** errors line, so the branch introduced it, and the first editor test to unmount a rendered component was enough to expose a gap that was already there. `packages/components` had solved it once and documented why; the fix ports that patch into the editor package's own helper.

When reading a Bun suite, read the whole tail block, not the two lines you were looking for.

**Breaking the wrong copy is the default outcome, not the unlucky one.** Proving the #1291 pin load-bearing took two attempts. Reverting `getRestoreFallbackTarget` in `node_modules/@lostgradient/cinder/dist/index.js` changed nothing, because `@lostgradient/cinder`'s `./focus-trap` subpath resolves `browser`/`svelte`/`import` to **`./src/components/focus-trap/index.ts`** — the package ships its source, and that is what the browser bundle compiles. Only `default` points at `dist/`. Breaking the source file turned the test red immediately.

That is the fourth distinct way a break-test has silently proven nothing in this repo, alongside the two dead-code copies and the `vite dev` pre-bundle cache. All four are now enumerated in `CLAUDE.md` under "Breaking an installed package to prove a test: which copy actually runs", because each one looks exactly like "the test proves nothing" from the outside.

## The #1291 / #1292 contracts, now pinned from the consumer side

`editor@0.9.2` / `cinder@0.24.3` published and synced. Both fixes verified live before anything was asserted against them:

- Deleting a thread from its own popover now leaves focus on `imperative-editor-sidebar-toggle`, not `<body>`.
- The readonly instance's ProseMirror node carries `aria-readonly="true"`, and Chromium computes the textbox as `readonly: true` where both instances previously reported `readonly: false, settable: true`.

Two new tests in `review-imperative.e2e.ts` pin them, and both go red against the previous release — the readonly one by dropping the `aria-readonly` write, the focus one by neutering the fallback resolver in the source file the browser actually compiles.

## The parallel authoring run, and the one bug that justified the whole roadmap

Nine agents authored the nine remaining items simultaneously, over disjoint file sets, fed the recon briefs written earlier in this run. Zero agent errors, ~80 tests across ~25 files, and the integrated tree typechecks at 991 files / 0 errors.

The constraints encoded into every prompt were this session's own failures, written as rules: no agent runs Playwright, a build, or a preview (load reached **209** earlier when agents ran browsers, corrupting a measurement badly enough that a config change had to be reverted — this run peaked at **12**); no agent edits `exercises/+page.svelte`, `hydration.e2e.ts`, or `playwright.config.ts`; no agent files a GitHub issue. Ownership was assigned before launch from the recon, not discovered by agents, so no two shared a file. Each returned a break recipe per test naming **which copy** to break.

All three held. The investigation-only agent wrote solely to the scratchpad.

### `HS-1` found that pressing "stop generating" crashed the server

The item existed because stop-generation was only ever tested against a request that never resolves — never against one with partial content already buffered. Testing that branch for the first time took the preview server down.

The mechanism is deliberate on the SDK's side. `MessageStream._emit`:

```js
if (event === 'abort') {
  if (!catchingPromiseCreated && !listeners?.length) Promise.reject(error);
```

An intentional unhandled rejection, so a silently-dropped stream is loud. `src/routes/api/chat/+server.ts` registered `on('error')` but no `abort` listener, and never awaits `done()`/`finalMessage()` because it forwards events as they arrive — so `catchingPromiseCreated` stays false. A client abort reached `cancel()` → `anthropicStream.abort()` → `_emit('abort')` → `Promise.reject` with nothing attached, and Node took the process down mid-request.

Registering the listener **is** the fix: its presence satisfies `!listeners?.length` and the SDK stops synthesising the rejection. The body is deliberately a no-op — an abort here is the documented outcome of `cancel()`, not a failure, and calling `controller.error` would turn a normal stop into an error the user never caused.

This is the second instance of a hazard the file's own `settled` comment already describes ("an uncaught throw here … crashes the whole process"): there a double controller call, here an event with no listener. Ours, not upstream, so no release loop. Proven load-bearing — remove the listener and the crash returns.

**Why the fixture is what made it findable.** The agent stood the fixture in for the **Anthropic API**, not for `/api/chat`, so the real endpoint, the real SDK stream, the real ndjson re-encode, the real `toolbox.execute` signature, and the real browser `ReadableStream` read all stayed under test — reachable only because the SDK resolves `baseURL` from `ANTHROPIC_BASE_URL` at construction, so no application code changed. And it uses **gates rather than delays**: the second chunk does not exist until the test asks for it via `POST /__fixture/release`, which turns "partial text is on screen while the response is still open" from a timing claim into a causal one. A `setTimeout`-and-wait fixture would have been the guess this repo treats as a defect, and would not have held the response open long enough to abort into.

### The other failure was a mis-stated assertion, not a defect

DiffViewer renders exactly one **empty** `.diff-line` before it computes anything — measured at `{count: 1, withText: 0}` on both the manual-tier control and the override. So `bodyLines(...).toHaveCount(0)` was counting a placeholder and reading it as a diff. The claim was right; the form was wrong. Now filtered on text, which is the same claim stated accurately and strictly stronger — a line carrying real content is caught, where a bare count could be satisfied by any single node.

### Integration surfaced two problems the agents structurally could not

Both lived in the shared files they were forbidden to touch, which is the argument for keeping them out of the fan-out:

- **A TypeScript overload limit at 28 routes.** `resolve()` is typed with one overload per route, and TypeScript cannot distribute a union argument across overloads — so ``resolve(`/exercises/${slug}`)`` was passing the union of every slug to a function that accepts one route. It compiled while the union was small and broke at 28. Fixed by resolving each `href` from a literal at definition, which is strictly more checking: it immediately caught an entry the edit had missed.
- **A lint false positive that followed.** `svelte/no-navigation-without-resolve` is syntactic and cannot trace the value back to its definition. Disabled for that one line with the reason written out, rather than switched off in config — the rule is right about every other anchor here.

## CHR-19: `WORK_DENY` now takes effect on the gate's ignored-content walk

Held open through the sections above, and fixed on 2026-08-17 as its own scoped task. Kept as a record rather than deleted, because the shape of the defect — and of the two holes the obvious fixes opened — is the reusable part. Three board rounds, twelve reviewer-findings, and the fix ended up somewhere the issue did not ask for.

**What was wrong.** `WORK_DENY` _was_ passed to `ignored_matching_paths` at all three of its call sites; the original note's citations, `work-hash.sh:911`, `:915` and `:1213`, were accurate against `0261ac8`, the revision they were taken at. The failure was in git: `git status --ignored=matching` collapses an ignored directory into a single entry and emits that entry whole regardless of any `:(exclude)` pathspec, in all three spellings (bare, trailing slash, `/**`), with `:(exclude)CLAUDE.md` as a working control on a _file_. Confirmed on two git versions (Homebrew 2.55.0 and Apple 2.50.1) and in the real repo; `--ignored=traditional` honours the exclude for the same directory. So `.claude/.review-board-state/` came back out of that function despite being denied, and stayed out of the hash only because `is_source` happens to reject `.signoff` and the extensionless `last-cleared`.

**The first fix opened a worse hole than it closed.** Filtering denied paths out of the walk made the exclusion real — and `.claude/.review-board-state` is the only _directory_ in `WORK_DENY`, so it immediately became the `docs/` hiding place that `WORK_DENY`'s own comment records as a mistake already made once. Measured both halves: an `Evil.svelte` written there moved the hash and appeared in `WAIVER_FORBIDDEN` before the change, and after it the hash was **unchanged** and `WAIVER_FORBIDDEN` was **empty**. One board round on a tracked `import` line would have bought unlimited unreviewed edits to a component vite still bundles, SSRs and hydrates, and `--grounds formatting-only` would have been recordable over it — and the waiver half is live machinery, unlike the unwired gate. A fail-**open**, in a file whose first design rule is "Fail closed. Any state this cannot evaluate is a BLOCK, never an allow."

**The second fix opened a smaller one.** `state_dir_hides_source` closed the hole by refusing, but reused `walk_hidden_dir` — a walk built to answer _what should I hash_ — as a _presence_ check. Every bound that walk has became a blind spot: `-maxdepth 12`, the `is_artifact` skip, the `*/.git` prune, and `find`'s swallowed stderr. Two of those were regressions this work introduced, since denying the state dir from `compute_work_hash`'s bounds loop is what removed the depth and readability refusals it used to get: a component at depth 13, and one behind a `chmod 111` subdirectory, both went from a named refusal at `0261ac8` to silence, and a full four-`--pass` sign-off cleared over them. The artifact and `.git` shapes never worked, at `0261ac8` either — one reviewer built a scratch vite project and watched `.review-board-state/dist/Evil.svelte` server-render a `role="dialog" aria-modal="true"` with no focus trap while both paths reported nothing. A justification committed alongside the first version ("an unreadable one fails loudly in `review-board-signoff.sh`'s own `mkdir -p`") was simply false: that `mkdir -p` only touches `signoffs/`, so an unreadable sibling is never stat'd.

**What shipped.** `path_is_denied` filters the walk as the issue asked. `state_dir_hides_source` carries **its own** walk — no artifact skip, no `.git` prune, its own depth and readability refusals, no file cap (it early-exits on the first hit and reads no contents, so the cap that protects the hashing walk would only be a refusal this tool could inflict on itself as the sign-off flow grows the directory), and lowercasing before `is_source` so `Evil.SVELTE` cannot escape a guard that `renders()` would enforce anywhere else. `state_dir_refusal` turns its `<reason>:<path>` line into a sentence, so an internal sentinel can never reach a person where a filename belongs — the first version printed `__WALK_TRUNCATED__` into the message as though it were one. Both `compute_work_hash` and `waiver_forbidden_paths` refuse, repeated rather than inherited, because today's coverage of the waiver path is a property of `review-board-signoff.sh`'s call order.

**Two deviations from the issue's acceptance criteria**, stated rather than buried:

- Criterion 1 asked for the prefix test "after `ignored_matching_paths` returns", which read literally means at the three call sites — but criterion 3 asked those call sites to stay unmodified, and both cannot hold at once. The filter went _inside_ the function, which satisfies the intent and criterion 3 literally, gets it right once instead of three times, and cannot be missed by a fourth call site later. The deny set is derived from the `:(exclude)` pathspecs actually passed rather than a second copy of `WORK_DENY`, so it cannot drift; the two `-C` call sites pass no excludes and are unaffected by construction.
- Criterion 2 asked that a source-extension file written into `.claude/.review-board-state/` leave the hash **unchanged**. That is precisely the fail-open above, so it is not implemented. Bookkeeping written there leaves the hash unchanged — the criterion's actual purpose — and a _source_ file refuses by name. The issue's stated premise, that this defect "fails closed" so the only risk is livelock, is true of the defect and **not** of the fix it prescribes.

**Fifty-four new assertions, and the mutations that redden them.** Units first, because this
paragraph shipped a wrong count in four consecutive rounds: the suite prints one line per
assertion, and a parameterized loop prints one per iteration, so a `for` over nine artifact names
is one `ok` call site and nine assertions. Counted by running the suite at `0261ac8` and at `HEAD`
and diffing the rosters — **117 → 171** — never by grepping call sites, which produced two of the
four wrong figures. Every row is pasted output from one sweep in an isolated copy of the hooks,
after a background sweep writing `work-hash.sh` concurrently with a foreground edit destroyed one.

| mutation                                            | result   |
| --------------------------------------------------- | -------- |
| clean                                               | 171 / 0  |
| pre-fix at `0261ac8`                                | 128 / 43 |
| first `walk_hidden_dir`-based guard (`c7ac225`)     | 134 / 37 |
| access(2)-based guard (`aeddf2f`)                   | 163 / 8  |
| bare exit-status guard (`e2dfbe1`)                  | 164 / 7  |
| state-dir guard neutered at both entry points       | 143 / 28 |
| guard file walk bounded to `-maxdepth 1`            | 161 / 10 |
| containment arm deleted                             | 170 / 1  |
| containment reversed                                | 169 / 2  |
| `${#__deny[@]}` empty-array guard removed           | 170 / 1  |
| state-dir boundary check disabled                   | 170 / 1  |
| tree-wide boundary check deleted                    | 170 / 1  |
| one sentinel consumer reverted to a substring test  | 169 / 2  |
| churn retry probe removed                           | 170 / 1  |
| `is_source` stops lowercasing                       | 170 / 1  |
| vite CSS set removed from `IS_SOURCE_EXT`           | 167 / 4  |
| vite CSS set and `.svg` removed from `WAIVER_NEVER` | 162 / 9  |
| `state_dir_refusal` newline arm deleted             | 170 / 1  |
| root-stat arm always refuses (over-refusal)         | 90 / 81  |
| pre-fix plus `.signoff` in `IS_SOURCE_EXT`          | 127 / 44 |

**All 54 are reddened by at least one of those**, computed rather than asserted: the union of every
mutation's failing-assertion names, normalised for the per-run `mktemp` paths two pre-existing
probes embed in their own names, contains all 54. Earlier versions of this sentence claimed
coverage a reviewer then disproved, twice. Two rows exist only because redundancy would otherwise
hold a probe green: the over-refusal row for "a genuinely absent state dir does not provoke a
refusal" (no other mutation reaches it, since every other one makes the guard refuse _less_), and
the `${#__deny[@]}` row. A reviewer's own union found only three rows uniquely necessary — those
two plus `containment reversed` — and specifically that the `.signoff` row is _not_ uniquely
necessary for the bookkeeping probe, which the over-refusal row also reddens as collateral. An
earlier version of this sentence said "three rows" and then enumerated six, bundling the four
commit-checkout rows under a rationale that is not theirs: those measure what each successive
design actually missed rather than what its author believed it caught.

**Four claims this record made confidently and wrongly**, each caught by a reviewer, kept because the pattern is the lesson:

- "Two go red pre-fix" when three did — disproved by the session's own earlier `118 passed, 3 failed`. Corrected, and then the corrected figure was wrong too ("five" when six did, at `c7ac225`). Two consecutive rounds of the same defect, in the document whose entire purpose is to be the durable record of the verification. The table above is measured output pasted in, not a count carried in prose.
- `path_is_denied`'s docblock claimed that without its trailing-slash strip "the filter is inert in exactly the case it exists for". False: the strip-less variant stays fully green and still answers denied, because the `"$__d"/*` arm matches `foo/` with `*` binding the empty string. Defensive, not load-bearing, and now says so.
- The explanation for why one probe's fixture reaches the "sits UNDER one" arm was wrong twice. It is not that git only fails on the entry that _is_ the excluded path — the probe's own `deny/sub/` is strictly below it and survives — and it is not the `.gitignore`'s nesting. The operative variable is **tracked content inside the excluded directory**, which forces git to descend past the pathspec prune; the nested `.gitignore` works because committing it puts tracked content there, and any tracked file does the same. Measured four ways. Worth knowing: the live repo's state dir is ignored whole and holds nothing tracked, so only the exact-match arm is reachable in production and the other is defensive coverage.
- "Every one proven load-bearing" covered a probe no mutation reddens (above).

One figure correction, attributed properly: the **CHR-19 issue** (not this note, which quoted no figure) said `grep -n WORK_DENY` returns 12. It returned 21 at `0261ac8` and 28 now.

**The ACL chase, and why the third design is smaller than the first.** Rounds three and four spent
themselves on one question: how does this gate know a directory it walked was actually readable?
The answer went through three designs, and each of the first two was defeated by a macOS ACL one
verb further out — `chmod +a "<user> deny ..."`, no root required.

- `-perm` (mode bits) was beaten by `deny list`, which denies readdir while the mode still reads
  `drwxr-xr-x`.
- `-perm` plus a per-directory access(2) test was beaten by `deny readattr`, which denies stat, so
  `find` cannot classify the entry at all: `-type d` never names the directory for a per-directory
  test to run on, `-type f` never descends, and both `-maxdepth` counts agree so no depth refusal
  fires. Two reviewers reached this independently, one demonstrating the whole consequence — gate
  blocks, four `--pass` sign-offs record, gate allows, the hidden component is then _edited_ with
  no board, gate still allows — and building the component with this repo's own vite to confirm
  `aria-modal="true"` with no focus trap reached the bundle.

The third design asks `find` whether it FINISHED, via its exit status. That covers all five —
`chmod 000`, `111`, `666`, `deny list` and `deny readattr` — **except at the walk's own `-maxdepth`
boundary**, where `find` never opens the directory and four of the five exit 0. An earlier version
of this paragraph asserted "subsumes all of them" flat, and a reviewer refuted it by measuring each
shape at depths 1, 11 and 12 on two `find` binaries. The boundary is covered by reading the exit
status of the _deeper_ depth-probe walk, the only one that opens it.

Deleting the access(2) loop and both `-perm` arms alongside that was justified here as "unpinnable
redundancy", and that framing was wrong in a way worth keeping. They were **unpinnable, not
redundant**: production code was removed because the test environment could not reach it, which is
the same disease as writing production code to satisfy a test, pointed the other way — and the
boundary regression above is what it cost. What makes the deletion defensible now is the boundary
check, not the argument given for it at the time. A separate
arm covers the state directory's own root, where `[ -d ]` is itself a stat and a `readattr` denial
turned "this directory holds a component" into "there is no state directory"; it asks the parent
for its entries, since readdir supplies names without stat'ing them, and is paired with a negative
control because a false refusal on a fresh checkout is the livelock this task exists to remove.

**A refutation this log got wrong, corrected here because it was published as fact.** A reviewer
proposed a per-directory `ls` as the remedy for the first ACL. This log recorded that it "does not
work either — under that ACL `ls` exits 0 with empty output". That was false, and measured in the
wrong shell: `ls` here is an alias for `eza`, and `/bin/ls` — which is what a hook gets — exits 1.
A second reviewer measured it four ways (`/bin/ls` rc=1, `ls -A` rc=1, `eza` rc=2, python
`os.listdir` raising) and located the error exactly: on the ACL'd directory `ls` exits 1, and on
its _parent_ it exits 0 **and prints the entry** — so "exits 0 with empty output" described no
directory in the fixture at all. A later reviewer caught that this correction had itself carried
forward the "empty output" half of the claim it was correcting. Two adjacent
facts, conflated, and shipped into three files as a reason to reject a remedy that would in fact
have worked for that ACL. The remedy is still not what shipped — it does not survive `deny
readattr` either — but it was dismissed on a measurement that does not hold.

Separately, `is_source` carried five of vite's nine CSS extensions and `WAIVER_NEVER` carried one:
vite 8.1.5 matches `(css|less|sass|scss|styl|stylus|pcss|postcss|sss)`, and a scratch project using
this repo's own vite compiled a state-dir `.pcss` into shipped CSS carrying `outline: none` on
`:focus-visible`, waived cleanly under `formatting-only`. Both lists now carry all nine, plus
`.svg`, which was in `IS_SOURCE_EXT` only and so waivable outside `src/` despite carrying `role`
and `aria-label`.

**Two gaps this campaign found and did not close, recorded rather than implied.** A macOS ACL
denying `read` on a FILE is invisible to every guard here: mode bits stay clean, `find` never opens
files so every exit status is 0, and `cat`/`shasum` fail into `2>/dev/null` — so two different
bodies of the same file hash identically with no refusal. Pre-existing, and the reason it is
recorded rather than fixed is that closing it means reading every hidden file's bytes through a
path that can fail, which is a different design from the one this campaign hardened. Separately,
the file-read `-perm` arm is now the only mechanism-based permission test left in the file, and it
is exactly the kind an ACL defeats — which is the argument that justified deleting its siblings,
pointing back at it.

**Known gaps, left open deliberately.** The artifact blind spot is tree-wide, not just in the state directory: `tmp/dist/Evil.svelte` in any ignored directory is invisible to both the hash and the waiver, at `0261ac8` and now. The reason for deferring it is **livelock, not performance** — an earlier version of this paragraph said performance, which is the weaker half and invites a future session to "fix" this with a faster walk and reintroduce the livelock. Artifact directories legitimately contain source-extension files, so dropping the `is_artifact` bound from the tree-wide walk turns a real `build/` or `playwright-report/` into a cap refusal telling the user to narrow an ignore rule for a build output: the exact unactionable-refusal class CHR-19 exists to remove. The state directory is the one place "no source, ever" is a defensible invariant, which is why dropping the skip _there_ is right and dropping it everywhere is not. (The performance hazard is real too — that walk once hashed 3000 Istanbul files at 7s — it is just not the deciding reason.) The waiver path also still has no _depth_ probe of its own for non-denied ignored directories, covered only by `review-board-signoff.sh` calling `compute_work_hash` afterwards — the same call-order dependency the state-dir guard declines to rely on. It does now have its own readability refusal; an earlier version of this sentence said otherwise and was measured false.

**A methodology rule this cost three rounds to learn.** A suite number measured inside the shared session scratchpad is untrustworthy unless the runner hashes the hooks before and after the run. Reviewers work concurrently and pick colliding directory names; one caught a peer mid-run with `ps` and matched the file it was seeing to the artifact of its own mutation. A timed-out sweep in the main session also left a mutation in the real tree, caught only by a hash check afterwards. Every figure in the table above comes from a run whose start and end state were hash-verified.

**A note on the board round itself.** One reviewer reported the suite as flaky on a shared machine — `118/3`, then `120/1` with a different probe red. Both numbers reproduce exactly as mutation signatures: the pre-fix revert, and the bare string-prefix mutation, each of which another reviewer reported running at the time. So they are mutation artifacts rather than fixture fragility, which two reviewers confirmed independently by reproducing them deterministically. The _attribution_ to a specific concurrent session is inference, not measurement — nothing in the tree records who ran what — and is stated that way here after a reviewer correctly objected that the earlier flat "not fixture fragility" claimed more than had been established.

## Board round 5: the first review of the parallel-authored batches, and one more upstream campaign

Convened over the entire uncommitted tree at once (batches A through F — `CA-1`/`CA-2`/`CA-3`/`CA-5`/`RE-1`, `A11Y-2`/`A11Y-3`, and the nine parallel-authored items `RE-2`–`RE-4`, `DV-1`–`DV-3`, `ME-1`, `I-1`, `TI-2`, `HS-1`/`HS-2`), rather than per-batch, per the consolidation lesson already recorded above. The full `test:e2e` suite (3 engines, 869 tests) passed clean on its first-ever execution before the board convened — 866 passed, 3 skipped (the documented WebKit Full-Keyboard-Access skips), 0 failed.

**Verdicts: two PASS, two FAIL, both FAILs resolved.**

- **harness-skeptic: PASS.** Independently reproduced the two highest-risk claims rather than reading them: removed `HS-1`'s abort-listener fix and watched the Node process actually crash against the real Anthropic SDK, then restored; neutered `I-1`'s focus-backstop and watched focus land on `<body>`, then restored. Confirmed the fixture stands in for the Anthropic API, not for `/api/chat`, so no application code is fixture-shaped. Also caught a concurrent reviewer's own break-test on `artifact-panel.svelte` mid-flight and correctly read it as the documented shared-tree collision pattern rather than tampering.
- **test-integrity-auditor: PASS.** Broke and hash-verified-restored 11 files across most batches; every sampled assertion proven load-bearing, no wait-threshold padding found. Flagged one thing worth checking rather than failing on it: whether `RE-2` actually drives `ReviewEditor`'s own imperative `exportUnifiedDiff`/`exportMarkdownSummary` methods or only the module-level stateless wrappers. Checked directly: `review-front-matter/+page.svelte` and `review-form-and-exports/+page.svelte` both call the bound instance methods via `bind:this` and assert they agree with the module functions — genuine coverage, not a gap. Surfaced a documented, tripwired, deliberate divergence between the two functions' normalization (`generateUnifiedDiff` normalizes, `generateMarkdownSummary` does not) that is directly relevant context for the still-open `X-2` item.
- **contract-auditor: FAIL, fixed.** Every finding was prose/doc drift, nothing in the code itself: `ROADMAP_PROGRESS.md`'s own status board said batches D/E/F were "not started" while the log text below it described them as authored; the upstream-issue table showed `#1291`/`#1292` as "awaiting publish" when they'd already published and synced (corrected against verified npm timestamps); `ROADMAP.md`'s coverage table and prose still said 16/22 `ReviewEditor` imperative methods driven; `A11Y-4` said six pinned-bug tests when `RE-4` had added two more (`scrollToThread`'s two defects), for eight, still unfiled; `TI-2`'s acceptance criteria posed a question its own test's comments show is unsatisfiable (every mutation method re-checks the id and no-ops before any callback — rewritten to record what was actually decided); three stale `0.9.2` version labels; and `check:upstream` only scanning tracked files, silently missing roughly a third of this diff's still-untracked new files (extended to `git grep --untracked`). All fixed and reverified clean.
- **a11y-ssr-auditor: FAIL, fixed via a full upstream loop.** Reproduced two live, real defects in `DiffToolbar`/`DiffViewer` with three instances on one page: `DiffToolbar` hardcoded `id="diff-view-mode"`, so every instance's `aria-labelledby` resolved to the first instance's label via `getElementById`; and `DiffViewer`'s `]`/`[`/`Ctrl+Shift+D` bindings fired on every instance regardless of focus, via a bare `<svelte:window onkeydown>`. Both are exactly what `DV-3`'s own acceptance criteria anticipated ("if they do fire globally, that is an upstream issue: file it"), and neither had been filed. Also flagged that `DV-2`'s judgement (reconcile vs. document the slot-semantics divergence) had never been recorded anywhere.
- **a11y-ssr-auditor, re-review: FAIL, fixed.** Convened again once the fix above shipped, scoped to just `DV-2`/`DV-3` rather than the whole diff. Independently reproduced both fixes live (unique per-instance ids with correct `aria-labelledby` resolution; keyboard scoping including the single-instance-on-a-page case) and re-verified both retargeted test files load-bearing by reverting and restoring the dist a second time, hash-checked. But caught a genuine gap this session's own claim had gotten wrong: "`DV-2`'s judgement is recorded in both packages' published READMEs" was false as stated — `editor`'s README had it, `chat`'s did not, because `chat` never got a changeset in PR #1311, so `@lostgradient/chat@0.9.3` on npm predated the merge by three hours and never picked it up. Traced to the exact missing changeset rather than just flagged as "docs are stale." Resolved by the small follow-up loop described just below.

### The DV-2/DV-3 upstream campaign

Driven end to end by the `upstream-fixer` agent, batched as one PR/release cycle per `CLAUDE.md`'s batching rule since both bugs live in the same component area:

- **[stevekinney/cinder#1309](https://github.com/stevekinney/cinder/issues/1309)** (id collision) and **[stevekinney/cinder#1310](https://github.com/stevekinney/cinder/issues/1310)** (global keybindings), both filed, both closed.
- **[stevekinney/cinder#1311](https://github.com/stevekinney/cinder/pull/1311)** — the fix PR, merged (`7dcc81c`). `DiffToolbar` now derives its `SegmentedControl` id from `$props.id()` with an optional `id` override; `DiffViewer` passes `id={`${instanceId}-view-mode`}` down explicitly. The keydown handler moved from `<svelte:window>` onto the component's own `<Surface>` root, relying on DOM event bubbling to scope it to whichever instance contains the focused element — a deliberate behavior change beyond the bug fix: focus outside every instance (including a single instance's own page) now fires nothing, where before it always fired globally.
- **[stevekinney/cinder#1312](https://github.com/stevekinney/cinder/pull/1312)** — version-packages release PR, merged (`9c4489b`), `action_required` workflows approved, release workflow succeeded.
- **Published, confirmed from npm rather than the merge alone**: `@lostgradient/editor@0.10.0`. `bun run sync:cinder` moved exactly that one package at the time; `chat`/`cinder`/`markdown`/`armorer` were already latest.
- **DV-2's judgement**, recorded rather than reconciled: `DiffViewer.toolbar`'s total replacement is intentional (a standalone diff view outside a chat context may want fully custom chrome), where Chat's `renderDefault` exists because message-part rendering carries built-in behavior most wrappers want to keep. Landed in both `packages/editor/README.md` and `packages/chat/README.md` in the same PR #1311 — but only `editor`'s half of that PR carried a changeset. **This was wrong when first written here** — a follow-up `a11y-ssr-auditor` re-review (below) caught that `chat`'s README half was merged but never released, which the campaign's own doctrine treats as not done. Now genuinely closed: a second small loop (changeset → PR #1314 → version-packages PR #1315 → release) shipped `@lostgradient/chat@0.9.4`, confirmed via `npm view` and a direct `npm pack` tarball inspection (not just the packument, which can cache stale) that the published README contains the section. Synced into chatroom; both packages' published READMEs now genuinely carry the judgement.

**Chatroom's pinned tests retargeted to the fixed contract**, in `diff-viewer.e2e.ts`. Five tests that pinned the two bugs as current behavior went red on the first post-sync run, exactly as predicted, plus one that the sync correctly left green for the wrong reason (a `#diff-view-mode` locator asserting "the override removed the toolbar" that would now pass even if the override broke, since that literal id no longer exists anywhere — rewritten to a role-based `getByRole('radiogroup')` query). All six rewritten, then proven load-bearing by reverting both fix mechanisms in the installed dist (not the unused `diff-toolbar.svelte` fallback — `diff-viewer.svelte` passes an explicit `id` that always wins over it) and confirming four of the five keyboard/id tests correctly went red; the fifth (decoy-input) correctly stayed green, since it tests the pre-existing input guard, which neither fix touched. One authoring mistake caught in the process: the first draft of the `]`-only test pressed both `]` and `[` in sequence, which nets back to the starting value whether or not either individual keystroke fired — round-trips can't prove a negative. Fixed to a single keystroke before it was trusted.

**A seventh pinned test, in a different file, was missed on the first pass.** The first post-sync full-suite run (as opposed to running `diff-viewer.e2e.ts` alone) turned up `review-views.e2e.ts`'s own copy of the same DV-3 pin — ReviewEditor embeds `DiffViewer` for its diff view, and that route had its own test asserting the global-firing bug as current behavior. Retargeted the same way: focus outside every `DiffViewer` instance (a page heading, landing on `<body>`) now fires nothing, proven with a causal barrier rather than a bare absence check; focus on a diff line — the one thing genuinely inside `DiffViewer`'s own subtree here, since this route passes an empty `toolbar` snippet and ReviewEditor's own mode-switcher radiogroup lives outside `DiffViewer` entirely — and the shortcuts work as before. Proven load-bearing the same way: reverted the keydown fix in the installed dist, watched exactly this test go red across all three engines, restored, md5-verified. Worth the lesson for its own sake: a single-spec test run after a sync is not sufficient evidence the sync is safe — the full suite is what caught this.

## The A11Y-4/X-2/X-3 campaign: twelve issues, four PRs, one release, six retargeting agents

Board round 5 left twelve open `@lostgradient/editor` issues on the table: the eight originally-pinned `A11Y-4` bugs (cinder#1301–#1306, plus `RE-4`'s two `scrollToThread` defects filed this round as #1316/#1317), and `X-2`/`X-3`'s three (cinder#1307 already open, plus #1318 found working `X-2` directly and #1319/#1320 found working `X-3`). Two more spun out of review along the way — #1324 and #1325, both pre-existing behavior unrelated to the bug the PR that surfaced them was fixing, filed separately rather than folded in.

Driven as four parallel worktree campaigns, batched into PRs #1321 (the #1307/#1318 normalizer fix), #1322 and #1323 (the `A11Y-4`/`X-3` batches), and #1327 (the remaining `A11Y-4` pins), each surviving real review rounds — including the same `required_review_thread_resolution` blocker documented earlier in this log for #1311, now a recognized pattern rather than a surprise. Merged, then one combined changesets release: version-packages PR #1326, `action_required` workflows approved, `main-green` validation gate waited out, `@lostgradient/editor@0.11.0` confirmed published to npm before syncing.

`bun run sync:cinder` came back clean (`lint`/`check`/`check:upstream`/`check:peers`). The expected wave of pinned-bug test failures followed — 17 tests across 6 files — decomposed into six parallel retargeting agents, each briefed with the exact upstream mechanics already known from the fixer agents' own reports rather than left to rediscover them:

- **`review-ssr-and-a11y.e2e.ts`**: 5 tests. One retarget needed a real course-correction mid-flight — the first draft of the Escape/Tab indent-outdent test raced an unsettled ~500ms debounce on `review-current` and was non-load-bearing as written; rewritten to wait out the debounce properly before asserting.
- **`review-modes.e2e.ts`**: 2 tests, including the readonly popover's `aria-modal` assertion, flipped after confirming via `git show` of the exact upstream diff that the new absence of `aria-modal` is the fix's correct behavior, not a regression.
- **`review-imperative.e2e.ts`**: 2 `scrollToThread` tests retargeted to the fixed contract (#1316/#1317). This agent also found the session's one genuine new regression — see below.
- **`review-comment-lifecycle.e2e.ts`**: 3 tests (#1319/#1320's stale-timer and re-selection fixes), plus a stale `TI-2` citation drift caught in passing.
- **`review-front-matter.e2e.ts`** / **`review-form-and-exports.e2e.ts`**: 2 tests, both normalizer-divergence pins flipped to agreement (#1307/#1318 fixed).
- **`review-views.e2e.ts`**: 1 test (aria-controls now only on the selected tab) plus one investigation that confirmed a second failing assertion was unrelated, correct behavior (undo history lost on remount, unchanged by this release) rather than a second regression.

All six groups landed fully green. Two of the six needed judgment calls beyond mechanical retargeting — the readonly-popover and undo-history cases above — and both were verified against the actual upstream diff or actual component behavior before being called "correct new behavior" rather than assumed.

### The one genuine new regression: cinder#1328

`MarkdownEditor.setMarkdown()` gained a `value = content;` statement in its `editorState` branch as part of the 0.11.0 bundle, added (per its own doc comment) for a `bind:value` consumer's benefit. `ReviewEditor` passes `value` down to `MarkdownEditor` one-way, not via `bind:value` — so once `setMarkdown()` has written to `MarkdownEditor`'s own bindable `value` locally, the one-way sync effect that would otherwise pick up a later parent-driven change stops firing, and `ReviewEditor.reset()`'s `value = original` never reaches the live document. A real user edit does not trigger this; only the imperative `setMarkdown` call leaves the sync disconnected.

Confirmed by reverting the single line in the installed dist and rebuilding: both previously-failing `RE-3` tests passed again. Restored and hash-verified. Filed as [stevekinney/cinder#1328](https://github.com/stevekinney/cinder/issues/1328); both tests converted to `(pinned known bug)` with the issue referenced directly in their docblocks. At the time of this entry: **not yet fixed, released, or synced** — per `CLAUDE.md`'s doctrine this is not deferrable, and is queued into the same upstream batch as #1324/#1325 (below) for one combined fix-and-release cycle rather than three separate ones.

**Update, 2026-08-15: fixed, released, and synced.** The write causing the disconnect (`MarkdownEditor.setMarkdown()`'s unconditional `value = content;`) was guarded with a read-compare; shipped in `@lostgradient/editor@0.12.0`, synced into chatroom via `bun run sync:cinder`. Both `RE-3` tests are retargeted off `(pinned known bug)` to confirm the fixed contract and pass across chromium/webkit/firefox; both proven load-bearing again by reverting the fix in the installed dist and watching them go red, then restoring and watching them go green, hash-verified.

### #1324 and #1325: fixed, released, and synced together with #1328

Both landed via [stevekinney/cinder#1330](https://github.com/stevekinney/cinder/pull/1330), merged in the same combined release as #1328's fix: `@lostgradient/editor@0.12.0` and `@lostgradient/markdown@0.3.0`. #1330 went through roughly a dozen rounds of automated review (`copilot-pull-request-reviewer`, `chatgpt-codex-connector`, Cursor Bugbot) before landing clean, including one architectural redirect mid-flight: repeated marker-canonicalization findings (unordered bullets, `1)` vs `1.`) were recognized as re-instances of the same defect class `#1285` had already fixed once, so the line-provenance approach was rebuilt on AST-native positions read from the parser rather than continuing to patch individual text-alignment edge cases.

Two release-blocking issues turned up outside the original scope and were fixed via dispatched follow-up PRs before the release could ship: a stale hardcoded peer-range literal in `package-boundary.test.ts` predating the fix (#1333), and a validator false-positive in `validate-consumer.ts` where a regex-based import scanner flagged prose fragments inside comments as import specifiers (`stevekinney/cinder#1334`, fixed by #1335 via `Bun.Transpiler.scanImports()`-based real lexing).

**#1325's fix carries a disclosed UX tradeoff, surfaced by the retargeting agent for `review-front-matter.e2e.ts` and confirmed against PR #1330's own description rather than treated as a new finding.** Before the fix, front matter that failed to parse as YAML was still recognized (`hasFrontMatter: true`, `data: null`), which is what powered `ReviewEditor`'s raw-YAML recovery editor. The fix folds that case together with "valid-but-non-object YAML" into `hasFrontMatter: false` — genuinely malformed front matter now renders as plain body text with no error and no recovery path. This is intentional and was disclosed in the PR body's "Also flagging, not silently shipping" paragraph, not discovered post-release: `combineFrontMatterAndBody` round-trips the content byte-for-byte (no data loss), and the raw editor still exists for the empty and comment-only-block cases. Four tests in `review-front-matter.e2e.ts` were retargeted accordingly. Whether the recovery affordance should exist for genuine syntax errors specifically is left as an open product question — see `X-2` in `ROADMAP.md` — not filed upstream, since #1325's own filed scope asked for exactly this behavior.

### Full-suite verification, and one flake

`bun run test:e2e` (3 engines, 879 total tests) came back **875 passed, 1 failed, 3 skipped**. The one failure — `interleaving.e2e.ts:162` on firefox, "the new turn streams cleanly and the stopped message stays frozen," `locator.click: Target page, context or browser has been closed` — is in Chat's stop-generation/retry surface, untouched by anything in this campaign. Re-run in isolation, `bunx playwright test interleaving --project=firefox --repeat-each=3`: **12 passed**, including 3 repetitions of the exact failing case. Read as an environment artifact of six simultaneous background agents running Playwright suites, vite builds, and shared-port webServers over the preceding two hours — not a regression — and not investigated further.

### Post-release retargeting and final verification, 2026-08-15

Syncing to `@lostgradient/editor@0.12.0`/`@lostgradient/markdown@0.3.0` (the #1328+#1324+#1325 combined release) flipped 10 more tests across 2 files, split into two parallel retargeting agents: `review-imperative.e2e.ts`'s two `RE-3` `setMarkdown`/`reset` tests (retargeted off `(pinned known bug)` to confirm the fixed contract — both proven load-bearing again by reverting the fix in the installed dist, watching them go red, then restoring and watching them go green, hash-verified), and `review-front-matter.e2e.ts`'s four tests (retargeted onto the #1325 fix's actual, broader-than-briefed scope — see the tradeoff paragraph above). Both diffs were read in full rather than taken on the agents' self-reports alone.

Re-running the full suite after both retargets landed hit the exit-code-masking pitfall documented elsewhere in this repo twice in a row before getting a clean signal: the first attempt's background task notification reported success while the log showed `exited with code 1` on a stale port-4599 listener (an orphan from an earlier improperly-backgrounded run of this same command, not a peer session — confirmed by matching process start time); the second attempt hit the same masking pattern on stale ports 4173 and 5175, orphaned from the same source. All three were killed (matching start timestamps confirmed they were this session's own leftovers, not another session's work) and the suite re-run a third time. That run produced a real, unmasked result: **874 passed, 1 failed, 3 skipped**, exit code 1 read directly from the log. The one failure — `review-imperative.e2e.ts:1158`, webkit only, a `.poll()` timing out waiting for an anchor's status to become `'orphaned'` — is in `RE-3`'s own re-anchoring test, not one either retargeting agent touched, and touches the same `setMarkdown` write path `#1328`'s fix changed, so it was not waved off as an obvious flake. Re-run in isolation, `bunx playwright test review-imperative --project=webkit -g "re-anchors the quote that survives" --repeat-each=5`: **5 passed**, each in 3.4–3.7s against a 5000ms timeout — comfortably clear, and consistent with this being contention from three stacked full-suite attempts rather than a logic regression. The project was singular `webkit` when that historical command ran; the current equivalent is `bunx playwright test review-imperative --project='webkit-*' -g "re-anchors the quote that survives" --repeat-each=5`. Read as an environment artifact, same as the interleaving flake above, and not investigated further.

### Board round: everything below is now `done`

**Committed history, for anyone reading `git log` alongside this section:** batches A–F (`RE-1`/`RE-2`, `DV-1`–`DV-3`, `ME-1`, `I-1`, `TI-2`, `HS-1`/`HS-2`, and the two upstream fixes those surfaced) were reviewed and committed earlier in this session, at `fac65de`. Everything this section and the ones above describe — the `TI-1`/`X-2`/`X-3` authoring, all 27 retargets across the two later release cycles, the `cinder#1336` cycle, and this board round — postdates that commit and is what this round covers.

The board (`test-integrity-auditor`, `harness-skeptic`, `contract-auditor`, `a11y-ssr-auditor`) convened over the full accumulated diff and returned four PASS, recorded in `.claude/.review-board-state/signoffs/`. Two rounds of real findings were worked, not waved through:

- **`test-integrity-auditor`: FAIL → fixed.** Found three `waitForTimeout` calls outside `TI-1`'s own documented four-file inventory (two in `review-ssr-and-a11y.e2e.ts`, one in `review-comment-lifecycle.e2e.ts`) — the two in `review-ssr-and-a11y.e2e.ts` were mechanically converted to auto-retrying `toHaveAttribute` matchers, removing the wait entirely. More seriously, it found the `cinder#1319` sidebar-timer test (`review-comment-lifecycle.e2e.ts`) was **not load-bearing**: reverting the fix left it 8/8 green at parallel load, because a second, independent "deep linking" `$effect` in `review-editor-impl.svelte` self-heals the corrupted popover state roughly one more `POSITION_DELAY_MS` window after the orphaned timer fires, and the test's single delayed snapshot landed past that self-heal every time. Fixed by rebuilding the test with a `MutationObserver`-based full-trace assertion (the wrong quote text must never appear across the whole at-risk window, not just be absent at one sampled instant) — break-and-restore re-proved 8/8 red-then-green at 5x parallel load, hash-verified. The sibling `cinder#1320` test's own `waitForTimeout` was converted to per-animation-frame in-page sampling, eliminating it too.
- **`harness-skeptic`: PASS**, first pass. Independently reproduced all three upstream fixes (`cinder#1336`, `#1328`, `#1325`) via break-and-restore directly against the installed `node_modules` dist, not by trusting any test's own account. Flagged (non-blocking) that `review-diff-performance.e2e.ts`'s 100ms regression tripwire wouldn't itself have caught the `#1336`-class regression (30.4ms passes comfortably under it) — a disclosed design tradeoff, recorded in `ROADMAP.md`'s `X-1` entry.
- **`a11y-ssr-auditor`: PASS**, first pass. Live-confirmed hydration, keyboard reachability, and focus behavior in real Chromium. Flagged (non-blocking) that the disclosed `cinder#1325` UX tradeoff is inconsistent with `ReviewEditor`'s own announcement discipline — the announcer infrastructure already exists on the affected instance but stays silent for this failure mode — attached to the existing open product question in `ROADMAP.md`'s `X-2` entry.
- **`contract-auditor`: FAIL → FAIL → PASS**, three rounds. Round 1 found and got fixed five real documentation/comment staleness issues (a pre-fix comment left describing a since-fixed bug as current, a stale `HYDRATING_ROUTES` count, a self-contradiction about the `A11Y-4` Tab-escape mechanism, two stale status-board rows). Round 2 confirmed all five held under independent re-verification against installed dist and `gh issue` state, but caught this file's own closing sentence claiming "nothing has been committed" when `fac65de` had already landed — fixed by scoping the claim correctly (see above). Round 3, narrowly scoped, confirmed that fix and a related `CLAUDE.md` staleness cleanup (stale exercise count and issue-open claims) both hold.

Full 3-engine `bun run test:e2e` after all fixes: **878 passed**, exit code 0 verified directly from the log (not the task-notification's reported status, per this repo's own documented exit-code-masking pitfall). `lint`/`check`/`check:upstream`/`check:peers` all clean.

### X-1: per-keystroke diff cost — measured, not acceptable, filed and fixed as cinder#1336

Unblocked once `#1318`/`#1324` (above) settled the diff-stats/export path this item measures. New exercise `/exercises/review-diff-performance` mounts the real `ReviewEditor` against a deterministic 304-line / 8,255-word / 50,891-char document and times the real recompute via `createReviewEditorState`'s exported `diffStats` getter — a public wrapper around the exact same `computeReviewEditorDiffStats` the shipped toolbar badge calls (`@lostgradient/editor/review-editor`), not a reimplementation. `performance.now()` runs in the page; keystrokes are sent one at a time via real `page.keyboard.press()`, each polled to confirm a real recompute landed before the next is sent, against the production `vite build && vite preview` server (not dev), in Chromium.

**The debounce finding, before the numbers.** `value` is not written on every keydown: `MarkdownEditor` only flushes its bindable `value` from a debounced `onchange` — 300ms `changeDebounceMs` stacked on `@milkdown/plugin-listener`'s own ~200ms internal debounce (`markdown-editor.svelte`'s placeholder-property comment). So during continuous typing the recompute fires roughly 2-3x/second, not once per physical keydown — the ROADMAP item's own "per keystroke" framing is not quite literal. The spec paces one keystroke at a time specifically so "one recompute per keystroke" is a proven fact for the numbers below (a coalesced recompute would leave the poll waiting past its timeout) rather than an assumption carried over from the item's own wording.

**Numbers** (ms, n=27 per run): four in-harness runs plus one bare `playwright` script with no tracing/video (to rule out recording overhead, per an `advisor` consultation before filing) all agree within noise. Baseline (the very first, zero-diff recompute) 34.3–37.2; min 29.1–29.6; median 30.3–30.8; p95 31.7–32.6; max 32.2–33.4. Against the frame budgets this item asks to compare against, median is ~1.8x over 16.67ms (60fps) and ~3.8x over a conservative 8ms. Not catastrophic given the debounce — an occasional ~30ms hitch every 300–500ms while typing, not every keystroke — but clearly over budget, and the baseline number is the sharpest single line: the full ~35ms price is paid to learn that nothing changed.

**Root cause, measured rather than inferred** — the `advisor` flagged this explicitly, citing cinder#1288's public mechanism-correction as the reason to verify rather than assert. A stage-level breakdown, using the same document and the same public exports (`normalizeDocument` from `@lostgradient/editor/export`, `computeLineDiff`/`getDiffStats` from `@lostgradient/markdown/diff/line-diff`), found `normalizeDocument(original)` (~14.3–15.4ms) and `normalizeDocument(current)` (~14.6–15.4ms) are essentially identical in cost and together account for >99% of the total; `computeLineDiff` (~0.1–0.2ms) and `getDiffStats` (~0ms) are noise. `original` never changes within a review session, yet it is fully re-normalized on every recompute alongside `current` — confirming the suspected mechanism and quantifying the win a fix would buy (roughly half the total cost, moving the median from ~2x over the 16.67ms budget to close to or under it).

Filed as [stevekinney/cinder#1336](https://github.com/stevekinney/cinder/issues/1336) with the full methodology, numbers, and stage breakdown attached; confirmed **OPEN** via `gh issue view --json state`. Per `CLAUDE.md`'s upstream doctrine this is not deferrable, but driving the fix/release/sync loop is a scope expansion beyond this item's own assignment — reported back rather than started unilaterally, per explicit instruction, then immediately greenlit once reported.

**Fixed, merged, released, synced.** [stevekinney/cinder#1337](https://github.com/stevekinney/cinder/pull/1337) (squash-merged as `6cf3948b`) memoizes the wasteful half: `computeReviewEditorDiffStats` now keeps a bounded (8-entry), value-keyed, LRU-evicted `Map` cache of `original -> normalizeDocument(original)` inside itself. Two deliberate departures from the simplest possible sketch: not a single slot (multiple `ReviewEditor` instances interleaving calls with different `original` values would give a single slot a 0% hit rate, making it correct but useless), and not scoped to the two call sites that reach it (`review-editor-impl.svelte`'s toolbar badge, `review-editor-state.svelte.ts`'s exported `diffStats`), which would have duplicated the cache logic for no benefit. `current` stays unmemoized, since it changes on nearly every call. Proof is a call-count spy on the real `normalizeDocument`: an unchanged `original` is now normalized exactly once across repeated calls rather than once per call, verified by break-and-restore twice (once before addressing a review round, once after) — reverting the fix reproduces the exact predicted call-count delta (`Expected: 1, Received: 2`), restoring returns it to green. Re-measured on a synthetic 428-line/13k-word document (larger than the issue's own repro; the relative comparison is the claim, not the absolute number): median dropped **56.53ms to 29.44ms, a ~48% reduction** — matching the stage-breakdown's own prediction of removing one of two near-identical normalization passes.

Copilot's automated PR review raised one real concern worth checking — whether the test's spy could be attached to a different module instance than the one production code imports, given a `.js`/`.ts` import-specifier mismatch — refuted empirically (a same-instance check plus the break-and-restore proof, which could only behave as observed if the spy saw the real calls) but the specifier was switched to match production's own `.js` import anyway to remove the doubt for future readers, alongside a genuine hygiene gap (spy teardown moved into `afterEach`). Changeset explains the frame-budget violation, the root cause, and the scoping decision, not just the diff.

Released as `@lostgradient/editor@0.12.1` (confirmed via `npm view` and `dist-tags.latest`), synced into chatroom (`bun run sync:cinder`; only `@lostgradient/editor` moved, the other four packages were already current). `lint`/`check`/`check:upstream`/`check:peers` all clean post-sync. Issue confirmed **CLOSED**. Chatroom's own full 3-engine suite was re-run after the sync: **877 passed, 1 failed, 3 skipped** — the one failure (`review-comment-creation.e2e.ts`, firefox only, a Tab-focus assertion in the selection popover) is unrelated to the diff-stats path this fix touches, and confirmed a flake by 5/5 clean on an isolated `--repeat-each=5` re-run. No pinned-bug test needed retargeting, which is exactly the expected result for a caching fix that changes timing but not output.

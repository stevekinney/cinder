# AGENTS.md

> [!WARNING] Merged into the cinder monorepo (2026-08-25)
> This lab now lives at `labs/chat-room` inside `stevekinney/cinder` and consumes the workspace
> packages via `workspace:*`, not the published npm tarballs. Prose below about published-package
> consumption, `sync:cinder`, or working "across `chatroom` and `../cinder`" predates the merge —
> see the warning at the top of [CLAUDE.md](./CLAUDE.md).

See [CLAUDE.md](./CLAUDE.md) for project guidance — purpose, how work moves between here and
`../cinder` (chatroom consumes the _published_ npm packages, deliberately, not a `bun link`), the
Chat component's style/adapter/conversation-model contracts, the ReviewEditor component's peer set
and anchor coordinate spaces, the Anthropic SDK server-side seam, known upstream issues (Cinder and
agent-bureau), and commands. It applies equally regardless of which agent CLI is driving.

The rule most likely to change what you do: **a bug in an upstream package we own is the next
task, not an obstacle to route around.** File it, then fix it — switch into that repo, drive it to
merge, cut a release, sync the dependency here, and only then resume. Issues against the same repo
can be batched into one release instead of one each, but the batch must close — fixed, released,
and synced back — before you move on. See
[Filing and resolving upstream issues](./CLAUDE.md#filing-and-resolving-upstream-issues) for the
full loop and for what to do when it cannot finish.

See also [ROADMAP.md](./ROADMAP.md) for what still needs coverage, with acceptance criteria per
item.

## If you are not Claude Code

The [adversarial review board](./CLAUDE.md#the-adversarial-review-board) is a **requirement**,
and as of 2026-08-14 it is not machine-enforced for anyone — there is no hook, for Claude Code or
any other CLI, so the bar is identical regardless of which agent is driving. The four reviewers
live in `.claude/agents/` and the `review-board` skill that convenes them lives in
`.claude/skills/`; if your CLI cannot spawn subagents or load Claude Code skills, you still owe
every check they perform, and you owe it explicitly rather than by assertion: prove each new test
fails when the behavior it pins is broken, confirm any finding outside the harness that produced
it before filing upstream, verify docs and types still match the code, and check keyboard
reachability and hydration for anything you touched. Read the four agent files as checklists —
they are written to be useful as prose, not just as prompts.

State plainly in your summary which checks you performed and which you could not, so a review
that did not happen is visible as such rather than implied.

Two passages are Claude Code implementation detail and do not apply to you: CLAUDE.md's
["file was modified" notice](./CLAUDE.md#the-file-was-modified-notice-is-claude-code-not-an-attack)
section, and the paragraph in `.claude/agents/test-integrity-auditor.md` that describes it. They
document one harness's notification, not a property of this repo. The rules around them do carry
over — back up before you break something, restore it, and verify the restore by hash rather than
by `git status`, which cannot see `node_modules`.

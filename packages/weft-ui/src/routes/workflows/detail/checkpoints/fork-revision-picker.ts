/**
 * Fork revision selection (WFT-117), colocated with `divergence.ts` (same
 * "pure logic module, tested via `checkpoints-tab.test.ts`'s harness, no
 * dedicated per-component test file" precedent doesn't apply here — this
 * one DOES get its own `fork-dialog.test.ts`, since `fork-dialog.svelte`
 * owns real submission/conflict-handling behavior beyond markup, unlike
 * `divergence-view.svelte`'s pure rendering).
 *
 * `ForkOptions.revision` (`@lostgradient/weft`) is an explicit, validated
 * opt-in: omitted (the default), a fork resolves and persists the SOURCE
 * run's own `WorkflowState.revision`; passed, the fork targets that exact
 * revision instead (diagnostic use — "does this input fail on v1 or only on
 * v2?"). `ForkRevisionSelection` models the dialog's own binary choice
 * ("keep the source's revision" vs. "pick a different one") rather than an
 * `ForkOptions['revision'] | undefined` union directly, so the dialog's
 * radio/disclosure UI has a real discriminant to switch on instead of
 * treating `undefined` as ambiguous between "not yet decided" and "chose
 * the default."
 */
import type { ForkOptions } from '@lostgradient/weft';
import { isWeftFault } from '@lostgradient/weft';

export type ForkRevisionSelection =
  { readonly mode: 'source' } | { readonly mode: 'explicit'; readonly revision: string };

/** Builds the `ForkOptions` this selection implies, layered onto `fromStep`. `mode: 'source'` omits `revision` entirely — see module doc. */
export function resolveForkOptions(
  selection: ForkRevisionSelection,
  fromStep: number,
): ForkOptions {
  return selection.mode === 'explicit' ? { fromStep, revision: selection.revision } : { fromStep };
}

/**
 * `true` only for a `WorkflowRevisionUnavailableError`-coded rejection (an
 * explicit `revision` that this process cannot resolve — not registered,
 * not installed, or legacy-ambiguous; see that error's own doc,
 * `@lostgradient/weft`). Any other error (network, a semver-incompatible
 * `VersionMismatchError`, a generic 409) is NOT this — the fork dialog keeps
 * its existing generic-error paragraph for those, and reserves the
 * "pick a different revision" framing for the one error this specific
 * opt-in can actually cause.
 */
export function isForkRevisionConflict(error: unknown): boolean {
  return isWeftFault(error, 'WorkflowRevisionUnavailableError');
}

/**
 * The recovery sentence shown alongside a `WorkflowRevisionUnavailableError`
 * rejection, branched on which selection actually caused it (Codex review,
 * PR #978). `mode: 'explicit'` failed because the OPERATOR-picked revision
 * isn't resolvable — "use the source revision instead" is real, available
 * advice there. `mode: 'source'` failed because the SOURCE RUN'S OWN
 * revision isn't resolvable (purged, never installed, or legacy-ambiguous) —
 * telling the operator to "use the source revision" in that case would be
 * telling them to retry the exact thing that just failed, and an ambiguous
 * unpinned source has no single revision to fall back to at all. Route that
 * case toward the explicit picker instead.
 */
export function forkConflictGuidance(selection: ForkRevisionSelection): string {
  return selection.mode === 'explicit'
    ? 'Pick a different revision, or use the source revision instead.'
    : 'This run’s own revision could not be resolved on this process. Use “Fork a different revision” and pick one that is currently installed.';
}

/** One installed revision, as the fork dialog's revision picker needs it — a narrow projection of `WorkflowRevisionRecord` (`@lostgradient/weft`). */
export interface InstalledRevisionOption {
  readonly revision: string;
  readonly installedAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function manifestRevision(entry: Record<string, unknown>): string | undefined {
  const manifest = entry['manifest'];
  if (!isRecord(manifest)) return undefined;
  const revision = manifest['revision'];
  return typeof revision === 'string' ? revision : undefined;
}

function toInstalledRevisionOption(value: unknown): InstalledRevisionOption | undefined {
  if (!isRecord(value)) return undefined;
  const revision = manifestRevision(value);
  const installedAt = value['installedAt'];
  if (revision === undefined || typeof installedAt !== 'number') return undefined;
  return { revision, installedAt };
}

/**
 * Structurally validates `weft.workflows.revisions.list`'s wire response
 * (`unknown` — see `checkpoints-data.ts`'s identical outputSchema-is-`z.
 * unknown()` note) into a sorted (newest-installed-first) list of picker
 * options, or `undefined` for a malformed (non-array, or any
 * non-conforming entry) response — the picker degrades to its free-text
 * fallback rather than rendering a partial, silently-filtered list, mirror
 * ing `workflowRevisionRows`'s (`routes/system/workflow-revisions-view.ts`)
 * identical "reject, don't guess" contract for the same operation's output.
 */
export function parseInstalledRevisions(value: unknown): InstalledRevisionOption[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const options: InstalledRevisionOption[] = [];
  for (const entry of value) {
    const option = toInstalledRevisionOption(entry);
    if (option === undefined) return undefined;
    options.push(option);
  }
  return options.toSorted((a, b) => b.installedAt - a.installedAt);
}

/** Narrow surface the fork dialog's revision picker needs off `client.operations` — mirrors `CheckpointsOperationsClient`'s (`checkpoints-data.ts`) precedent. */
export interface WorkflowRevisionListClient {
  readonly operations: {
    readonly 'weft.workflows.revisions.list': (input: { name: string }) => Promise<unknown>;
  };
}

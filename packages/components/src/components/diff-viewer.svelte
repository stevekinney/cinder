<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';
  import type { DiffHunk, LineDiffStats } from '@cinder/markdown/diff/line-diff';

  export type ViewMode = 'unified' | 'final' | 'original';

  /** Context passed to toolbar snippets for custom rendering */
  export interface DiffToolbarContext {
    hunks: DiffHunk[];
    stats: LineDiffStats;
    hasChanges: boolean;
    viewMode: ViewMode;
  }

  export type DiffViewerProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
    /** The original/baseline text */
    original: string;
    /** The current/modified text */
    current: string;
    /**
     * Whether to normalize markdown inputs before comparison.
     * When true (default), both original and current are normalized
     * to canonical form before diffing, preventing false positives
     * from formatting differences.
     */
    normalizeInputs?: boolean;
    /** Called when user wants to revert all changes */
    onrevertall?: () => void;
    /** Called when user wants to revert a specific hunk */
    onreverthunk?: (hunkIndex: number, hunk: DiffHunk) => void;
    /** Whether the viewer is read-only (hides revert buttons) */
    readonly?: boolean;
    /**
     * Bindable: reactive access to computed hunks.
     * Parent components can bind to this to reactively access hunk data.
     */
    hunks?: DiffHunk[];
    /**
     * Bindable: reactive access to current view mode.
     * Parent components can bind to control or observe the view mode.
     */
    viewMode?: ViewMode;
    /**
     * Additional toolbar actions rendered in the toolbar-right section.
     * Use this to inject custom buttons (e.g., export actions) without
     * replacing the entire toolbar.
     */
    toolbarActions?: Snippet<[DiffToolbarContext]>;
    /**
     * Override the entire toolbar for advanced customization.
     * When provided, replaces the default toolbar completely.
     */
    toolbar?: Snippet<[DiffToolbarContext]>;
    /** Additional CSS classes */
    class?: string;
  };
</script>

<script lang="ts">
  /**
   * Diff viewer component for comparing two Markdown documents.
   *
   * Uses line-based diffing for reliable rendering:
   * - Lines are natural structural boundaries in Markdown
   * - Each line is rendered independently (no cross-line position tracking)
   * - Modified lines show word-level inline changes
   *
   * Size-based gating (DEP-47):
   * - <20KB: Real-time diff computation
   * - 20-100KB: Debounced (500ms) with warning badge
   * - >100KB: Manual trigger only, shows stale diff with "Outdated" badge
   */

  import { classNames } from '../utilities/class-names.ts';
  import Button from './button/button.svelte';
  import Surface from './surface.svelte';
  import { RotateCcw } from './icons/index.ts';
  import { computeLineDiff, getDiffStats, groupIntoHunks } from '@cinder/markdown/diff/line-diff';
  import { createDiffController } from './diff-viewer/diff-controller.svelte';
  import DiffLine from './diff-viewer/diff-line.svelte';
  import DiffFrontMatter from './diff-viewer/diff-front-matter.svelte';
  import DiffToolbar from './diff-viewer/diff-toolbar.svelte';

  type LocalFrontMatterBlock = {
    hasFrontMatter: boolean;
    raw: string | null;
    body: string;
    text: string;
  };

  function normalizeForDiff(markdown: string): string {
    if (!markdown.trim()) return '\n';

    return markdown
      .replace(/\r\n?/g, '\n')
      .replace(/^(\s*)[*+] /gm, '$1- ')
      .replace(/^([-*+] .*)$\n\n(?=[-*+] )/gm, '$1\n')
      .replace(/^(\d+\. .*)$\n\n(?=\d+\. )/gm, '$1\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\n+/, '')
      .replace(/\n+$/, '\n');
  }

  function getFrontMatterBlock(markdown: string): LocalFrontMatterBlock {
    const normalized = markdown.replace(/\r\n?/g, '\n');
    const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(normalized);

    if (!match) {
      return {
        hasFrontMatter: false,
        raw: null,
        body: markdown,
        text: '',
      };
    }

    return {
      hasFrontMatter: true,
      raw: match[1] ?? '',
      body: normalized.slice(match[0].length),
      text: `---\n${match[1] ?? ''}\n---`,
    };
  }

  let {
    original,
    current,
    normalizeInputs = true,
    onrevertall,
    onreverthunk,
    readonly = false,
    hunks: bindableHunks = $bindable<DiffHunk[]>([]),
    viewMode = $bindable<ViewMode>('unified'),
    toolbarActions,
    toolbar,
    class: className,
  }: DiffViewerProps = $props();

  // ─────────────────────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────────────────────

  // viewMode is now a $bindable prop (see props destructuring above)
  // User's explicit selection (null means "use default")
  let userSelectedIndex = $state<number | null>(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // Front Matter State (DEP-61)
  // ─────────────────────────────────────────────────────────────────────────────

  let frontMatterExpanded = $state(true);

  // ─────────────────────────────────────────────────────────────────────────────
  // Derived values
  // ─────────────────────────────────────────────────────────────────────────────

  // Parse front matter from both documents
  const originalParsed = $derived(getFrontMatterBlock(original));
  const currentParsed = $derived(getFrontMatterBlock(current));

  // Check if either document has front matter
  const hasFrontMatter = $derived(originalParsed.hasFrontMatter || currentParsed.hasFrontMatter);

  // Get front matter text for diffing (with delimiters for context)
  const originalFrontMatterText = $derived(originalParsed.text);
  const currentFrontMatterText = $derived(currentParsed.text);

  // Normalize body content only
  const normalizedOriginalBody = $derived(
    normalizeInputs ? normalizeForDiff(originalParsed.body) : originalParsed.body,
  );
  const normalizedCurrentBody = $derived(
    normalizeInputs ? normalizeForDiff(currentParsed.body) : currentParsed.body,
  );

  // Compute front matter diffs (always real-time since front matter is small)
  const frontMatterDiffs = $derived(
    hasFrontMatter ? computeLineDiff(originalFrontMatterText, currentFrontMatterText) : [],
  );
  const hasFrontMatterChanges = $derived(frontMatterDiffs.some((d) => d.type !== 'same'));

  // ─────────────────────────────────────────────────────────────────────────────
  // Diff Controller with size-based gating (DEP-47)
  // ─────────────────────────────────────────────────────────────────────────────

  const diffController = createDiffController();

  // Feed normalized content to the controller.
  // Combined into single effect to ensure both values are set atomically
  // before the controller's internal effect processes them.
  $effect(() => {
    diffController.setOriginal(normalizedOriginalBody);
    diffController.setCurrent(normalizedCurrentBody);
  });

  // Expose controller state
  const diffState = $derived(diffController.state);
  const lineDiffs = $derived(diffState.diffs);

  // Filter to only navigable lines based on view mode (single-pass for performance)
  // In 'final' mode, removed lines are hidden; in 'original' mode, added lines are hidden
  const changedLineIndices = $derived.by(() => {
    const result: number[] = [];
    for (let i = 0; i < lineDiffs.length; i++) {
      const diff = lineDiffs[i];
      if (!diff) continue;
      if (diff.type === 'same') continue;
      if (viewMode === 'final' && diff.type === 'removed') continue;
      if (viewMode === 'original' && diff.type === 'added') continue;
      result.push(i);
    }
    return result;
  });

  // Declarative selection: use user's choice, or default to first change
  const selectedLineIndex = $derived(
    userSelectedIndex !== null && changedLineIndices.includes(userSelectedIndex)
      ? userSelectedIndex
      : changedLineIndices.length > 0
        ? (changedLineIndices[0] ?? null)
        : null,
  );

  const changeCount = $derived(changedLineIndices.length);
  const currentChangeIndex = $derived(
    selectedLineIndex !== null ? changedLineIndices.indexOf(selectedLineIndex) : -1,
  );

  // Combine stats from front matter and body diffs
  const bodyStats = $derived(getDiffStats(lineDiffs));
  const frontMatterStats = $derived(getDiffStats(frontMatterDiffs));
  const diffStats = $derived({
    added: bodyStats.added + frontMatterStats.added,
    removed: bodyStats.removed + frontMatterStats.removed,
    modified: bodyStats.modified + frontMatterStats.modified,
  });

  // Whether there are any changes at all (body or front matter)
  const hasAnyChanges = $derived(changeCount > 0 || hasFrontMatterChanges);

  // ─────────────────────────────────────────────────────────────────────────────
  // Hunks for revert functionality
  // ─────────────────────────────────────────────────────────────────────────────

  const computedHunks = $derived(groupIntoHunks(lineDiffs));

  // Sync computed hunks to bindable prop for reactive parent access
  $effect(() => {
    bindableHunks = computedHunks;
  });

  /**
   * Map of line index → hunk that contains changes starting at that line.
   * We show hunk header at the first changed line (not context lines).
   * Using regular Map since it's created fresh in $derived.by and never mutated.
   */
  const hunkStartMap = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- Map is created fresh, never mutated
    const map = new Map<number, DiffHunk>();

    // Find all changed line indices
    const changedIndices: number[] = [];
    for (let i = 0; i < lineDiffs.length; i++) {
      if (lineDiffs[i]?.type !== 'same') {
        changedIndices.push(i);
      }
    }

    // For each hunk, find its first change
    let changeIndex = 0;
    for (const hunk of computedHunks) {
      // Count changes in this hunk
      const hunkChangeCount = hunk.lines.filter((l) => l.type !== 'same').length;

      if (hunkChangeCount > 0 && changeIndex < changedIndices.length) {
        // The first change of this hunk
        const changedIndex = changedIndices[changeIndex];
        if (changedIndex !== undefined) {
          map.set(changedIndex, hunk);
        }
        changeIndex += hunkChangeCount;
      }
    }

    return map;
  });

  /**
   * Public method to get hunks for programmatic access.
   * Useful for imperative access patterns.
   * For reactive access, use `bind:hunks` instead.
   */
  export function getHunks() {
    return bindableHunks;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Toolbar context for snippets
  // ─────────────────────────────────────────────────────────────────────────────

  const toolbarContext: DiffToolbarContext = $derived({
    hunks: computedHunks,
    stats: diffStats,
    hasChanges: hasAnyChanges,
    viewMode,
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Navigation
  // ─────────────────────────────────────────────────────────────────────────────

  function jumpToNext() {
    if (changedLineIndices.length === 0) return;
    const currentIdx = currentChangeIndex;
    const nextIdx = currentIdx < changedLineIndices.length - 1 ? currentIdx + 1 : 0;
    userSelectedIndex = changedLineIndices[nextIdx] ?? null;
  }

  function jumpToPrevious() {
    if (changedLineIndices.length === 0) return;
    const currentIdx = currentChangeIndex;
    const prevIdx = currentIdx > 0 ? currentIdx - 1 : changedLineIndices.length - 1;
    userSelectedIndex = changedLineIndices[prevIdx] ?? null;
  }

  function selectLine(index: number) {
    userSelectedIndex = index;
  }

  function handleRevertHunk(hunk: DiffHunk) {
    onreverthunk?.(hunk.index, hunk);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Keyboard shortcuts
  // ─────────────────────────────────────────────────────────────────────────────

  const VIEW_MODES: ViewMode[] = ['unified', 'final', 'original'];

  function handleKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (target.matches('input, textarea, [contenteditable]')) return;

    if (event.key === ']') {
      event.preventDefault();
      jumpToNext();
    } else if (event.key === '[') {
      event.preventDefault();
      jumpToPrevious();
    } else if (event.ctrlKey && event.shiftKey && event.key === 'D') {
      event.preventDefault();
      const currentIndex = VIEW_MODES.indexOf(viewMode);
      viewMode = VIEW_MODES[(currentIndex + 1) % VIEW_MODES.length] ?? 'unified';
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Expose data-ready for E2E test synchronization (DEP-138) -->
<Surface
  class={classNames('diff-viewer', className)}
  data-ready={!diffState.isComputing && !diffState.isStale ? true : undefined}
>
  <!-- Toolbar: Full override or default -->
  {#if toolbar}
    {@render toolbar(toolbarContext)}
  {:else}
    <DiffToolbar
      bind:viewMode
      stats={diffStats}
      {changeCount}
      {currentChangeIndex}
      hasChanges={hasAnyChanges}
      {readonly}
      {diffState}
      onjumpnext={jumpToNext}
      onjumpprevious={jumpToPrevious}
      {onrevertall}
      ontriggercompute={() => diffController.triggerCompute()}
    >
      {#snippet actions()}
        {#if toolbarActions}
          {@render toolbarActions(toolbarContext)}
        {/if}
      {/snippet}
    </DiffToolbar>
  {/if}

  <!-- Size warning banner (DEP-47) -->
  {#if diffState.warning}
    <div class="diff-warning" role="status">
      {diffState.warning}
      {#if diffState.lastComputeTime !== null}
        <span class="compute-time">(Last: {diffState.lastComputeTime.toFixed(0)}ms)</span>
      {/if}
    </div>
  {/if}

  <!-- Content -->
  <div class="diff-content">
    <!-- Front Matter Section (DEP-61) -->
    {#if hasFrontMatter}
      <DiffFrontMatter
        id="front-matter"
        diffs={frontMatterDiffs}
        {viewMode}
        bind:expanded={frontMatterExpanded}
        badgeLabel={hasFrontMatterChanges ? 'Changed' : null}
        badgeVariant="warning"
      />
    {/if}

    <!-- Body Content Section -->
    {#each lineDiffs as lineDiff, idx (idx)}
      {@const isSelected = selectedLineIndex === idx}
      {@const hunkAtLine = hunkStartMap.get(idx)}

      <!-- Hunk header with revert button (shown at first change of each hunk) -->
      {#if hunkAtLine && !readonly && onreverthunk}
        <div class="hunk-header">
          <span class="hunk-range">
            @@ -{hunkAtLine.originalStart},{hunkAtLine.originalCount} +{hunkAtLine.currentStart},{hunkAtLine.currentCount}
            @@
          </span>
          <Button
            variant="ghost"
            size="xs"
            class="hunk-revert-button"
            onclick={() => handleRevertHunk(hunkAtLine)}
            aria-label="Revert this change"
          >
            <RotateCcw class="icon-xs" />
            Revert
          </Button>
        </div>
      {/if}

      <DiffLine diff={lineDiff} {viewMode} selected={isSelected} onselect={() => selectLine(idx)} />
    {/each}
  </div>
</Surface>

<style>
  :global(.diff-viewer) {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .diff-content {
    flex: 1;
    overflow: auto;
    padding: 0;
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-sm);
    line-height: 1.5;
  }

  /* ─────────────────────────────────────────────────────────────────────────────
   * Size Warning Banner (DEP-47)
   * ───────────────────────────────────────────────────────────────────────────── */

  .diff-warning {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-2);
    padding: var(--cinder-space-2) var(--cinder-space-3);
    font-size: var(--cinder-text-xs);
    color: var(--cinder-warning);
    background: color-mix(in oklch, var(--cinder-warning), transparent 90%);
    border-bottom: 1px solid color-mix(in oklch, var(--cinder-warning), transparent 70%);
  }

  .compute-time {
    color: var(--cinder-text-muted);
    font-family: var(--cinder-font-mono);
  }

  /* ─────────────────────────────────────────────────────────────────────────────
   * Hunk Headers with Revert Buttons
   * ───────────────────────────────────────────────────────────────────────────── */

  .hunk-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--cinder-space-2);
    padding: var(--cinder-space-1) var(--cinder-space-3);
    background: var(--cinder-surface-inset);
    border-bottom: 1px solid var(--cinder-border);
    margin-top: var(--cinder-space-2);
  }

  .hunk-range {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-muted);
  }

  :global(.hunk-revert-button) {
    opacity: 0;
    transition: opacity var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  .hunk-header:hover :global(.hunk-revert-button),
  .hunk-header:focus-within :global(.hunk-revert-button) {
    opacity: 1;
  }

  /* Always show on touch devices (no hover capability) */
  @media (hover: none) {
    :global(.hunk-revert-button) {
      opacity: 1;
    }
  }
</style>

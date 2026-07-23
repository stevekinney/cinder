# SourceDiffViewer · accessibility

## Pattern

SourceDiffViewer presents structured source diff output. Preserve file headers, hunk headers, line-state labels, and source order so assistive technology receives the same relationships that are visible on screen.

Purpose: Lightweight unified-patch viewer for source-code and operational diffs with file headers, hunk headers, line state styling, and bounded rendering.

## Use when

- Rendering source-code unified patches from agent output, Git operations, workspace changes, or review systems.
- Showing operational patch output where file and hunk structure matters more than Markdown front matter or word-level prose review.

## Avoid when

- Comparing two Markdown documents with normalization, front-matter, and revert affordances — use `DiffViewer` from `@lostgradient/editor`.
- Showing syntax-highlighted code samples rather than patch output — use code-block instead.

## Keyboard and focus

The component is read-only. Keyboard behavior follows the rendered native elements. The diff region has an accessible label through `ariaLabel`; provide a specific label when multiple diff viewers appear on the same page.

## Names, roles, and state

Addition and removal rows include visually hidden labels such as "Added line 4" and "Removed line 2" so color is not the only state cue. Line-number gutters are decorative and hidden from assistive technology.

When rendering bounded output, the truncation notice uses `role="status"` and includes both the rendered and total diff-line counts.

## Verification

- Render SourceDiffViewer in the playground or a focused test fixture.
- Inspect the region label, file labels, hunk labels, and row text in browser accessibility tools.
- Confirm additions and removals remain identifiable without relying on color.
- Check forced-colors mode because additions and removals use status-colored surfaces.

Related components: `diff-statistics`, `code-block`.

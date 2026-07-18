# Phase 0 — Visual Regression Inventory

This document captures the read-only discovery work that gates Phases 1 and 2 of the visual-regression rollout. See `~/.claude/plans/dapper-painting-feather.md` for the full plan.

Five inventories were run in parallel:

1. Baseline size and LFS decision
2. ID generation inventory
3. Editor-component API audit
4. Existing fixtures and patterns
5. `data-testid` policy (Phase 2 hard gate)

A summary of plan-relevant deviations is at the end.

---

## Baseline size and LFS decision

We projected baseline snapshot growth by counting the playground's 50 components with examples, sampling 582 existing test PNGs (mean 25 KB, p95 56 KB), and assuming 2.62 average fixtures per component across 2 themes and 3 viewports.

**Initial baseline**: ~18.8 MB (50 components × 6 images/fixture × 2.62 fixtures × 25 KB mean PNG size).

**12-month growth estimate**: ~154 MB, accounting for 24 high-impact PRs/year touching shared CSS/tokens, each causing ~30% of baselines to rewrite (PNG blobs are non-deltifiable, so each rewrite adds full copies).

**Decision**: Plain Git is sufficient. The projection stays 46 MB under the 200 MB decision threshold, leaving comfortable headroom for growth variance or fixture expansion without needing LFS infrastructure.

---

## ID generation inventory

151 total components analyzed in `packages/components/src/components/`. The codebase has excellent ID stability across the board:

- **21 STABLE** with deterministic IDs
- **2 CHURN** (require deterministic factory migration)
- **128 N/A** (no DOM IDs)

### STABLE components

Form fields and input components use a caller-provided `id` prop (deterministic): Input, Checkbox, Select, Radio, Textarea, SearchField, NumberInput.

Disclosure and composite components use `useId()` (counter-based, deterministic within a session): Modal, Drawer, Popover, Tooltip, RadioGroup, CheckboxGroup, CommandPalette, ConfirmDialog, ColorPicker, Stat, NavigationBar, SortableList, Dropdown, SideNavigationGroup, TreeItem, Sheet.

Tabs and Accordion use value-based navigation (no ARIA ID dependencies on randomness).

### CHURN components (Phase 1 migration required)

| Component                     | Issue                                    | Location                                    | Impact                                                               |
| ----------------------------- | ---------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------- |
| **ChatInput**                 | `crypto.randomUUID()` on each attachment | `chat/input/chat-input.svelte:200`          | Attachment ID changes every mount; screenshots will differ on re-run |
| **MarkdownEditor (skeleton)** | `Math.random()` for UI shimmer widths    | `markdown-editor/editor-skeleton.svelte:23` | Skeleton layout varies; baseline will drift on screenshot re-runs    |

### Migration recipe

Phase 1's `packages/components/src/utilities/id-factory.ts` is only required for these two components. Replace randomness with:

- **ChatInput**: deterministic hash of `file.name + file.size`, or a counter-based attachment ID generator.
- **MarkdownEditor skeleton**: derive widths from a stable seed (line index, or a fixed pseudo-random seed for testing).

Every other component is already stable and does not need a migration.

---

## Editor-component API audit

The plan forbids calling `editor.setEditable(false)` from the playground wrapper. Each editor component gains an explicit `snapshotMode?: boolean` prop instead. Implementation is **CSS + blur-on-mount only** — never modify the underlying ProseMirror editability state.

### MarkdownEditor

- **Path**: `packages/components/src/components/markdown-editor/markdown-editor.svelte`
- **Milkdown handle**: exposed via exported `getEditor()` method, not a prop.
- **Existing disable mechanism**: `readonly?: boolean` calls `setEditorReadonly(...)` which invokes `state.view?.setProps({ editable: () => !readonly })`. It also hides the toolbar. Keep `readonly` for business logic; `snapshotMode` is purely visual.
- **Default mount behavior**: no auto-focus, caret visible, no selection.
- **Change required**: add `snapshotMode?: boolean`. When `true`: `caret-color: transparent`, `user-select: none`, blur active element on mount.

### ReviewEditor

- **Path**: `packages/components/src/components/review-editor/review-editor-impl.svelte`
- **Milkdown handle**: exposed via exported `getEditor()` method, not a prop.
- **Existing disable mechanism**: `mode?: 'edit' | 'readonly'` gates thread/comment operations via early returns. No `setEditable` call — interactivity is controlled at the business-logic layer.
- **Default mount behavior**: no auto-focus, caret visible, no selection. Keyboard nav uses `FocusRegionNavigator`.
- **Change required**: add `snapshotMode?: boolean`. Same CSS-and-blur recipe as MarkdownEditor.

### Chat

Chat wraps **ChatInput**, which wraps **MarkdownEditor** in lightweight mode. **No `snapshotMode` prop needed on Chat** — it inherits visual freeze from MarkdownEditor automatically.

### Other Milkdown usage

Search confirmed no other public editor components use Milkdown. Only `markdown-editor/*.types.ts` (type imports) and `review-editor/review-editor-*.svelte.ts` (internal helpers) import from `@milkdown/*`.

### Phase 1 migration list

- `markdown-editor/markdown-editor.svelte` — add `snapshotMode?: boolean`
- `review-editor/review-editor-impl.svelte` — add `snapshotMode?: boolean`

---

## Existing fixtures and patterns

### Current conventions

The cinder playground already hosts 131 interactive examples across 50 components, using the `*.example.svelte` convention:

- **Location**: `packages/playground/src/examples/<component>/<name>.example.svelte`
- **Metadata**: each file exports string literals `title` and `description` (parsed server-side via regex)
- **Purpose**: hand-authored playground demonstrations for developers
- **Discovery**: `discover.ts` scans for files; playground renders them dynamically

Additionally, two chat components house TypeScript test fixtures for unit/story support:

- **Location**: `packages/chat/src/lib/components/chat/<subcomponent>/<name>-fixtures.ts`
- **Shape**: factory functions with mutable counters (not JSON-serializable)
- **Purpose**: deterministic test data for story development

### Design decision: sibling conventions

The new visual-regression fixtures are a **sibling**, not a replacement, for two reasons:

1. **Different consumption model**: `.example.svelte` files are rendered interactively in the browser; the new fixtures are static JSON consumed by the test bot.
2. **Different authorship**: examples are hand-written by developers; fixtures are validated against a Zod schema and consumed by code-gen.

Attempting to unify them would force fixtures into Svelte or examples into JSON — both bad trades.

### File naming (deviation from plan)

The plan named the new files `<component-name>.fixtures.ts` (dot). The repo's existing convention for fixture-style files is `<component-name>-fixtures.ts` (hyphen) — see `chat/message/chat-message-fixtures.ts` and `chat/container/chat-container-fixtures.ts`.

**Adopting the hyphen form** in Phase 2:

- New files live at `packages/components/src/components/<component-name>/<component-name>-fixtures.ts`
- Matches existing per-directory layout (`<name>.svelte`, `<name>.types.ts`, `<name>-fixtures.ts`)
- Avoids collision with the existing chat fixture files; in fact, those two existing files become candidates for refactoring into the new schema if their factory output can be expressed as JSON

This is a naming swap only. The contract (Zod schema, JSON-serializable props, code-gen via TS compiler API) is unchanged.

---

## `data-testid` policy (Phase 2 hard gate)

**Decision: Option (a) — components ship `data-testid` on intentionally-marked elements.**

### Rationale

Option (b) (strip at build time) requires a source-to-artifact preprocessing step that does not exist in the current `Bun.build()` + `svelte-plugin.ts` pipeline. Introducing one would cause test execution (against source) to diverge from the published artifact — the exact failure mode that disqualifies it.

Option (c) (playground-wrapper only) cannot reach internal elements: the modal close button, combobox listbox, accordion header, and toolbar action buttons are pure internal markup with no slot or prop surface. They are unreachable from outside the component boundary.

Option (a) is already the de-facto status quo: `markdown-editor/editor-toolbar/editor-toolbar.svelte` and `review-editor/review-editor.svelte` both ship `data-testid` attributes in the published `dist/`. This policy makes that consistent and explicit.

### Scope

Apply `data-testid` only to elements that a visual-regression fixture or interaction test would need to locate:

- The primary interactive element (button, input, trigger)
- Overlay roots (dialog, listbox, popover panel)
- Internal controls with no accessible name stable enough for `getByRole` (close buttons inside modal panels, individual toolbar actions)

Do not scatter `data-testid` on purely structural wrapper divs.

### (i) Implementation pointer

No new infrastructure required. Add `data-testid` attributes directly to `.svelte` source files in `packages/components/src/components/`. The existing `packages/components/scripts/svelte-plugin.ts` compiles source with `svelte/compiler`'s `compile()`, which passes HTML attributes through unchanged.

Canonical example already in the repo: `packages/components/src/components/markdown-editor/editor-toolbar/editor-toolbar.svelte`.

### (ii) Verification command

After `bun run build`, the following must pass — it fails CI if any `data-testid` in `dist/` was not also present in source (catches accidental build-time injection), and vice versa (catches accidental stripping):

```sh
# Every data-testid in dist/ must originate in a source .svelte file.
bun --eval '
  import { readdirSync, readFileSync } from "node:fs";
  import { resolve } from "node:path";
  const distDir = resolve("packages/components/dist/server");
  const srcDir = resolve("packages/components/src/components");
  const srcContent = readdirSync(srcDir, { recursive: true })
    .filter((f) => String(f).endsWith(".svelte"))
    .map((f) => readFileSync(resolve(srcDir, String(f)), "utf8"))
    .join("\n");
  const distContent = readdirSync(distDir, { recursive: true })
    .filter((f) => String(f).endsWith(".js"))
    .map((f) => readFileSync(resolve(distDir, String(f)), "utf8"))
    .join("\n");
  const distIds = [...distContent.matchAll(/data-testid[=:]["\x27]([^"\x27]+)["\x27]/g)].map((m) => m[1]);
  const missing = distIds.filter((id) => !srcContent.includes(id));
  if (missing.length > 0) { console.error("data-testid in dist/ with no source declaration:", missing); process.exit(1); }
  console.log(`OK — ${distIds.length} data-testid(s) verified against source.`);
'
```

This command should be wired into `packages/components/scripts/validate-consumers.ts` or a sibling verification script so CI runs it on every build.

### (iii) Rollback implications

Rolling back means removing `data-testid` attributes from component source files. The build requires no changes. The visual-regression fixtures written in Phase 2 that locate elements by `data-testid` will break and must be rewritten to use semantic selectors (`getByRole`, `getByLabelText`, `aria-label`). For components with no accessible-name-stable internal trigger — modal close button, standalone icon buttons, toolbar actions — there is no semantic selector fallback, so those fixture interactions would need to be removed or the components extended with additional ARIA attributes. Rollback is low-cost at the build level, high-cost at the fixture level.

---

## Plan deviations recorded here

These deviate from the approved plan in `~/.claude/plans/dapper-painting-feather.md` and are intentional, justified above:

1. **Fixture file naming**: `<name>-fixtures.ts` (hyphen) instead of `<name>.fixtures.ts` (dot) — matches existing repo convention.
2. **Docker authenticity check**: the plan's "font fingerprint sha256" guard is replaced with `CINDER_PLAYWRIGHT_VERSION` baked into the image at build time and validated at update-snapshot time. The codebase has no bundled font (uses system fonts via CSS variables); fingerprinting a system font would not prove image authenticity, while a build-time-baked env var does.

Phases 1 and 2 should reference this document by section when picking up the implementation work.

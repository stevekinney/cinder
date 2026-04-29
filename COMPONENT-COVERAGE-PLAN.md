# Gap Analysis: Cinder vs. agent-bureau, depict, weft

## Context

Three downstream applications have been surveyed to determine whether Cinder can serve as their shared component library. All three are treated as Svelte consumers (agent-bureau today is React 19; per the user's explicit direction we treat its UI vocabulary as if it will migrate to Svelte — so its component needs are in scope, but a React port of Cinder is **not**).

- **agent-bureau** — observability / agent dashboard. Vocabulary: status badges, run tables, chat-style streams, configuration views, event timelines, JSON inspection, connection indicators.
- **depict** — SvelteKit + Svelte 5. ~71 custom components; deepest UI surface (review editors, diff viewers, chat, markdown, lesson/learning forms).
- **weft** — Bun durable-execution engine with embedded Svelte 5 dashboard. ~17 components + 15 domain fragments (event timelines, JSON viewer, agent reasoning, cost waterfall).

Cinder currently ships **21 Svelte 5 components** with a `.cinder-*` CSS layered design system: accordion, accordion-item, alert, badge, button, card, data-list, dropdown, empty-state, input, modal, navigation-bar, navigation-item, page-layout, pagination, select, skeleton, spinner, textarea, toggle, tooltip.

The goal is to confirm coverage and plan the missing pieces.

---

## Library Boundary (Admission Criteria)

Cinder is **primitives-only** in its stable surface. There are two namespaces: **stable** (`cinder/<name>`) and **experimental** (`cinder/experimental/<name>`). A component is admitted directly to stable only if **either**:

- **Multi-consumer rule**: requested by two or more of the three reference consumers, AND independent of any single consumer's domain model, AND has a public API stable enough that adopters can rely on prerelease bumps.
- **Universal-primitive rule**: it is a low-risk visual primitive with a well-established API in the wider Svelte/web ecosystem and minimal API-stability risk: Label, Avatar, Breadcrumbs, Kbd, CopyButton, Progress, CodeBlock. **Overlay components are explicitly excluded** from this rule because their API surface (modality, focus, positioning, hydration) is high-churn regardless of ecosystem precedent.

Components that meet neither rule — including all overlays without multi-consumer demand and all observability components — start in the **experimental** namespace.

**Promotion from experimental to stable** (the single canonical rule, referenced everywhere else in this document):

- Multi-consumer demand from at least two of the three reference consumers, AND
- One real consumer-replacement landed (deleted local component in any **currently-Svelte** consumer in favor of the Cinder version), AND
- No API change in the last release cycle, AND
- Accessibility, keyboard, and hydration tests passing.

**Note on agent-bureau and replacement eligibility**: agent-bureau is React today. It can satisfy the demand half of this rule (its component vocabulary is in scope per the user's direction), but it cannot satisfy the replacement half until it migrates to Svelte. So in the current state, replacement-eligible consumers are **depict** and **weft**. Once agent-bureau migrates, it joins the eligible set automatically. This avoids the asymmetry where a component could meet demand via depict + agent-bureau, land replacement in agent-bureau (impossible while it's React), and then claim promotion. The replacement gate is a quality signal — it requires a real Cinder component running in a real Svelte app. The demand gate is a roadmap signal — it ranks priority across all named consumers.

**Stable status, once granted, is permanent** unless the component's API is found to be technically wrong. Stable does not get revoked because of downstream scheduling. Adoption gates entry into stable; it does not threaten exit. If a stable component's API turns out to be wrong, it goes through a normal deprecation cycle (minor bump with deprecation notice, removal in a later major), not a demotion.

**Stable bucket** (admitted under multi-consumer rule unless noted):

- Form controls: Checkbox, Radio, Tabs, Label (universal-primitive)
- Feedback: Toast
- Data display: Table, CodeBlock (universal-primitive)
- Navigation: Avatar (universal-primitive), Breadcrumbs (universal-primitive)
- Progress (universal-primitive)
- Utilities: Kbd (universal-primitive), CopyButton (universal-primitive)
- Combobox (multi-consumer rule: depict + weft)

**Experimental bucket** (must earn stable promotion via the canonical rule):

- Sheet, Popover — overlay components, single-consumer demand today, will promote when depict's adoption demonstrates API fitness.
- ConnectionIndicator, JSON Viewer, Timeline, Message, Stat — observability-flavored, likely to churn on first contact with real data.

**Out of scope entirely**: markdown rendering, syntax highlighting, mermaid, diff viewer, review editor, charts. Heavyweight peer deps that belong in consuming apps.

---

## Coverage Matrix

**Legend**:

- ✓ = the consumer has a direct, named usage of this component (counts toward multi-consumer demand).
- ✓ _with parenthesized note_ = the consumer has a usage that requires this component's behavior even if the local code spells it differently (e.g., agent-bureau's run table is a Table need; weft's search-attributes panel is a Combobox need). These count toward multi-consumer demand at full weight.
- ✗ = missing from the consumer where one would expect it.
- (—) = consumer does not need this component.

| Need                                              | agent-bureau                     | depict | weft                         | Cinder                   | Gap                                              |
| ------------------------------------------------- | -------------------------------- | ------ | ---------------------------- | ------------------------ | ------------------------------------------------ |
| Button                                            | ✓                                | ✓      | ✓                            | ✓                        | —                                                |
| Input                                             | —                                | ✓      | ✓                            | ✓                        | —                                                |
| Textarea                                          | ✓                                | ✓      | —                            | ✓                        | —                                                |
| Select                                            | —                                | ✓      | ✓                            | ✓                        | —                                                |
| Toggle                                            | —                                | ✓      | ✓                            | ✓                        | —                                                |
| Badge                                             | ✓                                | ✓      | ✓                            | ✓                        | —                                                |
| Card                                              | —                                | ✓      | ✓                            | ✓                        | —                                                |
| Alert                                             | —                                | ✓      | ✓                            | ✓                        | —                                                |
| Modal                                             | —                                | ✓      | ✓                            | ✓                        | —                                                |
| Tooltip                                           | —                                | ✓      | ✓                            | ✓                        | —                                                |
| Spinner                                           | —                                | ✓      | ✓                            | ✓                        | —                                                |
| Skeleton                                          | —                                | ✓      | ✓                            | ✓                        | —                                                |
| Pagination                                        | —                                | ✓      | ✓                            | ✓                        | —                                                |
| Empty State                                       | —                                | ✓      | ✓                            | ✓                        | —                                                |
| Accordion                                         | —                                | ✓      | —                            | ✓                        | —                                                |
| Dropdown                                          | —                                | ✓      | —                            | ✓                        | —                                                |
| Navigation Bar/Item                               | ✓                                | ✓      | ✓                            | ✓                        | —                                                |
| Data List                                         | ✓                                | ✓      | ✓                            | ✓                        | —                                                |
| Page Layout                                       | ✓                                | ✓      | ✓                            | ✓                        | —                                                |
| **Checkbox**                                      | —                                | ✓      | —                            | ✗                        | **stable, Phase 1**                              |
| **Radio + RadioGroup**                            | —                                | ✓      | —                            | ✗                        | **stable, Phase 1**                              |
| **Tabs + TabPanel**                               | ✓ (run-detail sections)          | ✓      | ✓                            | ✗                        | **stable, Phase 1**                              |
| **Label (standalone)**                            | —                                | ✓      | —                            | ✗                        | **stable, Phase 1**                              |
| **Toast**                                         | ✓ (status feedback in dashboard) | ✓      | —                            | ✗                        | **stable, Phase 2**                              |
| **Table**                                         | ✓ runs table                     | ✓      | ✓ workflow rows              | ✗                        | **stable, Phase 2**                              |
| **Avatar**                                        | ✓ (chat-page roles)              | ✓      | —                            | ✗                        | **stable, Phase 3**                              |
| **Breadcrumbs**                                   | —                                | ✓      | —                            | ✗                        | **stable, Phase 3**                              |
| **Sheet / Drawer**                                | —                                | ✓      | —                            | ✗                        | **experimental, Phase 3**                        |
| **Popover** (interactive)                         | —                                | ✓      | —                            | ✗                        | **experimental, Phase 3**                        |
| **Progress** (bar + ring)                         | ✓ (token/step progress)          | ✓      | ✓ (agent budget gauge)       | ✗                        | **stable, Phase 3**                              |
| **Combobox**                                      | —                                | ✓      | ✓ (search-attributes filter) | ✗                        | **stable, Phase 4 (capped scope)**               |
| **Kbd**                                           | —                                | ✓      | —                            | ✗                        | **stable, Phase 5**                              |
| **CopyButton**                                    | ✓ (event/payload JSON)           | ✓      | ✓ (JSON viewer copy)         | ✗                        | **stable, Phase 5**                              |
| **JSON Viewer**                                   | ✓                                | —      | ✓                            | ✗                        | **experimental, Phase 5**                        |
| **CodeBlock** (preformatted, no syntax highlight) | ✓                                | ✓      | ✓                            | ✗                        | **stable, Phase 5**                              |
| **ConnectionIndicator**                           | ✓ (live WebSocket pill)          | —      | ✓ (workflow live-status)     | ✗                        | **experimental, Phase 5**                        |
| **Stat**                                          | ✓ (run summary)                  | —      | ✓ (dashboard tiles)          | ✗                        | **experimental, Phase 5**                        |
| **Timeline**                                      | ✓ (event timeline)               | —      | ✓ (workflow events)          | ✗                        | **experimental, Phase 5**                        |
| **Message**                                       | ✓ (chat page)                    | ✓      | ✓ (agent turn)               | ✗                        | **experimental, Phase 5**                        |
| Status Badge w/ semantic states                   | ✓                                | ✓      | ✓                            | partial (Badge variants) | covered by Badge composition                     |
| Form (validation surface)                         | —                                | ✓      | —                            | ✗                        | **deferred — not built until two consumers ask** |
| VerificationCodeInput                             | —                                | ✓      | —                            | ✗                        | **deferred — depict-specific**                   |
| Markdown Renderer                                 | —                                | ✓      | —                            | —                        | **out of scope**                                 |
| Mermaid Diagram                                   | —                                | ✓      | —                            | —                        | **out of scope**                                 |
| Diff Viewer                                       | —                                | ✓      | —                            | —                        | **out of scope**                                 |
| Review Editor                                     | —                                | ✓      | —                            | —                        | **out of scope**                                 |
| Cost Waterfall / Charts                           | —                                | —      | ✓                            | —                        | **out of scope**                                 |

---

## Roadmap

Six phases. **Phase 0 is mandatory and serial** — it establishes the internal contracts that every later component depends on. Phases 1–5 build on top.

### Phase 0 — Internal architecture (no public components shipped)

This phase ships zero new public components. It produces internal modules and one document. It is serial work owned by one author; later phases parallelize on top of it.

**Deliverables**:

1. **Field-control contract** (`src/_internal/field-control.ts`)
   - Shape for label + description + error association
   - Required props: `id`, `name`, `disabled`, `required`, `invalid`, `describedBy`
   - SSR-safe ID coordination via existing `use-id.ts`
   - Native form integration: components must back onto a real `<input>`/`<select>`/`<textarea>` and participate in form submission, reset, and constraint validation. No custom-role replacements.
   - Existing Input, Textarea, Select, Toggle audited and refactored to consume the contract (no public API change).

2. **Collection / selection contract** (`src/_internal/collection.ts`)
   - Roving tabindex helper (arrow keys, Home/End, Enter/Space)
   - Group context shape for parent/child coordination (used by RadioGroup, Tabs, Combobox listbox)
   - Existing Accordion audited and refactored to consume the contract.

3. **Overlay policy** (`src/_internal/overlay.ts` + `OVERLAY-POLICY.md`)
   - Single portal root convention (default to document.body, configurable)
   - Z-index layer constants: tooltip < dropdown/popover < modal/sheet < toast
   - Focus-restore protocol: capture focus on open, restore on close, configurable initial focus target
   - Escape priority: top-most overlay handles ESC; lower overlays ignore the event
   - Outside-click semantics: click on backdrop or outside the overlay's DOM tree closes it; configurable per-overlay
   - Scroll lock: only Modal and Sheet (full-viewport overlays) lock body scroll; ownership tracked so nested overlays don't double-unlock
   - Reduced-motion: every overlay must respect `prefers-reduced-motion`
   - **SSR rule** (hard constraint): overlays render nothing on the server, regardless of their initial `open` state. If a consumer passes `open={true}` during SSR, the component still renders an empty placeholder on the server and only mounts the overlay markup after client hydration. A development-mode warning is logged if `open={true}` is detected during SSR. This trades a one-frame render delay on initial paint for a single, predictable hydration model. Documented as the supported behavior in `OVERLAY-POLICY.md`. Consumers needing server-rendered overlay content for first paint must compose the content outside the overlay (e.g., render the panel inline with `display:none` toggled by a script) — Cinder does not support that path in v1.
   - Existing Modal, Dropdown, Tooltip audited and refactored to consume the policy.

4. **Token inventory pass** (`src/styles/tokens/`)
   - Audit current tokens
   - Add semantic states: `--cinder-color-info|success|warning|danger` (foreground/background/border triples)
   - Add layering tokens: `--cinder-z-tooltip|dropdown|modal|sheet|toast`
   - Add motion tokens: `--cinder-duration-instant|fast|moderate|slow`, `--cinder-easing-*`
   - Add overlay tokens: backdrop opacity, blur, padding
   - Existing components verified against the new token inventory.

5. **Test infrastructure**
   - Helpers for keyboard-interaction testing (key sequences, focus assertions)
   - Helpers for ARIA-attribute assertions
   - Helpers for lifecycle testing (mount/unmount cycles, leak detection on timers/listeners)
   - **SSR-render-and-hydrate helper**: renders a component with Svelte's SSR API, captures the HTML, mounts that HTML on the client side, asserts no hydration mismatch warnings, no ID drift, and no missing DOM-property state. Used by all phases.
   - One reference test per existing component using the new helpers, including at least one component that exercises the hydrate helper (e.g., Input with `use-id`).

**Verification**:

- All existing 21 components still pass `bun run validate` (lint, typecheck, test, exports check, consumer fixtures, build).
- New `OVERLAY-POLICY.md` is referenced by every overlay component's `.a11y.md`.
- No public API change (consumers don't see this phase).

---

### Phase 1 — Field controls + Tabs (smallest unblock)

**Capability requirements** (these are the contract; "ship the component" without these means the component is not done):

- **Checkbox**:
  - Backed by native `<input type="checkbox">`
  - Props: `name`, `value`, `checked` (bindable), `defaultChecked`, `indeterminate` (bindable; sets DOM property, not attribute), `disabled`, `required`, `invalid`, `id`, `description`, `error`, `label`
  - Indeterminate state: set on mount and on update via `effect`; cleared when checked toggles
  - Form participation: submits as form value when checked
  - Keyboard: native (Space toggles)
  - Acceptance test: form submission with checked/unchecked/indeterminate, reset behavior, hydration safety

- **Radio + RadioGroup**:
  - Backed by native `<input type="radio">`
  - RadioGroup owns `name`, `value` (bindable), `disabled`, `required`, `invalid`, `description`, `error`, `legend`
  - Radio reads context, derives own `checked` from group value
  - Roving tabindex via collection contract; arrow keys move selection (per WAI-ARIA radio pattern)
  - Form participation: native
  - Acceptance test: arrow-key navigation, form submission, reset, single-select invariant

- **Tabs + TabPanel**:
  - ARIA `tablist` / `tab` / `tabpanel` pattern
  - Tabs owns `value` (bindable), orientation (horizontal | vertical)
  - Tab declares its `value`; TabPanel matches by `value`
  - Keyboard: arrow keys (Home/End) move tab focus; Enter/Space activates; tabs activate on focus when `activateOnFocus` is true (default true for horizontal, manual for vertical)
  - `aria-controls`/`aria-labelledby` wired automatically via collection contract
  - Acceptance test: full keyboard navigation, screen-reader name/role/state assertions, controlled/uncontrolled value modes

- **Label (standalone)**:
  - Trivial: `for` association, optional `required` indicator. Exported separately so consumers building hand-rolled forms can match the same visual treatment as Input/Checkbox/Radio.

**Files added** (in `packages/components/src/components/`):

- `checkbox.svelte` + `.test.ts` + `.a11y.md`
- `radio.svelte` + `radio-group.svelte` + tests + a11y docs
- `tabs.svelte` + `tab.svelte` + `tab-panel.svelte` + tests + a11y docs
- `label.svelte` + tests

**Parallelization** (revised — only leaf component work runs in parallel; integration is serial):

- One integration owner per phase. Owner runs the serial work: barrel/exports update, CSS registry update, shared-utility merges, acceptance-test alignment.
- Up to 4 leaf workers (one per component family) run in parallel, each operating in an isolated worktree against Phase 0's frozen contracts.
- Each worker's PR rebases onto the phase branch only after the prior one merges to avoid contract drift.

**Promotion targets** (tracked, non-blocking for engineering completion):

- depict: replace one local checkbox usage and one local tabs usage with Cinder.
- weft: adopt Cinder Tabs in the workflow-detail view.

These are recorded in `tmp/consumer-replacement-status.md` and reviewed at the next phase boundary. Engineering completion does not block on them; promotion-status review may.

---

### Phase 2 — Toast + Table

**Capability requirements**:

- **Toast / ToastRegion**:
  - State is owned by `<ToastRegion />`. There is no process-global singleton. The region instance is registered into a Svelte context; `useToast()` from a child reads that context.
  - SSR: region renders nothing on server; toasts are created only on client.
  - API: `useToast()` returns `{ show, dismiss, dismissAll }`. `show(message, opts)` returns a handle; `opts` includes `variant`, `duration`, `action`, `dismissible`, `id` (for deduplication).
  - **Live-region architecture**: ToastRegion renders **two sibling regions** in the DOM: a polite region (`role="status"`, `aria-live="polite"`) for `info` and `success` variants, and an assertive region (`role="alert"`, `aria-live="assertive"`) for `warning` and `danger` variants. Both regions carry `aria-atomic="true"` and `aria-relevant="additions"`. Each toast is rendered into the region matching its variant. This ensures that high-priority warnings interrupt as expected without informational toasts being elevated, and that simultaneous announcements do not collapse into a single ambiguous role. Visually, both regions stack in the same screen position; semantics are independent.
  - Stack policy: configurable max-stack per region (default 5); overflow drops oldest with announcement.
  - Auto-dismiss: respects `prefers-reduced-motion` (no slide animation; immediate fade) and pauses on focus/hover.
  - Teardown: region clears all timers and removes nodes on unmount; tests verify no leak.
  - Deduplication: same `id` updates rather than duplicates.
  - Z-index from overlay tokens.
  - Acceptance test: polite vs assertive routing per variant, announcement assertions across both regions, focus pause behavior, per-region stack overflow, hydration safety (region is empty on SSR, populates on client without mismatch), teardown.

- **Table** (deliberately small v1):
  - Semantic markup: `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`. No virtualization, no row selection, no cell editing, no pinned columns, no column resize, no aggregation. These are explicit non-goals and listed in the README.
  - Consumer-owned data ordering: Table does not sort. It exposes a controlled `sort` (bindable `{ column, direction }`) and a `sortable` prop on each header. Click on a sortable header dispatches an event the consumer handles by re-ordering its data.
  - Row identity: consumer supplies `key` per row (required when rows are dynamic).
  - Sub-components are public API: `Table`, `TableHeader`, `TableHeaderCell`, `TableBody`, `TableRow`, `TableCell`. Composition over configuration.
  - **Sortable header structure**: when `sortable` is true, `TableHeaderCell` renders a `<button type="button">` inside the `<th>`. Focus and click activation live on the inner `<button>` (so keyboard activation is native via Enter/Space). `aria-sort` (`ascending` | `descending` | `none`) is set on the `<th>`. The button has the accessible name (column label); the `<th>` provides the column-header semantic role automatically. Non-sortable header cells render plain text inside the `<th>` with no inner button.
  - Sticky header: opt-in CSS class.
  - Empty state: empty body renders `EmptyState` if no rows.
  - Acceptance test: sort event contract, sticky header behavior, keyboard activation on the inner button (Enter/Space), focus visibly lands on the button, `aria-sort` transitions correctly across click cycles, non-sortable headers have no button, screen-reader announcement of sort state.

**Parallelization**: 2 leaf workers (Toast, Table) on top of integration owner.

**Promotion targets** (tracked, non-blocking for engineering completion or stable retention):

- depict: one toast usage replaced.
- weft or agent-bureau (post-migration): one workflow/run table replaced.

Recorded in `tmp/consumer-replacement-status.md`. Toast and Table are admitted directly to stable under the multi-consumer rule; their stable status is not contingent on replacement landing. Replacement is tracked to validate API fitness over time.

---

### Phase 3 — Navigation + Progress (stable) and overlay experiments

**Stable capability requirements**:

- **Avatar**: image + initials fallback (computed from `name` prop), sizes (xs|sm|md|lg|xl), shapes (circle|square). `alt` required when `image` is present; initials are decorative when shown alongside a name.

- **Breadcrumbs**: items + separator snippet (default `/`), wrapped in `<nav aria-label="Breadcrumb">`, list semantics (`<ol>`), last item carries `aria-current="page"` and is not a link.

- **Progress**: bar + ring variants. Determinate (`value` 0–100) + indeterminate (`value={undefined}`). Sizes (sm|md|lg). ARIA: `role="progressbar"`, `aria-valuenow`/`aria-valuemax`/`aria-valuemin` for determinate, `aria-valuetext` for human-readable status. **Reduced-motion**: when `prefers-reduced-motion: reduce` is set, indeterminate Progress switches off the looping animation entirely and renders a static bar/ring with `aria-valuetext="Loading"` (or a consumer-supplied label). Determinate updates use a `transition` step that is suppressed under reduced-motion (value changes apply immediately).

**Experimental capability requirements** (shipped under `cinder/experimental/<name>`):

- **Sheet / Drawer** (full capability contract — overlay component, high churn risk):
  - Modal-equivalent: focus trap, backdrop, ESC closes, scroll lock per overlay policy. By default modal (focus trapped, backdrop blocks pointer events, body scroll locked). `nonModal` prop disables those for inline panels.
  - Edges: `top` | `right` | `bottom` | `left`. Default `right`.
  - Sizes: `sm` | `md` | `lg` | `full`; CSS-token-driven dimensions.
  - Trigger ownership: Sheet is **uncontrolled-friendly** (`open` prop bindable). Trigger is the consumer's responsibility (any element with `onclick={() => open = true}`); Sheet does not provide a `<SheetTrigger>` wrapper to keep the API surface minimal.
  - Focus entry: on open, focus moves to the first focusable element inside the panel, or to a `data-cinder-initial-focus` element if present.
  - Focus exit: on close, focus restores to the previously focused element (per overlay policy).
  - Repositioning: edge-anchored sheets do not reposition (they are full-edge). No collision detection needed.
  - Nested overlay behavior: a Modal opened from inside a Sheet stacks above it (per overlay z-index tokens); ESC closes top-most only.
  - Animation: slides in from the edge; respects `prefers-reduced-motion` (immediate fade instead of slide).
  - SSR: follows the overlay policy's SSR rule — server renders an empty placeholder regardless of `open`, client mounts the panel on hydration. `open={true}` during SSR triggers a dev-mode warning and renders the overlay only after hydration.
  - **Non-goals (v1)**: resizable handles, swipe-to-close gestures, multiple simultaneous sheets on the same edge, custom backdrops, server-rendered open content for first paint.
  - Acceptance test: open/close, focus trap, focus restore, ESC handling, scroll lock + unlock with nested modal, `prefers-reduced-motion` behavior, hydration with `open={false}` (no markup, no warning), hydration with `open={true}` (placeholder on server, full overlay on client, dev warning emitted, focus moves correctly post-hydration).

- **Popover** (full capability contract — overlay component, high risk):
  - Anchored interactive surface. Distinct from Tooltip (display-only, hover-triggered) and Dropdown (menu semantics with `role="menu"`).
  - **Anchor semantics**: Popover is anchored to a trigger element. Two API options exposed:
    1. Snippet-based: `<Popover>{#snippet trigger()}<button>...</button>{/snippet}{#snippet content()}...{/snippet}</Popover>` — Popover wires up `aria-haspopup`, `aria-expanded`, and `aria-controls` automatically.
    2. Imperative: consumer passes a `triggerRef` (a Svelte ref) — useful when the trigger lives outside the Popover's DOM subtree.
  - Modality: `modal` prop (default false). When false, Popover is non-modal (focus does not trap; outside content remains interactive). When true, Popover behaves like a small modal (focus trap, backdrop optional via `backdrop` prop).
  - Focus entry: on open, focus moves to the first focusable element inside the popover content.
  - Focus exit: on close, focus restores to the trigger.
  - Positioning: placement (`top|right|bottom|left|top-start|top-end|...`), offset (px), align, with collision detection (flip + shift) reusing the positioning utility from Phase 0 (originally extracted from Dropdown).
  - **Repositioning**: the popover repositions on:
    1. `ResizeObserver` on the trigger and on the popover content (size changes).
    2. Scroll events on **all scrollable ancestors of the trigger** (walked at open time and re-walked on DOM mutations affecting the trigger's position in the tree), in addition to the viewport's `scroll` event.
    3. Window `resize`.
       Listeners are added with `{ passive: true, capture: true }`. All updates are throttled via `requestAnimationFrame`. Listeners are torn down on close and on unmount; tests verify no leak.
  - **Supported-layout rule**: Popover supports nested scrollable layouts (sidebars, scrollable panels, modal-internal scroll containers). It does **not** support: triggers inside iframes, triggers in shadow roots whose host is in a different document, or triggers with CSS `transform` ancestors that change the containing block in ways that interfere with `position: fixed` portals (consumers using such layouts must use a different anchoring strategy — documented as a known limitation).
  - ESC closes per overlay policy.
  - Outside-click closes by default; `closeOnOutsideClick={false}` to disable.
  - SSR: follows the overlay policy's SSR rule — server renders nothing, client mounts on hydration. `open={true}` during SSR triggers a dev-mode warning.
  - **Non-goals (v1)**: arrow/caret rendering, virtual triggers (popover anchored to a coordinate rather than an element), nested popovers from popovers (Popover inside Popover is undefined behavior), iframe and shadow-root anchoring.
  - Acceptance test: open/close, focus trap (modal), focus restore, ESC handling, outside-click handling, repositioning on viewport scroll, repositioning on nested scrollable ancestor scroll, repositioning on `ResizeObserver` events, collision flipping, controlled vs uncontrolled `open` state, hydration with both `open={false}` and `open={true}`, listener leak verification.

**Parallelization**: up to 5 leaf workers, integration owner serial. Sheet and Popover are the highest-risk; allocate Codex `high` effort to each. Avatar/Breadcrumbs/Progress are low-risk.

**Promotion targets**:

- Avatar, Breadcrumbs, Progress ship stable under the universal-primitive rule. Tracked but not gating.
- Sheet and Popover ship experimental. Promotion to stable follows the canonical promotion rule (multi-consumer demand + one real consumer-replacement + no API change in the last release cycle + a11y/keyboard/hydration tests). depict is the expected first adopter; agent-bureau (post-migration) and weft are the multi-consumer prospects.

---

### Phase 4 — Combobox (capped scope)

Combobox alone, because it's the most complex single component left.

**Hard scope caps written into the README**:

- Single-select only
- Synchronous local filtering only (consumer supplies a filter callback)
- No async / remote loading, no debounced fetch
- No virtualization (cap visible options at 200; document the limit)
- No multi-select, no token chips
- No "create new" / free-text submission

**Capability requirements**:

- Full WAI-ARIA combobox pattern (input + listbox)
- Keyboard: ArrowDown opens, ArrowUp/ArrowDown move active option, Enter selects, ESC closes, type-ahead supported
- `aria-expanded`, `aria-controls`, `aria-activedescendant`
- Empty state when no options match
- Acceptance test: full ARIA pattern verified, keyboard interactions, focus management on close

**Promotion target**: depict's FilterSelect — replace at least one usage. If the hard scope cap blocks the replacement, that signals the cap is too tight; review at the next phase boundary and either widen the cap (with new acceptance contracts) or defer.

---

### Phase 5 — Utilities + experimental observability bucket

**Stable utilities**:

- **Kbd** — keyboard-key chip, trivial
- **CopyButton** — Button preset + `clipboard.ts` utility (with execCommand fallback for older Safari, document behavior)
- **CodeBlock** — preformatted code, optional language label, optional copy. **No syntax highlighting** — that's a consumer concern (Shiki is heavy and depict already owns it).

**Experimental observability components** (under `cinder/experimental/*` subpath, marked unstable):

- **JSON Viewer** — collapsible tree, depth control, copy node. Hard caps: synchronous render only; payload >1MB shows a fallback with a download/copy action; max nested depth 50; consumers needing more should compose their own.
- **ConnectionIndicator** — semantic dot + label; states `connected | connecting | disconnected | error`. Generalize agent-bureau's pattern.
- **Stat** — label + value + optional delta/trend. KPI tile.
- **Timeline** — vertical rail + item snippet; icon/dot variant.
- **Message** — chat bubble; role (user | assistant | system), timestamp, content snippet.

**Promotion criteria**: see the canonical promotion rule under "Library Boundary (Admission Criteria)". This phase adds no exception or shortcut.

---

## Critical Files & Conventions

- `packages/components/src/index.ts` — barrel; updated by `bun run exports:generate`.
- `packages/components/scripts/generate-exports.ts` — regenerates `package.json` exports from filesystem. Phase 5 needs an extension to support `cinder/experimental/*` subpaths.
- `packages/components/src/styles/components/` — one CSS file per component, registered in `src/styles/index.css`.
- `packages/components/src/styles/tokens/` — tokens (Phase 0 expansion).
- `packages/components/src/_internal/` — field-control, collection, overlay contracts (Phase 0 deliverables).
- `packages/components/src/utilities/use-id.ts` — SSR-safe IDs.
- `packages/components/src/components/accordion.svelte` — reference for context-coordinated parent/child (RadioGroup, Tabs use the same pattern via the new collection contract).
- `packages/components/src/components/modal.svelte` — reference for native `<dialog>` (Sheet builds on the new overlay policy).
- `packages/components/src/components/dropdown.svelte` — reference for positioning + outside-click (Popover, Combobox build on the new overlay policy).
- `packages/components/src/components/input.svelte` — reference for label + description + error (Checkbox, Radio use the new field-control contract).
- `packages/components/src/components/data-list.svelte` — kept for non-tabular lists; Table is for tabular data.
- `packages/components/src/convention.test.ts`, `exports-drift.test.ts` — naming and exports drift; will fail loudly if a step is skipped.
- `packages/components/fixtures/` — `validate:consumer` fixtures; do not delete or rename.

---

## Verification (per phase)

The `bun run validate` pipeline must stay green:

```bash
cd packages/components
bun run lint                    # oxlint type-aware
bun run typecheck               # tsc + svelte-check
bun test                        # bun:test under happy-dom
bun run exports:check           # exports drift
bun run validate:consumer       # node + sveltekit fixtures consume the build
bun run build                   # prepack
```

**Per-component acceptance tests** (in addition to existing tests). Each new component must have tests covering:

- Keyboard interactions (key sequences using the Phase 0 helpers)
- ARIA attributes (role, aria-\* state)
- Focus movement (capture, restore, trap where applicable)
- Controlled vs uncontrolled state (where bindable)
- Lifecycle safety (mount/unmount cycles, no console errors, no leaked timers or listeners)
- Reduced-motion respect (where the component animates)
- Failure paths (invalid props, edge cases)

**Hydration tests** (separate from lifecycle tests). Required for any component that:

- Uses `use-id` for SSR-stable IDs (Input, Checkbox, Radio, Select, Textarea, Tabs, etc.)
- Uses portals or overlay surfaces (Modal, Sheet, Popover, Dropdown, Tooltip, ToastRegion)
- Has DOM-property-only state (Checkbox `indeterminate`)
- Has client-only state that must not render on server (ToastRegion)

The hydration test suite renders the component with Svelte's SSR mode, asserts the resulting HTML, then re-mounts the same markup in the client and asserts no hydration mismatch warnings, no ID drift between server and client, and that DOM-property-only state is correctly applied after hydration. Phase 0 ships the SSR-render-and-hydrate helper that all phases use.

**Real-consumer replacement** is a **promotion gate**, not a release gate. A phase is **engineering-complete** when validation, acceptance tests, and hydration tests pass. The component then ships under its phase's release. Real-consumer replacement (deleting a local component in depict or weft in favor of the Cinder version) is required for **promotion** from experimental to stable per the canonical rule under "Library Boundary (Admission Criteria)."

For components admitted directly to stable (under either the multi-consumer rule or the universal-primitive rule), real-consumer replacement is **tracked but not gating**. Once stable, status does not get revoked because of downstream scheduling: stable means stable. If a stable component's API turns out to be technically wrong, it goes through a normal deprecation cycle, not demotion.

This separates Cinder's engineering pace from depict/weft team availability. Cinder phases ship on Cinder's schedule. Cross-repo coordination happens against experimental→stable promotion, not engineering completion or stable retention.

**Cross-repository ownership** (when consumer replacement is in scope):

- Cinder owns the component implementation and the migration guide (a short Markdown file shipped in the README under `docs/migrating/<component>.md`).
- Each consuming repo's owner decides when to schedule the replacement work in their own backlog.
- A Cinder phase records the **target consumer** for each component it ships and tracks replacement status in `tmp/consumer-replacement-status.md` at the Cinder repo root.
- For experimental components, the replacement target is meaningful: it gates promotion to stable per the canonical rule.
- For components already in stable, the target is informational. Their stable status is not contingent on the replacement landing.
- Failure policy (for experimental components): if no consumer replacement lands within two release cycles, the component's API is reviewed for fitness. If the API is the blocker, it is revised (still in experimental, no deprecation needed) and re-targeted. If consumer timing is the blocker, the component stays experimental.

**Workflow rituals** (`committee-review`, `codex-advisor`, sentinel cleanup) are user-level workflow per `MEMORY.md`. They run alongside engineering verification but are not part of the engineering completion contract — i.e., a phase is engineering-complete when validation, acceptance tests, and hydration tests pass; the workflow rituals are a separate gate the user enforces on top.

---

## Release Strategy

- Cinder is at `0.0.1`. Until `1.0.0`, every phase ships as a `0.x` minor (e.g., 0.1.0 after Phase 0, 0.2.0 after Phase 1, etc.).
- Stable components are exported under their direct subpath (`cinder/checkbox`).
- Experimental components are exported under `cinder/experimental/<name>` and the README documents that any pre-1.0 release may break their API.
- Promotion from experimental to stable is a minor bump and a README note. Removal from experimental (without promotion) is a minor bump and a deprecation entry.
- After Phase 5, evaluate whether the surface is ready for `1.0.0`; criteria include zero open API-stability bugs and at least one real consumer using each stable component.

---

## Out of Scope

- Markdown rendering, syntax-highlighted code, mermaid, diff viewer, review editor, charts — domain widgets with heavy peer deps; stay in consuming apps.
- Form wrapper with validation orchestration — defer until two consumers ask.
- VerificationCodeInput — depict-only, specialized.
- Multi-select / async combobox, virtualized table, charting — explicit non-goals for v1.
- React port of Cinder — agent-bureau's needs are tracked at the vocabulary level; the port itself is not in this plan.

---

## Summary

- **Phase 0** (no public components): field-control, collection, overlay policy, token inventory, test helpers including SSR-render-and-hydrate. Serial. Mandatory prerequisite.
- **Phase 1** (4 components, all stable): Checkbox, Radio+RadioGroup, Tabs+TabPanel, Label.
- **Phase 2** (2 components, both stable): Toast, Table — both with explicit non-goals and capability contracts.
- **Phase 3** (3 stable + 2 experimental): Avatar, Breadcrumbs, Progress (stable); Sheet, Popover (experimental, promote on adoption).
- **Phase 4** (1 component, stable): Combobox with hard scope caps.
- **Phase 5** (3 stable + 5 experimental): Kbd, CopyButton, CodeBlock (stable); JSON Viewer, ConnectionIndicator, Stat, Timeline, Message (experimental).
- **Heavyweight domain widgets** stay in consuming apps. Cinder is the primitives layer with a small, marked experimental bucket containing high-churn overlays and observability widgets.

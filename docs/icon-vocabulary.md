# Icon vocabulary

Cinder uses [`lucide-svelte`](https://lucide.dev/) for component affordances. A
visible icon is supplementary to the control's accessible name or state; it
must not be the only way to communicate what an interactive element does.

## Meaning

- Disclosure uses a single `ChevronDown` that rotates 180 degrees when the
  controlled content is expanded. The control still exposes `aria-expanded`.
- Directional transfer uses a single chevron (`ChevronLeft` or `ChevronRight`)
  for moving selected items and a double chevron (`ChevronsLeft` or
  `ChevronsRight`) for moving all items.
- Add and increment actions use `Plus`; remove and clear actions use `X`;
  decrement actions use `Minus`. These named Lucide icons replace `+`, `-`, or
  `−` text glyphs. A plus or minus may remain as data
  typography (for example, a diff prefix or keyboard shortcut separator) when
  it is not an interactive affordance.
- Icons are `aria-hidden="true"` when the surrounding control has the accessible
  label. New icons use the shared `cinder-icon-*` sizing utilities: `xs`
  (0.875rem), `sm` (1rem), `md` (1.25rem), and `lg` (1.5rem). Existing
  component-specific sizing is allowed only when it is part of the component's
  documented visual contract and is recorded in this audit.

## Audit (2026-07-25)

The audit searched component templates for visible `+`, `-`, `−`, `×`, `<`, `>`,
`‹`, `›`, `▾`, `▸`, `↑`, `↓`, and their HTML entities (including `&times;`,
`&#8593;`, and `&#8595;`). It also searched component stylesheets for `content:`
values that generate visible glyphs, then classified each hit by whether it is
an interactive affordance.

| Location                                                                                                                                                               | Finding                      | Disposition                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kanban-board/kanban-board.svelte`                                                                                                                                     | Column disclosure            | Uses `ChevronDown`; the former `+`/`−` glyph is tracked by #939.                                                                                                                                                                               |
| `transfer-list/transfer-list.svelte`                                                                                                                                   | Four transfer controls       | Uses `ChevronLeft`, `ChevronRight`, `ChevronsLeft`, and `ChevronsRight`; the former text glyphs are tracked by #940.                                                                                                                           |
| `number-input/number-input.svelte`                                                                                                                                     | Increment/decrement steppers | Additional interactive `+`/`−` affordance; tracked in [#1014](https://github.com/stevekinney/cinder/issues/1014).                                                                                                                              |
| `menu-bar/menu-bar.svelte`                                                                                                                                             | Submenu indicator            | Additional interactive `>` affordance; tracked in [#1015](https://github.com/stevekinney/cinder/issues/1015).                                                                                                                                  |
| `dropdown-trigger/dropdown-trigger.svelte`                                                                                                                             | Disclosure indicator         | Existing hand-authored caret exception; it must be migrated to `ChevronDown` with expanded-state rotation.                                                                                                                                     |
| `accordion-item/accordion-item.svelte`, `collapsible/collapsible.svelte`, `json-viewer/_json-viewer-node.svelte`, `side-navigation-group/side-navigation-group.svelte` | Disclosure indicators        | Existing hand-authored SVG chevrons; migrate to `ChevronDown` with expanded-state rotation alongside DropdownTrigger.                                                                                                                          |
| `tree/tree-item.svelte`, `tree/tree.svelte`, `tree/tree.css`                                                                                                           | Disclosure indicators        | CSS-border chevrons on static and virtualized tree branches; migrate to `ChevronDown` with expanded-state rotation in [#1017](https://github.com/stevekinney/cinder/issues/1017).                                                              |
| `chip/chip.svelte`, `multi-select/multi-select.svelte`, `tag-input/tag-input.svelte`                                                                                   | Remove/clear controls        | Interactive `×` affordances; migrate to the named Lucide remove icon in [#1017](https://github.com/stevekinney/cinder/issues/1017), and include `×`, `&times;`, and numeric entity variants in future audits.                                  |
| `keyboard-shortcuts/keyboard-shortcuts.svelte`, `shortcut-hint/shortcut-hint.svelte`                                                                                   | Key-combination separators   | Intentional typography inside `aria-hidden` visual keycaps; no icon replacement needed.                                                                                                                                                        |
| `diff-statistics/diff-statistics.svelte`, `json-schema-editor/diff-view.svelte`                                                                                        | Diff markers                 | Data notation, not controls; retain text markers.                                                                                                                                                                                              |
| `invocation-rule-builder/invocation-rule-builder.svelte`                                                                                                               | Add controls                 | Additional interactive `+` affordances; tracked in [#1017](https://github.com/stevekinney/cinder/issues/1017).                                                                                                                                 |
| `multi-select/multi-select.svelte`                                                                                                                                     | Expanded-state trigger       | Additional interactive `▾` affordance; tracked in [#1017](https://github.com/stevekinney/cinder/issues/1017).                                                                                                                                  |
| `json-schema-editor/property-list.svelte`                                                                                                                              | Property disclosure          | Additional interactive `▸` affordance; tracked in [#1017](https://github.com/stevekinney/cinder/issues/1017).                                                                                                                                  |
| `json-schema-editor/property-list.svelte`                                                                                                                              | Move controls                | Interactive `↑`/`↓` affordances (and `&#8593;`/`&#8595;` entity variants); tracked in [#1017](https://github.com/stevekinney/cinder/issues/1017).                                                                                              |
| `calendar/calendar.svelte`                                                                                                                                             | Month navigation controls    | Interactive `‹`/`›` affordances; migrate to `ChevronLeft`/`ChevronRight` in [#1017](https://github.com/stevekinney/cinder/issues/1017).                                                                                                        |
| `json-schema-editor/json-schema-editor.css`                                                                                                                            | Generated disclosure         | `content: '▸'` on clickable constraint summaries; migrate to the named disclosure icon in [#1017](https://github.com/stevekinney/cinder/issues/1017).                                                                                          |
| `invocation-rule-builder/invocation-rule-builder.svelte`                                                                                                               | Remove controls              | Three hand-authored X-shaped SVG remove affordances; migrate to the named Lucide remove icon alongside the add controls in [#1017](https://github.com/stevekinney/cinder/issues/1017).                                                         |
| `transfer-list/transfer-list.svelte`                                                                                                                                   | Icon sizing exception        | Existing transfer icons use `size={18}` as a documented component chrome exception; retain until the visual contract is migrated, and scope the utility scale requirement to new work.                                                         |
| `permission-matrix/permission-matrix.svelte`                                                                                                                           | Icon sizing exception        | Existing status icons use `size={16}` as table chrome; retain as documented component-specific sizing.                                                                                                                                         |
| `connection-indicator/connection-indicator.svelte`                                                                                                                     | Icon sizing exception        | Existing status icon uses `size={13}` to fit the compact indicator; retain as documented component-specific sizing.                                                                                                                            |
| `access-gate/access-gate.svelte`, `access-gate/access-gate-inline.svelte`                                                                                              | Icon sizing exception        | Existing gate icons use `size={20}` and `size={14}` for their distinct full and inline chrome; retain as documented component-specific sizing.                                                                                                 |
| `inline-loading/inline-loading.svelte`                                                                                                                                 | Icon sizing exception        | Existing status icons use `size={14}` in compact loading chrome; retain as documented component-specific sizing.                                                                                                                               |
| `card/card.svelte`                                                                                                                                                     | Icon sizing exception        | Existing alert icon uses `size={18}` in card chrome; retain as documented component-specific sizing.                                                                                                                                           |
| `speed-dial*/**.fixture.svelte`                                                                                                                                        | Fixture-only plus marker     | Demo content, not published component UI; no action required.                                                                                                                                                                                  |
| `speed-dial/speed-dial.examples.json`                                                                                                                                  | Published example trigger    | The exported example is instructional consumer code rather than component chrome; scope the policy to shipped component markup, and track replacing its `+` trigger with `Plus` in [#1017](https://github.com/stevekinney/cinder/issues/1017). |

The rows above account for every interactive text-glyph affordance found by the
audit. Future audits should keep this distinction: a glyph that conveys data is
not an icon affordance, while a glyph inside a button or menu trigger must
follow this vocabulary.

## Enforcement

The audit is currently documentation-backed rather than a lint rule. A generic
lint rule would need to understand Svelte expressions, fixture-only markup, and
data notation before it could distinguish the cases above without false
positives. Until that guard exists, review new interactive markup against this
document and search both templates and generated CSS declarations for the glyphs
listed in the audit procedure. For example:

```sh
rg -n -e '[×−‹›▾▸↑↓]' -e '&times;|&#8593;|&#8595;' packages/components/src/components
rg -n -e '>[[:space:]]*[+-][[:space:]]*<' packages/components/src/components
rg -n "content:\\s*['\"]" packages/components/src/components --glob '*.css'
```

# Accordion

A vertically stacked set of disclosure regions. The `Accordion` parent owns expansion state and provides a context the `AccordionItem` children read.

## Usage

`Accordion` is a compound component. Import the parent and compose
`Accordion.Item` via the namespace API.

```svelte
<script lang="ts">
  import { Accordion } from '@lostgradient/cinder/accordion';

  let expandedIds = $state<string[]>([]);
</script>

<Accordion bind:expandedIds multiple>
  <Accordion.Item id="one" title="One">First panel content.</Accordion.Item>
  <Accordion.Item id="two" title="Two">Second panel content.</Accordion.Item>
</Accordion>
```

The leaf remains importable individually for à-la-carte builds — see
`@lostgradient/cinder/accordion-item`.

## Props

<!-- generated:props:start -->

| Prop       | Type       | Required | Default | Description                                                                                                                                        |
| ---------- | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`    | `string`   | no       | —       | Additional CSS class merged with `.cinder-accordion`.                                                                                              |
| `multiple` | `boolean`  | no       | `false` | When true, multiple items may be expanded simultaneously.                                                                                          |
| `children` | `(opaque)` | yes      | —       | AccordionItem children. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

- `Accordion.Item` — child disclosure panel; receives the accordion context via
  Svelte's context API. See [`accordion-item`](../accordion-item/README.md).

<!-- generated:subcomponents:end -->

## Accordion vs Collapsible

[`Collapsible`](../collapsible/README.md) is the single-panel counterpart to Accordion.

Use Accordion when you have multiple named sections sharing a parent, and opening one may close another. The panels intentionally omit `role="region"` to avoid polluting the page's landmark list — see [accordion.a11y.md](./accordion.a11y.md).

Use [`Collapsible`](../collapsible/README.md) for a single independent disclosure that benefits from a named landmark region, animated open/close, or a trigger label that reacts to state.

### Why AccordionItem does not compose Collapsible

AccordionItem and Collapsible differ in enough dimensions that sharing internals would require adding an `accordion-mode` flag to Collapsible or removing `role="region"` conditionally — either change would alter Collapsible's public API and bleed accordion-specific concerns into a general-purpose primitive. Instead, they share the same visual vocabulary (heading button + chevron icon + panel) while keeping their semantics separate. See [collapsible.a11y.md](../collapsible/collapsible.a11y.md) for a side-by-side comparison.

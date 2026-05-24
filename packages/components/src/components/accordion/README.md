# Accordion

A vertically stacked set of disclosure regions. The `Accordion` parent owns expansion state and provides a context the `AccordionItem` children read.

## Usage

`Accordion` is a compound component. Import the parent and compose
`Accordion.Item` via the namespace API.

```svelte
<script lang="ts">
  import { Accordion } from 'cinder/accordion';

  let expandedIds = $state<string[]>([]);
</script>

<Accordion bind:expandedIds multiple>
  <Accordion.Item id="one" title="One">First panel content.</Accordion.Item>
  <Accordion.Item id="two" title="Two">Second panel content.</Accordion.Item>
</Accordion>
```

The leaf remains importable individually for à-la-carte builds — see
`cinder/accordion-item`.

## Props

<!-- generated:props:start -->

| Prop       | Type      | Required | Default | Description                                               |
| ---------- | --------- | -------- | ------- | --------------------------------------------------------- |
| `class`    | `string`  | no       | —       | Additional CSS class merged with `.cinder-accordion`.     |
| `multiple` | `boolean` | no       | `false` | When true, multiple items may be expanded simultaneously. |

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

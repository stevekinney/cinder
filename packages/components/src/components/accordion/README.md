# Accordion

A vertically stacked set of disclosure regions. The `Accordion` parent owns expansion state and provides a context the `AccordionItem` children read.

## Usage

```svelte
<script lang="ts">
  import Accordion from 'cinder/accordion';
  import AccordionItem from 'cinder/accordion-item';

  let expandedIds = $state<string[]>([]);
</script>

<Accordion bind:expandedIds multiple>
  <AccordionItem id="one" title="One">First panel content.</AccordionItem>
  <AccordionItem id="two" title="Two">Second panel content.</AccordionItem>
</Accordion>
```

`AccordionItem` is a separate top-level public export (`cinder/accordion-item`).

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

- `AccordionItem` — child disclosure panel; receives the accordion context via Svelte's context API.
<!-- generated:subcomponents:end -->

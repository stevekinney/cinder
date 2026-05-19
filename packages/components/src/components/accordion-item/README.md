# AccordionItem

A single expandable panel inside an `Accordion`. Reads the accordion context to drive its expanded state and toggle behavior.

## Usage

```svelte
<script lang="ts">
  import Accordion from 'cinder/accordion';
  import AccordionItem from 'cinder/accordion-item';
</script>

<Accordion expandedIds={[]}>
  <AccordionItem id="settings" title="Settings">Panel body.</AccordionItem>
</Accordion>
```

`AccordionItem` throws if used outside an `Accordion` — the context lookup is required.

## Props

<!-- generated:props:start -->

| Prop       | Type      | Required | Default | Description                                                |
| ---------- | --------- | -------- | ------- | ---------------------------------------------------------- |
| `class`    | `string`  | no       | —       | Additional CSS class merged with `.cinder-accordion-item`. |
| `disabled` | `boolean` | no       | `false` | When true, the item cannot be toggled.                     |
| `id`       | `string`  | yes      | —       | Unique identifier matched against Accordion's expandedIds. |
| `title`    | `string`  | yes      | —       | Visible header label for the item.                         |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

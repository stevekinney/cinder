# Toolbar

A named grouping of related controls that implements the WAI-ARIA toolbar pattern with roving tabindex.

## Usage

```svelte
<script lang="ts">
  import Toolbar from '@lostgradient/cinder/toolbar';
  import { Button } from '@lostgradient/cinder/button';
</script>

<Toolbar aria-label="Document actions">
  <Toolbar.Group>
    <Button variant="secondary">Save</Button>
    <Button variant="secondary">Share</Button>
  </Toolbar.Group>
  <Toolbar.Spacer />
  <Toolbar.Group>
    <Button>Publish</Button>
  </Toolbar.Group>
</Toolbar>
```

Horizontal toolbars wrap groups by default so constrained containers do not
overlap controls. Each `Toolbar.Group` keeps its controls together until the
toolbar's narrow container query wraps controls inside the group. A named
`Toolbar.Group` gets `role="group"` by default; pass an explicit `role` when a
different semantic grouping is required.

## Props

<!-- generated:props:start -->

| Prop          | Type                           | Required | Default        | Description                                                                                                      |
| ------------- | ------------------------------ | -------- | -------------- | ---------------------------------------------------------------------------------------------------------------- |
| `class`       | `string`                       | no       | —              | Additional class merged with `.cinder-toolbar`.                                                                  |
| `orientation` | `"horizontal"` \| `"vertical"` | no       | `"horizontal"` | Layout direction for keyboard ownership and separator placement.                                                 |
| `children`    | `(opaque)`                     | yes      | —              | Controls rendered inside the toolbar. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

- `Toolbar.Group` — cluster related controls and let the toolbar draw separators between groups.
- `Toolbar.Spacer` — consume remaining space and push later groups to the far edge.

<!-- generated:subcomponents:end -->

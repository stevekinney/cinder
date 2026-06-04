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

## Props

<!-- generated:props:start -->

| Prop          | Type                           | Required | Default        | Description                                                      |
| ------------- | ------------------------------ | -------- | -------------- | ---------------------------------------------------------------- |
| `class`       | `string`                       | no       | —              | Additional class merged with `.cinder-toolbar`.                  |
| `orientation` | `"horizontal"` \| `"vertical"` | no       | `"horizontal"` | Layout direction for keyboard ownership and separator placement. |

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

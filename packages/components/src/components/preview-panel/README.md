# PreviewPanel

Layout shell for bounded previews with consistent header, status, optional tabs, body, and footer regions.

## Usage

```svelte
<script lang="ts">
  import PreviewPanel from '@lostgradient/cinder/preview-panel';
</script>

<PreviewPanel title="Artifact preview" status="ready">
  <p>Preview content</p>
</PreviewPanel>
```

## Props

`PreviewPanel` supports `title`, `status`, `leading`, `actions`, `tabs`, `children`, `footer`, and `class`.

## Accessibility

The panel is layout-only for non-error states. `status="error"` promotes the panel to `role="alert"` so the error preview state is announced assertively.

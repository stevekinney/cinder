<script lang="ts" module>
  export const title = 'Basic review editor';
  export const description = 'Editable markdown with source, rendered, and diff views.';
</script>

<script lang="ts">
  import { ReviewEditor } from '@lostgradient/cinder/review-editor';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let editorId = $derived(`${mountIdPrefix ?? uid}-review-editor`);

  const original = `# Release Plan

The first release includes a dashboard, export actions, and inline review.

## Checklist

- Finalize the component API
- Add playground coverage
- Verify consumer fixtures`;

  let value = $state(`# Release Plan

The first release includes a dashboard, export actions, inline review, and comment summaries.

## Checklist

- Finalize the component API
- Add playground coverage
- Verify consumer fixtures
- Document review export behavior`);
</script>

<div style="min-height: 34rem;">
  <ReviewEditor id={editorId} {original} bind:value currentUserId="steve" name="review" />
</div>

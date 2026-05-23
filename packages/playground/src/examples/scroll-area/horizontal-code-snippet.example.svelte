<script lang="ts" module>
  export const title = 'Horizontal code snippet';
  export const description =
    'Horizontal scrolling for a long single-line code sample, rendered as a <pre> via the `as` prop so the region role is preserved alongside the semantic tag.';
</script>

<script lang="ts">
  import { ScrollArea } from 'cinder/scroll-area';

  const command =
    '$ bun run --filter @cinder/components build && bun run --filter @cinder/components test --coverage --reporter=verbose --bail';
</script>

<ScrollArea as="pre" direction="horizontal" maxWidth="32rem" ariaLabel="Example command"
  ><code>{command}</code></ScrollArea
>

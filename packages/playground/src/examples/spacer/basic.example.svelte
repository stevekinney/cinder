<script lang="ts" module>
  export const title = 'Spacer basic';
  export const description = 'Spacer pushes the trailing action to the far end of an Inline row.';
</script>

<script lang="ts">
  import { Inline } from 'cinder/inline';
  import { Spacer } from 'cinder/spacer';
</script>

<Inline>
  <span>Leading label</span>
  <Spacer />
  <button type="button">Trailing</button>
</Inline>

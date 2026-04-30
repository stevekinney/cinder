<script lang="ts" module>
  export const title = 'Loading state';
  export const description =
    'A permanent loading button alongside one that toggles loading on click; both render the spinner and set aria-busy.';
</script>

<script lang="ts">
  import { Button } from '../../../../components/src/index.ts';

  let loading = $state(false);

  async function handleClick() {
    loading = true;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    loading = false;
  }
</script>

<div class="example-preview-row">
  <Button variant="primary" label="Saving..." loading />
  <Button variant="primary" label="Save changes" {loading} onclick={handleClick} />
</div>

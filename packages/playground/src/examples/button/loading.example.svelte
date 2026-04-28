<script lang="ts" module>
  export const title = 'Loading state';
  export const description = 'Click to toggle loading; the button is disabled while loading.';
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

<Button variant="primary" label="Save changes" {loading} onclick={handleClick} />

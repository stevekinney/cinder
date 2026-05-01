<script lang="ts" module>
  export const title = 'Basic checkbox';
  export const description = 'Unchecked and checked variants with associated labels.';
</script>

<script lang="ts">
  import { Checkbox } from '../../../../components/src/index.ts';

  let acceptTerms = $state(false);
  let subscribed = $state(true);
</script>

<div style="display: flex; flex-direction: column; gap: 0.75rem;">
  <Checkbox id="checkbox-terms" label="I accept the terms of service" bind:checked={acceptTerms} />
  <Checkbox
    id="checkbox-newsletter"
    label="Subscribe to the newsletter"
    bind:checked={subscribed}
  />
</div>

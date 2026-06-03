<script lang="ts" module>
  export const title = 'Basic backdrop';
  export const description =
    'A full-viewport scrim that dims content behind it. Click the backdrop to dismiss it.';
</script>

<script lang="ts">
  import { Backdrop } from 'cinder/backdrop';
  import { Button } from 'cinder/button';
  import { Spinner } from 'cinder/spinner';

  let open = $state(false);
  let invisible = $state(false);
</script>

<div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
  <Button
    label="Show dimmed backdrop"
    onclick={() => {
      invisible = false;
      open = true;
    }}
  />
  <Button
    variant="secondary"
    label="Show invisible backdrop"
    onclick={() => {
      invisible = true;
      open = true;
    }}
  />
</div>

<Backdrop {open} {invisible} onclick={() => (open = false)}>
  <div
    style="display: flex; flex-direction: column; align-items: center; gap: 1rem; color: white; pointer-events: none;"
  >
    <Spinner size="lg" label="Loading" />
    <span style="font-size: 1rem; font-weight: 500;">Loading… click anywhere to dismiss</span>
  </div>
</Backdrop>

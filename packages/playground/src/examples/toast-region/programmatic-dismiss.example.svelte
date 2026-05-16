<script lang="ts" module>
  export const title = 'Programmatic dismiss';
  export const description =
    'show() returns the toast id. Capture it to dismiss a specific toast later, or call dismissAll() to clear both stacks at once.';
</script>

<script lang="ts">
  import { Button, ToastRegion, useToast } from '../../../../components/src/index.ts';

  let lastId = $state<string | null>(null);
</script>

<ToastRegion>
  {#snippet children()}
    {@const toast = useToast()}
    <div class="example-preview-row">
      <Button
        label="Show sticky"
        onclick={() => {
          lastId = toast.show('Sticky toast — will not auto-dismiss.', { duration: 0 });
        }}
      />
      <Button
        label="Dismiss last"
        variant="secondary"
        onclick={() => {
          if (lastId) toast.dismiss(lastId);
        }}
      />
      <Button label="Dismiss all" variant="secondary" onclick={() => toast.dismissAll()} />
    </div>
  {/snippet}
</ToastRegion>

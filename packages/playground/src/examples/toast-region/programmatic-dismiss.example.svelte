<script lang="ts" module>
  export const title = 'Programmatic dismiss';
  export const description =
    'show() returns the toast id. Capture it to dismiss a specific toast later, or call dismissAll() to clear both stacks at once.';
</script>

<script lang="ts">
  import { Button, ToastRegion, useToast } from '../../../../components/src/index.ts';
</script>

<ToastRegion>
  {#snippet children()}
    {@const toast = useToast()}
    {@const lastId = { value: null as string | null }}
    <div class="example-preview-row">
      <Button
        label="Show sticky"
        onclick={() => {
          lastId.value = toast.show('Sticky toast — will not auto-dismiss.', { duration: 0 });
        }}
      />
      <Button
        label="Dismiss last"
        variant="secondary"
        onclick={() => {
          if (lastId.value) toast.dismiss(lastId.value);
        }}
      />
      <Button label="Dismiss all" variant="danger" onclick={() => toast.dismissAll()} />
    </div>
  {/snippet}
</ToastRegion>

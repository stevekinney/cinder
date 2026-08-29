<script lang="ts" module>
  export const title = 'Basic form';
  export const description = 'Native form submission with Cinder controls.';
</script>

<script lang="ts">
  import { Form } from '@lostgradient/cinder/form';
  import { Input } from '@lostgradient/cinder/input';
</script>

<Form onSubmit={() => undefined}>
  {#snippet children({ submitting })}
    <Input id="form-name" label="Name" value="" disabled={submitting}>
      {#snippet leading()}{/snippet}
      {#snippet trailing()}{/snippet}
    </Input>
    <button type="submit" disabled={submitting}>Save</button>
  {/snippet}
</Form>

<script lang="ts" module>
  export const title = 'Indeterminate checkbox';
  export const description =
    'A parent checkbox driven by its children. Indeterminate clears once the user toggles checked.';
</script>

<script lang="ts">
  import { Checkbox } from '@lostgradient/cinder/checkbox';
  let red = $state(true);
  let green = $state(false);
  let blue = $state(true);

  let allChecked = $derived(red && green && blue);
  let someChecked = $derived(red || green || blue);
  let parentIndeterminate = $derived(someChecked && !allChecked);

  function toggleAll(checked: boolean) {
    red = checked;
    green = checked;
    blue = checked;
  }
</script>

<div style="display: flex; flex-direction: column; gap: 0.5rem;">
  <Checkbox
    id="checkbox-parent"
    label="All colors"
    checked={allChecked}
    indeterminate={parentIndeterminate}
    onchange={(event) => toggleAll((event.currentTarget as HTMLInputElement).checked)}
  />
  <div style="padding-inline-start: 1.5rem; display: flex; flex-direction: column; gap: 0.4rem;">
    <Checkbox id="checkbox-red" label="Red" bind:checked={red} />
    <Checkbox id="checkbox-green" label="Green" bind:checked={green} />
    <Checkbox id="checkbox-blue" label="Blue" bind:checked={blue} />
  </div>
</div>

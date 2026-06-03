<script lang="ts" module>
  export const title = 'Basic drawer';
  export const description =
    'An edge-anchored slide-in panel with controls for side, size, and triggerRef.';
</script>

<script lang="ts">
  import { Button } from 'cinder/button';
  import { Checkbox } from 'cinder/checkbox';
  import { Drawer } from 'cinder/drawer';
  import type { DrawerSide, DrawerSize } from 'cinder/drawer';
  import { Select } from 'cinder/select';
  let open = $state(false);
  let triggerRef: HTMLElement | null = $state(null);
  let side = $state<DrawerSide>('right');
  let size = $state<DrawerSize>('md');
  let useTriggerRef = $state(true);

  const sideOptions: { value: DrawerSide; label: string }[] = [
    { value: 'right', label: 'right' },
    { value: 'left', label: 'left' },
  ];
  const sizeOptions: { value: DrawerSize; label: string }[] = [
    { value: 'sm', label: 'sm' },
    { value: 'md', label: 'md' },
    { value: 'lg', label: 'lg' },
    { value: 'xl', label: 'xl' },
  ];
</script>

<div style="display: flex; flex-direction: column; gap: 1rem; max-width: 32rem;">
  <div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end;">
    <Select id="drawer-side" bind:value={side} options={sideOptions} label="Side" />
    <Select id="drawer-size" bind:value={size} options={sizeOptions} label="Size" />
    <Checkbox id="drawer-use-trigger-ref" bind:checked={useTriggerRef} label="Use triggerRef" />
  </div>

  <Button
    label="Open drawer"
    onclick={(event) => {
      triggerRef = useTriggerRef ? event.currentTarget : null;
      open = true;
    }}
  />
</div>

<Drawer bind:open {side} {size} title="Drawer panel" triggerRef={useTriggerRef ? triggerRef : null}>
  <p>This is the drawer body. You can put any content here.</p>
  <p>Current settings: side={side}, size={size}.</p>

  {#snippet footer()}
    <div style="display: flex; gap: 0.5rem;">
      <Button variant="secondary" label="Cancel" onclick={() => (open = false)} />
      <Button label="Confirm" onclick={() => (open = false)} />
    </div>
  {/snippet}
</Drawer>

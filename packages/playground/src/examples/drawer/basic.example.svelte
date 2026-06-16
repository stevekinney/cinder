<script lang="ts" module>
  export const title = 'Basic drawer';
  export const description =
    'An edge-anchored slide-in panel with controls for side, size, and triggerRef.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { Checkbox } from '@lostgradient/cinder/checkbox';
  import { Drawer } from '@lostgradient/cinder/drawer';
  import type { DrawerSide, DrawerSize } from '@lostgradient/cinder/drawer';
  import { Select } from '@lostgradient/cinder/select';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let sideId = $derived(`${mountIdPrefix ?? uid}-side`);
  let sizeId = $derived(`${mountIdPrefix ?? uid}-size`);
  let useTriggerRefId = $derived(`${mountIdPrefix ?? uid}-use-trigger-ref`);

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
    <Select id={sideId} bind:value={side} options={sideOptions} label="Side" />
    <Select id={sizeId} bind:value={size} options={sizeOptions} label="Size" />
    <Checkbox id={useTriggerRefId} bind:checked={useTriggerRef} label="Use triggerRef" />
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

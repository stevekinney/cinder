<script lang="ts" module>
  export const title = 'Basic drawer';
  export const description =
    'An edge-anchored slide-in panel with controls for side, size, footer, and triggerRef.';
</script>

<script lang="ts">
  import { Button, Drawer } from '../../../../components/src/index.ts';
  import type { DrawerSide, DrawerSize } from '../../../../components/src/index.ts';

  let open = $state(false);
  let triggerRef: HTMLElement | null = $state(null);
  let side = $state<DrawerSide>('right');
  let size = $state<DrawerSize>('md');
  let showFooter = $state(true);
  let useTriggerRef = $state(true);
</script>

<div style="display: flex; flex-direction: column; gap: 1rem; max-width: 32rem;">
  <div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end;">
    <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.875rem;">
      Side
      <select
        value={side}
        onchange={(e) => (side = (e.currentTarget as HTMLSelectElement).value as DrawerSide)}
        style="padding: 0.25rem 0.5rem; border-radius: 0.375rem; border: 1px solid #d1d5db;"
      >
        <option value="right">right</option>
        <option value="left">left</option>
      </select>
    </label>

    <label style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.875rem;">
      Size
      <select
        value={size}
        onchange={(e) => (size = (e.currentTarget as HTMLSelectElement).value as DrawerSize)}
        style="padding: 0.25rem 0.5rem; border-radius: 0.375rem; border: 1px solid #d1d5db;"
      >
        <option value="sm">sm</option>
        <option value="md">md</option>
        <option value="lg">lg</option>
        <option value="xl">xl</option>
      </select>
    </label>

    <label
      style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; cursor: pointer;"
    >
      <input type="checkbox" bind:checked={showFooter} />
      Show footer
    </label>

    <label
      style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; cursor: pointer;"
    >
      <input type="checkbox" bind:checked={useTriggerRef} />
      Use triggerRef
    </label>
  </div>

  <Button
    label="Open drawer"
    onclick={(event) => {
      triggerRef = useTriggerRef ? event.currentTarget : null;
      open = true;
    }}
  />
</div>

<Drawer
  bind:open
  {side}
  {size}
  title="Drawer panel"
  triggerRef={useTriggerRef ? triggerRef : null}
  {footer}
>
  <p>This is the drawer body. You can put any content here.</p>
  <p>Current settings: side={side}, size={size}.</p>
</Drawer>

{#snippet footer()}
  {#if showFooter}
    <div style="display: flex; gap: 0.5rem;">
      <Button variant="secondary" label="Cancel" onclick={() => (open = false)} />
      <Button label="Confirm" onclick={() => (open = false)} />
    </div>
  {/if}
{/snippet}

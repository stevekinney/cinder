<script lang="ts" module>
  export const title = 'Basic popover';
  export const description =
    'A button trigger that opens an interactive floating panel. Anchor positioning via floating-ui; focus moves into the panel on open and restores to the trigger on close.';
</script>

<script lang="ts">
  import { Popover } from 'cinder/popover';
  let open = $state(false);
  let triggerEl: HTMLButtonElement | null = $state(null);
</script>

<div style="padding: 4rem; display: flex; flex-direction: column; gap: 1rem;">
  <button type="button" bind:this={triggerEl} onclick={() => (open = !open)}>
    Toggle popover
  </button>

  <Popover bind:open triggerRef={triggerEl} label="Account settings" showArrow>
    <div style="display: flex; flex-direction: column; gap: 0.5rem; min-width: 14rem;">
      <strong>Account</strong>
      <p style="margin: 0; font-size: 0.875rem; color: var(--cinder-text-muted, currentColor);">
        Edit your profile, manage billing, or sign out.
      </p>
      <button type="button" onclick={() => (open = false)}>Edit profile</button>
      <button type="button" onclick={() => (open = false)}>Sign out</button>
    </div>
  </Popover>
</div>

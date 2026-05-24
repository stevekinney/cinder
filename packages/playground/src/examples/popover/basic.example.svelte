<script lang="ts" module>
  export const title = 'Basic popover';
  export const description =
    'A button trigger that opens an interactive floating panel. Anchor positioning via floating-ui; focus moves into the panel on open and restores to the trigger on close.';
</script>

<script lang="ts">
  import { Button } from 'cinder/button';
  import { Popover } from 'cinder/popover';

  const popoverHeadingId = 'account-settings-popover-title';

  let open = $state(false);
</script>

<div style="padding: 4rem; display: flex; flex-direction: column; gap: 1rem;">
  <Popover bind:open ariaLabelledby={popoverHeadingId} showArrow>
    {#snippet trigger()}
      <Button label="Toggle popover" onclick={() => (open = !open)} />
    {/snippet}

    <div style="display: flex; flex-direction: column; gap: 0.5rem; min-width: 14rem;">
      <h2
        id={popoverHeadingId}
        style="margin: 0; font-size: var(--cinder-text-sm); color: var(--cinder-text);"
      >
        Account settings
      </h2>
      <p style="margin: 0; font-size: 0.875rem; color: var(--cinder-text-muted, currentColor);">
        Edit your profile, manage billing, or sign out.
      </p>
      <Button variant="secondary" label="Edit profile" onclick={() => (open = false)} />
      <Button variant="ghost-danger" label="Sign out" onclick={() => (open = false)} />
    </div>
  </Popover>
</div>

<script lang="ts" module>
  export const title = 'Basic popover';
  export const description =
    'A button trigger that opens a floating panel. The panel preserves focus on the trigger — use focusManagement="panel" when the panel contains a form or search input that needs immediate keyboard access.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { Popover } from '@lostgradient/cinder/popover';

  const popoverHeadingId = 'account-settings-popover-title';

  let open = $state(false);
</script>

<!--
  align-items: flex-start prevents the Popover (and its trigger Button) from
  stretching to the full container width. Without it, the trigger Button becomes
  a wide bar and the panel arrow no longer aligns to the trigger center.
-->
<div
  style="padding: 4rem; display: flex; flex-direction: column; align-items: flex-start; gap: 1rem;"
>
  <!--
    focusManagement="preserve" keeps focus on the trigger after open.
    Use the default "panel" when the panel contains a form or requires
    immediate keyboard interaction (e.g. a search input or date picker).
  -->
  <Popover bind:open ariaLabelledby={popoverHeadingId} showArrow focusManagement="preserve">
    {#snippet trigger()}
      <Button label="Account settings" onclick={() => (open = !open)} />
    {/snippet}

    <div
      style="display: flex; flex-direction: column; gap: var(--cinder-space-2); min-width: 14rem;"
    >
      <h2
        id={popoverHeadingId}
        style="margin: 0; font-size: var(--cinder-text-sm); font-weight: var(--cinder-font-semibold); color: var(--cinder-text);"
      >
        Account settings
      </h2>
      <p style="margin: 0; font-size: var(--cinder-text-xs); color: var(--cinder-text-muted);">
        Edit your profile, manage billing, or sign out.
      </p>
      <Button variant="secondary" label="Edit profile" onclick={() => (open = false)} />
      <Button variant="ghost-danger" label="Sign out" onclick={() => (open = false)} />
    </div>
  </Popover>
</div>

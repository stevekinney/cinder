<script lang="ts" module>
  export const title = 'Presence state';
  export const description =
    'Coordinates CSS-driven enter and exit states while keeping the wrapper mounted through the outro.';
</script>

<script lang="ts">
  import { Button, Presence } from 'cinder';

  let open = $state(false);
</script>

<Button onclick={() => (open = !open)}>
  {open ? 'Hide presence' : 'Show presence'}
</Button>

<Presence
  present={open}
  style="
    display: block;
    margin-block-start: var(--cinder-space-4);
    opacity: {open ? 1 : 0};
    transform: translateY({open ? 0 : '-0.25rem'});
    transition:
      opacity 180ms ease,
      transform 180ms ease;
  "
>
  <div
    style="
      padding: var(--cinder-space-4);
      border: 1px solid var(--cinder-border);
      border-radius: var(--cinder-radius-lg);
      background: var(--cinder-surface-raised);
    "
  >
    This card exits only after its CSS transition finishes.
  </div>
</Presence>

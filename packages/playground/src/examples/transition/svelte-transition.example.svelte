<script lang="ts" module>
  export const title = 'Svelte transition';
  export const description =
    'Uses a [Svelte transition](https://svelte.dev/docs/svelte-transition) function through the headless Transition wrapper.';
</script>

<script lang="ts">
  import { Button, Transition } from 'cinder';

  let open = $state(false);

  function fade(_node: Element) {
    return {
      duration: 200,
      css: (t: number) => `opacity: ${t};`,
    };
  }
</script>

<Button onclick={() => (open = !open)}>
  {open ? 'Hide fade transition' : 'Show fade transition'}
</Button>

<Transition show={open} transition={fade} transitionParameters={{ duration: 200 }}>
  <div
    style="
      margin-block-start: var(--cinder-space-4);
      padding: var(--cinder-space-4);
      border: 1px solid var(--cinder-border);
      border-radius: var(--cinder-radius-lg);
      background: var(--cinder-surface-raised);
    "
  >
    This example uses a Svelte transition function.
  </div>
</Transition>

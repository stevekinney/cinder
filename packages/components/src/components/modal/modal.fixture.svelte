<script lang="ts">
  import { Modal } from './index.ts';

  type FixtureProps = {
    describedById?: string;
    open?: boolean;
    title?: string;
  };

  let { describedById, open = true, title = 'Fixture dialog' }: FixtureProps = $props();
  let modalOpen = $state(open);
  let triggerRef: HTMLButtonElement | null = $state(null);
</script>

<div class="modal-fixture">
  <button bind:this={triggerRef} class="modal-fixture__trigger" type="button">
    Open fixture modal
  </button>

  {#if describedById}
    <Modal bind:open={modalOpen} {title} {triggerRef} {describedById}>
      <p id={describedById}>
        This dialog includes a description so aria-describedby can be captured in the visual
        fixture.
      </p>

      {#snippet footer()}
        <button class="modal-fixture__action" type="button" onclick={() => (modalOpen = false)}>
          Cancel
        </button>
        <button
          class="modal-fixture__action modal-fixture__action--primary"
          type="button"
          onclick={() => (modalOpen = false)}
        >
          Save changes
        </button>
      {/snippet}
    </Modal>
  {:else}
    <Modal bind:open={modalOpen} {title} {triggerRef}>
      <p>This dialog body is supplied by the host fixture.</p>

      {#snippet footer()}
        <button class="modal-fixture__action" type="button" onclick={() => (modalOpen = false)}>
          Cancel
        </button>
        <button
          class="modal-fixture__action modal-fixture__action--primary"
          type="button"
          onclick={() => (modalOpen = false)}
        >
          Save changes
        </button>
      {/snippet}
    </Modal>
  {/if}
</div>

<style>
  .modal-fixture {
    display: grid;
    min-block-size: 12rem;
    place-items: start;
  }

  .modal-fixture__trigger {
    border: 1px solid var(--cinder-border);
    border-radius: 0.375rem;
    background: var(--cinder-surface);
    color: var(--cinder-text);
    font: inherit;
    padding: 0.5rem 0.75rem;
  }

  .modal-fixture__action {
    border: 1px solid var(--cinder-border);
    border-radius: 0.375rem;
    background: var(--cinder-surface);
    color: var(--cinder-text);
    font: inherit;
    padding: 0.5rem 0.75rem;
  }

  .modal-fixture__action--primary {
    background: var(--cinder-accent);
    color: var(--cinder-accent-contrast);
  }
</style>

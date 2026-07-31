<script lang="ts">
  import { Modal } from './index.ts';
  import { Popover } from '../popover/index.ts';
  import { untrack } from 'svelte';

  type FixtureProps = {
    describedById?: string;
    open?: boolean;
    anchoredOverlay?: boolean;
    title?: string;
  };

  let {
    describedById,
    open = true,
    anchoredOverlay = false,
    title = 'Fixture dialog',
  }: FixtureProps = $props();
  let modalOpen = $state(untrack(() => open));
  let overlayOpen = $state(untrack(() => anchoredOverlay));
  let triggerRef: HTMLButtonElement | null = $state(null);
  let overlayTriggerRef: HTMLButtonElement | null = $state(null);
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
        {#if anchoredOverlay}
          <Popover
            bind:open={overlayOpen}
            triggerRef={overlayTriggerRef}
            placement="bottom"
            label="Dialog-owned anchored overlay"
            focusManagement="preserve"
          >
            {#snippet trigger()}
              <button bind:this={overlayTriggerRef} class="modal-fixture__action" type="button">
                Anchored overlay trigger
              </button>
            {/snippet}

            <div class="modal-fixture__overlay-content">
              Dialog-owned overlay content remains visible beyond the panel boundary.
            </div>
          </Popover>
        {/if}
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
        {#if anchoredOverlay}
          <Popover
            bind:open={overlayOpen}
            triggerRef={overlayTriggerRef}
            placement="bottom"
            label="Dialog-owned anchored overlay"
            focusManagement="preserve"
          >
            {#snippet trigger()}
              <button bind:this={overlayTriggerRef} class="modal-fixture__action" type="button">
                Anchored overlay trigger
              </button>
            {/snippet}

            <div class="modal-fixture__overlay-content">
              Dialog-owned overlay content remains visible beyond the panel boundary.
            </div>
          </Popover>
        {/if}
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

  .modal-fixture__overlay-content {
    min-width: 18rem;
    max-width: 24rem;
    padding: 1rem;
  }
</style>

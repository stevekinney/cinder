<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status beta
   * @purpose Context-scoped host for imperative Modal registration and promise-returning confirmations.
   * @useWhen Application code must open deduplicated modals or await a confirmation result imperatively.
   * @avoidWhen A single declarative modal is sufficient; use Modal directly.
   * @related modal, confirm-dialog
   * @rationale Nearest alternative: Modal owns one declarative surface; this owns an imperative modal registry.
   */
  export type { ModalRegionProps } from './modal-region.types.ts';
</script>

<script lang="ts">
  import { onDestroy, type Component } from 'svelte';
  import ConfirmDialog from '../confirm-dialog/confirm-dialog.svelte';
  import Modal from '../modal/modal.svelte';
  import {
    setModalContext,
    type ModalEntry,
    type ModalApi,
    type ModalComponent,
    type OpenModalOptions,
  } from '../../_internal/modal-context.ts';
  import type { ModalRegionProps } from './modal-region.types.ts';

  let { children }: ModalRegionProps = $props();
  let entries = $state<ModalEntry[]>([]);
  let sequence = 0;
  let destroyed = false;

  const api: ModalApi = {
    openModal<T extends Record<string, unknown>>(
      component: Component<T>,
      props: Omit<T, 'modal'> & { id?: string },
      options: OpenModalOptions,
    ) {
      if (destroyed) return Promise.resolve(undefined);
      const typedProps = props as Record<string, unknown> & { id?: string };
      const id = typeof typedProps.id === 'string' ? typedProps.id : `cinder-modal-${++sequence}`;
      const duplicate = entries.find((entry) => entry.id === id);
      if (duplicate?.promise) return duplicate.promise;
      let resolver: (value: unknown) => void = () => {};
      const promise = new Promise<unknown>((resolve) => {
        resolver = resolve;
      });
      entries = [
        ...entries,
        {
          id,
          component: component as ModalComponent,
          props: { ...typedProps },
          title: options.title,
          resolve: resolver,
          promise,
        },
      ];
      return promise;
    },
    confirm(options) {
      if (destroyed) return Promise.resolve(false);
      const id = options.id ?? `cinder-confirm-${++sequence}`;
      const promise = api.openModal(
        ConfirmDialog,
        {
          ...options,
          id,
          open: true,
          confirmLabel: options.confirmLabel ?? 'Confirm',
          onConfirm: () => finish(id, true),
          onCancel: () => finish(id, false),
        },
        { title: options.title },
      ) as Promise<boolean>;
      const entry = entries.find((candidate) => candidate.id === id);
      if (entry) {
        entry.ownsModal = true;
        entry.confirmation = true;
        entries = [...entries];
      }
      return promise;
    },
  };

  function finish(id: string | undefined, value: unknown): void {
    const entry = entries.find((candidate) => candidate.id === (id ?? entries.at(-1)?.id));
    if (!entry || entry.settled) return;
    entry.settled = true;
    entry.resolve(value);
    entries = [...entries];
  }

  function remove(id: string): void {
    entries = entries.filter((entry) => entry.id !== id);
  }

  setModalContext(api);
  onDestroy(() => {
    destroyed = true;
    for (const entry of entries) entry.resolve(entry.confirmation ? false : undefined);
    entries = [];
  });
</script>

{@render children?.()}
{#each entries as entry (entry.id)}
  {@const Component = entry.component}
  {#if entry.ownsModal}
    <Component
      {...entry.props}
      open={!entry.settled}
      onDismiss={() => finish(entry.id, false)}
      onExitComplete={() => remove(entry.id)}
    />
  {:else}
    <Modal
      open={!entry.settled}
      title={entry.title}
      onDismiss={() => finish(entry.id, false)}
      onExitComplete={() => remove(entry.id)}
    >
      <Component
        {...entry.props}
        open={!entry.settled}
        modal={{
          resolve: (value: unknown) => finish(entry.id, value),
          close: () => finish(entry.id, undefined),
        }}
      />
    </Modal>
  {/if}
{/each}

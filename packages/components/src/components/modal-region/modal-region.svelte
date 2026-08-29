<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status beta
   * @purpose Context-scoped host for imperative Modal registration and promise-returning confirmations.
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
  } from '../../_internal/modal-context.ts';
  import type { ModalRegionProps } from './modal-region.types.ts';

  let { children }: ModalRegionProps = $props();
  let entries = $state<ModalEntry[]>([]);
  let sequence = 0;
  let destroyed = false;

  const api: ModalApi = {
    openModal<T extends Record<string, unknown>>(
      component: Component<T>,
      props = {} as T & { id?: string },
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
          resolve: resolver,
          promise,
        },
      ];
      return promise;
    },
    confirm(options) {
      const id = options.id ?? `cinder-confirm-${++sequence}`;
      const promise = api.openModal(ConfirmDialog, {
        ...options,
        id,
        open: true,
        confirmLabel: options.confirmLabel ?? 'Confirm',
        onConfirm: () => finish(id, true),
        onCancel: () => finish(id, false),
      }) as Promise<boolean>;
      const entry = entries.find((candidate) => candidate.id === id);
      if (entry) {
        entry.ownsModal = true;
        entries = [...entries];
      }
      return promise;
    },
  };

  function finish(id: string | undefined, value: unknown): void {
    const entry = entries.find((candidate) => candidate.id === (id ?? entries.at(-1)?.id));
    if (!entry) return;
    entries = entries.filter((candidate) => candidate !== entry);
    entry.resolve(value);
  }

  setModalContext(api);
  onDestroy(() => {
    destroyed = true;
    for (const entry of entries) entry.resolve(undefined);
    entries = [];
  });
</script>

{@render children?.()}
{#each entries as entry (entry.id)}
  {@const Component = entry.component}
  {#if entry.ownsModal}
    <Component {...entry.props} open={true} />
  {:else}
    <Modal
      open={true}
      title={typeof entry.props['title'] === 'string' ? entry.props['title'] : 'Dialog'}
      onDismiss={() => finish(entry.id, false)}
    >
      <Component {...entry.props} open={true} />
    </Modal>
  {/if}
{/each}

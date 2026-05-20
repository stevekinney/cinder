<script lang="ts" module>
  import { TOAST_CONTEXT_KEY } from '../../_internal/toast-context.ts';

  // Re-export so consumers using the public package surface get a single
  // import path; internal modules import directly from _internal.
  export { TOAST_CONTEXT_KEY };
  export type {
    ToastApi,
    ToastItem,
    ToastOptions,
    ToastVariant,
    ToastRegionProps,
  } from './toast-region.types.ts';
</script>

<script lang="ts">
  import { onDestroy, setContext } from 'svelte';

  import { cn } from '../../utilities/class-names.ts';
  import type {
    ToastApi,
    ToastItem,
    ToastOptions,
    ToastRegionProps,
    ToastVariant,
  } from './toast-region.types.ts';

  let {
    maxStack = 5,
    defaultDuration = 5000,
    class: className,
    children,
  }: ToastRegionProps = $props();

  // Hydration gate — ToastRegion renders nothing on the server (per overlay
  // policy: client-only state must not appear in SSR markup).
  let hydrated = $state(false);
  $effect(() => {
    hydrated = true;
  });

  // Two regions, two stacks. Polite for info/success; assertive for warning/danger.
  let politeStack: ToastItem[] = $state([]);
  let assertiveStack: ToastItem[] = $state([]);

  // Track auto-dismiss timers so we can cancel on dismiss / unmount.
  const timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  let nextId = 0;

  function isPolite(variant: ToastVariant): boolean {
    return variant === 'info' || variant === 'success';
  }

  function findStack(id: string): ToastItem[] | null {
    if (politeStack.some((t) => t.id === id)) return politeStack;
    if (assertiveStack.some((t) => t.id === id)) return assertiveStack;
    return null;
  }

  function show(message: string, options: ToastOptions = {}): string {
    const id = options.id ?? `cinder-toast-${++nextId}`;
    const variant = options.variant ?? 'info';
    const duration = options.duration ?? defaultDuration;
    const dismissible = options.dismissible ?? true;
    const item: ToastItem = {
      id,
      message,
      variant,
      duration,
      dismissible,
      ...(options.action ? { action: options.action } : {}),
    };

    // Deduplication: if an id is already active, replace the existing entry.
    const stack = isPolite(variant) ? politeStack : assertiveStack;
    const existingIndex = stack.findIndex((t) => t.id === id);
    if (existingIndex !== -1) {
      stack[existingIndex] = item;
    } else {
      stack.push(item);
      if (stack.length > maxStack) {
        const dropped = stack.shift();
        if (dropped) clearTimer(dropped.id);
      }
    }

    if (isPolite(variant)) {
      politeStack = [...stack];
    } else {
      assertiveStack = [...stack];
    }

    if (duration > 0) {
      clearTimer(id);
      timers.set(
        id,
        setTimeout(() => {
          dismiss(id);
        }, duration),
      );
    }

    return id;
  }

  function dismiss(id: string): void {
    clearTimer(id);
    politeStack = politeStack.filter((t) => t.id !== id);
    assertiveStack = assertiveStack.filter((t) => t.id !== id);
  }

  function dismissAll(): void {
    for (const id of timers.keys()) clearTimer(id);
    politeStack = [];
    assertiveStack = [];
  }

  function clearTimer(id: string): void {
    const handle = timers.get(id);
    if (handle !== undefined) {
      clearTimeout(handle);
      timers.delete(id);
    }
  }

  function handleActionClick(item: ToastItem): void {
    if (!item.action) return;
    item.action.onAction();
    if (!item.action.keepOpen) {
      dismiss(item.id);
    }
  }

  setContext<ToastApi>(TOAST_CONTEXT_KEY, { show, dismiss, dismissAll });

  onDestroy(() => {
    // Tear down timers so unmounting the region (e.g., during route change)
    // doesn't leak timers that fire later and try to mutate disposed state.
    for (const id of timers.keys()) clearTimer(id);
  });
  // Reference findStack so the linter doesn't drop it; reserved for future
  // diagnostics that need to know which region holds a given toast.
  void findStack;
</script>

{#if children}
  {@render children()}
{/if}

{#if hydrated}
  <div
    class={cn('cinder-toast-region', className)}
    aria-label="Notifications"
    data-cinder-stack="polite"
  >
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-relevant="additions"
      class="cinder-toast-region__channel"
    >
      {#each politeStack as toast (toast.id)}
        <div
          class="cinder-toast"
          data-cinder-variant={toast.variant}
          data-cinder-toast-id={toast.id}
        >
          <div class="cinder-toast__message">{toast.message}</div>
          {#if toast.action}
            <button
              type="button"
              class="cinder-toast__action"
              onclick={() => handleActionClick(toast)}
            >
              {toast.action.label}
            </button>
          {/if}
          {#if toast.dismissible}
            <button
              type="button"
              class="cinder-toast__dismiss"
              aria-label="Dismiss notification"
              onclick={() => dismiss(toast.id)}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
                />
              </svg>
            </button>
          {/if}
        </div>
      {/each}
    </div>
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      aria-relevant="additions"
      class="cinder-toast-region__channel"
      data-cinder-stack="assertive"
    >
      {#each assertiveStack as toast (toast.id)}
        <div
          class="cinder-toast"
          data-cinder-variant={toast.variant}
          data-cinder-toast-id={toast.id}
        >
          <div class="cinder-toast__message">{toast.message}</div>
          {#if toast.action}
            <button
              type="button"
              class="cinder-toast__action"
              onclick={() => handleActionClick(toast)}
            >
              {toast.action.label}
            </button>
          {/if}
          {#if toast.dismissible}
            <button
              type="button"
              class="cinder-toast__dismiss"
              aria-label="Dismiss notification"
              onclick={() => dismiss(toast.id)}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
                />
              </svg>
            </button>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}

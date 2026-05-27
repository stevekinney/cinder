<script lang="ts" module>
  /**
   * @cinder
   * @category feedback
   * @status stable
   * @purpose Provider region that hosts polite and assertive toast stacks and exposes an imperative show/dismiss API via context.
   * @tag feedback
   * @tag toast
   * @useWhen Surfacing transient, non-blocking confirmations or errors that auto-dismiss after a short duration.
   * @useWhen Announcing the outcome of a background action that the user does not need to acknowledge.
   * @avoidWhen Communicating a persistent page-level message — use banner so it stays until dismissed.
   * @avoidWhen Reporting an urgent error that must remain on screen — use alert.
   * @related alert, banner
   */
  import { TOAST_CONTEXT_KEY } from '../../_internal/toast-context.ts';

  // Re-export so consumers using the public package surface get a single
  // import path; internal modules import directly from _internal.
  export { TOAST_CONTEXT_KEY };
  export type {
    ToastApi,
    ToastItem,
    ToastOptions,
    ToastPosition,
    ToastVariant,
    ToastRegionProps,
  } from './toast-region.types.ts';
</script>

<script lang="ts">
  import { onDestroy, setContext } from 'svelte';
  import type { Attachment } from 'svelte/attachments';

  import { pushEscapeHandler } from '../../_internal/overlay.ts';
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
    position = 'bottom-right',
    class: className,
    children,
  }: ToastRegionProps = $props();

  type InternalShowOptions = ToastOptions & { pending?: boolean };
  type DismissReason =
    | 'action'
    | 'dismissAll'
    | 'dismissButton'
    | 'keyboard'
    | 'overflow'
    | 'programmatic'
    | 'swipe'
    | 'timer';

  type TimerRecord = {
    handle: ReturnType<typeof setTimeout> | null;
    remaining: number;
    startedAt: number;
  };
  type InternalToastItem = ToastItem & {
    pending?: boolean;
    leaving?: boolean;
    generation: number;
    swipeX?: number;
  };

  // Hydration gate — toast live regions are client-only, but wrapped app
  // content and the context provider still render during SSR.
  let hydrated = $state(false);
  $effect(() => {
    hydrated = true;
  });

  // Two regions, two stacks. Polite for info/success; assertive for warning/danger.
  let politeStack: InternalToastItem[] = $state([]);
  let assertiveStack: InternalToastItem[] = $state([]);

  // Track auto-dismiss timers so we can cancel on dismiss / unmount.
  const timers: Map<string, TimerRecord> = new Map();
  const removalTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  const generations: Map<string, number> = new Map();
  let regionElement: HTMLElement | null = $state(null);
  let nextId = 0;
  let isPointerInsideRegion = false;
  let isFocusInsideRegion = false;
  let destroyed = false;
  let releaseFocusedToastEscape: (() => void) | null = null;

  function isPolite(variant: ToastVariant): boolean {
    return variant === 'info' || variant === 'success';
  }

  function getCurrentStack(variant: ToastVariant): InternalToastItem[] {
    return isPolite(variant) ? politeStack : assertiveStack;
  }

  function setCurrentStack(variant: ToastVariant, stack: InternalToastItem[]): void {
    if (isPolite(variant)) {
      politeStack = stack;
    } else {
      assertiveStack = stack;
    }
  }

  function findToast(id: string): InternalToastItem | undefined {
    return (
      politeStack.find((toast) => toast.id === id) ??
      assertiveStack.find((toast) => toast.id === id)
    );
  }

  function nextGeneration(id: string): number {
    const generation = (generations.get(id) ?? 0) + 1;
    generations.set(id, generation);
    return generation;
  }

  function invalidateGeneration(id: string): void {
    generations.set(id, (generations.get(id) ?? 0) + 1);
  }

  function removeFromBothStacks(id: string): void {
    politeStack = politeStack.filter((toast) => toast.id !== id);
    assertiveStack = assertiveStack.filter((toast) => toast.id !== id);
  }

  function shouldPauseTimers(): boolean {
    return isPointerInsideRegion || isFocusInsideRegion;
  }

  function show(message: string, options: ToastOptions = {}): string {
    if (destroyed) return options.id ?? `cinder-toast-${++nextId}`;
    return upsertToast(message, options).id;
  }

  function upsertToast(message: string, options: InternalShowOptions = {}): InternalToastItem {
    const id = options.id ?? `cinder-toast-${++nextId}`;
    const variant = options.variant ?? 'info';
    const duration = options.duration ?? defaultDuration;
    const dismissible = options.dismissible ?? true;
    clearTimer(id);
    clearRemovalTimer(id);
    removeFromBothStacks(id);

    const item: InternalToastItem = {
      id,
      message,
      variant,
      duration,
      dismissible,
      generation: nextGeneration(id),
      pending: options.pending ?? false,
      leaving: false,
      ...(options.icon ? { icon: options.icon } : {}),
      ...(options.action ? { action: options.action } : {}),
    };

    setCurrentStack(variant, [...getCurrentStack(variant), item]);

    dismissOverflow(variant);

    if (duration > 0) {
      armTimer(id, duration);
    }

    return item;
  }

  function dismissOverflow(variant: ToastVariant): void {
    const stack = getCurrentStack(variant);
    const activeToasts = stack.filter((toast) => !toast.leaving);
    if (activeToasts.length <= maxStack) return;

    const oldest = activeToasts[0];
    if (oldest) beginDismiss(oldest.id, 'overflow');
  }

  function dismiss(id: string): void {
    beginDismiss(id, 'programmatic');
  }

  function dismissAll(): void {
    const ids = [...politeStack, ...assertiveStack]
      .filter((toast) => !toast.leaving)
      .map((toast) => toast.id);
    for (const id of ids) beginDismiss(id, 'dismissAll');
  }

  function clearTimer(id: string): void {
    const record = timers.get(id);
    if (record) {
      if (record.handle) clearTimeout(record.handle);
      timers.delete(id);
    }
  }

  function clearRemovalTimer(id: string): void {
    const handle = removalTimers.get(id);
    if (handle) {
      clearTimeout(handle);
      removalTimers.delete(id);
    }
  }

  function armTimer(id: string, duration: number): void {
    if (duration <= 0) return;
    const record: TimerRecord = {
      handle: null,
      remaining: duration,
      startedAt: performance.now(),
    };
    timers.set(id, record);
    if (shouldPauseTimers()) {
      record.handle = null;
      return;
    }
    record.handle = setTimeout(() => beginDismiss(id, 'timer'), duration);
  }

  function pauseAllTimers(): void {
    for (const record of timers.values()) {
      if (!record.handle) continue;
      clearTimeout(record.handle);
      record.handle = null;
      record.remaining = Math.max(0, record.remaining - (performance.now() - record.startedAt));
    }
  }

  function resumeAllTimers(): void {
    if (shouldPauseTimers()) return;
    for (const [id, record] of timers.entries()) {
      if (record.handle) continue;
      if (record.remaining <= 0) {
        beginDismiss(id, 'timer');
        continue;
      }
      record.startedAt = performance.now();
      record.handle = setTimeout(() => beginDismiss(id, 'timer'), record.remaining);
    }
  }

  function setRegionPointerInside(nextValue: boolean): void {
    isPointerInsideRegion = nextValue;
    if (shouldPauseTimers()) {
      pauseAllTimers();
    } else {
      resumeAllTimers();
    }
  }

  function handleRegionFocusIn(): void {
    isFocusInsideRegion = true;
    pauseAllTimers();
    synchronizeFocusedToastEscapeHandler();
  }

  function handleRegionFocusOut(event: FocusEvent): void {
    const currentTarget = event.currentTarget;
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && currentTarget instanceof Node) {
      if (currentTarget.contains(nextTarget)) return;
      isFocusInsideRegion = false;
      releaseToastEscapeHandler();
      resumeAllTimers();
      return;
    }

    queueMicrotask(() => {
      if (!(currentTarget instanceof Node)) return;
      isFocusInsideRegion = currentTarget.contains(document.activeElement);
      synchronizeFocusedToastEscapeHandler();
      if (!isFocusInsideRegion) resumeAllTimers();
    });
  }

  function getToastElement(id: string): HTMLElement | null {
    return regionElement?.querySelector(`[data-cinder-toast-id="${CSS.escape(id)}"]`) ?? null;
  }

  function prefersReducedMotion(): boolean {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  function beginDismiss(id: string, reason: DismissReason): void {
    const item = findToast(id);
    if (!item || item.leaving) return;

    clearTimer(id);
    invalidateGeneration(id);

    const element = getToastElement(id);
    if (element && !prefersReducedMotion()) {
      const shell = element.closest<HTMLElement>('.cinder-toast-shell');
      shell?.style.setProperty('--cinder-toast-height', `${shell.offsetHeight}px`);
    }

    const focusNeedsMove = element?.contains(document.activeElement) ?? false;
    item.leaving = true;
    item.swipeX = 0;
    politeStack = [...politeStack];
    assertiveStack = [...assertiveStack];

    if (focusNeedsMove) moveFocusAfterDismiss(id, reason);

    const generation = item.generation;
    if (prefersReducedMotion()) {
      queueMicrotask(() => reallyRemove(id, generation));
      return;
    }

    clearRemovalTimer(id);
    removalTimers.set(
      id,
      setTimeout(() => reallyRemove(id, generation), 220),
    );
  }

  function reallyRemove(id: string, generation: number): void {
    const item = findToast(id);
    if (!item || item.generation !== generation) return;

    clearTimer(id);
    clearRemovalTimer(id);
    removeFromBothStacks(id);
  }

  function moveFocusAfterDismiss(id: string, reason: DismissReason): void {
    if (
      reason === 'timer' ||
      reason === 'overflow' ||
      reason === 'programmatic' ||
      reason === 'dismissAll'
    ) {
      return;
    }
    queueMicrotask(() => {
      const candidates = [...(regionElement?.querySelectorAll<HTMLElement>('.cinder-toast') ?? [])]
        .filter((element) => element.dataset['cinderToastId'] !== id)
        .filter((element) => element.dataset['cinderLeaving'] !== 'true');
      const nextControl = candidates
        .map((element) => element.querySelector<HTMLElement>('button:not([disabled])'))
        .find((element): element is HTMLElement => element !== null);
      (nextControl ?? document.body).focus();
      synchronizeFocusedToastEscapeHandler();
    });
  }

  function handleActionClick(item: InternalToastItem): void {
    if (item.leaving) return;
    if (!item.action) return;
    item.action.onAction();
    if (!item.action.keepOpen) {
      beginDismiss(item.id, 'action');
    }
  }

  function promise<T>(
    promiseToTrack: Promise<T>,
    options: {
      loading: string;
      success: string | ((value: T) => string);
      error: string | ((error: unknown) => string);
    } & Pick<ToastOptions, 'id' | 'duration' | 'dismissible' | 'action'>,
  ): string {
    const id = options.id ?? `cinder-toast-${++nextId}`;
    const loadingOptions: InternalShowOptions = {
      id,
      duration: 0,
      variant: 'info',
      pending: true,
    };
    if (options.dismissible !== undefined) loadingOptions.dismissible = options.dismissible;
    const pendingToast = upsertToast(options.loading, loadingOptions);
    const generation = pendingToast.generation;
    const isCurrentPromiseToast = () =>
      !destroyed && generations.get(id) === generation && findToast(id);

    promiseToTrack.then(
      (value) => {
        if (!isCurrentPromiseToast()) return;
        const message =
          typeof options.success === 'function' ? options.success(value) : options.success;
        const successOptions: InternalShowOptions = { id, variant: 'success' };
        if (options.duration !== undefined) successOptions.duration = options.duration;
        if (options.dismissible !== undefined) successOptions.dismissible = options.dismissible;
        if (options.action !== undefined) successOptions.action = options.action;
        upsertToast(message, successOptions);
      },
      (error) => {
        if (!isCurrentPromiseToast()) return;
        const message = typeof options.error === 'function' ? options.error(error) : options.error;
        const errorOptions: InternalShowOptions = { id, variant: 'danger' };
        if (options.duration !== undefined) errorOptions.duration = options.duration;
        if (options.dismissible !== undefined) errorOptions.dismissible = options.dismissible;
        if (options.action !== undefined) errorOptions.action = options.action;
        upsertToast(message, errorOptions);
      },
    );

    return id;
  }

  function handleToastKeydown(event: KeyboardEvent, item: InternalToastItem): void {
    if (event.key !== 'Escape') return;
    if (!item.dismissible) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    beginDismiss(item.id, 'keyboard');
  }

  function getFocusedToast(): InternalToastItem | undefined {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement)) return undefined;
    const toastElement = activeElement.closest<HTMLElement>('.cinder-toast');
    const id = toastElement?.dataset['cinderToastId'];
    if (!id) return undefined;
    return findToast(id);
  }

  function releaseToastEscapeHandler(): void {
    releaseFocusedToastEscape?.();
    releaseFocusedToastEscape = null;
  }

  function synchronizeFocusedToastEscapeHandler(): void {
    if (!isFocusInsideRegion) {
      releaseToastEscapeHandler();
      return;
    }

    const focusedToast = getFocusedToast();
    if (!focusedToast?.dismissible || focusedToast.leaving) {
      releaseToastEscapeHandler();
      return;
    }

    if (releaseFocusedToastEscape) return;
    releaseFocusedToastEscape = pushEscapeHandler(() => {
      const toast = getFocusedToast();
      if (!toast?.dismissible || toast.leaving) return;
      beginDismiss(toast.id, 'keyboard');
    });
  }

  function updateToastSwipe(id: string, swipeX: number): void {
    const item = findToast(id);
    if (!item || item.leaving) return;
    item.swipeX = swipeX;
    politeStack = [...politeStack];
    assertiveStack = [...assertiveStack];
  }

  function createToastInteractions(item: InternalToastItem): Attachment<HTMLElement> {
    let pointerId: number | null = null;
    let startX = 0;

    return (element) => {
      function handlePointerDown(event: PointerEvent): void {
        if (!item.dismissible || item.leaving) return;
        pointerId = event.pointerId;
        startX = event.clientX;
        element.setPointerCapture?.(event.pointerId);
      }

      function handlePointerMove(event: PointerEvent): void {
        if (pointerId !== event.pointerId) return;
        updateToastSwipe(item.id, event.clientX - startX);
      }

      function handlePointerUp(event: PointerEvent): void {
        if (pointerId !== event.pointerId) return;
        const delta = event.clientX - startX;
        pointerId = null;
        if (Math.abs(delta) >= 80) {
          beginDismiss(item.id, 'swipe');
        } else {
          updateToastSwipe(item.id, 0);
        }
      }

      function handlePointerCancel(): void {
        pointerId = null;
        updateToastSwipe(item.id, 0);
      }

      function handleKeydown(event: KeyboardEvent): void {
        handleToastKeydown(event, item);
      }

      element.addEventListener('keydown', handleKeydown);
      element.addEventListener('pointerdown', handlePointerDown);
      element.addEventListener('pointermove', handlePointerMove);
      element.addEventListener('pointerup', handlePointerUp);
      element.addEventListener('pointercancel', handlePointerCancel);

      return () => {
        element.removeEventListener('keydown', handleKeydown);
        element.removeEventListener('pointerdown', handlePointerDown);
        element.removeEventListener('pointermove', handlePointerMove);
        element.removeEventListener('pointerup', handlePointerUp);
        element.removeEventListener('pointercancel', handlePointerCancel);
      };
    };
  }

  setContext<ToastApi>(TOAST_CONTEXT_KEY, { show, dismiss, dismissAll, promise });

  onDestroy(() => {
    destroyed = true;
    // Tear down timers so unmounting the region (e.g., during route change)
    // doesn't leak timers that fire later and try to mutate disposed state.
    for (const id of timers.keys()) clearTimer(id);
    for (const id of removalTimers.keys()) clearRemovalTimer(id);
    generations.clear();
    politeStack = [];
    assertiveStack = [];
    releaseToastEscapeHandler();
  });
</script>

{#if children}
  {@render children()}
{/if}

{#if hydrated}
  <div
    bind:this={regionElement}
    class={cn('cinder-toast-region', className)}
    role="presentation"
    data-cinder-position={position}
    onpointerenter={() => setRegionPointerInside(true)}
    onpointerleave={() => setRegionPointerInside(false)}
    onfocusin={handleRegionFocusIn}
    onfocusout={handleRegionFocusOut}
  >
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-relevant="additions"
      class="cinder-toast-region__channel"
    >
      {#each politeStack as toast, index (toast.id)}
        <div
          class="cinder-toast-shell"
          style={`--cinder-toast-stack-index: ${index};`}
          data-cinder-presence={toast.leaving ? 'exiting' : 'entered'}
        >
          <div
            class="cinder-toast"
            role="group"
            aria-label="Notification"
            data-cinder-variant={toast.variant}
            data-cinder-toast-id={toast.id}
            data-cinder-pending={toast.pending ? 'true' : undefined}
            data-cinder-leaving={toast.leaving ? 'true' : undefined}
            style={toast.swipeX ? `--cinder-toast-swipe-x: ${toast.swipeX}px;` : undefined}
            {@attach createToastInteractions(toast)}
          >
            {#if toast.icon}
              <div class="cinder-toast__icon" aria-hidden="true">{@render toast.icon()}</div>
            {/if}
            {#if toast.pending}
              <span class="cinder-toast__spinner" aria-hidden="true"></span>
            {/if}
            <div class="cinder-toast__message">{toast.message}</div>
            {#if toast.action}
              <button
                type="button"
                class="cinder-toast__action"
                disabled={toast.leaving}
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
                disabled={toast.leaving}
                onclick={() => beginDismiss(toast.id, 'dismissButton')}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
                  />
                </svg>
              </button>
            {/if}
          </div>
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
      {#each assertiveStack as toast, index (toast.id)}
        <div
          class="cinder-toast-shell"
          style={`--cinder-toast-stack-index: ${index};`}
          data-cinder-presence={toast.leaving ? 'exiting' : 'entered'}
        >
          <div
            class="cinder-toast"
            role="group"
            aria-label="Notification"
            data-cinder-variant={toast.variant}
            data-cinder-toast-id={toast.id}
            data-cinder-pending={toast.pending ? 'true' : undefined}
            data-cinder-leaving={toast.leaving ? 'true' : undefined}
            style={toast.swipeX ? `--cinder-toast-swipe-x: ${toast.swipeX}px;` : undefined}
            {@attach createToastInteractions(toast)}
          >
            {#if toast.icon}
              <div class="cinder-toast__icon" aria-hidden="true">{@render toast.icon()}</div>
            {/if}
            {#if toast.pending}
              <span class="cinder-toast__spinner" aria-hidden="true"></span>
            {/if}
            <div class="cinder-toast__message">{toast.message}</div>
            {#if toast.action}
              <button
                type="button"
                class="cinder-toast__action"
                disabled={toast.leaving}
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
                disabled={toast.leaving}
                onclick={() => beginDismiss(toast.id, 'dismissButton')}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
                  />
                </svg>
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}

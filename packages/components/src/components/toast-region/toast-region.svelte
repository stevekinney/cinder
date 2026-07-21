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
  export type {
    ToastItem,
    ToastOptions,
    ToastPosition,
    ToastVariant,
    ToastRegionProps,
  } from './toast-region.types.ts';
</script>

<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Attachment } from 'svelte/attachments';

  import { setToastContext } from '../../_internal/toast-context.ts';
  import { pushEscapeHandler } from '../../_internal/overlay.ts';
  import { waitForTransitionCompletion } from '../../_internal/transition-completion.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { useReducedMotion } from '../../utilities/use-reduced-motion.svelte.ts';
  import type {
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
    | 'dismiss-button'
    | 'dismissAll'
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
    swiping?: boolean;
  };

  // Shared reduced-motion preference (OVERLAY-POLICY: use the shared hook, not inline matchMedia).
  const reducedMotion = useReducedMotion();

  // Hydration gate — toast live regions are client-only, but wrapped app
  // content and the context provider still render during SSR.
  let hydrated = $state(false);
  $effect(() => {
    hydrated = true;
  });

  // Two regions, two stacks. Polite for non-urgent feedback; assertive for danger.
  let politeStack: InternalToastItem[] = $state([]);
  let assertiveStack: InternalToastItem[] = $state([]);

  // Track auto-dismiss timers so we can cancel on dismiss / unmount.
  const timers: Map<string, TimerRecord> = new Map();
  const removalTimers: Map<string, () => void> = new Map();
  const generations: Map<string, number> = new Map();
  let regionElement: HTMLElement | null = $state(null);
  let nextId = 0;
  let isPointerInsideRegion = false;
  let isFocusInsideRegion = false;
  let destroyed = false;
  let releaseFocusedToastEscape: (() => void) | null = null;
  let returnFocusElement: HTMLElement | null = null;
  let generationCounter = 0;

  function isPolite(variant: ToastVariant): boolean {
    return variant === 'info' || variant === 'success' || variant === 'warning';
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
    const generation = (generationCounter += 1);
    generations.set(id, generation);
    return generation;
  }

  function invalidateGeneration(id: string): void {
    generations.set(id, (generationCounter += 1));
  }

  function clearGeneration(id: string): void {
    generations.delete(id);
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

  function canMutateToasts(): boolean {
    return hydrated && typeof document !== 'undefined' && !destroyed;
  }

  function getNextToastId(options: Pick<ToastOptions, 'id'>): string {
    if (options.id) return options.id;
    if (!canMutateToasts()) return `cinder-toast-${nextId + 1}`;
    nextId += 1;
    return `cinder-toast-${nextId}`;
  }

  function upsertToast(message: string, options: InternalShowOptions = {}): InternalToastItem {
    const id = getNextToastId(options);
    const variant = options.variant ?? 'info';
    const duration = options.duration ?? defaultDuration;
    const dismissible = options.dismissible ?? true;
    if (!canMutateToasts()) {
      return {
        id,
        message,
        variant,
        duration,
        dismissible,
        showIcon: options.showIcon ?? false,
        generation: 0,
        pending: options.pending ?? false,
        leaving: false,
        swiping: false,
        ...(options.icon ? { icon: options.icon } : {}),
        ...(options.action ? { action: options.action } : {}),
      };
    }
    clearTimer(id);
    clearRemovalTimer(id);
    removeFromBothStacks(id);

    const item: InternalToastItem = {
      id,
      message,
      variant,
      duration,
      dismissible,
      showIcon: options.showIcon ?? false,
      generation: nextGeneration(id),
      pending: options.pending ?? false,
      leaving: false,
      swiping: false,
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
    if (!canMutateToasts()) return;
    beginDismiss(id, 'programmatic');
  }

  function dismissAll(): void {
    if (!canMutateToasts()) return;
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
    const cancelCompletion = removalTimers.get(id);
    if (cancelCompletion) {
      cancelCompletion();
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

  function handleRegionFocusIn(event: FocusEvent): void {
    const previousTarget = event.relatedTarget;
    if (
      !isFocusInsideRegion &&
      previousTarget instanceof HTMLElement &&
      !regionElement?.contains(previousTarget)
    ) {
      returnFocusElement = previousTarget;
    }
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

  function beginDismiss(id: string, reason: DismissReason): void {
    const item = findToast(id);
    if (!item || item.leaving) return;

    clearTimer(id);
    invalidateGeneration(id);

    const element = getToastElement(id);
    const shell = element?.closest<HTMLElement>('.cinder-toast-shell');
    if (element && shell && !reducedMotion.current) {
      shell.style.setProperty('--cinder-toast-height', `${shell.offsetHeight}px`);
      void shell.offsetHeight;
    }

    const focusNeedsMove = element?.contains(document.activeElement) ?? false;
    item.leaving = true;
    item.swipeX = 0;
    item.swiping = false;
    politeStack = [...politeStack];
    assertiveStack = [...assertiveStack];

    if (focusNeedsMove) moveFocusAfterDismiss(id, reason);

    const generation = item.generation;
    if (!shell) {
      queueMicrotask(() => reallyRemove(id, generation));
      return;
    }

    clearRemovalTimer(id);
    const cancelCompletion = waitForTransitionCompletion({
      element: shell,
      reducedMotion: reducedMotion.current,
      onComplete: () => reallyRemove(id, generation),
    });
    removalTimers.set(id, cancelCompletion);
  }

  function reallyRemove(id: string, generation: number): void {
    const item = findToast(id);
    if (!item || item.generation !== generation) return;

    clearTimer(id);
    clearRemovalTimer(id);
    removeFromBothStacks(id);
    clearGeneration(id);
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
      (nextControl ?? returnFocusElement ?? document.body).focus();
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
    const id = getNextToastId(options);
    if (!canMutateToasts()) {
      promiseToTrack.then(undefined, () => {});
      return id;
    }
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
    item.swiping = swipeX !== 0;
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

  setToastContext({ show, dismiss, dismissAll, promise });

  // The dismiss button's accessible name embeds the message so stacked toasts
  // have distinguishable controls ("Dismiss: File saved" vs "Dismiss: Upload
  // failed"). The full message is already announced by the live region, so a
  // long (rich/error) message is bounded here to keep the control name short.
  const DISMISS_LABEL_MAX = 60;

  function dismissLabel(message: string): string {
    const trimmed = message.trim();
    // An empty/whitespace message would yield a dangling "Dismiss: " — a
    // low-quality control name for assistive tech. Fall back to a generic label.
    if (trimmed.length === 0) return 'Dismiss notification';
    if (trimmed.length <= DISMISS_LABEL_MAX) return `Dismiss: ${trimmed}`;
    return `Dismiss: ${trimmed.slice(0, DISMISS_LABEL_MAX - 1).trimEnd()}…`;
  }

  onDestroy(() => {
    // Tear down timers so unmounting the region (e.g., during route change)
    // doesn't leak timers that fire later and try to mutate disposed state.
    destroyed = true;
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

{#snippet toastItem(toast: InternalToastItem, index: number)}
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
      data-cinder-swiping={toast.swiping ? 'true' : undefined}
      style={toast.swipeX ? `--cinder-toast-swipe-x: ${toast.swipeX}px;` : undefined}
      {@attach createToastInteractions(toast)}
    >
      {#if toast.icon}
        <div class="cinder-toast__icon" aria-hidden="true">{@render toast.icon()}</div>
      {:else if toast.showIcon}
        <div class="cinder-toast__icon" aria-hidden="true">
          {#if toast.variant === 'success'}
            <svg viewBox="0 0 20 20" fill="currentColor" style="color: var(--_cinder-toast-accent)">
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                clip-rule="evenodd"
              />
            </svg>
          {:else if toast.variant === 'warning'}
            <svg viewBox="0 0 20 20" fill="currentColor" style="color: var(--_cinder-toast-accent)">
              <path
                fill-rule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clip-rule="evenodd"
              />
            </svg>
          {:else if toast.variant === 'danger'}
            <svg viewBox="0 0 20 20" fill="currentColor" style="color: var(--_cinder-toast-accent)">
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                clip-rule="evenodd"
              />
            </svg>
          {:else}
            <svg viewBox="0 0 20 20" fill="currentColor" style="color: var(--_cinder-toast-accent)">
              <path
                fill-rule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                clip-rule="evenodd"
              />
            </svg>
          {/if}
        </div>
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
          aria-label={dismissLabel(toast.message)}
          disabled={toast.leaving}
          onclick={() => beginDismiss(toast.id, 'dismiss-button')}
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
{/snippet}

{#if hydrated}
  <div
    bind:this={regionElement}
    class={classNames('cinder-toast-region', className)}
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
      {#each politeStack as toast, index (`${toast.id}:${toast.generation}`)}
        {@render toastItem(toast, index)}
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
      {#each assertiveStack as toast, index (`${toast.id}:${toast.generation}`)}
        {@render toastItem(toast, index)}
      {/each}
    </div>
  </div>
{/if}

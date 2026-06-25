<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status stable
   * @purpose Modal search overlay for keyboard-first command launching and navigation. Filtering is consumer-owned: the `items` snippet receives `{ query }` and renders only the matching rows.
   * @tag overlay
   * @tag command
   * @useWhen Exposing a global keyboard-first launcher for power-user actions and navigation.
   * @useWhen Letting users search across heterogeneous results such as commands, pages, and records in one input.
   * @avoidWhen Picking a single value bound to a form field — use combobox instead.
   * @avoidWhen Showing a contextual action menu attached to a trigger — use dropdown instead.
   * @related combobox, dropdown, command-item
   */
  export type { CommandPaletteProps } from './command-palette.types.ts';
</script>

<script lang="ts">
  import type { CommandPaletteProps } from './command-palette.types.ts';
  import { onDestroy } from 'svelte';

  import { captureFocus, pushEscapeHandler } from '../../_internal/overlay.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { inDocumentOrder } from '../../utilities/document-order.ts';
  import { restoreFocusTo } from '../../utilities/focus.ts';
  import {
    setCommandListContext,
    type CommandItemRegistrationInput,
    type CommandListContext,
  } from '../_internal/command-list-context.ts';

  let {
    open = $bindable(false),
    placeholder = 'Search…',
    label = 'Command palette',
    query = $bindable(''),
    onclose,
    triggerRef = null,
    items,
    empty,
    footer,
    class: className,
  }: CommandPaletteProps = $props();

  // ── IDs ──────────────────────────────────────────────────────────────────
  const baseId = $props.id();
  const listboxId = `${baseId}-listbox`;
  const inputId = `${baseId}-input`;

  // ── DOM refs ─────────────────────────────────────────────────────────────
  let dialogElement: HTMLDialogElement | undefined = $state();
  let inputElement: HTMLInputElement | undefined = $state();

  // ── Hydration guard ───────────────────────────────────────────────────────
  // `mounted` is false during SSR. The dialog is rendered only when mounted
  // (client) or when already open (SSR open=true). Matching modal.svelte.
  let mounted = $state(false);
  $effect(() => {
    mounted = true;
  });

  // ── Focus capture ─────────────────────────────────────────────────────────
  let capturedFocus: HTMLElement | null = null;

  // ── Item registration ─────────────────────────────────────────────────────
  type RegistrationRecord = CommandItemRegistrationInput & { id: string; node: HTMLElement };
  let registrations = $state<RegistrationRecord[]>([]);

  // Stable incrementing counter for item ids within this palette instance.
  let itemCounter = 0;

  // ── Active item (virtual focus) ───────────────────────────────────────────
  // `intendedActiveId` is the user's last navigation/hover intent. The resolved
  // `activeItemId` clamps that intent to the currently-enabled set, so it is a
  // pure function of intent + enabledIds rather than a value repaired one tick
  // late inside an $effect. Keyboard/hover handlers write intent; everything
  // downstream reads the resolved derived.
  let intendedActiveId = $state<string | null>(null);

  // Ordered list of non-disabled item ids. Derived so arrow-key navigation
  // always walks the current set, including after prop changes (e.g. toggling
  // disabled on a mounted item).
  const enabledIds = $derived.by(() => {
    return inDocumentOrder(registrations)
      .filter((r) => !r.getDisabled())
      .map((r) => r.id);
  });

  // Resolved active id: preserve the user's intent if it's still in the enabled
  // set, otherwise fall back to the first enabled item (or null). This collapses
  // the previous read-then-write $effect into a single synchronous derivation.
  const activeItemId = $derived(
    intendedActiveId !== null && enabledIds.includes(intendedActiveId)
      ? intendedActiveId
      : (enabledIds[0] ?? null),
  );

  // ── Empty-state flash prevention ─────────────────────────────────────────
  // `registrationsReady` prevents the empty snippet from flashing on initial
  // open or when a query change causes a full key-swap of items. It is set
  // true after one microtask (giving children's $effect registrations time to
  // settle), and reset on every query change.
  //
  // A cycle counter guards against stale microtasks: if the query changes
  // twice in quick succession, only the most recent microtask sets ready=true.
  let registrationsReady = $state(false);
  let readyCycle = 0;

  $effect(() => {
    // Track query so this re-runs on every query change.
    void query;
    registrationsReady = false;
    const cycle = ++readyCycle;
    queueMicrotask(() => {
      if (cycle === readyCycle) registrationsReady = true;
    });
  });

  // ── Escape stack ──────────────────────────────────────────────────────────
  let releaseEscape: (() => void) | null = null;

  // ── Focus restoration ─────────────────────────────────────────────────────
  function returnFocus() {
    // Iterate candidates so a disconnected `triggerRef` falls through to
    // capturedFocus. Matches the modal/sheet/popover pattern; without this
    // a removed trigger would silently drop focus on the floor.
    const candidates: Array<HTMLElement | null> = [triggerRef, capturedFocus];
    for (const candidate of candidates) {
      if (restoreFocusTo(candidate)) break;
    }
    capturedFocus = null;
  }

  // ── Close ─────────────────────────────────────────────────────────────────
  // Single authoritative close path. All close triggers (Escape stack,
  // backdrop click, `close` event, programmatic open=false) route through here.
  // The `isClosing` flag prevents double-invocation: setting `open = false`
  // schedules the lifecycle $effect, which calls closePalette() again from the
  // else branch. The flag ensures that second call is a no-op.
  let isClosing = false;
  function closePalette() {
    if (isClosing) return;
    if (!open && !dialogElement?.open) return;
    isClosing = true;
    open = false;
    releaseEscape?.();
    releaseEscape = null;
    if (dialogElement?.open) dialogElement.close();
    returnFocus();
    onclose?.();
    isClosing = false;
  }

  // ── Open/close lifecycle ──────────────────────────────────────────────────
  $effect(() => {
    if (!dialogElement) return;
    if (open && !dialogElement.open) {
      query = '';
      intendedActiveId = null;
      capturedFocus = captureFocus();
      dialogElement.showModal();
      inputElement?.focus();
      releaseEscape = pushEscapeHandler(closePalette);
    } else if (!open && dialogElement.open) {
      // Programmatic close: open was set to false externally.
      // closePalette handles everything; call it to ensure focus is restored.
      closePalette();
    }
  });

  // Release escape handler on component destroy to prevent leaks.
  onDestroy(() => {
    releaseEscape?.();
    releaseEscape = null;
  });

  // ── Dialog event handlers ─────────────────────────────────────────────────

  // The native <dialog> fires `cancel` before `close` when Escape is pressed.
  // Prevent the native cancel so our escape-stack handler is the sole close path.
  function handleCancel(event: Event) {
    event.preventDefault();
  }

  // The `close` event fires when the dialog actually closes (any path).
  function handleClose() {
    closePalette();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === dialogElement) {
      closePalette();
    }
  }

  // ── Keyboard routing ──────────────────────────────────────────────────────
  function handleKeydown(event: KeyboardEvent) {
    const ids = enabledIds;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (ids.length === 0) return;
      if (activeItemId === null) {
        const firstId = ids[0];
        if (firstId !== undefined) intendedActiveId = firstId;
      } else {
        const index = ids.indexOf(activeItemId);
        const nextId = ids[(index + 1) % ids.length];
        if (nextId !== undefined) intendedActiveId = nextId;
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (ids.length === 0) return;
      if (activeItemId === null) {
        const lastId = ids[ids.length - 1];
        if (lastId !== undefined) intendedActiveId = lastId;
      } else {
        const index = ids.indexOf(activeItemId);
        const previousId = ids[index <= 0 ? ids.length - 1 : index - 1];
        if (previousId !== undefined) intendedActiveId = previousId;
      }
    } else if (event.key === 'Home') {
      event.preventDefault();
      intendedActiveId = ids[0] ?? null;
    } else if (event.key === 'End') {
      event.preventDefault();
      intendedActiveId = ids[ids.length - 1] ?? null;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (activeItemId !== null) context.activateItemById(activeItemId);
    }
  }

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    query = target.value;
  }

  $effect(() => {
    if (activeItemId === null) return;
    // Use the node captured at registration time rather than
    // document.getElementById, which assumes globally-unique ids and breaks in
    // shadow DOM, iframes, or multi-instance scenarios.
    const record = registrations.find((r) => r.id === activeItemId);
    record?.node.scrollIntoView({ block: 'nearest' });
  });

  // ── Context ───────────────────────────────────────────────────────────────
  const context: CommandListContext = {
    get listboxId() {
      return listboxId;
    },
    get activeItemId() {
      return activeItemId;
    },
    register(input: CommandItemRegistrationInput, node: HTMLElement) {
      const id = `${listboxId}-item-${++itemCounter}`;
      // Mutate in place: $state wraps the array in a deep reactive proxy that
      // tracks push/splice, so we avoid allocating a fresh array per register.
      registrations.push({
        id,
        node,
        getValue: input.getValue,
        getOnselect: input.getOnselect,
        getDisabled: input.getDisabled,
      });
      return {
        id,
        unregister: () => {
          const index = registrations.findIndex((r) => r.id === id);
          if (index !== -1) registrations.splice(index, 1);
        },
      };
    },
    setActiveById(id: string) {
      intendedActiveId = id;
    },
    activateItemById(id: string) {
      const record = registrations.find((r) => r.id === id);
      if (record && !record.getDisabled()) {
        record.getOnselect()();
      }
    },
  };

  setCommandListContext(context);

  const showEmpty = $derived(mounted && registrationsReady && registrations.length === 0);
</script>

{#if mounted || open}
  <dialog
    bind:this={dialogElement}
    class="cinder-command-palette"
    aria-label={label}
    aria-modal="true"
    oncancel={handleCancel}
    onclose={handleClose}
    onclick={handleBackdropClick}
  >
    {#if open}
      <div class={classNames('cinder-command-palette__panel', className)}>
        <div class="cinder-command-palette__search">
          <svg
            class="cinder-command-palette__search-icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              clip-rule="evenodd"
            />
          </svg>
          <label for={inputId} class="cinder-sr-only">{label}</label>
          <input
            bind:this={inputElement}
            id={inputId}
            type="text"
            class="cinder-command-palette__input"
            role="combobox"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            {placeholder}
            value={query}
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-activedescendant={activeItemId ?? undefined}
            oninput={handleInput}
            onkeydown={handleKeydown}
          />
        </div>

        <ul id={listboxId} role="listbox" class="cinder-command-palette__listbox">
          {@render items({ query })}
        </ul>

        {#if showEmpty && empty}
          <div class="cinder-command-palette__empty" role="status">
            {@render empty()}
          </div>
        {/if}

        {#if footer}
          <div class="cinder-command-palette__footer">
            {@render footer()}
          </div>
        {/if}
      </div>
    {/if}
  </dialog>
{/if}

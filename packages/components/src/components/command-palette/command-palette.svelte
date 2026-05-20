<script lang="ts" module>
  export type { CommandPaletteProps } from './command-palette.types.ts';
</script>

<script lang="ts">
  import type { CommandPaletteProps } from './command-palette.types.ts';
  import { onDestroy } from 'svelte';

  import { captureFocus, pushEscapeHandler } from '../../_internal/overlay.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { restoreFocusTo } from '../../utilities/focus.ts';
  import { useId } from '../../utilities/use-id.ts';
  import {
    setCommandPaletteContext,
    type CommandItemRegistrationInput,
    type CommandPaletteContext,
  } from '../_internal/command-palette-context.ts';

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
  const listboxId = useId('cinder-command-palette-listbox');
  const inputId = useId('cinder-command-palette-input');

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

  // Sort registrations by DOM document order. {@attach} fires after the node is
  // mounted, so registration order usually equals DOM order — but conditional
  // ({#if}) blocks that re-mount middle items can desync the list. Sorting on
  // read keeps keyboard navigation always aligned with visual order.
  function inDocumentOrder(items: RegistrationRecord[]): RegistrationRecord[] {
    return [...items].sort((a, b) => {
      const position = a.node.compareDocumentPosition(b.node);
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
  }

  // Stable incrementing counter for item ids within this palette instance.
  let itemCounter = 0;

  // ── Active item (virtual focus) ───────────────────────────────────────────
  let activeItemId = $state<string | null>(null);

  // Ordered list of non-disabled item ids. Derived so arrow-key navigation
  // always walks the current set, including after prop changes (e.g. toggling
  // disabled on a mounted item).
  const enabledIds = $derived.by(() => {
    return inDocumentOrder(registrations)
      .filter((r) => !r.getDisabled())
      .map((r) => r.id);
  });

  // Repair activeItemId whenever the enabled set changes (registration churn,
  // disabled toggled, query change). Preserve the current selection if it's
  // still present and non-disabled; otherwise fall back to first enabled or null.
  $effect(() => {
    const ids = enabledIds;
    if (activeItemId !== null && ids.includes(activeItemId)) return;
    activeItemId = ids[0] ?? null;
  });

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
    if (triggerRef) {
      restoreFocusTo(triggerRef);
    } else {
      restoreFocusTo(capturedFocus);
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
        if (firstId !== undefined) activeItemId = firstId;
      } else {
        const index = ids.indexOf(activeItemId);
        const nextId = ids[(index + 1) % ids.length];
        if (nextId !== undefined) activeItemId = nextId;
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (ids.length === 0) return;
      if (activeItemId === null) {
        const lastId = ids[ids.length - 1];
        if (lastId !== undefined) activeItemId = lastId;
      } else {
        const index = ids.indexOf(activeItemId);
        const previousId = ids[index <= 0 ? ids.length - 1 : index - 1];
        if (previousId !== undefined) activeItemId = previousId;
      }
    } else if (event.key === 'Home') {
      event.preventDefault();
      activeItemId = ids[0] ?? null;
    } else if (event.key === 'End') {
      event.preventDefault();
      activeItemId = ids[ids.length - 1] ?? null;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (activeItemId === null) return;
      const record = registrations.find((r) => r.id === activeItemId);
      if (record && !record.getDisabled()) {
        record.getOnselect()();
      }
    }
  }

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    query = target.value;
  }

  $effect(() => {
    if (activeItemId === null) return;
    document.getElementById(activeItemId)?.scrollIntoView({ block: 'nearest' });
  });

  // ── Context ───────────────────────────────────────────────────────────────
  const context: CommandPaletteContext = {
    get listboxId() {
      return listboxId;
    },
    get query() {
      return query;
    },
    get activeItemId() {
      return activeItemId;
    },
    register(input: CommandItemRegistrationInput, node: HTMLElement) {
      const id = `${listboxId}-item-${++itemCounter}`;
      registrations = [
        ...registrations,
        {
          id,
          node,
          getValue: input.getValue,
          getOnselect: input.getOnselect,
          getDisabled: input.getDisabled,
        },
      ];
      return {
        id,
        unregister: () => {
          registrations = registrations.filter((r) => r.id !== id);
        },
      };
    },
    setActiveById(id: string) {
      activeItemId = id;
    },
  };

  setCommandPaletteContext(context);

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

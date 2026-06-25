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
  import { restoreFocusTo } from '../../utilities/focus.ts';
  import { setCommandListContext } from '../_internal/command-list-context.ts';
  import { createCommandListState } from '../_internal/create-command-list-state.svelte.ts';

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

  const commandList = createCommandListState(listboxId);

  $effect(() => {
    // Track query so this re-runs on every query change.
    void query;
    commandList.refreshRegistrationsReady();
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
      commandList.resetActiveItem();
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
    commandList.handleKeydown({
      event,
      onEnter: (id) => commandList.activateItemById(id),
    });
  }

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    query = target.value;
  }

  $effect(() => {
    commandList.scrollActiveItemIntoView();
  });

  // ── Context ───────────────────────────────────────────────────────────────
  setCommandListContext(commandList.createContext());

  const showEmpty = $derived(
    mounted && commandList.registrationsReady && commandList.registrations.length === 0,
  );
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
            aria-activedescendant={commandList.activeItemId ?? undefined}
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

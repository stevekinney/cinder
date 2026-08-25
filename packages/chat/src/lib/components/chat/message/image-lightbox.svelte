<script lang="ts" module>
  export type LightboxImage = {
    src: string;
    alt: string;
  };

  export type ImageLightboxProps = {
    /** Images to display in the lightbox */
    images: LightboxImage[];
    /** Index of the image to show initially */
    initialIndex?: number;
    /** Whether the lightbox is open */
    open?: boolean;
    /** Called when the lightbox is closed */
    onClose?: () => void;
  };
</script>

<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { ChevronLeft, ChevronRight, X } from '@lostgradient/cinder/icons';
  import { Modal } from '@lostgradient/cinder/modal';

  let { images, initialIndex = 0, open = $bindable(false), onClose }: ImageLightboxProps = $props();

  // clampedInitialIndex is the clamped version of the `initialIndex` prop.
  const clampedInitialIndex = $derived(
    images.length > 0 ? Math.max(0, Math.min(initialIndex, images.length - 1)) : 0,
  );

  // navigationIndex is null when no user navigation has occurred in the current
  // open session. effectiveIndex falls back to clampedInitialIndex.
  //
  // Preserving the current image through the exit transition: Modal keeps the
  // lightbox's children mounted for the full exit-transition window (via its
  // own `SlidingDialogState`/`data-cinder-closing` lifecycle) even after
  // `open` has already flipped to false — that's what lets the panel fade out
  // instead of vanishing instantly. effectiveIndex therefore must NOT fall
  // back to clampedInitialIndex the moment `open` goes false, or the displayed
  // image would visibly reset mid-fade to whatever the user navigated away
  // from. So effectiveIndex reads ONLY navigationIndex (falling back to
  // clampedInitialIndex just when no navigation has happened yet), with no
  // dependency on `open` at all.
  //
  // Reset semantics WITHOUT a write-back loop: navigationIndex is cleared
  // exactly once per FRESH open (the false→true transition), not on close.
  // `resetAppliedForCurrentSession` is a plain (non-`$state`) variable — it is
  // write-only bookkeeping for this effect and nothing else ever reads it, so
  // it never participates in Svelte's dependency tracking. The effect's only
  // reactive read is `open`; it writes `navigationIndex` conditionally on
  // that plain flag, never in a way that would re-trigger itself. This is not
  // the read-and-write-back-the-same-bindable pattern #464 removes (that
  // pattern re-wrote a $state the SAME effect also read).
  let navigationIndex = $state<number | null>(null);
  // frozenIndex freezes the resolved session index (whatever effectiveIndex
  // was showing) for the WHOLE closing/exit-transition window — including
  // the no-navigation case, where effectiveIndex would otherwise keep
  // tracking `clampedInitialIndex` reactively. This matters because a
  // consumer's `onClose` callback is a common place to reset a
  // controlled-component's selected index — that mutation happens
  // synchronously, in the SAME tick as the close, before Modal's exit
  // transition has even started to play. Without freezing, the still-fading
  // lightbox would immediately swap to whatever image the just-reset
  // `initialIndex` now points at. `frozenIndex` is captured synchronously
  // inside close()/handleModalDismiss() BEFORE onClose runs (see below), not
  // only via the effect's fallback path, so it beats that race. Reset to
  // null (unfrozen) exactly once per fresh open, same effect as
  // resetAppliedForCurrentSession below.
  let frozenIndex = $state<number | null>(null);
  const effectiveIndex = $derived(frozenIndex ?? navigationIndex ?? clampedInitialIndex);
  // lastLiveIndex continuously mirrors the live effectiveIndex WHILE open —
  // this is the fallback freeze's actual source of truth (see the effect
  // below), not a re-read of navigationIndex/clampedInitialIndex at close
  // time. That distinction matters for a PARENT-driven close: when a
  // controlling parent sets `open = false` AND resets `initialIndex` in the
  // very same reactive update (a common controlled-component pattern), both
  // prop changes land in the SAME effect flush — by the time our
  // open-watching effect runs, `clampedInitialIndex` already reflects the
  // NEW `initialIndex`, so re-deriving from it at that point would freeze
  // the wrong (post-reset) image. `lastLiveIndex` instead only updates on
  // flushes where `open` is (still) true, so it holds the value from the
  // LAST such flush — i.e. whatever was actually visible immediately before
  // this closing transition began, unaffected by a same-flush prop reset.
  // (The synchronous close()/handleModalDismiss() capture below remains the
  // precise mechanism for LIGHTBOX-initiated closes, since it runs before
  // any effect at all; this is specifically the fallback for a parent-driven
  // `open = false` that bypasses those functions entirely.)
  let lastLiveIndex = $state(0);
  let resetAppliedForCurrentSession = false;
  // Lazy mount: `hasOpenedOnce` starts false so an ImageLightbox instance
  // that is never opened (the common case — MessageAttachments renders one
  // per message unconditionally) never mounts Modal at all: no closed
  // <dialog>, no reduced-motion observer, no SlidingDialogState effects.
  // Flips true on open (so Modal's children stay mounted through
  // `data-cinder-closing` for the exit fade to play — the template guard
  // below must not depend on `open` alone) and clears back to false once
  // Modal's exit transition genuinely finishes, via `onExitComplete`
  // (`handleExitComplete`, below) — NOT permanently true after the first
  // open. Without that release, every lightbox ever opened would keep a
  // closed <dialog>, SlidingDialogState's effects, and a useReducedMotion
  // MediaQuery subscription alive for the rest of the chat's lifetime, one
  // per message in a long thread (CIN-377 review).
  //
  // Initialized from `open && images.length > 0` (NOT a hardcoded `false`,
  // and NOT `open` alone): `$effect` never runs on the server, so a
  // hardcoded `false` here would leave the client's own bootstrap effect as
  // the only thing that ever sets it, opening a brief window on the client
  // where an already-open instance renders no Modal yet. Seeding from `open`
  // closes that window for the common already-open-on-mount case — but
  // `open` ALONE is not sufficient: gating on `images.length > 0` too
  // matches the template's actual mount condition
  // (`{#if hasOpenedOnce && currentImage}`, and `currentImage` is
  // `undefined` for an empty `images` array). Seeding `hasOpenedOnce = true`
  // for `open: true` with an EMPTY `images` array previously left the flag
  // stuck at `true` forever with no Modal ever having genuinely mounted —
  // `onExitComplete` (the only other place that clears it) never fires for a
  // Modal that never mounted — so a LATER update supplying non-empty
  // `images` (with the lightbox already closed by then) mounted a Modal that
  // was already CLOSED the instant it appeared, with no exit transition to
  // release it (PR #1422 review). Note: per OVERLAY-POLICY.md's SSR rule,
  // this seeding does not itself put any dialog markup into the server
  // HTML — Modal's own internal `{#if mounted}` gate keeps its overlay
  // surface SSR-empty regardless of `hasOpenedOnce`; see
  // image-lightbox.ssr.test.ts.
  //
  // Wrapped in `untrack()` (the established idiom elsewhere in this
  // codebase for exactly this — see `popover-bindable-fixture.svelte`'s
  // `$state(untrack(() => initialOpen))`): reading `images.length` directly
  // inside the `$state(...)` initializer is flagged by Svelte as
  // `state_referenced_locally`, since only the value AT CONSTRUCTION TIME is
  // captured — which is exactly what's wanted here (a one-time seed, not a
  // live binding), but the compiler can't tell that from a bare reactive
  // read. `untrack()` makes the one-time intent explicit to both the
  // compiler and the reader.
  let hasOpenedOnce = $state(open && untrack(() => images.length) > 0);
  // Snapshot of the currently-displayed image, independent of the live
  // `images` array (PR #1422 review). `currentImage` (`images[effectiveIndex]`,
  // below) previously drove BOTH what's rendered AND the template's mount
  // guard (`{#if hasOpenedOnce && currentImage}`) directly — so if a parent
  // cleared `images` while the lightbox was open (or right as it closed),
  // `currentImage` went `undefined` mid-session and that `{#if}` destroyed
  // the still-open/closing Modal INSTANTLY, skipping the promised exit
  // transition entirely. Worse, `onExitComplete` never got a chance to fire
  // (Modal was torn down out from under it, not exited normally), so
  // `hasOpenedOnce` never cleared — a LATER `images` restore (with `open`
  // already false by then) mounted a Modal that was already closed the
  // instant it appeared, with no exit transition to release it — the exact
  // same shape of bug as the empty-images-on-open leak fixed above, but
  // triggered mid-session instead of on open.
  //
  // `sessionImage` mirrors `currentImage` whenever it's truthy (see the
  // effect below `currentImage`'s declaration) and is left untouched
  // otherwise — so it freezes at the last real image the instant `images`
  // goes empty, and the template renders from THIS, not the live array.
  // Cleared back to `null` in `handleExitComplete`, in lockstep with
  // `hasOpenedOnce`, once the exit transition has genuinely finished.
  // Seeded here (not left `null` until the first client effect) for the
  // same already-open-on-first-render reason `hasOpenedOnce` is seeded from
  // `open` above — `untrack()` for the same one-time-capture reason (see
  // that seed's comment).
  let sessionImage = $state<LightboxImage | null>(
    untrack(() => {
      if (!open || images.length === 0) return null;
      const initialSessionIndex = Math.max(0, Math.min(initialIndex, images.length - 1));
      return images[initialSessionIndex] ?? null;
    }),
  );
  // Forces the `{#key mountGeneration}` block around <Modal> (below) to
  // fully destroy and recreate on every genuine remount cycle. `{#if}`
  // alone was not reliable here: when `hasOpenedOnce` flips false (exit
  // complete) and then true again (a fresh open shortly after) across two
  // separate reactive commits, plain boolean-toggle diffing could leave a
  // stale, already-`onDestroy`'d Modal instance's <dialog> element behind
  // in the DOM instead of removing it before inserting the new instance —
  // `{#key}` guarantees full teardown-then-recreate instead of relying on
  // that diffing. Incremented only on the false→true (fresh mount)
  // transition, never on a reopen-during-close (hasOpenedOnce never
  // actually went false in that case).
  let mountGeneration = $state(0);
  $effect(() => {
    if (open) {
      lastLiveIndex = navigationIndex ?? clampedInitialIndex;
      // Gate on `images.length > 0` (equivalently: a Modal will genuinely
      // mount), not on `open` alone. `open` flipping true with an EMPTY
      // `images` array used to set `hasOpenedOnce = true` here even though
      // the template's own mount condition (`{#if hasOpenedOnce &&
      // currentImage}`) never actually mounts a Modal in that case
      // (`currentImage` is `undefined` when `images` is empty) — so
      // `onExitComplete` (the only other place that clears
      // `hasOpenedOnce`) never fires, and the flag stayed stuck at `true`
      // indefinitely. A LATER update supplying non-empty `images` while
      // `open` was already false by then (the lightbox's own open/close
      // cycle having come and gone with no Modal ever mounting) would flip
      // the template condition true and mount a Modal that was already
      // CLOSED from the moment it appeared — a closed `<dialog>` +
      // `SlidingDialogState` + `useReducedMotion` subscription that then
      // persists indefinitely, since a Modal that never actually opens has
      // no exit transition to fire `onExitComplete` and release it either.
      // Reading `images.length` here (this effect did not previously read
      // `images` at all) also means the effect now correctly reruns and
      // sets `hasOpenedOnce` the moment `images` transitions from empty to
      // non-empty while still open, so a real Modal mounts as soon as
      // there's something to show.
      if (images.length > 0) {
        if (!hasOpenedOnce) {
          mountGeneration += 1;
        }
        hasOpenedOnce = true;
      }
      frozenIndex = null;
      if (!resetAppliedForCurrentSession) {
        navigationIndex = null;
        resetAppliedForCurrentSession = true;
      }
      // Force `sessionImage` to resync HERE too, on every fresh-open
      // transition — not solely via the separate `currentImage`-mirroring
      // effect below. That effect only reruns when `currentImage` (a
      // `$derived`) actually CHANGES; a close-then-reopen at the SAME index
      // (the overwhelmingly common case, e.g. re-clicking the same
      // thumbnail) recomputes `currentImage` to the exact same object
      // reference as before the close — Svelte's fine-grained reactivity
      // does not consider that a change, so the mirroring effect would never
      // rerun, leaving `sessionImage` stuck at the `null` `handleExitComplete`
      // cleared it to. Reading `images[...]` directly here, AFTER
      // `frozenIndex`/`navigationIndex` were just reset above so
      // `effectiveIndex` reflects the fresh session's index, guarantees a
      // resync on every genuine open regardless of whether the resulting
      // value happens to be referentially identical to the old one.
      if (images[effectiveIndex]) {
        sessionImage = images[effectiveIndex];
      }
    } else {
      resetAppliedForCurrentSession = false;
      // Fallback freeze for a parent-driven `open = false` that doesn't go
      // through close()/handleModalDismiss() at all (no onClose fires for
      // that path, so there's no synchronous capture point to race) — this
      // is a no-op if already frozen synchronously below. Reads
      // `lastLiveIndex`, NOT a fresh navigationIndex/clampedInitialIndex
      // recomputation — see the comment on `lastLiveIndex` above for why.
      if (frozenIndex === null) {
        frozenIndex = lastLiveIndex;
      }
    }
  });

  const hasMultiple = $derived(images.length > 1);
  const currentImage = $derived(images[effectiveIndex]);
  const counterText = $derived(`${effectiveIndex + 1} of ${images.length}`);

  // Keeps `sessionImage` (declared above, alongside `hasOpenedOnce`) in sync
  // with `currentImage` for LIVE changes during an open session — arrow-key
  // navigation (`previous()`/`next()`, below) changes `effectiveIndex`
  // without touching `open` at all, so the main open-watching effect above
  // (which only resyncs `sessionImage` on a fresh open transition) would
  // never see it. This effect is the complement, not the sole mechanism: a
  // close-then-reopen at the SAME index recomputes `currentImage` to the
  // exact same object reference as before, which Svelte's reactivity does
  // NOT treat as a change, so this effect alone would never rerun for that
  // case — the main effect's direct, unconditional resync on every fresh
  // open (above) is what covers it.
  //
  // Deliberately does NOT clear `sessionImage` when `currentImage` goes
  // `undefined` (an `images` clear mid-session): that's the entire point —
  // `sessionImage` freezes at the last real image instead of following
  // `images` down to empty, so the template's mount guard and rendered
  // `<img>` both keep showing that frozen image through the rest of the
  // open session and the whole exit-transition window. Only
  // `handleExitComplete` (below) clears it, once the exit has genuinely
  // finished.
  $effect(() => {
    if (currentImage) {
      sessionImage = currentImage;
    }
  });

  // The single path for a lightbox-initiated close (the close button, or a
  // click on the backdrop area around the image). `open` flips first so a
  // thrown onClose callback does not leave the lightbox's reactive state open.
  // Freezes the resolved index BEFORE calling onClose — a controlled-
  // component consumer commonly resets its selected index from onClose,
  // synchronously, in this same tick, which would otherwise leak into
  // effectiveIndex mid-fade. Deliberately does NOT reset navigationIndex —
  // Modal keeps this component's children mounted through its exit
  // transition, and resetting now would visibly snap the displayed image
  // back to clampedInitialIndex mid-fade. The reset happens exactly once, on
  // the NEXT fresh open (see the effect above).
  function close() {
    open = false;
    if (frozenIndex === null) {
      frozenIndex = effectiveIndex;
    }
    onClose?.();
  }

  // Modal's own dismiss paths (Escape, and its own backdrop-click handling)
  // route through `onDismiss` instead of our `close()` — Modal has already
  // flipped `open` to false by the time this fires, via the coordinated
  // SlidingDialogState lifecycle (focus trap, scroll lock, escape-stack
  // participation, exit-transition) that Modal owns entirely. Same
  // synchronous freeze-before-onClose as close(), for the same race-with-
  // onClose reason — and no navigationIndex reset here either, for the same
  // preserve-through-the-exit reason.
  function handleModalDismiss() {
    if (frozenIndex === null) {
      frozenIndex = effectiveIndex;
    }
    onClose?.();
  }

  // Releases the lazy-mount flag once Modal's exit transition genuinely
  // finishes — not when `open` first flips false. Without this,
  // `hasOpenedOnce` stayed permanently true after the FIRST open, so every
  // lightbox instance that had ever been opened kept a closed <dialog>,
  // SlidingDialogState's effects, and a useReducedMotion MediaQuery
  // subscription alive for the rest of the chat's lifetime — one per
  // message, in a long thread. Modal's `onExitComplete` (mirroring the
  // Popover/SelectionPopover pattern from CIN-376) fires exactly once the
  // panel has actually unmounted, covering both the real-transition and the
  // reduced-motion-collapses-to-zero paths, and does NOT fire at all if
  // `open` flips back to true before the exit finishes (a reopen mid-close)
  // — so a reopen during the exit transition simply never reaches this
  // handler, and hasOpenedOnce/the mount stay intact through it.
  function handleExitComplete() {
    // Deferred via tick(): this callback fires from deep inside Modal's own
    // effect chain (SlidingDialogState's transition-completion callback),
    // i.e. from WITHIN the very component instance the write below tears
    // down (clearing hasOpenedOnce flips the {#if} that mounts <Modal>).
    // Writing it synchronously here raced a near-simultaneous reopen in
    // testing: Svelte's block reconciliation could observe the "remove" and
    // a subsequent "add" (from the reopen) within overlapping effect
    // passes and momentarily render BOTH the outgoing and incoming <Modal>
    // instances. Deferring the write to a fresh tick lets Modal's own
    // teardown fully settle first.
    void tick().then(() => {
      if (!open) {
        hasOpenedOnce = false;
        // Cleared in lockstep with `hasOpenedOnce`, not before: `sessionImage`
        // must keep the exit-transition's frozen image visible for the ENTIRE
        // window Modal keeps this component's children mounted, which lasts
        // until exactly this point.
        sessionImage = null;
      }
    });
  }

  function previous() {
    navigationIndex = (effectiveIndex - 1 + images.length) % images.length;
  }

  function next() {
    navigationIndex = (effectiveIndex + 1) % images.length;
  }

  // Clicking the content wrapper directly (not the image or a button) closes
  // the lightbox, matching a backdrop-click dismissal. Modal's own
  // dismissOnBackdropClick only fires when the click lands on the <dialog>
  // element itself, which chrome="none" full-bleed content covers entirely —
  // this handler is what makes "click outside the image" work.
  function handleContentClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      close();
    }
  }

  // Arrow-key navigation is the one piece of lightbox-specific keyboard
  // handling Modal does not own. Escape is handled entirely by Modal (native
  // <dialog> `cancel` event, routed through the shared LIFO escape stack via
  // `pushEscapeHandler` — see OVERLAY-POLICY.md § Escape priority) — this
  // component no longer has its own Escape handler.
  function handleKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowLeft':
        if (hasMultiple) {
          event.preventDefault();
          previous();
        }
        break;
      case 'ArrowRight':
        if (hasMultiple) {
          event.preventDefault();
          next();
        }
        break;
    }
  }
</script>

{#key mountGeneration}
  {#if hasOpenedOnce && sessionImage}
    <Modal
      bind:open
      chrome="none"
      aria-label="Image viewer"
      closeButtonVisible={false}
      class="lightbox-modal"
      onDismiss={handleModalDismiss}
      onExitComplete={handleExitComplete}
    >
      <!--
      `autofocus` (plus `tabindex="-1"` so it's programmatically focusable)
      makes this element Modal's initial-focus target: Modal's own initial-
      focus policy (`focusDialogBodyUnlessAutofocused`) looks for an
      `[autofocus]` descendant and focuses it directly via `.focus()`, falling
      back to the body container only when none exists. Without this, focus
      would land on Modal's own `.cinder-modal__body` wrapper — the PARENT of
      this element — and the `onkeydown` handler below (which owns
      ArrowLeft/ArrowRight navigation) would never see the keystroke until
      focus moved somewhere inside this subtree.
    -->
      <!--
      No ARIA role fits this element semantically: it is the dialog's own
      content surface (Modal already supplies the dialog role on its own
      ancestor <dialog> element), not a widget — but it legitimately needs
      both a click
      handler (backdrop-style dismiss when clicking outside the image) and a
      keydown handler (ArrowLeft/ArrowRight navigation) while being a real
      keyboard-focus target (autofocus + tabindex="-1", see the comment
      above). role="presentation"/"none" would be actively wrong (a focus
      target cannot be presentational), and every other ARIA role either
      claims interactive semantics this element doesn't have or reintroduces
      the "non-interactive element with event listeners" warning instead.
    -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="lightbox-content"
        onclick={handleContentClick}
        onkeydown={handleKeyDown}
        tabindex="-1"
        autofocus
      >
        <button
          type="button"
          class="lightbox-close"
          aria-label="Close image viewer"
          onclick={close}
        >
          <X size={20} />
        </button>

        {#if hasMultiple}
          <button
            type="button"
            class="lightbox-nav lightbox-nav-previous"
            aria-label="Previous image"
            onclick={previous}
          >
            <ChevronLeft size={24} />
          </button>
        {/if}

        <div class="lightbox-image-container">
          <img
            src={sessionImage.src}
            alt={sessionImage.alt}
            class="lightbox-image"
            decoding="async"
          />
        </div>

        {#if hasMultiple}
          <button
            type="button"
            class="lightbox-nav lightbox-nav-next"
            aria-label="Next image"
            onclick={next}
          >
            <ChevronRight size={24} />
          </button>

          <div class="lightbox-counter" aria-live="polite" aria-atomic="true">
            {counterText}
          </div>
        {/if}
      </div>
    </Modal>
  {/if}
{/key}

<style>
  /*
   * `--cinder-modal-backdrop` is Modal's supported override point for the
   * `::backdrop` color — scoped via the `class` prop Modal already forwards
   * onto its own <dialog>, not a `:global()` reach into Modal's internal
   * selectors. `.lightbox-modal` lives on that external dialog element (not
   * inside this component's own template), so `:global()` is required here
   * for the selector to match — the override point itself is the public
   * contract, not an escape into `.cinder-modal__panel` etc.
   *
   * `::backdrop` does NOT reliably inherit custom properties from its
   * originating element across engines, so setting `--cinder-modal-backdrop`
   * on `.lightbox-modal` alone is inert for `::backdrop`'s own computed
   * style — the override must also target `.lightbox-modal::backdrop`
   * directly (matching modal.css's own `.cinder-modal::backdrop` rule,
   * which redeclares the default there for the same reason).
   */
  :global(.lightbox-modal),
  :global(.lightbox-modal::backdrop) {
    --cinder-modal-backdrop: rgba(0, 0, 0, 0.9);
  }

  .lightbox-content {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .lightbox-image-container {
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 90vw;
    max-height: 90vh;
  }

  .lightbox-image {
    max-width: 90vw;
    max-height: 90vh;
    object-fit: contain;
    border-radius: var(--cinder-radius-sm);
  }

  /* Close button */
  .lightbox-close {
    position: fixed;
    top: var(--cinder-space-4, 1rem);
    right: var(--cinder-space-4, 1rem);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: var(--cinder-radius-sm);
    color: white;
    cursor: pointer;
    transition: background var(--cinder-duration-fast) var(--cinder-ease-standard);
    z-index: 1;
  }

  @media (hover: hover) {
    .lightbox-close:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }

  .lightbox-close:focus-visible {
    /* Documented allowlist exception (docs/focus-ring-policy.md § Deviations):
       these controls float over an arbitrary dimmed photo backdrop where the
       accent ring color cannot guarantee contrast. A literal white outline is
       the deliberate high-contrast choice; it is already visible in Windows
       High Contrast Mode, so no forced-colors override is required. */
    /* stylelint-disable-next-line cinder/no-focus-visible-colored-outline -- white-over-photo contrast, see policy Deviations appendix */
    outline: 2px solid white;
    outline-offset: 2px;
  }

  /* Navigation buttons */
  .lightbox-nav {
    position: fixed;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 3rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: var(--cinder-radius-sm);
    color: white;
    cursor: pointer;
    transition: background var(--cinder-duration-fast) var(--cinder-ease-standard);
    z-index: 1;
  }

  @media (hover: hover) {
    .lightbox-nav:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }

  .lightbox-nav:focus-visible {
    /* Documented allowlist exception (docs/focus-ring-policy.md § Deviations):
       white-over-photo contrast — same rationale as .lightbox-close above. */
    /* stylelint-disable-next-line cinder/no-focus-visible-colored-outline -- white-over-photo contrast, see policy Deviations appendix */
    outline: 2px solid white;
    outline-offset: 2px;
  }

  .lightbox-nav-previous {
    left: var(--cinder-space-4, 1rem);
  }

  .lightbox-nav-next {
    right: var(--cinder-space-4, 1rem);
  }

  /* Image counter */
  .lightbox-counter {
    position: fixed;
    bottom: var(--cinder-space-4, 1rem);
    left: 50%;
    transform: translateX(-50%);
    color: rgba(255, 255, 255, 0.8);
    font-size: var(--cinder-text-sm, 0.875rem);
    background: rgba(0, 0, 0, 0.5);
    padding: var(--cinder-space-1, 0.25rem) var(--cinder-space-3, 0.75rem);
    border-radius: var(--cinder-radius-sm);
    pointer-events: none;
    z-index: 1;
  }
</style>

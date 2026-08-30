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
  // frozenImageCount is `frozenIndex`'s counterpart for `images.length`
  // (PR #1422 review): `counterText`/`hasMultiple` (below) previously
  // derived straight from the LIVE `images.length`, even while closing —
  // so a parent shrinking `images` during the exit fade (after
  // `sessionImage`/`frozenIndex` had already frozen the DISPLAYED image)
  // could still reintroduce a "3 of 2"-style mismatch: the frozen image
  // staying put while the counter kept recomputing against the shrinking
  // live count. Frozen for the WHOLE closing/exit-transition window,
  // reset to `null` on a fresh open (below, alongside `frozenIndex`) and
  // again in `handleExitComplete`, in lockstep with `sessionImage`/
  // `hasOpenedOnce` — grouped with the rest of that session-teardown
  // state even though `frozenIndex` itself is (for unrelated historical
  // reasons) only ever reset on the fresh-open side of that pair.
  let frozenImageCount = $state<number | null>(null);
  // The stable count to render from: while open, `frozenImageCount` is
  // `null` (reset on every fresh open), so this falls through to the LIVE
  // `images.length` — preserving the "re-clamp while genuinely open"
  // behavior from the prior round's fix. Once closing begins, it holds the
  // frozen snapshot instead, immune to further live shrinks/grows until the
  // exit genuinely completes. Mirrors `effectiveIndex`'s own
  // frozen-value-or-live-fallback shape immediately above.
  const displayImageCount = $derived(frozenImageCount ?? images.length);
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
  // `lastLiveIndex`'s counterpart for `images.length` — continuously
  // mirrors the live count WHILE open, so the fallback freeze below (for a
  // parent-driven `open = false` that bypasses close()/handleModalDismiss())
  // has a value to capture into `frozenImageCount` from.
  let lastLiveImageCount = $state(0);
  let resetAppliedForCurrentSession = false;
  // Plain (non-reactive) bookkeeping, same idiom as
  // `resetAppliedForCurrentSession` above: tracks whether THIS effect's own
  // `if (open)` branch (below) has actually executed since the last close —
  // i.e. whether OUR reactivity ever observed a genuine `open === true`
  // moment for the current session, as distinct from `hasOpenedOnce` merely
  // being seeded/set `true`. See the "cancelled initial open" handling in
  // the effect's `else` branch below for why this distinction matters.
  let genuineOpenObserved = false;
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
  let lightboxContent = $state<HTMLElement | null>(null);

  // Modal owns the dialog lifecycle. Focus the keyboard navigation surface
  // after it mounts so arrow-key navigation works without an HTML auto-focus attribute.
  $effect(() => {
    if (!open || !sessionImage) return;
    void tick().then(() => lightboxContent?.focus());
  });
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
      const isFreshOpen = !resetAppliedForCurrentSession;
      // `isFreshOpen` is true only on the very FIRST run of this effect
      // since the last close — i.e. the genuine false→true open-transition
      // edge — because it reads `resetAppliedForCurrentSession` BEFORE that
      // flag gets set `true` for this session, a few lines below. On any
      // LATER rerun of this same branch while still open (e.g. `images`
      // changing while the session stays open the whole time),
      // `resetAppliedForCurrentSession` is already `true`, so
      // `isFreshOpen` is `false`.
      //
      // This distinction matters for an EMPTY `images` array (PR #1422
      // review, two rounds): on a FRESH open, empty `images` is not
      // renderable at all — `currentImage`/`effectiveIndex` have nothing to
      // resolve to — so it is treated as if this effect's own branch never
      // genuinely ran, covering two leak shapes:
      //   1. `open` flips true with an EMPTY `images` array on the very
      //      first open — `onExitComplete` (the only other place that
      //      clears `hasOpenedOnce`) never fires because no Modal ever
      //      mounts, so a LATER update supplying non-empty `images` while
      //      `open` was already false by then would mount an
      //      already-CLOSED Modal that persists indefinitely.
      //   2. Closing, then having the parent clear `images` and flip
      //      `open` back to `true` before the exit transition finishes: the
      //      previous (truthy) `sessionImage` would otherwise survive
      //      untouched (nothing here resyncs it for an empty array), and
      //      reopening cancels Modal's own close cycle — so
      //      `onExitComplete` never fires either — leaving the lightbox
      //      stuck showing a stale image that isn't even in `images`
      //      anymore.
      // A LATER, non-fresh rerun with empty `images` (the session was
      // already genuinely open with real images, and a parent clears them
      // WHILE STILL OPEN) is deliberately NOT covered by this branch — that
      // is the "clearing images mid-session… does not destroy the Modal
      // outright" behavior fixed in a prior round: `sessionImage` must stay
      // frozen at its last real value so the exit transition can still play
      // once the session actually closes, not be cleared out here.
      if (isFreshOpen && images.length === 0) {
        // Not renderable: clear the stale/previous snapshot so the
        // template's `{#if hasOpenedOnce && sessionImage}` guard hides the
        // Modal regardless of whatever `hasOpenedOnce` currently is.
        // Deliberately does NOT set `genuineOpenObserved` here — this
        // `open === true` moment never produced anything to show, so it
        // must not count as a "genuine open" for the cancelled-open guard
        // in the top-level `else` branch below. That keeps that guard free
        // to release `hasOpenedOnce` (if a still-in-progress prior close
        // had left it `true`) the next time `open` goes false, instead of
        // leaking a Modal stuck on stale content with no exit transition
        // ever coming to release it. An early `return` here (rather than an
        // `if`/`else` split of the rest of this branch) is deliberate: it
        // keeps this effect's single top-level `if`-then-`else` shape (open
        // vs. closed) intact for the other else-branch-scoped checks
        // elsewhere in this file that locate that branch by its own source
        // text.
        sessionImage = null;
        return;
      }
      genuineOpenObserved = true;
      lastLiveIndex = navigationIndex ?? clampedInitialIndex;
      lastLiveImageCount = images.length;
      if (images.length > 0) {
        if (!hasOpenedOnce) {
          mountGeneration += 1;
        }
        hasOpenedOnce = true;
      }
      frozenIndex = null;
      frozenImageCount = null;
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
      // cleared it to (or at the empty-images early-return's `null`).
      // Reading `images[...]` directly here, AFTER `frozenIndex`/
      // `navigationIndex` were just reset above so `effectiveIndex` reflects
      // the fresh session's index, guarantees a resync on every genuine
      // open regardless of whether the resulting value happens to be
      // referentially identical to the old one.
      //
      // Wrapped in `untrack()`: this is a plain array-index read, but
      // `effectiveIndex` transitively depends on `frozenIndex` — which THIS
      // SAME branch just wrote to `null` a few lines up. Reading it
      // reactively here (i.e. without `untrack`) makes `effectiveIndex` a
      // dependency of this effect for the first time, and writing a
      // dependency then reading it in the same pass reschedules the effect
      // to run again (an otherwise-harmless extra pass elsewhere in this
      // file — see the `else` branch's `frozenIndex` comment). Combined with
      // the separate `currentImage`-mirroring effect below (also reading
      // values derived from `frozenIndex`), that extra pass stopped settling
      // and looped indefinitely instead of converging. `untrack()` makes
      // this the one-time, non-reactive snapshot read it was always meant to
      // be, matching the `hasOpenedOnce`/`sessionImage` seeds' own use of
      // `untrack()` for the identical reason.
      const snapshotImage = untrack(() => images[effectiveIndex]);
      if (snapshotImage) {
        sessionImage = snapshotImage;
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
      if (frozenImageCount === null) {
        frozenImageCount = lastLiveImageCount;
      }
      // Cancelled initial open (PR #1422 review): `hasOpenedOnce` can be
      // `true` (Modal mounted — seeded from `open` for an already-open-on-
      // construction instance, see that seed's own comment) while this
      // effect's `if (open)` branch above never actually got to run with
      // `open === true` — i.e. a consumer flips `open` back to `false`
      // before Modal's OWN `syncOpenState()` effect ever calls
      // `showModal()`. Modal's dialog therefore never genuinely opens:
      // `syncOpenState()`'s own "already closed" branch only sets
      // `renderPanel = false` — it never calls `beginClosing()` (that
      // requires `dialogElement.open` to already be `true`), so
      // `#finishClosing()` never runs and `onExitComplete` NEVER fires.
      // Waiting for `handleExitComplete` to release the gate here would
      // wait forever — a closed `<dialog>` + `SlidingDialogState` +
      // `useReducedMotion` subscription would persist indefinitely, the
      // same leak shape as the empty-images and mid-session-clear bugs
      // fixed above, just triggered by a cancelled FIRST open instead.
      //
      // Fixed HERE (in the lightbox), not in `SlidingDialogState`: the
      // obvious alternative — making `syncOpenState()`'s "already closed"
      // branch fire `onClosed` too — would fire `onExitComplete` on every
      // ordinary Modal/Drawer/Popover mount that starts closed and is never
      // opened at all (the overwhelmingly common case for every overlay in
      // this codebase), directly contradicting the documented "fires once
      // the exit transition genuinely finishes" contract for a modal that
      // never had an exit in the first place, and risking a real regression
      // across every other `SlidingDialogState` consumer and their test
      // suites. `genuineOpenObserved` (a plain flag set only inside this
      // effect's own `if (open)` branch, distinct from `hasOpenedOnce`
      // merely being seeded/set) is the precise, LOCAL signal that this
      // specific session's Modal never got a chance to open — clear the
      // gate directly instead of waiting for a callback that will never
      // come.
      //
      // Deliberately NEVER reset back to `false` here (or anywhere in this
      // branch): this effect can rerun MULTIPLE times for the same logical
      // "now closed" state — e.g. the `frozenIndex === null` write just
      // above is itself a read-then-write of a value this effect reads,
      // which reschedules one extra, otherwise-idempotent pass. Resetting
      // `genuineOpenObserved` on the first such pass made a perfectly
      // NORMAL close (which correctly skipped the clear on that first pass)
      // wrongly clear `hasOpenedOnce` on the harmless second pass, since by
      // then the flag had already been reset out from under the check.
      // Leaving it `true` forever once observed is safe: every session
      // AFTER the very first one sets `hasOpenedOnce` and
      // `genuineOpenObserved` together, atomically, in the same `if (open)`
      // execution (`open` flipping true always re-runs this effect) — so
      // the two can only diverge in exactly the one case this exists to
      // catch, the cancelled-before-any-`if`-branch-run initial seed.
      if (hasOpenedOnce && !genuineOpenObserved) {
        hasOpenedOnce = false;
        sessionImage = null;
      }
    }
  });

  // Both derive from `displayImageCount`, NOT the live `images.length`
  // directly (PR #1422 review): while genuinely open, `displayImageCount`
  // already falls through to the live count (see its own declaration
  // above), so this changes nothing about the "re-clamp while open"
  // behavior from the prior round's fix — but while CLOSING, it stays
  // pinned to the frozen snapshot instead of following a parent's shrink
  // mid-fade, keeping the counter consistent with the (also frozen)
  // displayed image for the whole exit-transition window.
  const hasMultiple = $derived(displayImageCount > 1);
  const currentImage = $derived(images[effectiveIndex]);
  const counterText = $derived(`${effectiveIndex + 1} of ${displayImageCount}`);

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

  // Re-clamps `navigationIndex` when a non-empty shrink orphans the
  // current session index (PR #1422 review) — e.g. viewing image 3 of
  // [A, B, C], then the parent shrinks `images` down to [A, B].
  // `clampedInitialIndex` already reactively re-derives from
  // `images.length` for a session the user never navigated in, but
  // `navigationIndex` (set once by `previous()`/`next()`, held as a plain
  // snapshot number) does not — it stays pinned at the now out-of-range
  // value. `effectiveIndex` keeps resolving to it, `currentImage` goes
  // `undefined` (out of bounds), and the mirror effect just below
  // (correctly) leaves `sessionImage` frozen at the STALE image that used
  // to live at that index — while `counterText` (below) recomputes against
  // the NEW, smaller `images.length`, producing a mismatched "3 of 2".
  // This is deliberately distinct from the EMPTY-list case (handled in the
  // main open-watching effect above), which intentionally freezes
  // `sessionImage` entirely — there is nothing left to clamp TO. A
  // non-empty shrink instead re-clamps to what is still genuinely visible,
  // exactly as a live `previous()`/`next()` navigation would; the mirror
  // effect below then picks up the resulting valid `currentImage`
  // automatically, since it depends on it.
  $effect(() => {
    if (!open || images.length === 0) return;
    if (navigationIndex !== null && navigationIndex > images.length - 1) {
      navigationIndex = images.length - 1;
    }
  });

  $effect(() => {
    // Gated on `open` (PR #1422 review): without this, a parent swapping
    // `images` to a DIFFERENT non-empty list WHILE the lightbox is closing
    // (mid exit-transition, `open` already `false` but the Modal still
    // mounted for the fade) re-resolved `currentImage` against the new list
    // — the still-fading lightbox visibly swapped to the next session's
    // image instead of staying frozen on the one the user was actually
    // looking at when they closed it. Once `open` goes false, this effect
    // must stop syncing entirely — `sessionImage` stays frozen from close
    // until `handleExitComplete` (below) explicitly clears it once the exit
    // has genuinely finished, matching the "images cleared mid-session"
    // freeze this same mechanism already provides.
    if (open && currentImage) {
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
    if (frozenImageCount === null) {
      frozenImageCount = images.length;
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
    if (frozenImageCount === null) {
      frozenImageCount = images.length;
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
        // until exactly this point. `frozenImageCount` (its `counterText`/
        // `hasMultiple` counterpart) is cleared the same way, for the same
        // reason.
        sessionImage = null;
        frozenImageCount = null;
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
      This element is programmatically focused after Modal mounts so the
      ArrowLeft/ArrowRight handler receives navigation keys immediately.
    -->
      <!--
      No ARIA role fits this element semantically: it is the dialog's own
      content surface (Modal already supplies the dialog role on its own
      ancestor <dialog> element), not a widget — but it legitimately needs
      both a click
      handler (backdrop-style dismiss when clicking outside the image) and a
      keydown handler (ArrowLeft/ArrowRight navigation) while being a real
      keyboard-focus target (tabindex="-1", see the comment above).
      role="presentation"/"none" would be actively wrong (a focus
      target cannot be presentational), and every other ARIA role either
      claims interactive semantics this element doesn't have or reintroduces
      the "non-interactive element with event listeners" warning instead.
    -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        bind:this={lightboxContent}
        class="lightbox-content"
        onclick={handleContentClick}
        onkeydown={handleKeyDown}
        tabindex="-1"
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
   * directly. This matches modal.css's own `.cinder-modal::backdrop` rule,
   * which does NOT redeclare `--cinder-modal-backdrop` there (that would
   * shadow a consumer override scoped to `::backdrop` itself, and risks a
   * cyclic `var(--cinder-modal-backdrop, var(--cinder-modal-backdrop))`-
   * shaped declaration) — it only CONSUMES the property, with a fallback:
   * `background-color: var(--cinder-modal-backdrop, var(--cinder-overlay-backdrop))`.
   * Declaring the override on both scopes here (`.lightbox-modal` and
   * `.lightbox-modal::backdrop`) is what makes that consumed value resolve
   * correctly for `::backdrop`'s own disconnected inheritance scope.
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

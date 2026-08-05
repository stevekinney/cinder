export type VirtualKeyboardDismissalOptions = {
  enabled: () => boolean;
  panel: () => HTMLElement | null;
  composerForm: () => HTMLElement | null;
  composerOwnsKeyboard: () => boolean;
  isRestoringFocus: () => boolean;
  /**
   * Whether a pointer button is currently held down, tracked independently
   * of `enabled` (which gates on the popover being open). A drag-select
   * gesture that reaches the viewport edge triggers the browser's native
   * autoscroll-while-selecting behavior, firing real `scroll` events on
   * `window` WHILE the pointer is still down — often before the gesture
   * that is opening this popover has even finished (the pointer went down
   * before the popover existed/was enabled). Movement dismissal must ignore
   * those self-produced events, so the caller tracks pointer state for the
   * component's full mounted lifetime and reports it here, rather than this
   * module tracking it itself only while `enabled()` is true (which would
   * miss a pointerdown that happened before the popover opened).
   */
  isPointerDown: () => boolean;
  onDismiss: (preventScroll: boolean) => void;
  onFocusMovedOutside: () => void;
};

function isVirtualKeyboardResize(source: 'window' | 'visual-viewport'): boolean {
  const visualViewport = window.visualViewport;
  if (source === 'visual-viewport' && visualViewport?.scale !== 1) return false;

  const virtualKeyboard = (
    navigator as Navigator & {
      virtualKeyboard?: { boundingRect?: { height: number } };
    }
  ).virtualKeyboard;
  if ((virtualKeyboard?.boundingRect?.height ?? 0) > 0) return true;

  if (source === 'window') return false;

  return visualViewport != null && visualViewport.height < window.innerHeight;
}

/**
 * Dismisses the popover when a virtual (on-screen) keyboard closes while the
 * composer doesn't own it — distinguishing a real keyboard-close resize/scroll
 * burst from the user manually resizing the window or scrolling the page.
 *
 * Called once at the owning component's top level; owns its own `$effect`
 * gated on `options.enabled()`, matching `createAnchoredOverlay`'s shape.
 * Cleans up via Svelte's effect-root scoping — there is no external destroy
 * call.
 */
export function createVirtualKeyboardDismissal(options: VirtualKeyboardDismissalOptions): void {
  $effect(() => {
    if (!options.enabled()) return;
    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;
    const visualViewport = window.visualViewport;
    const virtualKeyboardWasVisible = {
      window: isVirtualKeyboardResize('window'),
      'visual-viewport': isVirtualKeyboardResize('visual-viewport'),
    };
    const virtualKeyboardTransitionFrames: Partial<Record<'window' | 'visual-viewport', number>> =
      {};
    let layoutKeyboardVisible = false;
    let layoutKeyboardResizeActive = false;
    let layoutKeyboardScrollsSeen = 0;
    let layoutKeyboardSettleFrames: number[] = [];
    const virtualKeyboard = (
      navigator as Navigator & {
        virtualKeyboard?: { boundingRect?: DOMRectReadOnly };
      }
    ).virtualKeyboard;
    layoutKeyboardVisible = Boolean(virtualKeyboard?.boundingRect?.height);
    const markLayoutKeyboardResize = () => {
      layoutKeyboardResizeActive = true;
      layoutKeyboardScrollsSeen = 0;
      for (const frame of layoutKeyboardSettleFrames) window.cancelAnimationFrame(frame);
      layoutKeyboardSettleFrames = [];
      const settle = (remaining: number) => {
        if (remaining === 0) {
          layoutKeyboardResizeActive = false;
          return;
        }
        layoutKeyboardSettleFrames.push(window.requestAnimationFrame(() => settle(remaining - 1)));
      };
      settle(2);
    };
    // Latches "the composer owned this keyboard transition" across the async
    // close burst. A cancel/submit collapses the composer (and clears
    // commentBody) synchronously, before the keyboard's closing resize
    // arrives, so deriving ownership from the *current* expanded/commentBody
    // state at event time would read false and let the collapse-triggered
    // resize fall through to closeForMovement() — dismissing the popover the
    // cancel was meant to leave open. Instead we remember ownership from the
    // moment the keyboard was last seen visible and only forget it once the
    // transition settles (mirrors the virtualKeyboardWasVisible bookkeeping).
    const virtualKeyboardOwnedByComposer: Partial<Record<'window' | 'visual-viewport', boolean>> =
      {};
    // Once focus genuinely moves outside the popover, ownership is forgotten
    // for the rest of this keyboard-visible transition — even if `expanded`
    // or a draft still reads true — so a real external keyboard (belonging
    // to whatever the user tabbed to) can't be re-claimed by the composer's
    // now-stale state on the very next event.
    const keyboardOwnershipForgotten = new Set<'window' | 'visual-viewport'>();
    const readVirtualKeyboardTransition = (
      source: 'window' | 'visual-viewport',
      composerOwnsKeyboardNow: boolean,
    ) => {
      const isVisible = isVirtualKeyboardResize(source);
      if (isVisible) {
        const pendingFrame = virtualKeyboardTransitionFrames[source];
        if (pendingFrame !== undefined) {
          window.cancelAnimationFrame(pendingFrame);
          delete virtualKeyboardTransitionFrames[source];
        }
        virtualKeyboardWasVisible[source] = true;
        // Only ever latch ownership to true here, never downgrade an
        // already-true latch back to false. A Cancel/submit collapses the
        // composer (composerOwnsKeyboardNow -> false) before the keyboard
        // reports itself hidden, and an intervening event while it's still
        // visible would otherwise overwrite the ownership this latch exists
        // to preserve across that gap. A forgotten latch stays forgotten
        // until the transition settles, so it can't be immediately
        // re-claimed by stale composer state either.
        const ownedByComposer = keyboardOwnershipForgotten.has(source)
          ? false
          : (virtualKeyboardOwnedByComposer[source] ?? false) || composerOwnsKeyboardNow;
        virtualKeyboardOwnedByComposer[source] = ownedByComposer;
        return { active: true, isVisible, ownedByComposer };
      }
      if (!virtualKeyboardWasVisible[source])
        return { active: false, isVisible, ownedByComposer: composerOwnsKeyboardNow };

      if (composerOwnsKeyboardNow && !keyboardOwnershipForgotten.has(source))
        virtualKeyboardOwnedByComposer[source] = true;
      const ownedByComposer = virtualKeyboardOwnedByComposer[source] ?? composerOwnsKeyboardNow;

      virtualKeyboardTransitionFrames[source] ??= window.requestAnimationFrame(() => {
        virtualKeyboardWasVisible[source] = false;
        delete virtualKeyboardTransitionFrames[source];
        delete virtualKeyboardOwnedByComposer[source];
        keyboardOwnershipForgotten.delete(source);
      });
      return { active: true, isVisible, ownedByComposer };
    };
    const closeForMovement = () => {
      options.onDismiss(true);
    };
    const dismiss = (event: Event) => {
      const panel = options.panel();
      if (event.target instanceof Node && panel?.contains(event.target)) return;
      if (event.type === 'scroll' && layoutKeyboardResizeActive) {
        if (layoutKeyboardScrollsSeen < 2) {
          layoutKeyboardScrollsSeen += 1;
          return;
        }
        layoutKeyboardResizeActive = false;
      }
      if (event.type === 'resize') {
        const viewportWidthChanged = window.innerWidth !== viewportWidth;
        const viewportHeightChanged = window.innerHeight !== viewportHeight;
        const previousViewportHeight = viewportHeight;
        viewportWidth = window.innerWidth;
        viewportHeight = window.innerHeight;
        const composerFormElement = options.composerForm();
        const composerHasFocus =
          document.activeElement instanceof Node &&
          composerFormElement?.contains(document.activeElement);
        const composerOwnedKeyboardNow = options.composerOwnsKeyboard();
        const virtualKeyboardTransition = readVirtualKeyboardTransition(
          'window',
          composerOwnedKeyboardNow,
        );
        if (virtualKeyboardTransition.active && !virtualKeyboardTransition.isVisible)
          markLayoutKeyboardResize();
        const layoutKeyboardResize =
          composerHasFocus &&
          viewportHeightChanged &&
          window.innerHeight < previousViewportHeight &&
          visualViewport != null &&
          visualViewport.height < previousViewportHeight;
        if (layoutKeyboardResize) {
          layoutKeyboardVisible = true;
          markLayoutKeyboardResize();
        }
        const closingLayoutKeyboard =
          composerHasFocus &&
          viewportHeightChanged &&
          window.innerHeight > previousViewportHeight &&
          layoutKeyboardVisible;
        if (closingLayoutKeyboard) {
          layoutKeyboardVisible = false;
          markLayoutKeyboardResize();
        }
        if (
          !viewportWidthChanged &&
          (!viewportHeightChanged ||
            virtualKeyboardTransition.active ||
            layoutKeyboardResize ||
            closingLayoutKeyboard) &&
          (composerHasFocus ||
            (virtualKeyboardTransition.active && virtualKeyboardTransition.ownedByComposer))
        ) {
          return;
        }
      }
      // A scroll/resize produced by the SAME held-down pointer gesture that
      // is (or just did) open the popover — e.g. the browser's native
      // autoscroll-while-selecting kicking in as a drag-select nears the
      // viewport edge — is not "the user moved on"; it's the gesture that
      // anchors the popover still in progress. Ignore movement events while
      // any pointer button is held; the dismiss re-arms the instant it's
      // released. Checked last (not as an early return) so the viewport/
      // keyboard-transition bookkeeping above still runs while the pointer
      // is down — only the final act of dismissing is suppressed.
      if (options.isPointerDown()) return;
      closeForMovement();
    };
    const dismissVisualViewport = (event: Event) => {
      const composerFormElement = options.composerForm();
      const composerHasFocus =
        document.activeElement instanceof Node &&
        composerFormElement?.contains(document.activeElement);
      const composerOwnedKeyboardNow = options.composerOwnsKeyboard();
      const virtualKeyboardTransition =
        visualViewport?.scale === 1
          ? readVirtualKeyboardTransition('visual-viewport', composerOwnedKeyboardNow)
          : { active: false, isVisible: false, ownedByComposer: composerOwnedKeyboardNow };
      if ((event.type === 'resize' || event.type === 'scroll') && layoutKeyboardResizeActive) {
        if (event.type === 'scroll' && layoutKeyboardScrollsSeen < 2) {
          layoutKeyboardScrollsSeen += 1;
          return;
        }
        if (event.type === 'resize') return;
        layoutKeyboardResizeActive = false;
      }
      if (
        (event.type === 'resize' || event.type === 'scroll') &&
        virtualKeyboardTransition.active &&
        (composerHasFocus || virtualKeyboardTransition.ownedByComposer)
      ) {
        return;
      }
      // See the matching guard at the end of `dismiss` above — checked last
      // so the keyboard-transition bookkeeping above still runs while a
      // pointer is held; only the final dismissal is suppressed.
      if (options.isPointerDown()) return;
      closeForMovement();
    };
    // A cancel/submit that only returns focus to the pre-open owner (or drops
    // it entirely) still leaves the composer "in charge" of the in-flight
    // keyboard close, so the latch above should survive it. But once focus
    // lands on something outside this popover entirely, the interaction has
    // genuinely moved on — drop the latch so a later keyboard-close resize is
    // free to dismiss (see "an external visual-viewport keyboard close
    // dismisses a collapsed popover").
    const forgetComposerKeyboardOwnershipOnExternalFocus = (event: FocusEvent) => {
      if (options.isRestoringFocus()) return;
      const panel = options.panel();
      if (event.target instanceof Node && panel?.contains(event.target)) {
        // Focus genuinely returned to the composer (e.g. the user tapped
        // away and back while the keyboard stayed up). A keyboard
        // interaction it triggers from here should be able to establish
        // ownership again, rather than staying forgotten until the whole
        // transition settles.
        keyboardOwnershipForgotten.delete('window');
        keyboardOwnershipForgotten.delete('visual-viewport');
        return;
      }
      // document.body is where the platform (and our own restoreFocus() calls)
      // parks focus when the previously-focused element is removed or isn't
      // focusable — it is never a real destination the user chose, so it
      // isn't evidence the interaction moved on.
      if (event.target === document.body) return;
      // The user has deliberately moved focus to a real destination outside
      // the popover (e.g. tabbing out to another control). A later movement
      // dismissal's restoreFocus() must not steal focus back from it, so
      // drop the saved restoration target along with the keyboard latches.
      // Mark ownership forgotten (not just clear it) so `expanded` or a
      // leftover draft can't immediately re-claim it as composer-owned on
      // the very next event while the keyboard is still visible.
      options.onFocusMovedOutside();
      delete virtualKeyboardOwnedByComposer.window;
      delete virtualKeyboardOwnedByComposer['visual-viewport'];
      keyboardOwnershipForgotten.add('window');
      keyboardOwnershipForgotten.add('visual-viewport');
    };
    const windowScrollOptions: AddEventListenerOptions = { capture: true, passive: true };
    const visualViewportScrollOptions: AddEventListenerOptions = { passive: true };
    window.addEventListener('scroll', dismiss, windowScrollOptions);
    window.addEventListener('resize', dismiss);
    window.addEventListener('focusin', forgetComposerKeyboardOwnershipOnExternalFocus);
    visualViewport?.addEventListener('scroll', dismissVisualViewport, visualViewportScrollOptions);
    visualViewport?.addEventListener('resize', dismissVisualViewport);
    return () => {
      for (const frame of Object.values(virtualKeyboardTransitionFrames)) {
        if (frame !== undefined) window.cancelAnimationFrame(frame);
      }
      for (const frame of layoutKeyboardSettleFrames) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', dismiss, windowScrollOptions);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('focusin', forgetComposerKeyboardOwnershipOnExternalFocus);
      visualViewport?.removeEventListener(
        'scroll',
        dismissVisualViewport,
        visualViewportScrollOptions,
      );
      visualViewport?.removeEventListener('resize', dismissVisualViewport);
    };
  });
}

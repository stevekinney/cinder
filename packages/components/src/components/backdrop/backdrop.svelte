<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status beta
   * @purpose Full-viewport fixed scrim primitive for custom overlay patterns such as loading dimmers and image lightboxes.
   * @tag overlay
   * @tag scrim
   * @useWhen Providing a full-screen dimming layer behind a custom overlay that is not modal, drawer, or sheet.
   * @useWhen Building a loading state that dims the full viewport while an async operation runs.
   * @avoidWhen Interrupting the user for a decision — use modal or alert-dialog which manage focus and Escape automatically.
   * @avoidWhen Showing a side panel — use drawer instead.
   * @avoidWhen Showing structured content in a dialog — use modal, drawer, or sheet, which render their own native `<dialog>::backdrop` scrim.
   * @related modal, drawer, sheet
   */

  /*
   * Backdrop is a low-level primitive: it dims/captures pointer events and locks
   * body scroll (`scrollLocked`, default true), but it does NOT trap focus or
   * isolate the content behind it from the keyboard. A keyboard user can still
   * Tab to page content under an open backdrop. When you need that isolation
   * (a full-page loading dimmer, a lightbox), apply `inert` to your page-content
   * container while the backdrop is open and pair it with `@lostgradient/cinder/focus-trap`.
   * Escape dispatches through the shared overlay stack and invokes the scrim's
   * click path when an `onclick` callback is provided.
   */
  export type { BackdropProps } from './backdrop.types.ts';
</script>

<script lang="ts">
  import { fade } from 'svelte/transition';
  import type { BackdropProps } from './backdrop.types.ts';
  import { lockBodyScroll, pushEscapeHandler } from '../../_internal/overlay.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { useReducedMotion } from '../../utilities/use-reduced-motion.svelte.ts';

  const DEFAULT_TRANSITION_DURATION = 200;

  let {
    open,
    invisible = false,
    scrollLocked = true,
    transitionDurationMilliseconds = DEFAULT_TRANSITION_DURATION,
    onclick,
    class: className,
    children,
    ...rest
  }: BackdropProps = $props();

  // Respect prefers-reduced-motion: collapse the fade to an instant show/hide so
  // the scrim does not animate for users who have opted out of motion.
  const reducedMotion = useReducedMotion();
  const effectiveDuration = $derived(reducedMotion.current ? 0 : transitionDurationMilliseconds);

  // SSR/hydration gate (overlay contract — see _internal/overlay.ts / OVERLAY-POLICY.md).
  // `$effect` runs only on the client, so `hydrated` stays false through SSR and the
  // server emits no scrim. Wrapping the element in `{#if hydrated}` keeps SSR HTML free
  // of a dimmer whose scroll lock (a client-only effect) has not yet run.
  let hydrated = $state(false);
  $effect(() => {
    hydrated = true;
  });

  $effect(() => {
    if (!open || !scrimElement || !onclick) return;
    return pushEscapeHandler((event) => {
      if (event.defaultPrevented) return;
      event.preventDefault();
      scrimElement?.click();
    });
  });

  // Lock body scroll while the scrim is present — including the fade-out outro, so
  // the page can't scroll under a still-visible dimmer. We track the rendered scrim
  // element rather than keying on `open`: the {#if open} block sets `scrimElement` on
  // intro (bind:this) and clears it on a genuine close (guarded onoutroend), so the
  // lock is held for the element's full visible lifetime. Counted lock — safe to
  // nest with other overlays.
  let scrimElement: HTMLElement | undefined = $state();
  $effect(() => {
    if (!scrimElement || !scrollLocked) return;
    const release = lockBodyScroll();
    return release;
  });
</script>

{#if hydrated && open}
  <!--
    The scrim itself is decorative chrome. With no children it is hidden from
    assistive technology (aria-hidden). But when `children` are rendered — e.g. a
    loading <Spinner role="status">"Loading…"</Spinner> — the wrapper must NOT be
    aria-hidden, or that announced content is silenced for screen readers.
  -->
  <div
    bind:this={scrimElement}
    {...rest}
    aria-hidden={children ? undefined : 'true'}
    class={classNames('cinder-backdrop', invisible && 'cinder-backdrop--invisible', className)}
    data-cinder-invisible={invisible ? '' : undefined}
    {onclick}
    transition:fade={{ duration: effectiveDuration }}
    onoutroend={() => {
      // Only clear on a genuine close. If `open` flipped back to true during the
      // outro, a keyless {#if} reuses this node and cancels the outro — but guard
      // against any late/zero-duration outro callback releasing the lock while the
      // scrim is still open and visible.
      if (!open) scrimElement = undefined;
    }}
  >
    {#if children}
      {@render children()}
    {/if}
  </div>
{/if}

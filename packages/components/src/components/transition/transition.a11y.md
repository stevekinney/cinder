# Transition — Accessibility Rationale

## What this component is — and what it isn't

`transition.svelte` (and its sibling `presence.svelte`) is a **headless mount-coordination primitive**. It does exactly one thing: it keeps a wrapping `<div>` in the DOM long enough for an enter or exit animation to finish, then unmounts it. It ships two modes — a CSS-driven presence wrapper that exposes `data-cinder-state` (`open`/`closed`) and `data-cinder-presence` (`entering`/`entered`/`exiting`/`exited`) for you to animate against, and a thin pass-through to a Svelte `transition:` function. That's the whole surface.

It is intentionally _not_ a widget. It has no role, no `tabindex`, no keyboard handlers, no `aria-*` attributes of its own, and no concept of "open" beyond the presence state attributes it stamps for your CSS. Think of it as a piece of plumbing that the overlay components in this library — `modal`, `drawer`, `sheet`, `accordion-item` — compose on top of. The accessibility semantics live in _those_ components, not here.

## Why there is no ARIA here

A role is a promise to assistive technology about what an element _is_ and how a user can operate it. This primitive makes no such promise: it doesn't know whether the content it wraps is a dialog, a tooltip, a disclosure panel, or just a fading-in card. Stamping a fixed role (`dialog`, `region`, anything) on the wrapper would be a lie in every case where the consumer meant something else, and it would silently collide with the role the consumer _does_ set on the same subtree.

So the wrapper is a plain `<div>`. Every attribute you pass — `role`, `aria-modal`, `aria-labelledby`, `id`, `tabindex` — is spread straight through via `{...rest}` onto that wrapper, untouched. The contract is deliberate: **the consumer owns the semantics, the primitive owns the timing.** If you're animating a dialog, you (or the `modal` component) put `role="dialog"` and `aria-modal="true"` on it through this pass-through; the primitive will faithfully forward them and never overwrite them.

Because the wrapper carries no role and no `tabindex`, it is transparent to the accessibility tree and to the tab order. It does not become a focus stop, it does not announce itself, and it does not change how the wrapped content is read. That transparency is the correct behavior for plumbing.

## The key concern: `prefers-reduced-motion`

This component _animates the appearance and disappearance of content_, which puts it squarely in scope for [`prefers-reduced-motion`](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html). Users who set that preference are telling the platform that motion can cause discomfort, vestibular disorientation, or nausea. Honoring it is not optional polish — for some users it's the difference between a usable interface and a physically unpleasant one.

The crucial thing to understand is **where the motion actually comes from**, because that determines who is responsible for reducing it:

- In **CSS-driven (`Presence`) mode**, this primitive does not define any animation. It only toggles the `data-cinder-state` / `data-cinder-presence` attributes; _your stylesheet_ supplies the `transition` or `@keyframes` that react to those attributes. That means the reduced-motion gate also lives in your stylesheet. Wrap the moving declarations in `@media (prefers-reduced-motion: no-preference)`, or zero them out under `@media (prefers-reduced-motion: reduce)`:

  ```css
  /* Motion only when the user hasn't asked us to stop. */
  @media (prefers-reduced-motion: no-preference) {
    [data-cinder-presence='entering'] {
      transition:
        opacity 200ms ease,
        transform 200ms ease;
    }
  }
  ```

  The primitive's exit timing follows whatever duration your CSS reports through `getComputedStyle`. When reduced motion collapses your transition to `0ms`, `getPresenceExitDuration` reads that zero and the wrapper unmounts on the next animation frame instead of waiting — so reducing motion in CSS also makes the unmount instant, which is exactly what you want. **No JavaScript change is required; correct CSS gives you correct behavior for free.**

- In **Svelte `transition:` mode**, the motion comes from the transition function you pass (`fade`, `fly`, your own). Svelte's built-in transitions do not consult `prefers-reduced-motion` on their own. If you use this mode, you are responsible for respecting the preference — read it at the call site (for example with cinder's reduced-motion helper or a `matchMedia('(prefers-reduced-motion: reduce)')` check) and pass a `duration: 0` / no-op transition when the user has opted out, or gate which transition function you hand in.

> [!WARNING] Reduced motion is the consumer's job to wire up.
> This primitive will never animate _on its own_, so it can't violate the preference by itself — but it also can't enforce it for you. Whichever mode you use, make sure the motion you supply is gated on `prefers-reduced-motion`. A component that animates unconditionally is not done.

## It must not trap or delay focus

The other accessibility hazard for any mount/unmount coordinator is **focus**, and the design here is to stay out of its way entirely:

- **The primitive never moves focus.** It sets no `tabindex`, calls no `.focus()`, and installs no focus trap. Keyboard focus management for an overlay (moving focus into a dialog on open, restoring it to the trigger on close, trapping Tab inside a modal) belongs to the semantic component layered on top — `modal` and friends own that, because only they know the pattern. Putting focus logic in this primitive would fight with the consumer's own focus handling.

- **The exit delay must not strand focus.** The whole point of this component is that content lingers in the DOM during its exit animation so it can fade out gracefully. That creates a subtle trap risk: if the element being animated away — or anything inside it — still holds focus while it's mid-exit, a keyboard or screen-reader user can be left focused on content that is visually vanishing and semantically gone. The consumer must move focus to a sensible place (typically the element that triggered the overlay) **at the moment of dismissal**, not after the exit animation completes. Do not wait for `onExitComplete` to relocate focus; by then the user has been stuck on disappearing content for the duration of the animation.

- **`forceMount` keeps content in the accessibility tree.** When `forceMount` is set, the wrapper stays mounted even while `closed`/`exited` so you can animate it without remounting. A plain hidden-but-present `<div>` is still reachable by Tab and still read by screen readers. If you use `forceMount` for content that should be inert while closed, _you_ must make it inert. Use a mechanism that removes it from **both** the accessibility tree **and** the keyboard Tab order — `hidden`, `display: none`, or `inert` — driven off the `data-cinder-state="closed"` attribute. Do **not** reach for `aria-hidden` alone: it hides content from assistive technology but leaves focusable descendants in the Tab order, so a keyboard user can still tab into invisible content (use it only when paired with making the subtree unfocusable). The primitive deliberately does not apply any of these for you, because "hidden" means different things for a permanently-mounted tooltip versus a closed dialog, and guessing wrong would hide content that should stay available.

## Summary of the contract

The primitive owns _timing_; the consumer owns _semantics, motion preferences, and focus_. It forwards every attribute you give it, animates nothing on its own, traps nothing, and moves focus nowhere. Used correctly — reduced-motion-gated CSS (or a reduced-motion-aware transition function), focus relocated on dismissal, and `forceMount` content made inert when closed — it is fully accessible. Used carelessly, it will faithfully animate an inaccessible overlay into and out of existence, because making the overlay accessible was never its job.

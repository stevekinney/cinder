---
'@lostgradient/cinder': minor
---

Carousel: fix a `{...rest}` bug that silently dropped consumer `onkeydown`/`onmouseenter`/`onmouseleave`/`onfocusin`/`onfocusout` handlers, add an `onSlideChange` callback, add four `--cinder-carousel-*` theming hooks, and add `indicators`/`indicatorLimit` for large slide counts.

- **Behavior change:** `loop` now defaults to `false`. Previously the carousel always wrapped past the first/last slide; `Previous`/`Next` now clamp and disable at the ends instead. Pass `loop` to restore the old always-wrap behavior. Autoplay also stops at the last slide instead of wrapping when `loop` is unset. Wrapping (with `loop`) remains seamless only for the first cycle through the deck — see the Carousel README for why.
- `onkeydown`, `onmouseenter`, `onmouseleave`, `onfocusin`, and `onfocusout` passed to `<Carousel>` were previously overwritten by the component's own internal handlers of the same name (a `{...rest}` spread ordering bug) — they're now composed, consumer handler first. A consumer `onkeydown` that calls `event.preventDefault()` now suppresses the carousel's own Arrow/Home/End handling.
- New `onSlideChange?: (index, slide) => void`, called whenever the carousel's own navigation (keyboard, controls, dot picker, autoplay, or native scroll settling) moves the active slide. Never fires for a parent-driven `activeIndex` update.
- New CSS custom properties on `.cinder-carousel`: `--cinder-carousel-slide-size`, `--cinder-carousel-gap`, `--cinder-carousel-aspect-ratio`, `--cinder-carousel-dot-size`.
- New `indicators?: 'dots' | 'counter' | 'none'` and `indicatorLimit?: number` (default `8`): above the limit the picker automatically switches from dots to a compact `"N / total"` counter unless `indicators` is set explicitly.

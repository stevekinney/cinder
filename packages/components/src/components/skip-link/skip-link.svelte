<script lang="ts" module>
  /**
   * @cinder
   * @category navigation
   * @status stable
   * @purpose Visually hidden skip link that moves keyboard focus to a landmark element, letting keyboard and screen reader users bypass repeated navigation.
   * @tag navigation
   * @tag accessibility
   * @tag skip-link
   * @useWhen Providing a keyboard shortcut to jump past site-wide navigation directly to the main content area.
   * @useWhen Meeting WCAG 2.4.1 (Bypass Blocks) without adding visible chrome to the layout.
   * @avoidWhen The page has no repeated navigation block — a skip link adds no value on single-panel layouts.
   * @avoidWhen The target region already receives focus naturally without intervention.
   * @related visually-hidden
   */
  export type { SkipLinkProps } from './skip-link.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import { useReducedMotion } from '../../utilities/use-reduced-motion.svelte.ts';
  import VisuallyHidden from '../visually-hidden/visually-hidden.svelte';

  import type { SkipLinkProps } from './skip-link.types.ts';

  let { target, class: className, children }: SkipLinkProps = $props();

  const motion = useReducedMotion();

  const mergedClass = $derived(classNames(className));

  // Marks a target whose tabindex SkipLink is currently managing, so re-activating
  // before focus leaves does not recapture the temporary `-1` as the "original"
  // value or stack a second restore listener.
  const MANAGED_ATTRIBUTE = 'data-cinder-skip-link-managed';

  function handleClick(event: MouseEvent) {
    const element = document.getElementById(target);

    if (!element) {
      // No matching element — let the native anchor jump happen.
      return;
    }

    event.preventDefault();

    const alreadyManaged = element.hasAttribute(MANAGED_ATTRIBUTE);

    if (!alreadyManaged) {
      // First activation: capture the genuine original tabindex, mark the
      // element as managed, and arm a one-shot restore on the next blur.
      const originalTabIndex = element.getAttribute('tabindex');
      element.setAttribute(MANAGED_ATTRIBUTE, '');
      element.setAttribute('tabindex', '-1');

      element.addEventListener(
        'blur',
        () => {
          element.removeAttribute(MANAGED_ATTRIBUTE);
          if (originalTabIndex === null) {
            element.removeAttribute('tabindex');
          } else {
            element.setAttribute('tabindex', originalTabIndex);
          }
        },
        { once: true },
      );
    }

    // Focus without the browser's implicit scroll so the reduced-motion-aware
    // scrollIntoView below is the single, authoritative scroll.
    element.focus({ preventScroll: true });
    element.scrollIntoView({
      behavior: motion.current ? 'auto' : 'smooth',
      block: 'start',
    });
  }
</script>

<VisuallyHidden as="a" href="#{target}" focusable class={mergedClass} onclick={handleClick}>
  {#if children}
    {@render children()}
  {:else}
    Skip to main content
  {/if}
</VisuallyHidden>

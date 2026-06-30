<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status beta
   * @purpose Auto-scrolling horizontal or vertical ticker that loops content continuously with reduced-motion-safe behavior.
   * @tag marquee
   * @tag ticker
   * @useWhen Showing repeating announcements, partner logos, or status strips in a constrained space.
   * @useWhen You need CSS-driven, seamless loop motion that can pause on hover/focus.
   * @avoidWhen Users need to manually scroll and inspect static overflow content. | scroll-area
   * @avoidWhen Information should remain fixed in place without motion emphasis.
   * @related scroll-area, banner
   */
  export type { MarqueeDirection, MarqueeProps } from './marquee.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';

  import type { MarqueeProps } from './marquee.types.ts';

  let {
    direction = 'horizontal',
    duration = '24s',
    gap = '1.5rem',
    label,
    pauseOnHover = true,
    pauseOnFocus = true,
    class: customClassName,
    children,
    ...rest
  }: MarqueeProps = $props();

  const mergedClassName = $derived(classNames('cinder-marquee', customClassName));
  const normalizedLabel = $derived(
    typeof label === 'string' && label.trim().length > 0 ? label.trim() : undefined,
  );
  const ariaLabelledby = $derived((rest as { 'aria-labelledby'?: string })['aria-labelledby']);
  const hasAccessibleName = $derived(
    Boolean(normalizedLabel) ||
      (typeof ariaLabelledby === 'string' && ariaLabelledby.trim().length > 0),
  );
  const role = $derived(hasAccessibleName ? 'region' : undefined);
  let primaryTrackItem: HTMLDivElement | undefined = $state();
  let duplicateTrackItem: HTMLDivElement | undefined = $state();
  let duplicateReady = $state(false);
  let duplicateCloneVersion = 0;

  function rewriteUrlReferences(value: string, idMap: Map<string, string>): string {
    let nextValue = value;
    for (const [originalId, duplicateId] of idMap) {
      nextValue = nextValue.replaceAll(`url(#${originalId})`, `url(#${duplicateId})`);
    }

    return nextValue;
  }

  function rewriteCloneIds(root: HTMLElement): void {
    const elementsWithIds = root.querySelectorAll<HTMLElement>('[id]');
    if (elementsWithIds.length > 0) {
      duplicateCloneVersion += 1;
      const idMap = new Map<string, string>();
      for (const element of elementsWithIds) {
        const originalId = element.getAttribute('id');
        if (!originalId) continue;
        const duplicateId = `${originalId}--cinder-marquee-duplicate-${duplicateCloneVersion}`;
        idMap.set(originalId, duplicateId);
        element.setAttribute('id', duplicateId);
      }

      if (idMap.size > 0) {
        const referenceAttributes = [
          'href',
          'xlink:href',
          'fill',
          'stroke',
          'filter',
          'mask',
          'clip-path',
          'marker-start',
          'marker-mid',
          'marker-end',
          'aria-labelledby',
          'aria-describedby',
        ];
        const urlReferenceAttributes = new Set([
          'fill',
          'stroke',
          'filter',
          'mask',
          'clip-path',
          'marker-start',
          'marker-mid',
          'marker-end',
        ]);

        root.querySelectorAll<HTMLElement>('*').forEach((element) => {
          for (const attribute of referenceAttributes) {
            const value = element.getAttribute(attribute);
            if (!value) continue;

            if (urlReferenceAttributes.has(attribute)) {
              const rewrittenUrlValue = rewriteUrlReferences(value, idMap);
              if (rewrittenUrlValue !== value) {
                element.setAttribute(attribute, rewrittenUrlValue);
              }
              continue;
            }

            let nextValue = value;
            for (const [originalId, duplicateId] of idMap) {
              if (attribute === 'href' || attribute === 'xlink:href') {
                if (nextValue === `#${originalId}`) {
                  nextValue = `#${duplicateId}`;
                }
                continue;
              }

              if (attribute === 'aria-labelledby' || attribute === 'aria-describedby') {
                nextValue = nextValue
                  .split(/\s+/)
                  .map((token) => (token === originalId ? duplicateId : token))
                  .join(' ');
              }
            }

            if (nextValue !== value) {
              element.setAttribute(attribute, nextValue);
            }
          }

          const styleValue = element.getAttribute('style');
          if (!styleValue) return;
          const rewrittenStyle = rewriteUrlReferences(styleValue, idMap);
          if (rewrittenStyle !== styleValue) {
            element.setAttribute('style', rewrittenStyle);
          }
        });
      }
    }

    root
      .querySelectorAll<
        HTMLElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >('input, select, textarea, button, fieldset, output, option, optgroup, [name]')
      .forEach((element) => {
        element.removeAttribute('name');
      });
  }

  function syncDuplicateTrack() {
    if (!primaryTrackItem || !duplicateTrackItem) return;
    const clone = primaryTrackItem.cloneNode(true) as HTMLElement;
    rewriteCloneIds(clone);
    duplicateTrackItem.replaceChildren(...clone.childNodes);
    duplicateReady = true;
  }

  function duplicateTrack(node: HTMLDivElement) {
    duplicateTrackItem = node;
    syncDuplicateTrack();

    return {
      destroy() {
        if (duplicateTrackItem === node) {
          duplicateTrackItem = undefined;
        }
      },
    };
  }

  function makeScrollableRegionFocusable(node: HTMLDivElement) {
    node.tabIndex = 0;
  }

  $effect(() => {
    if (!primaryTrackItem || !duplicateTrackItem) return;
    duplicateReady = false;
    syncDuplicateTrack();
    const observer = new MutationObserver(() => {
      syncDuplicateTrack();
    });
    observer.observe(primaryTrackItem, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });
    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(() => {
            syncDuplicateTrack();
          });
    resizeObserver?.observe(primaryTrackItem);
    return () => {
      observer.disconnect();
      resizeObserver?.disconnect();
    };
  });
</script>

<div
  {...rest}
  class={mergedClassName}
  data-cinder-direction={direction}
  data-cinder-pause-hover={pauseOnHover ? 'true' : 'false'}
  data-cinder-pause-focus={pauseOnFocus ? 'true' : 'false'}
  data-cinder-ready={duplicateReady ? 'true' : 'false'}
  aria-label={normalizedLabel}
  {role}
  style:--cinder-marquee-duration={duration}
  style:--cinder-marquee-gap={gap}
>
  <div
    class="cinder-marquee__viewport"
    role="group"
    aria-label={normalizedLabel ? `${normalizedLabel} scroll area` : 'Marquee content'}
    use:makeScrollableRegionFocusable
  >
    <div class="cinder-marquee__track">
      <div class="cinder-marquee__item" bind:this={primaryTrackItem}>
        {@render children()}
      </div>
      <div class="cinder-marquee__item" aria-hidden="true" inert use:duplicateTrack></div>
    </div>
  </div>
</div>

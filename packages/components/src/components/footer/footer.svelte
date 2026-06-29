<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status beta
   * @purpose Footer composition primitive with brand copy, grouped links, and legal row content.
   * @tag layout
   * @tag navigation
   * @tag footer
   * @useWhen Building page-level footer chrome with grouped resource links and legal text.
   * @useWhen Keeping lower-page wayfinding and compliance links in one responsive region.
   * @avoidWhen You need top-level route switching with active state handling. | navigation-bar
   * @avoidWhen You need dense in-content navigation rather than page chrome.
   * @related navigation-bar, side-navigation, container, grid
   */
  export type { FooterGroup, FooterLink, FooterProps } from './footer.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import type { FooterProps } from './footer.types.ts';

  let {
    brand,
    description,
    groups = [],
    legalLinks = [],
    copyright,
    label = 'Footer',
    class: className,
    ...rest
  }: FooterProps = $props();
</script>

<footer {...rest} class={classNames('cinder-footer', className)} aria-label={label}>
  <div class="cinder-footer__main">
    <section class="cinder-footer__brand">
      {#if brand}
        <h2 class="cinder-footer__brand-title">{brand}</h2>
      {/if}
      {#if description}
        <p class="cinder-footer__brand-description">{description}</p>
      {/if}
    </section>

    {#if groups.length > 0}
      <div class="cinder-footer__groups">
        {#each groups as group (group.id)}
          <nav aria-label={group.title}>
            <h3 class="cinder-footer__group-title">{group.title}</h3>
            <ul class="cinder-footer__list">
              {#each group.links as link (link.id)}
                <li><a class="cinder-footer__link" href={link.href}>{link.label}</a></li>
              {/each}
            </ul>
          </nav>
        {/each}
      </div>
    {/if}
  </div>

  {#if copyright || legalLinks.length > 0}
    <div class="cinder-footer__legal">
      {#if copyright}
        <span>{copyright}</span>
      {/if}

      {#if legalLinks.length > 0}
        <ul class="cinder-footer__legal-links">
          {#each legalLinks as link (link.id)}
            <li><a class="cinder-footer__link" href={link.href}>{link.label}</a></li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</footer>

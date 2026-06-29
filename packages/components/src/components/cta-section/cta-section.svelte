<script lang="ts" module>
  /**
   * @cinder
   * @category domain
   * @status stable
   * @purpose Focused conversion band with a short headline, supporting copy, and primary/secondary action buttons.
   * @tag marketing
   * @tag cta
   * @tag conversion
   * @useWhen Inserting a repeated “ready to get started?” conversion section between page segments.
   * @useWhen Prompting sign-up or demo actions after readers consume feature or testimonial content.
   * @avoidWhen Building a full top-of-page hero with complex media and long-form messaging. | hero-section
   * @avoidWhen Capturing an email address inline with form fields. | newsletter-section
   * @related hero-section, newsletter-section, button, container
   */
  export type { CtaSectionAlign, CtaSectionProps, CtaSectionTone } from './cta-section.types.ts';
</script>

<script lang="ts">
  import Button from '../button/button.svelte';
  import Container from '../container/container.svelte';
  import { classNames } from '../../utilities/class-names.ts';

  import type { CtaSectionProps } from './cta-section.types.ts';

  let {
    as = 'section',
    title,
    description,
    primaryActionLabel,
    secondaryActionLabel,
    onPrimaryClick,
    onSecondaryClick,
    align = 'center',
    tone = 'default',
    maxWidth = 'wide',
    class: className,
    children,
    ...rest
  }: CtaSectionProps = $props();
</script>

<svelte:element
  this={as}
  class={classNames('cinder-cta-section', className)}
  data-cinder-align={align}
  data-cinder-tone={tone}
  {...rest}
>
  <Container {maxWidth}>
    <div class="cinder-cta-section__inner">
      <h2 class="cinder-cta-section__title">{title}</h2>
      {#if description}
        <p class="cinder-cta-section__description">{description}</p>
      {/if}
      <div class="cinder-cta-section__actions">
        <Button label={primaryActionLabel} variant="primary" onclick={onPrimaryClick} />
        {#if secondaryActionLabel}
          <Button label={secondaryActionLabel} variant="secondary" onclick={onSecondaryClick} />
        {/if}
      </div>
      {#if children}
        <div class="cinder-cta-section__extra">{@render children()}</div>
      {/if}
    </div>
  </Container>
</svelte:element>

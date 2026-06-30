<script lang="ts" module>
  /**
   * @cinder
   * @category domain
   * @status stable
   * @purpose Email capture section with heading copy, inline email field, and submit action for newsletter signups.
   * @tag marketing
   * @tag newsletter
   * @tag form
   * @useWhen Collecting subscriber email addresses in a dedicated marketing section.
   * @useWhen Adding a lightweight signup form beneath blog or CTA content.
   * @avoidWhen Showing a generic call-to-action with buttons only and no data entry. | cta-section
   * @avoidWhen Collecting multi-field account or billing details. | form-section
   * @related cta-section, form-section, input, button, container
   */
  export type { NewsletterSectionProps } from './newsletter-section.types.ts';
</script>

<script lang="ts">
  import Button from '../button/button.svelte';
  import Container from '../container/container.svelte';
  import Input from '../input/input.svelte';
  import { classNames } from '../../utilities/class-names.ts';

  import type { NewsletterSectionProps } from './newsletter-section.types.ts';

  let {
    as = 'section',
    title,
    description,
    emailLabel = 'Email address',
    emailPlaceholder,
    submitLabel = 'Subscribe',
    onSubmit,
    consentText,
    maxWidth = 'wide',
    class: className,
    children,
    ...rest
  }: NewsletterSectionProps = $props();

  const uid = $props.id();
  const emailId = $derived(`cinder-newsletter-${uid}-email`);
  let email = $state('');

  function handleSubmit(event: SubmitEvent): void {
    if (!onSubmit) {
      return;
    }

    event.preventDefault();
    onSubmit(email.trim());
  }
</script>

<svelte:element this={as} class={classNames('cinder-newsletter-section', className)} {...rest}>
  <Container {maxWidth}>
    <div class="cinder-newsletter-section__inner">
      <header class="cinder-newsletter-section__header">
        <h2 class="cinder-newsletter-section__title">{title}</h2>
        {#if description}
          <p class="cinder-newsletter-section__description">{description}</p>
        {/if}
      </header>

      <form class="cinder-newsletter-section__form" onsubmit={handleSubmit}>
        <div class="cinder-newsletter-section__field">
          <Input
            id={emailId}
            type="email"
            label={emailLabel}
            value={email}
            onValueChange={(next) => {
              email = next;
            }}
            placeholder={emailPlaceholder}
            required
          />
        </div>
        <Button type="submit" label={submitLabel} variant="primary" />
      </form>

      {#if consentText}
        <p class="cinder-newsletter-section__consent">{consentText}</p>
      {/if}
      {#if children}
        <div class="cinder-newsletter-section__extra">{@render children()}</div>
      {/if}
    </div>
  </Container>
</svelte:element>

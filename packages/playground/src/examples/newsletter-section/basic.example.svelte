<script lang="ts" module>
  export const title = 'NewsletterSection';
  export const description =
    'NewsletterSection with email capture form, helper text, and submission callback.';
</script>

<script lang="ts">
  import { NewsletterSection } from '@lostgradient/cinder/newsletter-section';

  function handleSubmit(email: string) {
    // eslint-disable-next-line no-console
    console.log('newsletter signup', email);
  }
</script>

<NewsletterSection
  title="Stay ahead with monthly product insights"
  description="Get shipping tips, release notes, and real-world examples from the Cinder team."
  consentText="No spam. One email per month. Unsubscribe anytime."
  onSubmit={handleSubmit}
>
  We respect your inbox and your privacy.
</NewsletterSection>

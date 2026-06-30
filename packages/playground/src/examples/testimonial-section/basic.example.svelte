<script lang="ts" module>
  export const title = 'TestimonialSection';
  export const description =
    'TestimonialSection showing attributed customer quotes in a responsive grid.';
</script>

<script lang="ts">
  import { TestimonialSection } from '@lostgradient/cinder/testimonial-section';

  const testimonials = [
    {
      quote: 'Cinder helped us replace six internal UI kits with one consistent system.',
      name: 'Priya Singh',
      role: 'VP Product',
      company: 'Kiteworks',
    },
    {
      quote: 'Our engineers now focus on business value instead of reinventing controls.',
      name: 'Marcus Chen',
      role: 'Engineering Manager',
      company: 'Northline',
    },
    {
      quote: 'The accessibility defaults saved us weeks of QA cycles.',
      name: 'Casey Murray',
      role: 'Staff Designer',
      company: 'Anchor',
    },
  ];
</script>

<TestimonialSection
  title="Loved by product teams"
  description="From startups to large orgs, teams use Cinder to deliver consistent interfaces quickly."
  {testimonials}
  layout="grid"
  columns={3}
/>

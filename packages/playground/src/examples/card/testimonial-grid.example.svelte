<script lang="ts" module>
  export const title = 'Testimonial grid';
  export const description =
    'A social-proof section recipe: Cards hold customer blockquotes with an Avatar byline attributing each quote to a person and company.';
</script>

<script lang="ts">
  import { Avatar } from '@lostgradient/cinder/avatar';
  import { Card } from '@lostgradient/cinder/card';
  import { Container } from '@lostgradient/cinder/container';

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

<section style="padding-block: var(--cinder-space-10);">
  <Container maxWidth="wide">
    <div style="display: grid; gap: var(--cinder-space-6);">
      <header style="display: grid; gap: var(--cinder-space-2); max-inline-size: 60ch;">
        <h2 style="margin: 0; font-size: var(--cinder-text-3xl);">Loved by product teams</h2>
        <p style="margin: 0; color: var(--cinder-text-muted);">
          From startups to large orgs, teams use Cinder to deliver consistent interfaces quickly.
        </p>
      </header>

      <ul
        style="list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: var(--cinder-space-4);"
      >
        {#each testimonials as item (item.name)}
          <li>
            <Card>
              <blockquote
                style="margin: 0; font-size: var(--cinder-text-lg); line-height: var(--cinder-leading-relaxed);"
              >
                “{item.quote}”
              </blockquote>
              <div
                style="margin-block-start: var(--cinder-space-4); display: flex; align-items: center; gap: var(--cinder-space-3);"
              >
                <Avatar name={item.name} size="sm" />
                <div style="display: grid; gap: var(--cinder-space-1);">
                  <p
                    style="margin: 0; font-size: var(--cinder-text-sm); font-weight: var(--cinder-font-semibold); line-height: var(--cinder-leading-snug);"
                  >
                    {item.name}
                  </p>
                  <p
                    style="margin: 0; color: var(--cinder-text-muted); font-size: var(--cinder-text-sm); line-height: var(--cinder-leading-snug);"
                  >
                    {item.role} · {item.company}
                  </p>
                </div>
              </div>
            </Card>
          </li>
        {/each}
      </ul>
    </div>
  </Container>
</section>

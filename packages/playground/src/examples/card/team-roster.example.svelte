<script lang="ts" module>
  export const title = 'Team roster';
  export const description =
    'A meet-the-team section recipe: profile Cards with an Avatar, role, bio, and profile link, plus an AvatarGroup summary row above the grid.';
</script>

<script lang="ts">
  import { Avatar } from '@lostgradient/cinder/avatar';
  import { AvatarGroup } from '@lostgradient/cinder/avatar-group';
  import { Card } from '@lostgradient/cinder/card';
  import { Container } from '@lostgradient/cinder/container';

  const members = [
    {
      name: 'Jordan Lee',
      role: 'Engineering Lead',
      bio: 'Leads our platform architecture and component quality initiatives.',
      href: '#',
    },
    {
      name: 'Taylor Green',
      role: 'Product Designer',
      bio: 'Designs cohesive product experiences across web and mobile.',
      href: '#',
    },
    {
      name: 'Riley Park',
      role: 'Developer Advocate',
      bio: 'Helps teams adopt Cinder with docs, examples, and workshops.',
      href: '#',
    },
  ];

  const avatarItems = members.map((member) => ({ name: member.name }));
</script>

<section style="padding-block: var(--cinder-space-10);">
  <Container maxWidth="wide">
    <div style="display: grid; gap: var(--cinder-space-6);">
      <header style="display: grid; gap: var(--cinder-space-2); max-inline-size: 60ch;">
        <h2 style="margin: 0; font-size: var(--cinder-text-3xl);">Meet the team behind Cinder</h2>
        <p style="margin: 0; color: var(--cinder-text-muted);">
          A cross-functional group of engineers, designers, and educators.
        </p>
      </header>

      <div>
        <AvatarGroup avatars={avatarItems} label="Team members" maxVisible={6} />
      </div>

      <ul
        style="list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: var(--cinder-space-4);"
      >
        {#each members as member (member.name)}
          <li>
            <Card>
              <div style="display: flex; align-items: center; gap: var(--cinder-space-3);">
                <Avatar name={member.name} size="lg" />
                <div style="display: grid; gap: var(--cinder-space-1);">
                  <p
                    style="margin: 0; font-size: var(--cinder-text-sm); font-weight: var(--cinder-font-semibold); line-height: var(--cinder-leading-snug);"
                  >
                    {member.name}
                  </p>
                  <p
                    style="margin: 0; color: var(--cinder-text-muted); font-size: var(--cinder-text-sm); line-height: var(--cinder-leading-snug);"
                  >
                    {member.role}
                  </p>
                </div>
              </div>
              <p
                style="margin: var(--cinder-space-3) 0 0; color: var(--cinder-text-muted); font-size: var(--cinder-text-sm);"
              >
                {member.bio}
              </p>
              <a
                href={member.href}
                aria-label={`View ${member.name}'s profile`}
                style="display: inline-flex; margin-block-start: var(--cinder-space-3); font-size: var(--cinder-text-sm); color: var(--cinder-accent-text); text-decoration: none;"
              >
                View profile
              </a>
            </Card>
          </li>
        {/each}
      </ul>
    </div>
  </Container>
</section>

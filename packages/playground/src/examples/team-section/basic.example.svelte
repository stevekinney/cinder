<script lang="ts" module>
  export const title = 'TeamSection';
  export const description =
    'TeamSection with member cards, bios, profile links, and avatar-group summary.';
</script>

<script lang="ts">
  import { TeamSection } from '@lostgradient/cinder/team-section';

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
</script>

<TeamSection
  title="Meet the team behind Cinder"
  description="A cross-functional group of engineers, designers, and educators."
  {members}
  showAvatarGroup
/>

# TeamSection

Renders a team roster section with avatars, roles, bios, and optional profile links.

## Usage

```svelte
<script lang="ts">
  import TeamSection from '@lostgradient/cinder/team-section';

  const members = [
    { name: 'Alex Morgan', role: 'CEO', bio: 'Leads product and strategy.' },
    { name: 'Riley Chen', role: 'CTO', bio: 'Owns architecture and platform.' },
    { name: 'Jordan Lee', role: 'Design Lead', bio: 'Shapes the design system.' },
  ];
</script>

<TeamSection title="Meet the team" {members} />
```

## Props

<!-- generated:props:start -->

| Prop               | Type                                                                                        | Required | Default          | Description                                                     |
| ------------------ | ------------------------------------------------------------------------------------------- | -------- | ---------------- | --------------------------------------------------------------- |
| `as`               | `"section"` \| `"div"`                                                                      | no       | `"section"`      | Wrapper element tag.                                            |
| `avatarGroupLabel` | `string`                                                                                    | no       | `"Team members"` | Label for the AvatarGroup summary.                              |
| `class`            | `string`                                                                                    | no       | —                | Custom class merged with `.cinder-team-section`.                |
| `columns`          | `2` \| `3` \| `4`                                                                           | no       | `3`              | Grid column count.                                              |
| `description`      | `string`                                                                                    | no       | —                | Optional section description text.                              |
| `maxWidth`         | `"prose"` \| `"narrow"` \| `"wide"` \| `"full"`                                             | no       | `"wide"`         | Max width token forwarded to Container.                         |
| `members`          | { avatarSrc?: `string`; bio?: `string`; href?: `string`; name: `string`; role: `string` }[] | yes      | —                | Team members to render.                                         |
| `showAvatarGroup`  | `boolean`                                                                                   | no       | `false`          | Whether to render a compact AvatarGroup summary above the grid. |
| `title`            | `string`                                                                                    | no       | —                | Optional section heading text.                                  |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

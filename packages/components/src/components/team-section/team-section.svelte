<script lang="ts" module>
  /**
   * @cinder
   * @category domain
   * @status stable
   * @purpose Marketing team roster section that renders profile cards with avatars, roles, and optional profile links.
   * @tag marketing
   * @tag team
   * @tag profile
   * @useWhen Introducing company teammates with names, titles, and short bios.
   * @useWhen Showing a small "meet the team" grid in landing and about pages.
   * @avoidWhen Showing customer quotes and outcomes rather than internal team members. | testimonial-section
   * @avoidWhen Rendering brand/customer logos without person profiles. | logo-cloud
   * @related testimonial-section, logo-cloud, avatar, avatar-group, card, container
   */
  export type { TeamSectionMember, TeamSectionProps } from './team-section.types.ts';
</script>

<script lang="ts">
  import Avatar from '../avatar/avatar.svelte';
  import AvatarGroup from '../avatar-group/avatar-group.svelte';
  import Card from '../card/card.svelte';
  import Container from '../container/container.svelte';
  import { classNames } from '../../utilities/class-names.ts';

  import type { TeamSectionProps } from './team-section.types.ts';

  let {
    as = 'section',
    title,
    description,
    members,
    columns = 3,
    showAvatarGroup = false,
    avatarGroupLabel = 'Team members',
    maxWidth = 'wide',
    class: className,
    ...rest
  }: TeamSectionProps = $props();

  const avatarItems = $derived(
    members.map((member) =>
      member.avatarSrc ? { name: member.name, src: member.avatarSrc } : { name: member.name },
    ),
  );

  function avatarProps(name: string, src: string | undefined): { name: string; src?: string } {
    return src ? { name, src } : { name };
  }
</script>

<svelte:element
  this={as}
  class={classNames('cinder-team-section', className)}
  data-cinder-columns={String(columns)}
  {...rest}
>
  <Container {maxWidth}>
    <div class="cinder-team-section__inner">
      {#if title}
        <header class="cinder-team-section__header">
          <h2 class="cinder-team-section__title">{title}</h2>
          {#if description}
            <p class="cinder-team-section__description">{description}</p>
          {/if}
        </header>
      {/if}

      {#if showAvatarGroup}
        <div class="cinder-team-section__summary">
          <AvatarGroup avatars={avatarItems} label={avatarGroupLabel} maxVisible={6} />
        </div>
      {/if}

      <ul class="cinder-team-section__list">
        {#each members as member, index (`${member.name}-${index}`)}
          <li class="cinder-team-section__item">
            <Card>
              <div class="cinder-team-section__person">
                <Avatar {...avatarProps(member.name, member.avatarSrc)} size="lg" />
                <div class="cinder-team-section__meta">
                  <p class="cinder-team-section__name">{member.name}</p>
                  <p class="cinder-team-section__role">{member.role}</p>
                </div>
              </div>
              {#if member.bio}
                <p class="cinder-team-section__bio">{member.bio}</p>
              {/if}
              {#if member.href}
                <a
                  class="cinder-team-section__link"
                  href={member.href}
                  aria-label={`View ${member.name}'s profile`}
                >
                  View profile
                </a>
              {/if}
            </Card>
          </li>
        {/each}
      </ul>
    </div>
  </Container>
</svelte:element>

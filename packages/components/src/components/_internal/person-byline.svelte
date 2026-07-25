<script lang="ts">
  import Avatar from '../avatar/avatar.svelte';

  let {
    name,
    role,
    avatarSrc,
    avatarSize = 'sm',
  }: {
    name: string;
    role?: string | undefined;
    avatarSrc?: string | undefined;
    avatarSize?: 'sm' | 'lg';
  } = $props();
</script>

<div class="cinder-person-byline">
  <Avatar {...avatarSrc ? { name, src: avatarSrc } : { name }} size={avatarSize} />
  <div class="cinder-person-byline__meta">
    <p class="cinder-person-byline__name">{name}</p>
    {#if role}
      <p class="cinder-person-byline__role">{role}</p>
    {/if}
  </div>
</div>

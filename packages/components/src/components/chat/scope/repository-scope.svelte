<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';

  type Repository = {
    id: number;
    owner: string;
    name: string;
  };

  export type RepositoryScopeProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
    /** Array of repositories in scope */
    repositories: Repository[];
    /** Compact mode for active session header */
    compact?: boolean;
    class?: string;
  };
</script>

<script lang="ts">
  import { FolderGit2 } from '../../icons/index.ts';
  import Badge from '../../badge/badge.svelte';
  import EmptyState from '../../empty-state.svelte';
  import { classNames } from '../../../utilities/class-names.ts';

  let {
    repositories = [],
    compact = false,
    class: className,
    ...rest
  }: RepositoryScopeProps = $props();

  const count = $derived(repositories.length);
  const badgeLabel = $derived(count === 1 ? '1 repository' : `${count} repositories`);
  const ariaLabel = $derived(`Scope: ${badgeLabel}`);
</script>

{#if count === 0}
  <EmptyState title="No repositories" description="Add repositories to your project to enable chat">
    {#snippet icon()}
      <FolderGit2 class="icon-sm" />
    {/snippet}
  </EmptyState>
{:else}
  <div class={classNames('repository-scope', className)} data-compact={compact} {...rest}>
    <Badge class="u-intrinsic-flex-item" variant="neutral" aria-label={ariaLabel}>
      {badgeLabel}
    </Badge>
    <ul class="repository-list">
      {#each repositories as repo (repo.id)}
        <li class="repository-item">
          <span class="repository-owner">{repo.owner}</span>
          <span class="repository-separator">/</span>
          <span class="repository-name">{repo.name}</span>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .repository-scope {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-3);
    min-width: 0;
  }

  .repository-scope[data-compact='true'] {
    gap: var(--cinder-space-2);
  }

  .repository-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-2);
    min-width: 0;
  }

  .repository-scope[data-compact='true'] .repository-list {
    display: none;
  }

  .repository-item {
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-muted);
    display: flex;
    align-items: center;
    gap: var(--cinder-space-1);
    min-width: 0;
  }

  .repository-owner {
    color: var(--cinder-text-subtle);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .repository-separator {
    color: var(--cinder-text-disabled);
    flex-shrink: 0;
  }

  .repository-name {
    color: var(--cinder-text-muted);
    font-weight: var(--cinder-font-medium);
    min-width: 0;
    overflow-wrap: anywhere;
  }
</style>

<script lang="ts" module>
  type Repository = {
    id: number;
    owner: string;
    name: string;
  };

  export type RepositoryScopeHeaderCompositionStoryProps = {
    repositories: Repository[];
  };
</script>

<script lang="ts">
  import Button from '../../button.svelte';
  import RepositoryScope from './repository-scope.svelte';

  let { repositories = [] }: RepositoryScopeHeaderCompositionStoryProps = $props();
</script>

<div class="header-composition-story">
  <RepositoryScope {repositories} compact />
  <Button type="button" size="sm" variant="ghost-danger">End Session</Button>
</div>

<style>
  .header-composition-story {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--cinder-space-3);
    max-inline-size: 40rem;
    padding: var(--cinder-space-3);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-md);
    background: var(--cinder-surface);
  }

  .header-composition-story :global(.repository-scope) {
    flex: 1 1 auto;
    min-width: 0;
  }

  .header-composition-story :global(button) {
    flex-shrink: 0;
  }
</style>

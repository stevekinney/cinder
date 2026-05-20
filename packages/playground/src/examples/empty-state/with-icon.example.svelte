<script lang="ts" module>
  export const title = 'With icon';
  export const description = 'An icon snippet above the title.';
</script>

<script lang="ts">
  import { EmptyState } from 'cinder/empty-state';
</script>

<EmptyState title="No documents" description="Upload your first document to get started.">
  {#snippet icon()}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
    </svg>
  {/snippet}
</EmptyState>

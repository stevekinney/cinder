<script lang="ts" module>
  export const title = 'Basic section heading';
  export const description =
    'A leveled section heading with description and actions, rendered without adding extra header landmarks.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { SectionHeading } from '@lostgradient/cinder/section-heading';
</script>

<SectionHeading
  title="Project overview"
  description="Track the current milestone, recent activity, and next steps."
>
  {#snippet actions()}
    <Button size="sm" variant="secondary" label="Share" />
  {/snippet}
</SectionHeading>

<script lang="ts" module>
  export const title = 'Invite link share card';
  export const description = 'A compact share card for copying and sharing an invite link.';
</script>

<script lang="ts">
  import { ShareCard } from '@lostgradient/cinder/share-card';
</script>

<div style="max-width: 22rem;">
  <ShareCard
    value="https://app.example.com/invite/abc123xyz"
    title="Invite a teammate"
    description="Share this link to invite someone to your workspace."
    copyLinkLabel="Copy invite link"
    copiedLabel="Copied!"
  />
</div>

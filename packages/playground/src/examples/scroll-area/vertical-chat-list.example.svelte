<script lang="ts" module>
  export const title = 'Vertical chat transcript';
  export const description =
    'A vertical scroll region with a meaningful accessible name, so assistive technology treats it as a landmark via the derived role="region".';
</script>

<script lang="ts">
  import { ScrollArea } from '@lostgradient/cinder/scroll-area';
</script>

<ScrollArea label="Chat transcript" maxHeight="16rem">
  <p>Avery: morning! ready to pair on the migration?</p>
  <p>Jordan: yep — pulling the branch now.</p>
  <p>Avery: heads up, the seed script changed.</p>
  <p>Jordan: noticed. running it locally first.</p>
  <p>Avery: thanks. ping me when you hit the auth step.</p>
  <p>Jordan: will do. tests are green on my end.</p>
  <p>Avery: nice. I'll start drafting the changelog.</p>
  <p>Jordan: cool — should I cherry-pick the hotfix in?</p>
  <p>Avery: yes please, then squash before review.</p>
  <p>Jordan: pushed. take a look when you can.</p>
</ScrollArea>

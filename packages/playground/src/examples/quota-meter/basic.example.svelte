<script lang="ts" module>
  export const title = 'QuotaMeter';
  export const description = 'Show finite quota consumption with an accessible value summary.';
</script>

<script lang="ts">
  import { QuotaMeter } from '@lostgradient/cinder/quota-meter';
</script>

<QuotaMeter used={72} />

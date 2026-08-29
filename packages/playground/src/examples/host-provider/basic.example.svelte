<script lang="ts" module>
  export const title = 'Desktop host';
  export const description = 'Provide host platform information to descendants.';
</script>

<script lang="ts">
  import { HostProvider } from '@lostgradient/cinder/host-provider';
</script>

<HostProvider platform="macos" safeHeaderLeft="4rem" safeHeaderRight="1rem">
  <p>Desktop-aware application surface</p>
</HostProvider>

<script lang="ts" module>
  export const title = 'Managed setting';
  export const description = 'Explain why a setting is controlled by policy.';
</script>

<script lang="ts">
  import { PolicyLock } from '@lostgradient/cinder/policy-lock';
</script>

<PolicyLock id="retention-policy" reason="Managed by your organization" source="Security policy" />

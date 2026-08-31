# PolicyLock

PolicyLock explains why a setting is managed, names the policy source when available, and displays the policy scope as a Badge. Use it with SettingRow when a setting is visible but not locally editable.

## Usage

```svelte
<script lang="ts">
  import { PolicyLock } from '@lostgradient/cinder/policy-lock';
</script>

<PolicyLock id="retention-policy" reason="Managed by your organization" source="Security policy" />
```

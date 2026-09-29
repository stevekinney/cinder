# PolicyLock

PolicyLock explains why a setting is managed, names the policy source when available, and displays the policy scope as a Badge. Use it with SettingRow when a setting is visible but not locally editable.

## Usage

```svelte
<script lang="ts">
  import { PolicyLock } from '@lostgradient/cinder';
</script>

<PolicyLock id="retention-policy" reason="Managed by your organization" source="Security policy" />
```

`reason` is the required explanation; `source` and `scope` add context when the host can name the policy that applies. PolicyLock is explanatory UI, not an authorization check and not a disabled form control. Pair it with [`SettingRow`](../setting-row/README.md), keep the setting visible, and let the host decide whether a request-access or retry action is available.

## Props

<!-- generated:props:start -->

| Prop     | Type     | Required | Default | Description                                                                                                       |
| -------- | -------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| `class`  | `string` | no       | —       | Additional class merged with the component's root class.                                                          |
| `id`     | `string` | yes      | —       | Stable id for the lock explanation.                                                                               |
| `reason` | `string` | yes      | —       | Required explanation of why the setting is managed.                                                               |
| `scope`  | `string` | no       | —       | Policy scope, rendered as a Badge when non-empty—`scope=""` renders nothing, the same as omitted (`{#if scope}`). |
| `source` | `string` | no       | —       | Name of the policy source, when the host can name it.                                                             |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.
<!-- generated:variables:end -->

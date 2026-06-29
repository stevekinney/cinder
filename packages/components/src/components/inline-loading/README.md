# InlineLoading

Inline async-action status indicator that transitions from loading to success or error with accessible announcements.

## Usage

```svelte
<script lang="ts">
  import InlineLoading from '@lostgradient/cinder/inline-loading';

  let status = $state<'inactive' | 'active' | 'finished' | 'error'>('inactive');
</script>

<InlineLoading {status} description="Saving changes" />
```

## Props

<!-- generated:props:start -->

| Prop              | Type                                                    | Required | Default      | Description                                                                              |
| ----------------- | ------------------------------------------------------- | -------- | ------------ | ---------------------------------------------------------------------------------------- |
| `class`           | `string`                                                | no       | —            | Extra classes appended to the root element.                                              |
| `description`     | `string`                                                | no       | —            | Visible status label rendered next to the indicator.                                     |
| `iconDescription` | `string`                                                | no       | —            | Accessible status wording used by announcements when no visible description is provided. |
| `status`          | `"inactive"` \| `"active"` \| `"finished"` \| `"error"` | no       | `"inactive"` | Lifecycle state for the inline async action indicator.                                   |
| `successDelay`    | `number`                                                | no       | `1500`       | Delay in milliseconds before auto-resetting `finished` back to `inactive`.               |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->
<!-- generated:subcomponents:end -->

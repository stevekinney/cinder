# SubscriptionBadge

Opinionated Badge variant that communicates billing subscription states with a standardized tone, icon, and human-readable label — never relying on color alone.

## Usage

```svelte
<script lang="ts">
  import { SubscriptionBadge } from '@lostgradient/cinder/subscription-badge';
</script>
```

## Guidance

### Use When

- Displaying the billing state of a subscription in a dashboard, invoice list, or account settings page.
- Annotating a plan name, customer row, or invoice line with its current payment lifecycle state.

### Avoid When

- The subscription state is not one of the six recognized values — use Badge directly with a custom label.
- You need an interactive control that changes the state — use a Button or Select.

## Props

<!-- generated:props:start -->

| Prop    | Type                                                                                      | Required | Default | Description                                                                                       |
| ------- | ----------------------------------------------------------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------- |
| `class` | `string`                                                                                  | no       | —       | Extra classes forwarded to the underlying Badge.                                                  |
| `state` | `"active"` \| `"trialing"` \| `"past-due"` \| `"canceled"` \| `"expired"` \| `"refunded"` | yes      | —       | The billing lifecycle state to display. Determines the badge tone, icon, and label automatically. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

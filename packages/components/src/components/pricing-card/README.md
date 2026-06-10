# PricingCard

Presents a single pricing plan with its name, price, feature list, an optional caveat line, and a call-to-action button, with a selectable/active state.

## Usage

```svelte
<script lang="ts">
  import { PricingCard } from '@lostgradient/cinder/pricing-card';
</script>
```

## Guidance

### Use When

- Letting users compare and select subscription tiers or product plans.
- Highlighting one tier as selected or recommended in a pricing comparison.

### Avoid When

- Showing generic grouped content without a distinct price or CTA — use card instead.
- Displaying a single key metric in isolation — use stat or stat-group instead.

## Props

<!-- generated:props:start -->

| Prop       | Type       | Required | Default | Description                                            |
| ---------- | ---------- | -------- | ------- | ------------------------------------------------------ |
| `caveat`   | `string`   | no       | —       | Optional footnote or caveat beneath the features list. |
| `class`    | `string`   | no       | —       | Custom class merged with `.cinder-pricing-card`.       |
| `cta`      | `string`   | yes      | —       | Label for the call-to-action button.                   |
| `features` | `string`[] | yes      | —       | Feature strings to display in the bulleted list.       |
| `name`     | `string`   | yes      | —       | Plan name displayed as the card heading.               |
| `price`    | `string`   | yes      | —       | Price string, e.g. "$9/mo" or "Free".                  |
| `selected` | `boolean`  | no       | `false` | Whether this card is the currently selected plan.      |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

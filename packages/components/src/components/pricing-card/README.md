# PricingCard

Presents a single pricing plan with its name, price, feature list, an optional caveat line, and a call-to-action button, with a selectable/active state.

## Usage

```svelte
<script lang="ts">
  import PricingCard from '@lostgradient/cinder/pricing-card';
</script>

<div style="max-inline-size: 22rem;">
  <PricingCard
    name="Growth"
    price="$29/mo"
    features={['Unlimited projects', '50 GB storage', 'Email & chat support', 'Advanced analytics']}
    caveat="Billed annually. Monthly billing available at $35/mo."
    callToActionLabel="Start free trial"
    onPlanSelect={() => {}}
  />
</div>
```

Pass `href` (plus optional `target`/`rel`) to render the CTA as a link instead of a button. `onPlanSelect` is optional in that case, but not mutually exclusive with `href` — pass both to navigate and still run a side effect such as analytics:

```svelte
<PricingCard
  name="Pro"
  price="$29/mo"
  features={['Unlimited projects', '50 GB storage', 'Priority support']}
  callToActionLabel="Continue to checkout"
  href="/checkout?plan=pro"
  target="_blank"
  rel="noopener noreferrer"
  onPlanSelect={() => {
    // e.g. track an analytics event before navigation
  }}
/>
```

## Guidance

### Use When

- Letting users compare and select subscription tiers or product plans.
- Highlighting one tier as selected or recommended in a pricing comparison.

### Avoid When

- Showing generic grouped content without a distinct price or CTA — use card instead.
- Displaying a single key metric in isolation — use statistic or statistic-group instead.

## Props

<!-- generated:props:start -->

| Prop                | Type               | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------- | ------------------ | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `callToActionLabel` | `string`           | yes      | —       | Label for the call-to-action button.                                                                                                                                                                                                                                                                                                                                                    |
| `caveat`            | `string`           | no       | —       | Optional footnote or caveat beneath the features list; the runtime API also accepts a template-only snippet (e.g. a terms link).                                                                                                                                                                                                                                                        |
| `class`             | `string`           | no       | —       | Custom class merged with `.cinder-pricing-card`.                                                                                                                                                                                                                                                                                                                                        |
| `features`          | `string`[]         | yes      | —       | Feature strings to display in the bulleted list.                                                                                                                                                                                                                                                                                                                                        |
| `href`              | `string`           | no       | —       | When set, the CTA renders as an anchor (`<a href>`) instead of a `<button>`. The outer card structure stays a fixed `<div>` — only the inner CTA element swaps.                                                                                                                                                                                                                         |
| `name`              | `string`           | yes      | —       | Plan name displayed as the card heading.                                                                                                                                                                                                                                                                                                                                                |
| `price`             | `string`           | yes      | —       | Price string, e.g. "$9/mo" or "Free".                                                                                                                                                                                                                                                                                                                                                   |
| `rel`               | `string` \| `null` | no       | —       | `rel` for the CTA anchor. Only applied when `href` is set.                                                                                                                                                                                                                                                                                                                              |
| `selected`          | `boolean`          | no       | `false` | Whether this card is the currently selected plan.                                                                                                                                                                                                                                                                                                                                       |
| `onPlanSelect`      | `(opaque)`         | no       | —       | Called when the CTA is activated. Required when `href` is not set — the button is the only way to activate the CTA. Optional when `href` is set, but not mutually exclusive with it — pass both to navigate and also run a side effect such as analytics tracking (mirrors the cinder Button anchor branch). Not expressible in JSON Schema; see the component types for the signature. |
| `target`            | `(opaque)`         | no       | —       | `target` for the CTA anchor. Only applied when `href` is set. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

# NavigationBar

Top-level horizontal navigation bar for primary site or app destinations.

## Usage

```svelte
<script lang="ts">
  import NavigationBar from 'cinder/navigation-bar';
</script>

<NavigationBar />
```

## Props

<!-- generated:props:start -->

| Prop             | Type       | Required | Default | Description                                                                                                                |
| ---------------- | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `mobileMenuOpen` | `boolean`  | no       | —       | Two-way bindable open state of the mobile menu.                                                                            |
| `navAriaLabel`   | `string`   | no       | —       | Accessible name for the <nav> landmark. Wins over any aria-label passed via rest. Default 'Main navigation'.               |
| `actions`        | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `brand`          | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `class`          | `(opaque)` | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |
| `items`          | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `menuToggle`     | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

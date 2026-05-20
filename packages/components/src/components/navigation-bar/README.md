# NavigationBar

A NavigationBar component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import NavigationBar from 'cinder/navigation-bar';
</script>

<NavigationBar />
```

## Props

<!-- generated:props:start -->

| Prop             | Type       | Required | Default | Description                                                                                                  |
| ---------------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| `mobileMenuOpen` | `boolean`  | no       | —       | Two-way bindable open state of the mobile menu.                                                              |
| `navAriaLabel`   | `string`   | no       | —       | Accessible name for the <nav> landmark. Wins over any aria-label passed via rest. Default 'Main navigation'. |
| `actions`        | `(opaque)` | —        | —       | function-or-snippet                                                                                          |
| `brand`          | `(opaque)` | —        | —       | function-or-snippet                                                                                          |
| `class`          | `(opaque)` | —        | —       | unknown-shape                                                                                                |
| `items`          | `(opaque)` | —        | —       | function-or-snippet                                                                                          |
| `menuToggle`     | `(opaque)` | —        | —       | function-or-snippet                                                                                          |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

# NavigationBar

Top-level navigation bar for primary site or app destinations. Use
`placement="top"` for header navigation and `placement="bottom"` for a mobile
tab-bar composition.

## Usage

```svelte
<script lang="ts">
  import { NavigationBar } from '@lostgradient/cinder/navigation-bar';
  import { NavigationItem } from '@lostgradient/cinder/navigation-item';
</script>

<NavigationBar>
  {#snippet items({ variant })}
    <NavigationItem {variant} href="/home" active>Home</NavigationItem>
    <NavigationItem {variant} href="/settings">Settings</NavigationItem>
  {/snippet}
</NavigationBar>
```

Bottom placement keeps the same link semantics and leaves viewport pinning to
the app shell:

```svelte
<div style="position: sticky; bottom: 0;">
  <NavigationBar placement="bottom" showLabels="active">
    {#snippet items({ variant })}
      <NavigationItem {variant} href="/home" active>
        <span aria-hidden="true">⌂</span>
        <span data-cinder-navigation-label>Home</span>
      </NavigationItem>
      <NavigationItem {variant} href="/settings">
        <span aria-hidden="true">⚙</span>
        <span data-cinder-navigation-label>Settings</span>
      </NavigationItem>
    {/snippet}
  </NavigationBar>
</div>
```

## Props

<!-- generated:props:start -->

| Prop             | Type                                  | Required | Default    | Description                                                                                                                                                                                                                                                                                         |
| ---------------- | ------------------------------------- | -------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`          | `string`                              | no       | —          | Custom class merged onto the root `<nav>` element.                                                                                                                                                                                                                                                  |
| `mobileMenuOpen` | `boolean`                             | no       | —          | Two-way bindable open state of the mobile menu.                                                                                                                                                                                                                                                     |
| `navAriaLabel`   | `string`                              | no       | —          | Accessible name for the <nav> landmark. Wins over any aria-label passed via rest. Default 'Main navigation'.                                                                                                                                                                                        |
| `placement`      | `"top"` \| `"bottom"`                 | no       | `"top"`    | Visual placement mode. `bottom` renders a mobile tab-bar composition, but still does not fix or stick itself to the viewport.                                                                                                                                                                       |
| `showLabels`     | `"always"` \| `"active"` \| `"never"` | no       | `"always"` | Label visibility for mobile bottom-tab compositions. Hidden labels remain in the accessibility tree when wrapped in `[data-cinder-navigation-label]`.                                                                                                                                               |
| `actions`        | `(opaque)`                            | no       | —          | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                          |
| `brand`          | `(opaque)`                            | no       | —          | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                          |
| `items`          | `(opaque)`                            | yes      | —          | Receives a context object with the current variant. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                      |
| `menuToggle`     | `(opaque)`                            | no       | —          | Snippet receiving toggle button attributes. Consumer renders the actual <button> and should mark decorative glyphs or icons inside it as aria-hidden so the button name comes from text or aria-label, not the ornament. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

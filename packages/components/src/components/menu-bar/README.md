# MenuBar

Command menubar for application chrome such as File, Edit, and View menus.

## Usage

```svelte
<script lang="ts">
  import { MenuBar } from '@lostgradient/cinder/menu-bar';
</script>
```

## Guidance

### Use When

- Building a desktop-style command menubar with dropdown command groups.
- Exposing top-level application menus that need arrow-key traversal and optional submenus.

### Avoid When

- Linking between routes or sections — use navigation-bar or side-navigation instead.
- Showing one standalone trigger with a menu — use dropdown, dropdown-menu, and dropdown-item directly.

## Props

<!-- generated:props:start -->

| Prop         | Type       | Required | Default | Description                                                                                                          |
| ------------ | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| `class`      | `string`   | no       | —       | Additional class names merged with the component's root class.                                                       |
| `id`         | `string`   | no       | —       | HTML id applied to the menubar root element. Auto-generated when omitted.                                            |
| `label`      | `string`   | no       | —       | Accessible label for the menubar, applied as aria-label. Ignored when labelledBy is set. Default `Application menu`. |
| `labelledBy` | `string`   | no       | —       | ID of an existing element whose text labels the menubar, applied as aria-labelledby. Takes precedence over label.    |
| `menus`      | `(opaque)` | yes      | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.              |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

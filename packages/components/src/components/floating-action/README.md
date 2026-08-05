# FloatingAction

Circular button representing the single most important action on a screen.

## Usage

```svelte
<script lang="ts">
  import FloatingAction from '@lostgradient/cinder/floating-action';
</script>

<div style="display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
  <!-- Primary filled floating action (default) -->
  <FloatingAction aria-label="Add item">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  </FloatingAction>

  <!-- Secondary variant -->
  <FloatingAction variant="secondary" aria-label="Edit">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  </FloatingAction>

  <!-- Surface variant -->
  <FloatingAction variant="surface" aria-label="Share">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  </FloatingAction>

  <!-- Extended shape with icon + label -->
  <FloatingAction shape="extended" aria-label="Compose new message">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
    Compose
  </FloatingAction>

  <!-- Small size -->
  <FloatingAction size="sm" aria-label="Add small">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  </FloatingAction>

  <!-- Large size -->
  <FloatingAction size="lg" aria-label="Add large">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  </FloatingAction>

  <!-- Link floating action -->
  <FloatingAction href="/new" aria-label="Create new item">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  </FloatingAction>

  <!-- Disabled floating action -->
  <FloatingAction disabled aria-label="Add (unavailable)">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  </FloatingAction>
</div>
```

## Guidance

### Use When

- One action dominates the page purpose (compose, add, create).

### Avoid When

- Multiple equally-important actions exist — use a toolbar or button group.
- You need it pinned to the viewport — it doesn't position itself; wrap it in your own fixed/sticky container.

## Props

<!-- generated:props:start -->

| Prop       | Type                                        | Required | Default     | Description                                                                                                                                                                                                                                    |
| ---------- | ------------------------------------------- | -------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`    | `string`                                    | no       | —           | Custom class merged with `.cinder-floating-action`.                                                                                                                                                                                            |
| `disabled` | `boolean`                                   | no       | `false`     | When true, disables the button and prevents interaction.                                                                                                                                                                                       |
| `href`     | `string`                                    | no       | —           | Render as an anchor `<a>` element with this href.                                                                                                                                                                                              |
| `shape`    | `"filled"` \| `"extended"`                  | no       | `"filled"`  | Shape. `filled` = circle, `extended` = pill.                                                                                                                                                                                                   |
| `size`     | `"sm"` \| `"md"` \| `"lg"`                  | no       | `"md"`      | Size of the floating action.                                                                                                                                                                                                                   |
| `variant`  | `"primary"` \| `"secondary"` \| `"surface"` | no       | `"primary"` | Color palette.                                                                                                                                                                                                                                 |
| `children` | `(opaque)`                                  | no       | —           | The icon (or icon + label for extended shape). Always provide `aria-label` when the floating action renders an icon without visible text — i.e. the `filled` shape. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

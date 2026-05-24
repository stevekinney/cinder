# FocusTrap

Traps keyboard focus within a container and restores focus to the previously focused element when the trap deactivates.

## Usage

```svelte
<script lang="ts">
  import FocusTrap from 'cinder/focus-trap';
</script>

<FocusTrap>
  <button>First</button>
  <button>Second</button>
</FocusTrap>
```

## Props

<!-- generated:props:start -->

| Prop            | Type               | Required | Default | Description |
| --------------- | ------------------ | -------- | ------- | ----------- |
| `active`        | `boolean`          | no       | —       |             |
| `class`         | `string`           | no       | —       |             |
| `fallbackFocus` | `string` \| `null` | no       | —       |             |
| `initialFocus`  | `string` \| `null` | no       | —       |             |
| `restoreFocus`  | `boolean`          | no       | —       |             |

<!-- generated:props:end -->

`initialFocus` and `fallbackFocus` accept either selector strings or `HTMLElement`
references. Invalid selectors are ignored so the trap can fall back to the next
available focus target.

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

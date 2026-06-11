# ShareCard

Compact share card with copy-link, copy-text, and native navigator.share actions, with accessible success announcements and graceful fallback when navigator.share is unavailable.

## Usage

```svelte
<script lang="ts">
  import { ShareCard } from '@lostgradient/cinder/share-card';
</script>
```

## Guidance

### Use When

- Offering a quick way to share a link or text with copy and native share options.
- Presenting a result, invite link, or exported report link with sharing affordances.

### Avoid When

- Generating the share text or images — compose ShareCard with your own copy generation logic.
- Posting directly to social media or analytics — wire those externally.

## Props

<!-- generated:props:start -->

| Prop              | Type       | Required | Default | Description                                                                                                                                                    |
| ----------------- | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`           | `string`   | no       | —       | Additional class names merged with `.cinder-share-card`.                                                                                                       |
| `confirmDuration` | `number`   | no       | `2000`  | Duration in ms to show the copied confirmation state.                                                                                                          |
| `copiedLabel`     | `string`   | no       | —       | Label shown after a successful copy.                                                                                                                           |
| `copyLinkLabel`   | `string`   | no       | —       | Label for the copy-link button.                                                                                                                                |
| `description`     | `string`   | no       | —       | Additional descriptive text.                                                                                                                                   |
| `shareLabel`      | `string`   | no       | —       | Label for the native-share button.                                                                                                                             |
| `title`           | `string`   | no       | —       | Human-readable title for the share card.                                                                                                                       |
| `value`           | `string`   | yes      | —       | The URL or text to share/copy.                                                                                                                                 |
| `actions`         | `(opaque)` | no       | —       | Explicit actions to show. When omitted, default copy + native-share actions render. Not expressible in JSON Schema; see the component types for the signature. |
| `preview`         | `(opaque)` | no       | —       | Preview content slot rendered above the actions. Not expressible in JSON Schema; see the component types for the signature.                                    |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

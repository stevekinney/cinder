# ShareCard

Compact share card with copy-link, copy-text, and native navigator.share actions, with accessible success announcements and graceful fallback when navigator.share is unavailable.

## Usage

```svelte
<script lang="ts">
  import ShareCard from '@lostgradient/cinder/share-card';
</script>

<div style="max-width: 22rem;">
  <ShareCard
    value="https://app.example.com/invite/abc123xyz"
    title="Invite a teammate"
    description="Share this link to invite someone to your workspace."
    copyLinkLabel="Copy invite link"
    copiedLabel="Copied!"
  />
</div>
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

| Prop              | Type       | Required | Default       | Description                                                                                                                                                    |
| ----------------- | ---------- | -------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`           | `string`   | no       | —             | Additional class names merged with `.cinder-share-card`.                                                                                                       |
| `confirmDuration` | `number`   | no       | `2000`        | Duration in ms to show the copied confirmation state.                                                                                                          |
| `copiedLabel`     | `string`   | no       | `"Copied!"`   | Label shown after a successful copy.                                                                                                                           |
| `copyLinkLabel`   | `string`   | no       | `"Copy link"` | Label for the copy-link button.                                                                                                                                |
| `description`     | `string`   | no       | —             | Additional descriptive text.                                                                                                                                   |
| `shareLabel`      | `string`   | no       | `"Share"`     | Label for the native-share button.                                                                                                                             |
| `title`           | `string`   | no       | —             | Human-readable title for the share card.                                                                                                                       |
| `value`           | `string`   | yes      | —             | The URL or text to share/copy. Expected to be single-line; see `ShareCardProps.value` for the full multi-line-input contract.                                  |
| `actions`         | `(opaque)` | no       | —             | Explicit actions to show. When omitted, default copy + native-share actions render. Not expressible in JSON Schema; see the component types for the signature. |
| `preview`         | `(opaque)` | no       | —             | Preview content slot rendered above the actions. Not expressible in JSON Schema; see the component types for the signature.                                    |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

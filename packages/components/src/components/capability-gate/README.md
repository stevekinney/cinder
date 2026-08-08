# CapabilityGate

Present feature availability and next action for browser permission or support states, with accessible status text and focus management.

## Usage

```svelte
<script lang="ts">
  import Button from '@lostgradient/cinder/button';
  import CapabilityGate from '@lostgradient/cinder/capability-gate';
  import Link from '@lostgradient/cinder/link';
</script>

<div style="display: flex; flex-direction: column; gap: 1rem;">
  <CapabilityGate feature="Notifications" state="permission-denied" variant="banner">
    {#snippet actions({ dismiss })}
      <Link href="#">Enable in settings</Link>
      <Button size="sm" variant="ghost" label="Dismiss" onclick={dismiss} />
    {/snippet}
  </CapabilityGate>
  <CapabilityGate feature="Offline storage" state="unsupported" variant="callout">
    <p style="font-size: 0.875rem; color: var(--cinder-text-muted); margin: 0;">
      Your browser does not support offline storage. Some features may be limited.
    </p>
  </CapabilityGate>
</div>
```

## Guidance

### Use When

- Surfacing that a feature requires a browser permission such as microphone or notifications.
- Communicating that a feature is unsupported in the current browser with a clear fallback path.

### Avoid When

- Performing the actual feature detection or permission request — wire that in userland.
- Storing permission state — CapabilityGate is a pure presentation component.

## Props

<!-- generated:props:start -->

| Prop        | Type                                                                                                                 | Required | Default    | Description                                                                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------------------- | -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `class`     | `string`                                                                                                             | no       | —          | Additional class names merged with `.cinder-capability-gate`.                                                                                    |
| `feature`   | `string`                                                                                                             | yes      | —          | The feature being gated.                                                                                                                         |
| `state`     | `"supported"` \| `"unsupported"` \| `"permission-needed"` \| `"permission-denied"` \| `"loading"` \| `"unavailable"` | yes      | —          | Current availability state.                                                                                                                      |
| `variant`   | `"inline"` \| `"banner"` \| `"callout"`                                                                              | no       | `"inline"` | Presentation variant.                                                                                                                            |
| `actions`   | `(opaque)`                                                                                                           | no       | —          | Action row content; receives the gate's own `dismiss` function. Not expressible in JSON Schema; see the component types for the signature.       |
| `children`  | `(opaque)`                                                                                                           | no       | —          | Custom content rendered below the status text and before the actions. Not expressible in JSON Schema; see the component types for the signature. |
| `onDismiss` | `(opaque)`                                                                                                           | no       | —          | Called when the gate is dismissed. Not expressible in JSON Schema; see the component types for the signature.                                    |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

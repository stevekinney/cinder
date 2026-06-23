# CapabilityGate

Present feature availability and next action for browser permission or support states, with accessible status text and focus management.

## Usage

```svelte
<script lang="ts">
  import { CapabilityGate } from '@lostgradient/cinder/capability-gate';
</script>
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

| Prop               | Type                                                                                                                 | Required | Default    | Description                                                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- | -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `class`            | `string`                                                                                                             | no       | —          | Additional class names merged with `.cinder-capability-gate`.                                                                                    |
| `dismissAction`    | `string`                                                                                                             | no       | —          | Label for the dismiss action.                                                                                                                    |
| `fallbackAction`   | `string`                                                                                                             | no       | —          | Label for the fallback action.                                                                                                                   |
| `fallbackHref`     | `string`                                                                                                             | no       | —          | Href for a fallback link.                                                                                                                        |
| `feature`          | `string`                                                                                                             | yes      | —          | The feature being gated.                                                                                                                         |
| `primaryAction`    | `string`                                                                                                             | no       | —          | Label for the primary action button.                                                                                                             |
| `state`            | `"supported"` \| `"unsupported"` \| `"permission-needed"` \| `"permission-denied"` \| `"loading"` \| `"unavailable"` | yes      | —          | Current availability state.                                                                                                                      |
| `variant`          | `"inline"` \| `"banner"` \| `"callout"`                                                                              | no       | `"inline"` | Presentation variant.                                                                                                                            |
| `children`         | `(opaque)`                                                                                                           | no       | —          | Custom content rendered below the status text and before the actions. Not expressible in JSON Schema; see the component types for the signature. |
| `ondismiss`        | `(opaque)`                                                                                                           | no       | —          | Called when the gate is dismissed. Not expressible in JSON Schema; see the component types for the signature.                                    |
| `onfallbackaction` | `(opaque)`                                                                                                           | no       | —          | Called when the fallback action button is activated. Not expressible in JSON Schema; see the component types for the signature.                  |
| `onprimaryaction`  | `(opaque)`                                                                                                           | no       | —          | Called when the primary action button is activated. Not expressible in JSON Schema; see the component types for the signature.                   |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

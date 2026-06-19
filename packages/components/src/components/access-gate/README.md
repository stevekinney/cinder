# AccessGate

Authorization presentation gate for controls and sections that stay visible when
the current user is missing an application scope or permission.

## Usage

```svelte
<script lang="ts">
  import { AccessGate } from '@lostgradient/cinder/access-gate';
  import { Button } from '@lostgradient/cinder/button';
</script>

<AccessGate granted={false} reason="Requires scope: workflows:cancel">
  <Button label="Cancel workflow" />
</AccessGate>

<AccessGate
  granted={false}
  variant="section"
  reason="Requires scope: storage:admin"
  requirement="storage:admin"
/>
```

## Props

<!-- generated:props:start -->

| Prop          | Type                      | Required | Default    | Description                                                                                                                          |
| ------------- | ------------------------- | -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `class`       | `string`                  | no       | —          | Custom class merged with the denied-state wrapper or section placeholder.                                                            |
| `granted`     | `boolean`                 | yes      | —          | Whether the consumer-authorized action or section is available.                                                                      |
| `reason`      | `string`                  | yes      | —          | Human-readable explanation shown to users and wired to assistive technology.                                                         |
| `requirement` | `string`                  | no       | —          | Named scope, permission, or policy requirement shown in the section placeholder.                                                     |
| `variant`     | `"inline"` \| `"section"` | no       | `"inline"` | Presentation mode.                                                                                                                   |
| `children`    | `(opaque)`                | no       | —          | Gated content. Rendered untouched when access is granted. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

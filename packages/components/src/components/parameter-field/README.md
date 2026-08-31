# ParameterField

Displays an inherited base parameter and an optional local override. Overrides can be reset to the base value and may carry Unsaved or Experimental badges.

Use the default output for a read-only summary, or provide a child snippet to render a `NumberInput`, `Slider`, or another numeric editor. The snippet receives the effective `value`, whether it is `overridden`, and a `setOverride` callback.

## Usage

```svelte
<script lang="ts">
  import { ParameterField } from '@lostgradient/cinder/parameter-field';
</script>

<ParameterField id="timeout" label="Timeout" base={30} unit="seconds" />
```

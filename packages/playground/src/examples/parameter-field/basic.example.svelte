<script lang="ts" module>
  export const title = 'Parameter override';
  export const description = 'Show an inherited value with a local override.';
</script>

<script lang="ts">
  import { ParameterField } from '@lostgradient/cinder/parameter-field';
</script>

<ParameterField id="timeout" label="Timeout" base={30} unit="seconds" />

<script lang="ts" module>
  export const title = 'Primitive and null values';
  export const description =
    'Each JSON primitive type — string, number, boolean, and null — rendered inline with type-specific color coding. Useful for verifying that scalar fields survive serialization round-trips.';
</script>

<script lang="ts">
  import { JsonViewer } from '@lostgradient/cinder/json-viewer';

  const payload = {
    label: 'activity-result',
    count: 42,
    ratio: 0.9375,
    active: true,
    deprecated: false,
    errorMessage: null,
    emptyString: '',
    negativeOffset: -7,
  };
</script>

<JsonViewer value={payload} />

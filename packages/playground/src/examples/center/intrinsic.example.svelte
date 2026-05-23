<script lang="ts" module>
  export const title = 'Center intrinsic';
  export const description =
    'Intrinsic mode centers based on the natural width of the content rather than filling the container.';
</script>

<script lang="ts">
  import { Center } from 'cinder/center';
</script>

<Center intrinsic>
  <h2>A heading</h2>
  <p>Centered to content width, not container width.</p>
  <button type="button">Trailing action</button>
</Center>

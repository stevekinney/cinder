<script lang="ts" module>
  export const title = 'Bidirectional scroll';
  export const description =
    'A bounded viewport that scrolls both axes when the inner content exceeds both dimensions. Useful for wide tables or grids embedded in a fixed-size surface.';
</script>

<script lang="ts">
  import { ScrollArea } from '@lostgradient/cinder/scroll-area';
</script>

<ScrollArea direction="both" maxHeight="12rem" maxWidth="24rem">
  <table>
    <thead>
      <tr>
        <th>Run</th>
        <th>Status</th>
        <th>Duration</th>
        <th>Triggered by</th>
        <th>Commit</th>
        <th>Branch</th>
      </tr>
    </thead>
    <tbody>
      <tr
        ><td>#4821</td><td>passed</td><td>4m 12s</td><td>avery</td><td>9c1f8a2</td><td>main</td></tr
      >
      <tr
        ><td>#4820</td><td>failed</td><td>3m 47s</td><td>jordan</td><td>2b4d701</td><td
          >feat/scroll-area</td
        ></tr
      >
      <tr
        ><td>#4819</td><td>passed</td><td>4m 03s</td><td>avery</td><td>7e9a318</td><td>main</td></tr
      >
      <tr
        ><td>#4818</td><td>passed</td><td>3m 58s</td><td>renovate</td><td>1a02fce</td><td
          >chore/deps</td
        ></tr
      >
      <tr
        ><td>#4817</td><td>cancelled</td><td>0m 41s</td><td>jordan</td><td>54bb6ad</td><td
          >feat/grid-list</td
        ></tr
      >
    </tbody>
  </table>
</ScrollArea>

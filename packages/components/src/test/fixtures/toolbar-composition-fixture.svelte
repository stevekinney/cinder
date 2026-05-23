<script lang="ts">
  import Toolbar from '../../components/toolbar/index.ts';
  import Button from '../../components/button/index.ts';
  import NumberInput from '../../components/number-input/index.ts';
  import Segment from '../../components/segment/index.ts';
  import SegmentedControl from '../../components/segmented-control/index.ts';

  let width = $state<number | null>(768);
</script>

<Toolbar aria-label="Preview controls">
  <Toolbar.Group>
    <SegmentedControl
      id="viewport"
      label="Viewport"
      hideLabel
      density="toolbar"
      value="mobile"
      onchange={() => {}}
    >
      <Segment value="mobile">Mobile</Segment>
      <Segment value="desktop">Desktop</Segment>
    </SegmentedControl>
  </Toolbar.Group>

  <Toolbar.Group>
    <NumberInput
      id="custom-width"
      aria-label="Custom width"
      value={width}
      onchange={(value) => {
        width = value;
      }}
    />
  </Toolbar.Group>

  <Toolbar.Spacer />

  <Toolbar.Group>
    <Button variant="ghost" size="sm" aria-label="Focus mode">
      <span aria-hidden="true">⛶</span>
    </Button>
  </Toolbar.Group>
</Toolbar>

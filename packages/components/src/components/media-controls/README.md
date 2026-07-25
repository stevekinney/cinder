# MediaControls

Accessible playback controls for play, pause, and replay actions with optional progress display.

## Usage

```svelte
<script lang="ts">
  import { MediaControls } from '@lostgradient/cinder/media-controls';
</script>
```

## Guidance

### Use When

- Embedding play/pause/replay controls for audio or video content.
- Rendering media controls inside a toolbar or standalone on a card.

### Avoid When

- You need waveform visualization or Web Audio integration — wire that separately.
- You need a full media player UI with seek scrubbing — use a dedicated player component.

## Props

<!-- generated:props:start -->

| Prop            | Type                        | Required | Default     | Description                                                                                                            |
| --------------- | --------------------------- | -------- | ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| `class`         | `string`                    | no       | —           | Additional class names merged with `.cinder-media-controls`.                                                           |
| `disabled`      | `boolean`                   | no       | `false`     | Disable all controls.                                                                                                  |
| `layout`        | `"compact"` \| `"expanded"` | no       | `"compact"` | Layout mode.                                                                                                           |
| `loading`       | `boolean`                   | no       | `false`     | Show loading state while media is buffering.                                                                           |
| `playing`       | `boolean`                   | no       | `false`     | Whether playback is active.                                                                                            |
| `progress`      | `number`                    | no       | —           | Progress value between 0 and 1. Omit to hide the progress bar.                                                         |
| `progressLabel` | `string`                    | no       | —           | Accessible label for the progress bar.                                                                                 |
| `replay`        | `boolean`                   | no       | `false`     | Show a replay action when the track has ended.                                                                         |
| `unavailable`   | `boolean`                   | no       | `false`     | Controls are unavailable.                                                                                              |
| `onPause`       | `(opaque)`                  | no       | —           | Called when the pause action is triggered. Not expressible in JSON Schema; see the component types for the signature.  |
| `onPlay`        | `(opaque)`                  | no       | —           | Called when the play action is triggered. Not expressible in JSON Schema; see the component types for the signature.   |
| `onReplay`      | `(opaque)`                  | no       | —           | Called when the replay action is triggered. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

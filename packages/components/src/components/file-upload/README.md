# FileUpload

Accessible file picker and drag-and-drop surface that validates dropped files,
announces results, and can render consumer-driven upload progress rows.

## Usage

```svelte
<script lang="ts">
  import FileUpload from '@lostgradient/cinder/file-upload';
  import type { FileUploadEntry } from '@lostgradient/cinder/file-upload';
  import FormField from '@lostgradient/cinder/form-field';

  let entries = $state<FileUploadEntry[]>([]);
  let uploadQueue = $state<File[]>([]);

  function queueFiles(acceptedFiles: File[]) {
    uploadQueue.push(...acceptedFiles);
  }
</script>

<FormField id="resume" label="Resume" description="PDF up to 5 MB">
  <FileUpload
    id="resume"
    accept=".pdf"
    maxSize={5 * 1024 * 1024}
    onFilesAccepted={queueFiles}
    onFilesChange={(nextEntries) => (entries = nextEntries)}
    files={entries}
  />
</FormField>
```

Use `browseLabel` when the picker action needs more specific text, such as
directory or import flows. Native input attributes still pass through to the
real file input, so directory selection can use `webkitdirectory`:

```svelte
<FileUpload id="history" browseLabel="Choose directory" multiple webkitdirectory />
```

## Upload queue and retry

`FileUpload` owns local validation, not network upload. Each picker selection or
drop is validated as one batch before callbacks run:

- `onFilesAccepted` receives the accepted native `File[]` so you can enqueue uploads.
- `onReject` receives rejected files with `too-large`, `wrong-type`, or `too-many` reasons.
- `onFilesChange` receives the full locally resolved queue. Accepted rows start as `pending`; rejected rows start as `error` with a visible message and `rejectionReason`.

The default file list includes a remove button for every row. In uncontrolled
use, removing a row immediately updates the local queue and frees a `maxFiles`
slot. In controlled use, removal reports the next queue through
`onFilesChange`; update `files` with that value to reflect the change.
Resetting an associated native form clears the uncontrolled queue and reports
an empty list through `onFilesChange`.

Pass the controlled `files` prop to show your uploader's current `pending`,
`uploading`, `success`, or `error` state. Set `progress` from 0–100 while an
entry uploads. When you provide `onRetry`, failed rows render a retry button and
return the complete entry to your upload queue handler. The component never
starts, cancels, or retries a network request by itself.

## Props

<!-- generated:props:start -->

| Prop                | Type       | Required | Default                           | Description                                                                                                                                           |
| ------------------- | ---------- | -------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accept`            | `string`   | no       | —                                 | Native file accept filter.                                                                                                                            |
| `borderBeamVisible` | `boolean`  | no       | `true`                            | Adds focus and drag-active border emphasis to the dropzone.                                                                                           |
| `browseLabel`       | `string`   | no       | `"Browse files"`                  | Visible text for the browse button.                                                                                                                   |
| `class`             | `string`   | no       | —                                 | Additional classes merged with `.cinder-file-upload`.                                                                                                 |
| `description`       | `string`   | no       | —                                 | Visible description below the title. Defaults to a summary derived from `accept`.                                                                     |
| `disabled`          | `boolean`  | no       | —                                 | Disables the file picker and drag-and-drop surface.                                                                                                   |
| `draggingLabel`     | `string`   | no       | `"Drop to add"`                   | Visible label shown while files are dragged over the dropzone.                                                                                        |
| `id`                | `string`   | no       | —                                 | Stable id for the native file input. Required when composing with `FormField`.                                                                        |
| `maxFiles`          | `number`   | no       | —                                 | Maximum number of files allowed. Files beyond this limit are rejected.                                                                                |
| `maxSize`           | `number`   | no       | —                                 | Maximum allowed file size in bytes.                                                                                                                   |
| `multiple`          | `boolean`  | no       | —                                 | Allow more than one file. Default `false`.                                                                                                            |
| `name`              | `string`   | no       | —                                 | Native input name used for form submission.                                                                                                           |
| `title`             | `string`   | no       | `"Click to upload or drop files"` | Visible title for the dropzone.                                                                                                                       |
| `dragActive`        | `(opaque)` | no       | —                                 | Replaces the default drag-active dropzone body. Not expressible in JSON Schema; see the component types for the signature.                            |
| `fileList`          | `(opaque)` | no       | —                                 | Replaces the default file-list renderer. Receives the resolved rows. Not expressible in JSON Schema; see the component types for the signature.       |
| `files`             | `(opaque)` | no       | —                                 | Consumer-driven file rows, including upload progress and error states. Not expressible in JSON Schema; see the component types for the signature.     |
| `idle`              | `(opaque)` | no       | —                                 | Replaces the default resting-state dropzone body. Not expressible in JSON Schema; see the component types for the signature.                          |
| `onFilesAccepted`   | `(opaque)` | no       | —                                 | Fires with accepted files after local validation passes. Not expressible in JSON Schema; see the component types for the signature.                   |
| `onFilesChange`     | `(opaque)` | no       | —                                 | Fires with the full resolved entry list after local validation changes it. Not expressible in JSON Schema; see the component types for the signature. |
| `onReject`          | `(opaque)` | no       | —                                 | Fires with rejected files and reasons after local validation runs. Not expressible in JSON Schema; see the component types for the signature.         |
| `onRetry`           | `(opaque)` | no       | —                                 | Called when the retry button is activated for a failed file. Not expressible in JSON Schema; see the component types for the signature.               |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-file-upload-background`
- `--cinder-file-upload-border-color`
- `--cinder-file-upload-progress-background`
- `--cinder-file-upload-progress-fill`
<!-- generated:variables:end -->

# FileUpload

Accessible file picker and drag-and-drop surface that validates dropped files,
announces results, and can render consumer-driven upload progress rows.

## Usage

```svelte
<script lang="ts">
  import FileUpload from '@lostgradient/cinder/file-upload';
  import FormField from '@lostgradient/cinder/form-field';

  let files = $state([]);
</script>

<FormField id="resume" label="Resume" description="PDF up to 5 MB">
  <FileUpload
    id="resume"
    accept=".pdf"
    maxSize={5 * 1024 * 1024}
    onchange={(accepted) => {
      files = accepted.map((file) => ({
        id: crypto.randomUUID(),
        file,
        status: 'success',
      }));
    }}
    {files}
  />
</FormField>
```

## Props

<!-- generated:props:start -->

| Prop         | Type       | Required | Default | Description                                                                                                                                       |
| ------------ | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accept`     | `string`   | no       | —       | Native file accept filter.                                                                                                                        |
| `disabled`   | `boolean`  | no       | —       | Disables the file picker and drag-and-drop surface.                                                                                               |
| `id`         | `string`   | no       | —       | Stable id for the native file input. Required when composing with `FormField`.                                                                    |
| `maxSize`    | `number`   | no       | —       | Maximum allowed file size in bytes.                                                                                                               |
| `multiple`   | `boolean`  | no       | —       | Allow more than one file. Default `false`.                                                                                                        |
| `name`       | `string`   | no       | —       | Native input name used for form submission.                                                                                                       |
| `class`      | `(opaque)` | no       | —       | Additional classes merged with `.cinder-file-upload`. Not expressible in JSON Schema; see the component types for the signature.                  |
| `dragActive` | `(opaque)` | no       | —       | Replaces the default drag-active dropzone body. Not expressible in JSON Schema; see the component types for the signature.                        |
| `fileList`   | `(opaque)` | no       | —       | Replaces the default file-list renderer. Receives the resolved rows. Not expressible in JSON Schema; see the component types for the signature.   |
| `files`      | `(opaque)` | no       | —       | Consumer-driven file rows, including upload progress and error states. Not expressible in JSON Schema; see the component types for the signature. |
| `idle`       | `(opaque)` | no       | —       | Replaces the default resting-state dropzone body. Not expressible in JSON Schema; see the component types for the signature.                      |
| `onchange`   | `(opaque)` | no       | —       | Fires with accepted files after local validation passes. Not expressible in JSON Schema; see the component types for the signature.               |
| `onreject`   | `(opaque)` | no       | —       | Fires with rejected files and reasons after local validation runs. Not expressible in JSON Schema; see the component types for the signature.     |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-file-upload-background`
- `--cinder-file-upload-border-color`
- `--cinder-file-upload-progress-background`
- `--cinder-file-upload-progress-fill`
<!-- generated:variables:end -->

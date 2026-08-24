---
'@lostgradient/cinder': patch
---

Rename `FileUploadStatus`'s `'success'` member to `'ready'`. `'ready'` is the canonical name because consumers (such as chat attachments) can create entries directly in that state without an upload ever occurring, which `'success'` couldn't express. Migration: replace any `status === 'success'` checks or literal `'success'` values against `FileUploadStatus`/`FileUploadEntry` with `'ready'`. The `data-status` attribute rendered by `FileUploadList` for the ready state also changed from `success` to `ready`; update any selectors that target it.

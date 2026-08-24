---
'@lostgradient/chat': patch
---

`ChatAttachment.status` now uses cinder's `FileUploadStatus` union (re-exported from `@lostgradient/cinder`) instead of declaring its own duplicate literal type. The allowed values are unchanged (`'pending' | 'uploading' | 'ready' | 'error'`), but the type now resolves to `FileUploadStatus`, so anything re-exporting or structurally depending on the old locally-declared type should reference `FileUploadStatus` from `@lostgradient/cinder` going forward.

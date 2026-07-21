---
'@lostgradient/cinder': patch
---

Add an `allowedModes` prop to `ScheduleBuilder` so consumers can restrict the authoring UI, including cron-only rendering with `allowedModes={['cron']}` that never emits interval values.

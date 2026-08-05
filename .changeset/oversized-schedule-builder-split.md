---
'@lostgradient/cinder': patch
---

Internal restructuring: deduplicate ScheduleBuilder's triplicated field-reseed block into `applySeedToFields` (all 12 fields, used by the prop-resync and allowed-modes-change effects) and `applyPresetSeedToFields` (the 8 preset-only fields, used by the presets branch of a mode switch, which must not touch `authoringMode`/cron/interval fields). No behavior or public API change; the 11 flat `$state` declarations and the three authoring-mode panels are unchanged.

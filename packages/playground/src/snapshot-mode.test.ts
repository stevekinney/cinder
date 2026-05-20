/**
 * Unit tests for snapshot-mode helpers.
 *
 * These helpers are pure functions with no DOM dependency, so they can be
 * tested directly under bun:test without any browser or JSDOM setup.
 *
 * Covered invariants:
 *   (a) Without `?snapshot=1`, no data-snapshot-mode attribute is emitted
 *       and no style tag is injected — the rendered output is byte-identical
 *       to the pre-snapshot-mode behavior.
 *   (b) With `?snapshot=1`, the data-snapshot-mode attribute is present on
 *       the <html> element, the injected stylesheet applies the motion-freeze
 *       and caret-color rules inside [data-snapshot-mode], and the <style>
 *       tag carries the expected id.
 *   (c) The strict equality check: only the value '1' activates snapshot mode;
 *       other truthy-looking values ('true', 'yes', 'on', '') do not.
 */

import { describe, expect, it } from 'bun:test';

import {
  SNAPSHOT_MODE_CSS,
  isSnapshotMode,
  snapshotModeHtmlAttribute,
  snapshotModeStyleTag,
} from './snapshot-mode.ts';

// ---------------------------------------------------------------------------
// isSnapshotMode
// ---------------------------------------------------------------------------

describe('isSnapshotMode', () => {
  it('returns true when snapshot param is exactly "1"', () => {
    expect(isSnapshotMode(new URLSearchParams('snapshot=1'))).toBe(true);
  });

  it('returns false when snapshot param is absent', () => {
    expect(isSnapshotMode(new URLSearchParams(''))).toBe(false);
  });

  it('returns false when snapshot param is "true"', () => {
    expect(isSnapshotMode(new URLSearchParams('snapshot=true'))).toBe(false);
  });

  it('returns false when snapshot param is "yes"', () => {
    expect(isSnapshotMode(new URLSearchParams('snapshot=yes'))).toBe(false);
  });

  it('returns false when snapshot param is "on"', () => {
    expect(isSnapshotMode(new URLSearchParams('snapshot=on'))).toBe(false);
  });

  it('returns false when snapshot param is an empty string', () => {
    expect(isSnapshotMode(new URLSearchParams('snapshot='))).toBe(false);
  });

  it('returns false when snapshot param is "0"', () => {
    expect(isSnapshotMode(new URLSearchParams('snapshot=0'))).toBe(false);
  });

  it('ignores other params and still returns true when snapshot=1 is present', () => {
    expect(isSnapshotMode(new URLSearchParams('theme=dark&snapshot=1&bg=checker'))).toBe(true);
  });

  it('ignores other params and still returns false when snapshot is absent', () => {
    expect(isSnapshotMode(new URLSearchParams('theme=dark&bg=checker'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// snapshotModeHtmlAttribute
// ---------------------------------------------------------------------------

describe('snapshotModeHtmlAttribute', () => {
  it('returns the data-snapshot-mode attribute string when active', () => {
    expect(snapshotModeHtmlAttribute(true)).toBe(' data-snapshot-mode=""');
  });

  it('returns an empty string when inactive', () => {
    expect(snapshotModeHtmlAttribute(false)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// snapshotModeStyleTag
// ---------------------------------------------------------------------------

describe('snapshotModeStyleTag', () => {
  it('returns an empty string when inactive', () => {
    expect(snapshotModeStyleTag(false)).toBe('');
  });

  it('returns a non-empty string when active', () => {
    expect(snapshotModeStyleTag(true).length).toBeGreaterThan(0);
  });

  it('contains the cinder-snapshot-mode id when active', () => {
    const tag = snapshotModeStyleTag(true);
    expect(tag).toContain('id="cinder-snapshot-mode"');
  });

  it('wraps the CSS inside a <style> element when active', () => {
    const tag = snapshotModeStyleTag(true);
    expect(tag).toMatch(/^<style /);
    expect(tag).toContain('</style>');
  });

  it('contains the motion-freeze animation-duration rule', () => {
    const tag = snapshotModeStyleTag(true);
    expect(tag).toContain('animation-duration: 0s');
    expect(tag).toContain('animation-delay: 0s');
  });

  it('contains the motion-freeze transition-duration rule', () => {
    const tag = snapshotModeStyleTag(true);
    expect(tag).toContain('transition-duration: 0s');
    expect(tag).toContain('transition-delay: 0s');
  });

  it('scopes rules to [data-snapshot-mode] so normal pages are unaffected', () => {
    const tag = snapshotModeStyleTag(true);
    expect(tag).toContain('[data-snapshot-mode]');
  });

  it('includes the data-preserve-motion exclusion selector', () => {
    const tag = snapshotModeStyleTag(true);
    expect(tag).toContain(':not([data-preserve-motion])');
    expect(tag).toContain(':not([data-preserve-motion] *)');
  });

  it('includes caret-color: transparent for [data-snapshot-mode]', () => {
    const tag = snapshotModeStyleTag(true);
    expect(tag).toContain('caret-color: transparent');
  });
});

// ---------------------------------------------------------------------------
// SNAPSHOT_MODE_CSS content-level assertions
// ---------------------------------------------------------------------------

describe('SNAPSHOT_MODE_CSS', () => {
  it('does not contain ::-webkit-scrollbar rules (scrollbar hiding is per-fixture opt-in)', () => {
    expect(SNAPSHOT_MODE_CSS).not.toContain('::-webkit-scrollbar');
  });

  it('uses !important on all zeroed duration/delay values', () => {
    // Every 0s value must carry !important so component-level transitions
    // cannot override the freeze.
    const zeroRules = SNAPSHOT_MODE_CSS.match(/0s/g) ?? [];
    const importantZeroRules = SNAPSHOT_MODE_CSS.match(/0s !important/g) ?? [];
    expect(importantZeroRules.length).toBe(zeroRules.length);
  });
});

import { describe, expect, test } from 'bun:test';

import { extractUsageFence, matchesComponentTag } from './extract-readme-usage-example.mjs';

describe('extractUsageFence', () => {
  test('extracts a compliant `## Usage` heading with a matching ```svelte fence', () => {
    const readme = [
      '# AlertDialog',
      '',
      '## Usage',
      '',
      '```svelte',
      '<script lang="ts">',
      "  import AlertDialog from '@lostgradient/cinder/alert-dialog';",
      '</script>',
      '',
      '<AlertDialog open title="Title" description="Description" onAcknowledge={() => {}} />',
      '```',
      '',
      '## Props',
    ].join('\n');

    const result = extractUsageFence(readme);
    expect('error' in result).toBe(false);
    if ('code' in result) {
      expect(matchesComponentTag(result.code, 'AlertDialog')).toBe(true);
    }
  });

  test('fails with `no-heading` when there is no `## Usage` heading', () => {
    const readme = ['# Button', '', '## Props', '', 'nothing here'].join('\n');

    expect(extractUsageFence(readme)).toEqual({ error: 'no-heading' });
  });

  test('fails with `no-fence` when `## Usage` has no fenced code block before the next heading', () => {
    const readme = [
      '# Button',
      '',
      '## Usage',
      '',
      'Just some prose, no fence.',
      '',
      '## Props',
      '',
      'more content',
    ].join('\n');

    expect(extractUsageFence(readme)).toEqual({ error: 'no-fence' });
  });

  test('fails with `no-fence` when `## Usage` has no fenced code block and the README ends', () => {
    const readme = [
      '# Button',
      '',
      '## Usage',
      '',
      'Just some prose, no fence, no more headings.',
    ].join('\n');

    expect(extractUsageFence(readme)).toEqual({ error: 'no-fence' });
  });

  test('fails with `no-fence` when the first fence under `## Usage` is untagged', () => {
    const readme = [
      '# Button',
      '',
      '## Usage',
      '',
      '```',
      'plain text, no language tag',
      '```',
      '',
      '## Props',
    ].join('\n');

    expect(extractUsageFence(readme)).toEqual({ error: 'no-fence' });
  });

  test('fails with `no-fence` when the first fence is tagged something other than svelte, even if a later fence is tagged svelte', () => {
    const readme = [
      '# Button',
      '',
      '## Usage',
      '',
      '```bash',
      'npm install',
      '```',
      '',
      '```svelte',
      '<script>',
      "  import Button from '@lostgradient/cinder/button';",
      '</script>',
      '<Button>Click</Button>',
      '```',
      '',
      '## Props',
    ].join('\n');

    // A non-svelte first fence is a hard stop — the later, correctly-tagged
    // fence is never reached.
    expect(extractUsageFence(readme)).toEqual({ error: 'no-fence' });
  });
});

describe('matchesComponentTag', () => {
  test('extracts successfully but does not match an import-only stub', () => {
    const readme = [
      '# Link',
      '',
      '## Usage',
      '',
      '```svelte',
      '<script lang="ts">',
      "  import Link from '@lostgradient/cinder/link';",
      '</script>',
      '```',
      '',
      '## Props',
    ].join('\n');

    const result = extractUsageFence(readme);
    expect('error' in result).toBe(false);
    if ('code' in result) {
      expect(matchesComponentTag(result.code, 'Link')).toBe(false);
    }
  });

  test('does not match `<AlertDialogExtra` when checking `AlertDialog` (word-boundary regression guard)', () => {
    expect(matchesComponentTag('<AlertDialogExtra foo="bar" />', 'AlertDialog')).toBe(false);
  });

  test('matches `<AlertDialog>` and `<AlertDialog />` and `<AlertDialog ` word-boundary forms', () => {
    expect(matchesComponentTag('<AlertDialog>', 'AlertDialog')).toBe(true);
    expect(matchesComponentTag('<AlertDialog />', 'AlertDialog')).toBe(true);
    expect(matchesComponentTag('<AlertDialog open>', 'AlertDialog')).toBe(true);
  });
});

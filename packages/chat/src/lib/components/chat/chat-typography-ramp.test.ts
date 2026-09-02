import { describe, expect, test } from 'bun:test';
import variables from './chat.variables.ts';

const chatCss = await Bun.file(`${import.meta.dir}/chat.css`).text();

describe('Chat scoped typography ramp', () => {
  test('publishes one rem-based control that drives a clamped multi-step ramp', () => {
    // Exact-equality on the whole generated list, not just the ramp's own
    // entries: this doubles as a review gate on the component's public
    // variable surface, so adding a `--cinder-`-prefixed custom property to
    // chat.css trips it and has to be acknowledged here deliberately.
    // `--cinder-chat-message-max-width` is the shared transcript readability
    // cap, added when the grouped tool-call row was brought under the same
    // measure as every other row.
    expect(variables).toEqual([
      '--cinder-chat-font-size',
      '--cinder-chat-message-max-width',
      '--cinder-text-base',
      '--cinder-text-lg',
      '--cinder-text-sm',
      '--cinder-text-xs',
    ]);
    expect(chatCss).toContain('--cinder-chat-font-size: 1rem');

    for (const step of ['4xs', '3xs', 'xs', 'sm', 'base', 'lg']) {
      const declaration = chatCss.match(
        new RegExp(`--_cinder-chat-text-${step}:\\s*([^;]+);`),
      )?.[1];
      expect(declaration).toContain('var(--cinder-chat-font-size)');
      expect(declaration).toContain('rem');
      expect(declaration).not.toContain('px');
    }

    expect(chatCss).toMatch(/--_cinder-chat-text-xs:\s*clamp\(/);
    expect(chatCss).toMatch(/--_cinder-chat-text-base:\s*clamp\(/);
    for (const step of ['xs', 'sm', 'base', 'lg']) {
      expect(chatCss).toContain(`--cinder-text-${step}: var(--_cinder-chat-text-${step})`);
    }
  });
});

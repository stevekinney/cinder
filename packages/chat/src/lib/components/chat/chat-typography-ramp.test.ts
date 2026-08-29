import { describe, expect, test } from 'bun:test';
import variables from './chat.variables.ts';

const chatCss = await Bun.file(`${import.meta.dir}/chat.css`).text();

describe('Chat scoped typography ramp', () => {
  test('publishes one rem-based control that drives a clamped multi-step ramp', () => {
    expect(variables).toEqual([
      '--cinder-chat-font-size',
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

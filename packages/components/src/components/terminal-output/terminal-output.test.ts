/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createRawSnippet } from 'svelte';
import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: TerminalOutput } = await import('./terminal-output.svelte');

afterEach(cleanup);

describe('TerminalOutput', () => {
  test('maps every ANSI foreground to a registered resting token', () => {
    const css = readFileSync(new URL('./terminal-output.css', import.meta.url), 'utf8');
    const tokens = [
      'black',
      'red',
      'green',
      'yellow',
      'blue',
      'magenta',
      'cyan',
      'white',
      'bright-black',
      'bright-red',
      'bright-green',
      'bright-yellow',
      'bright-blue',
      'bright-magenta',
      'bright-cyan',
      'bright-white',
    ];
    tokens.forEach((token, index) => {
      expect(css).toMatch(
        new RegExp(
          `data-cinder-foreground='${index}'\\]\\s*\\{\\s*color:\\s*var\\(--cinder-terminal-ansi-${token}\\);`,
        ),
      );
    });
  });

  test('renders a named, keyboard-scrollable log', () => {
    const { container } = render(TerminalOutput, { props: { value: 'ready' } });
    const output = container.querySelector('.cinder-terminal-output');
    expect(output?.getAttribute('role')).toBe('log');
    expect(output?.getAttribute('tabindex')).toBe('0');
  });

  test('renders fallback children without an empty parsed line', () => {
    const { container } = render(TerminalOutput, {
      props: {
        value: '',
        children: createRawSnippet(() => ({ render: () => '<p>Fallback</p>' })),
      },
    });
    expect(container.querySelector('.cinder-terminal-output__line')).toBeNull();
    expect(container.textContent).toContain('Fallback');
  });

  test('namespaces ANSI run-state data attributes', () => {
    const { container } = render(TerminalOutput, { props: { value: '\u001b[1;31merror' } });
    const run = container.querySelector('.cinder-terminal-output span');
    expect(run?.getAttribute('data-cinder-foreground')).toBe('1');
    expect(run?.hasAttribute('data-cinder-bold')).toBe(true);
    expect(run?.hasAttribute('data-foreground')).toBe(false);
    expect(run?.hasAttribute('data-bold')).toBe(false);
  });

  test('pauses following when the user scrolls away and resumes at the end', async () => {
    let followLatest = true;
    const { container } = render(TerminalOutput, {
      props: {
        value: 'output',
        get followLatest() {
          return followLatest;
        },
        set followLatest(value: boolean) {
          followLatest = value;
        },
      },
    });
    const output = container.querySelector('.cinder-terminal-output') as HTMLElement;
    Object.defineProperty(output, 'scrollHeight', { configurable: true, value: 400 });
    Object.defineProperty(output, 'clientHeight', { configurable: true, value: 100 });
    output.scrollTop = 0;
    await fireEvent.scroll(output);
    expect(followLatest).toBe(false);
    output.scrollTop = 300;
    await fireEvent.scroll(output);
    expect(followLatest).toBe(true);
  });
});

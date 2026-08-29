/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: TerminalOutput } = await import('./terminal-output.svelte');

afterEach(cleanup);

describe('TerminalOutput', () => {
  test('renders a named, keyboard-scrollable log', () => {
    const { container } = render(TerminalOutput, { props: { value: 'ready' } });
    const output = container.querySelector('.cinder-terminal-output');
    expect(output?.getAttribute('role')).toBe('log');
    expect(output?.getAttribute('tabindex')).toBe('0');
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

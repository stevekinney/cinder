/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: MediaControls } = await import('./media-controls.svelte');

afterEach(() => {
  cleanup();
});

describe('MediaControls', () => {
  test('renders the play/pause toggle (paused) by default', () => {
    const { getByRole } = render(MediaControls);
    const button = getByRole('button');
    // Stable toggle label + aria-pressed (not a changing Play/Pause label).
    expect(button.getAttribute('aria-label')).toBe('Play or pause');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.getAttribute('data-cinder-state')).toBe('paused');
  });

  test('the toggle is pressed when playing=true', () => {
    const { getByRole } = render(MediaControls, { playing: true });
    const button = getByRole('button');
    expect(button.getAttribute('aria-label')).toBe('Play or pause');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('data-cinder-state')).toBe('playing');
  });

  test('renders a replay button when replay=true', () => {
    const { getByRole } = render(MediaControls, { replay: true });
    const button = getByRole('button');
    expect(button.getAttribute('aria-label')).toBe('Replay');
    expect(button.getAttribute('data-cinder-state')).toBe('replay');
  });

  test('button is disabled when disabled=true', () => {
    const { getByRole } = render(MediaControls, { disabled: true });
    const button = getByRole('button', { hidden: true });
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  test('button is disabled and shows loading when loading=true', () => {
    const { getByRole } = render(MediaControls, { loading: true });
    const button = getByRole('button', { hidden: true });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
  });

  test('button is disabled when unavailable=true', () => {
    const { getByRole } = render(MediaControls, { unavailable: true });
    const button = getByRole('button', { hidden: true });
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  test('calls onPlay when play button is clicked', () => {
    let called = false;
    const { getByRole } = render(MediaControls, {
      playing: false,
      onPlay: () => {
        called = true;
      },
    });
    fireEvent.click(getByRole('button'));
    expect(called).toBe(true);
  });

  test('calls onPause when pause button is clicked', () => {
    let called = false;
    const { getByRole } = render(MediaControls, {
      playing: true,
      onPause: () => {
        called = true;
      },
    });
    fireEvent.click(getByRole('button'));
    expect(called).toBe(true);
  });

  test('calls onReplay when replay button is clicked', () => {
    let called = false;
    const { getByRole } = render(MediaControls, {
      replay: true,
      onReplay: () => {
        called = true;
      },
    });
    fireEvent.click(getByRole('button'));
    expect(called).toBe(true);
  });

  test('does not call onPlay when disabled', () => {
    let called = false;
    const { getByRole } = render(MediaControls, {
      disabled: true,
      onPlay: () => {
        called = true;
      },
    });
    // Disabled button: fireEvent.click still fires but handler should check disabled
    fireEvent.click(getByRole('button', { hidden: true }));
    expect(called).toBe(false);
  });

  test('renders progress bar when progress prop is provided', () => {
    const { getByRole } = render(MediaControls, { progress: 0.5 });
    const progressBar = getByRole('progressbar');
    expect(progressBar).not.toBeNull();
    expect(progressBar.getAttribute('aria-valuenow')).toBe('50');
    expect(progressBar.getAttribute('aria-label')).toBe('Playback progress');
  });

  test('progress bar clamps values between 0 and 100', () => {
    const { getByRole: getByRole1 } = render(MediaControls, { progress: -0.5 });
    expect(getByRole1('progressbar').getAttribute('aria-valuenow')).toBe('0');
    cleanup();
    const { getByRole: getByRole2 } = render(MediaControls, { progress: 1.5 });
    expect(getByRole2('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });

  test('does not render progress bar when progress is omitted', () => {
    const { container } = render(MediaControls);
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
  });

  test('does not render a progress bar for a non-finite progress value', () => {
    // `typeof NaN === 'number'` is true, so a naive type check would render a
    // progressbar with NaN aria values. A non-finite progress is treated as
    // "no progress".
    const { container: nanContainer } = render(MediaControls, { progress: Number.NaN });
    expect(nanContainer.querySelector('[role="progressbar"]')).toBeNull();
    cleanup();
    const { container: infContainer } = render(MediaControls, {
      progress: Number.POSITIVE_INFINITY,
    });
    expect(infContainer.querySelector('[role="progressbar"]')).toBeNull();
  });

  test('renders with compact layout by default', () => {
    const { container } = render(MediaControls);
    const root = container.querySelector('.cinder-media-controls');
    expect(root?.getAttribute('data-cinder-layout')).toBe('compact');
  });

  test('renders with expanded layout when layout=expanded', () => {
    const { container } = render(MediaControls, { layout: 'expanded' });
    const root = container.querySelector('.cinder-media-controls');
    expect(root?.getAttribute('data-cinder-layout')).toBe('expanded');
  });

  test('applies custom class', () => {
    const { container } = render(MediaControls, { class: 'my-player' });
    const root = container.querySelector('.cinder-media-controls');
    expect(root?.classList.contains('my-player')).toBe(true);
  });

  test('sets data-cinder-playing attribute when playing', () => {
    const { container } = render(MediaControls, { playing: true });
    const root = container.querySelector('.cinder-media-controls');
    expect(root?.hasAttribute('data-cinder-playing')).toBe(true);
  });

  test('does not set data-cinder-playing when paused', () => {
    const { container } = render(MediaControls, { playing: false });
    const root = container.querySelector('.cinder-media-controls');
    expect(root?.hasAttribute('data-cinder-playing')).toBe(false);
  });

  test('keyboard: button has the button role and is keyboard operable', () => {
    const { getByRole } = render(MediaControls);
    const button = getByRole('button');
    // Verify the element is a native button (keyboard-operable by default).
    expect(button.tagName.toLowerCase()).toBe('button');
    expect(button.getAttribute('role') ?? 'button').toBe('button');
  });

  test('loading state announces a loading label (not a stale Play/Pause)', () => {
    const { getByRole } = render(MediaControls, { loading: true });
    expect(getByRole('button').getAttribute('aria-label')).toBe('Loading playback controls');
  });

  test('unavailable state announces an unavailable label', () => {
    const { getByRole } = render(MediaControls, { unavailable: true });
    expect(getByRole('button').getAttribute('aria-label')).toBe('Playback unavailable');
  });

  test('paused play toggle has aria-pressed="false"', () => {
    const { container } = render(MediaControls, { playing: false });
    expect(container.querySelector('button')?.getAttribute('aria-pressed')).toBe('false');
  });

  test('playing pause toggle has aria-pressed="true"', () => {
    const { container } = render(MediaControls, { playing: true });
    expect(container.querySelector('button')?.getAttribute('aria-pressed')).toBe('true');
  });

  test('replay button does not expose aria-pressed (not a toggle)', () => {
    const { container } = render(MediaControls, { replay: true });
    expect(container.querySelector('button')?.hasAttribute('aria-pressed')).toBe(false);
  });

  test('loading button does not expose aria-pressed (not a toggle)', () => {
    const { container } = render(MediaControls, { loading: true });
    expect(container.querySelector('button')?.hasAttribute('aria-pressed')).toBe(false);
  });
});

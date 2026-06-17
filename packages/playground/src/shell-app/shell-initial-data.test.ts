import { describe, expect, test } from 'bun:test';

import { parseInitialData } from './shell-initial-data.ts';

describe('parseInitialData', () => {
  test('normalizes stale component-route payloads that predate readmeHtml', () => {
    expect(parseInitialData({ component: 'button', components: ['button', 'card'] })).toEqual({
      component: 'button',
      components: ['button', 'card'],
      readmeHtml: '',
    });
  });

  test('keeps README HTML when present', () => {
    expect(
      parseInitialData({ component: '', components: ['button'], readmeHtml: '<h1>cinder</h1>' }),
    ).toEqual({
      component: '',
      components: ['button'],
      readmeHtml: '<h1>cinder</h1>',
    });
  });

  test('rejects malformed component names', () => {
    expect(parseInitialData({ component: 'Button', components: ['button'] })).toBeNull();
    expect(parseInitialData({ component: 'button', components: ['Bad'] })).toBeNull();
  });
});

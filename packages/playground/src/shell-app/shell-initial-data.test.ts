import { describe, expect, test } from 'bun:test';

import { parseInitialData } from './shell-initial-data.ts';

describe('parseInitialData', () => {
  test('normalizes stale component-route payloads that predate readmeHtml', () => {
    expect(parseInitialData({ component: 'button', components: ['button', 'card'] })).toEqual({
      component: 'button',
      components: ['button', 'card'],
      readmeHtml: '',
      documentation: null,
      initialSearch: '',
    });
  });

  test('keeps README HTML when present', () => {
    expect(
      parseInitialData({ component: '', components: ['button'], readmeHtml: '<h1>cinder</h1>' }),
    ).toEqual({
      component: '',
      components: ['button'],
      readmeHtml: '<h1>cinder</h1>',
      documentation: null,
      initialSearch: '',
    });
  });

  test('keeps the request search used to seed SSR toolbar state', () => {
    expect(
      parseInitialData({
        component: 'button',
        components: ['button'],
        initialSearch: '?w=768&focus=1',
      }),
    ).toHaveProperty('initialSearch', '?w=768&focus=1');
  });

  test('rejects malformed component names', () => {
    expect(parseInitialData({ component: 'Button', components: ['button'] })).toBeNull();
    expect(parseInitialData({ component: 'button', components: ['Bad'] })).toBeNull();
  });
});

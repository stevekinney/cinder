import { describe, expect, it } from 'bun:test';

describe('@cinder/editor SSR import safety', () => {
  it('imports the package barrel without needing browser globals', async () => {
    const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');

    try {
      Reflect.deleteProperty(globalThis, 'document');
      const editorModule = await import('./index.js');
      expect(typeof editorModule.createEditor).toBe('function');
      expect(typeof editorModule.destroyEditor).toBe('function');
    } finally {
      if (documentDescriptor) {
        Object.defineProperty(globalThis, 'document', documentDescriptor);
      }
    }
  });
});

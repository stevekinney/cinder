// @ts-nocheck -- migrated commentary assertions use runtime-verified fixture indexing.
/**
 * Unit tests for editor anchoring utilities.
 *
 * These tests verify the pure functions that don't require a DOM environment.
 * For integration tests with real ProseMirror documents, see anchoring.svelte.test.ts.
 */

import { describe, expect, test } from 'bun:test';
import { generateBlockId } from './anchoring.js';

describe('generateBlockId', () => {
  describe('basic functionality', () => {
    test('generates a block ID from node type and content', () => {
      const blockId = generateBlockId('heading', 'Introduction to Anchoring');
      expect(blockId).toMatch(/^heading-[a-z0-9]+$/);
    });

    test('generates consistent IDs for the same input', () => {
      const blockId1 = generateBlockId('paragraph', 'Hello world');
      const blockId2 = generateBlockId('paragraph', 'Hello world');
      expect(blockId1).toBe(blockId2);
    });

    test('generates different IDs for different content', () => {
      const blockId1 = generateBlockId('paragraph', 'Hello world');
      const blockId2 = generateBlockId('paragraph', 'Goodbye world');
      expect(blockId1).not.toBe(blockId2);
    });

    test('generates different IDs for different node types', () => {
      const blockId1 = generateBlockId('heading', 'Same content');
      const blockId2 = generateBlockId('paragraph', 'Same content');
      expect(blockId1).not.toBe(blockId2);
    });
  });

  describe('content truncation', () => {
    test('uses only first 50 characters for hashing', () => {
      // Both should produce the same ID since they share the first 50 chars
      const prefix50 = 'A'.repeat(50);
      const longContent1 = prefix50 + 'DIFFERENT_SUFFIX_1';
      const longContent2 = prefix50 + 'DIFFERENT_SUFFIX_2';

      const blockId1 = generateBlockId('paragraph', longContent1);
      const blockId2 = generateBlockId('paragraph', longContent2);

      expect(blockId1).toBe(blockId2);
    });

    test('produces different IDs when first 50 chars differ', () => {
      const content1 = 'A' + 'x'.repeat(100);
      const content2 = 'B' + 'x'.repeat(100);

      const blockId1 = generateBlockId('paragraph', content1);
      const blockId2 = generateBlockId('paragraph', content2);

      expect(blockId1).not.toBe(blockId2);
    });
  });

  describe('edge cases', () => {
    test('handles empty content', () => {
      const blockId = generateBlockId('paragraph', '');
      expect(blockId).toMatch(/^paragraph-[a-z0-9]+$/);
    });

    test('handles empty node type', () => {
      const blockId = generateBlockId('', 'Some content');
      expect(blockId).toMatch(/^-[a-z0-9]+$/);
    });

    test('handles whitespace content', () => {
      const blockId = generateBlockId('paragraph', '   ');
      expect(blockId).toMatch(/^paragraph-[a-z0-9]+$/);
    });

    test('handles unicode content', () => {
      const blockId = generateBlockId('heading', '你好世界 🌍');
      expect(blockId).toMatch(/^heading-[a-z0-9]+$/);
    });

    test('handles special characters', () => {
      const blockId = generateBlockId('code_block', 'const x = 1; // comment');
      expect(blockId).toMatch(/^code_block-[a-z0-9]+$/);
    });

    test('handles newlines in content', () => {
      const blockId = generateBlockId('code_block', 'line1\nline2\nline3');
      expect(blockId).toMatch(/^code_block-[a-z0-9]+$/);
    });
  });

  describe('common node types', () => {
    test('works with heading nodes', () => {
      const blockId = generateBlockId('heading', 'Chapter 1');
      expect(blockId).toMatch(/^heading-/);
    });

    test('works with paragraph nodes', () => {
      const blockId = generateBlockId('paragraph', 'Some text');
      expect(blockId).toMatch(/^paragraph-/);
    });

    test('works with code_block nodes', () => {
      const blockId = generateBlockId('code_block', 'function test() {}');
      expect(blockId).toMatch(/^code_block-/);
    });

    test('works with blockquote nodes', () => {
      const blockId = generateBlockId('blockquote', 'A famous quote');
      expect(blockId).toMatch(/^blockquote-/);
    });

    test('works with list_item nodes', () => {
      const blockId = generateBlockId('list_item', 'First item');
      expect(blockId).toMatch(/^list_item-/);
    });
  });
});

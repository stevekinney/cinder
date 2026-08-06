import { describe, expect, test } from 'bun:test';

import {
  DRAG_DAMPING,
  DRAG_FRICTION,
  damp,
  dragSnap,
  project,
  shouldSnap,
  snapSelect,
} from './drag-scroll-physics.ts';

describe('damp', () => {
  test('moves current toward target, scaled by elapsed time', () => {
    const result = damp(0, 100, DRAG_DAMPING, 16);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(100);
  });

  test('converges to target as deltaTime grows', () => {
    const result = damp(0, 100, DRAG_DAMPING, 100_000);
    expect(result).toBeCloseTo(100, 1);
  });

  test('returns current unchanged when dampingConstant is zero', () => {
    expect(damp(10, 100, 0, 16)).toBe(10);
  });

  test('returns current unchanged when dampingConstant is negative', () => {
    expect(damp(10, 100, -1, 16)).toBe(10);
  });

  test('returns current unchanged when deltaTime is zero', () => {
    expect(damp(10, 100, DRAG_DAMPING, 0)).toBe(10);
  });

  test('returns current unchanged when deltaTime is negative', () => {
    expect(damp(10, 100, DRAG_DAMPING, -5)).toBe(10);
  });

  test('is a no-op when current already equals target', () => {
    expect(damp(50, 50, DRAG_DAMPING, 16)).toBe(50);
  });
});

describe('project', () => {
  test('projects a positive velocity forward past current', () => {
    const result = project(0, 100, DRAG_FRICTION);
    expect(result).toBeGreaterThan(0);
  });

  test('projects a negative velocity backward past current', () => {
    const result = project(0, -100, DRAG_FRICTION);
    expect(result).toBeLessThan(0);
  });

  test('returns current unchanged at zero velocity', () => {
    expect(project(50, 0, DRAG_FRICTION)).toBe(50);
  });

  test('returns current unchanged when friction is zero (no momentum carries)', () => {
    expect(project(50, 100, 0)).toBe(50);
  });

  test('returns current unchanged when friction is negative', () => {
    expect(project(50, 100, -0.1)).toBe(50);
  });

  test('returns current unchanged when friction is exactly 1 (would diverge)', () => {
    expect(project(50, 100, 1)).toBe(50);
  });

  test('returns current unchanged when friction exceeds 1', () => {
    expect(project(50, 100, 1.5)).toBe(50);
  });

  test('higher friction projects further for the same velocity', () => {
    const low = project(0, 100, 0.5);
    const high = project(0, 100, 0.95);
    expect(high).toBeGreaterThan(low);
  });
});

describe('dragSnap', () => {
  test('is the inverse of project: feeding its result back through project lands on distance', () => {
    const distance = 240;
    const velocity = dragSnap(distance, DRAG_FRICTION);
    const landed = project(0, velocity, DRAG_FRICTION);
    expect(landed).toBeCloseTo(distance, 5);
  });

  test('a negative distance yields a negative velocity', () => {
    expect(dragSnap(-100, DRAG_FRICTION)).toBeLessThan(0);
  });

  test('zero distance yields zero velocity', () => {
    expect(dragSnap(0, DRAG_FRICTION)).toBe(0);
  });

  test('returns 0 when friction is zero', () => {
    expect(dragSnap(100, 0)).toBe(0);
  });

  test('returns 0 when friction is negative', () => {
    expect(dragSnap(100, -0.1)).toBe(0);
  });

  test('returns 0 when friction is exactly 1', () => {
    expect(dragSnap(100, 1)).toBe(0);
  });

  test('returns 0 when friction exceeds 1', () => {
    expect(dragSnap(100, 1.2)).toBe(0);
  });
});

describe('snapSelect', () => {
  test('picks the nearest snap position', () => {
    expect(snapSelect(120, [0, 100, 200, 300])).toBe(100);
  });

  test('picks the nearest snap position when it is below the query point', () => {
    expect(snapSelect(280, [0, 100, 200, 300])).toBe(300);
  });

  test('breaks a tie by keeping the first candidate encountered', () => {
    expect(snapSelect(150, [100, 200])).toBe(100);
  });

  test('returns the sole candidate for a single-element list', () => {
    expect(snapSelect(999, [42])).toBe(42);
  });

  test('returns null for an empty list', () => {
    expect(snapSelect(100, [])).toBeNull();
  });

  test('returns the exact match when the query point is already a snap position', () => {
    expect(snapSelect(200, [0, 100, 200, 300])).toBe(200);
  });
});

describe('shouldSnap', () => {
  test("'mandatory' always snaps regardless of distance", () => {
    expect(shouldSnap(1000, 300, 'mandatory')).toBe(true);
    expect(shouldSnap(0, 300, 'mandatory')).toBe(true);
  });

  test("'mandatory' is the default mode", () => {
    expect(shouldSnap(1000, 300)).toBe(true);
  });

  test("'proximity' snaps within a third of the snapport", () => {
    expect(shouldSnap(90, 300, 'proximity')).toBe(true);
  });

  test("'proximity' does not snap beyond a third of the snapport", () => {
    expect(shouldSnap(110, 300, 'proximity')).toBe(false);
  });

  test("'proximity' treats the boundary itself as within range", () => {
    expect(shouldSnap(100, 300, 'proximity')).toBe(true);
  });

  test("'proximity' honors the sign-agnostic distance", () => {
    expect(shouldSnap(-90, 300, 'proximity')).toBe(true);
    expect(shouldSnap(-110, 300, 'proximity')).toBe(false);
  });

  test("'proximity' never snaps when the snapport has no size", () => {
    expect(shouldSnap(0, 0, 'proximity')).toBe(false);
  });

  test("'proximity' never snaps for a negative snapport size", () => {
    expect(shouldSnap(0, -10, 'proximity')).toBe(false);
  });
});

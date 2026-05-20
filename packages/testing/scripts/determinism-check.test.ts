import { describe, expect, it } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

/**
 * The determinism-check script's compare loop is just pixelmatch over PNGs
 * on disk. These tests pin the contract by exercising pixelmatch directly
 * against synthetic images — the script's spawn loop is integration-tested
 * by running it in CI.
 */
describe('determinism-check pixel comparison contract', () => {
  it('reports zero diff for byte-identical PNGs', () => {
    const png = new PNG({ width: 4, height: 4 });
    png.data.fill(0xff);
    const buffer = PNG.sync.write(png);

    const dir = mkdtempSync(join(tmpdir(), 'determinism-test-'));
    const pathA = join(dir, 'a.png');
    const pathB = join(dir, 'b.png');
    writeFileSync(pathA, buffer);
    writeFileSync(pathB, buffer);

    const imageA = PNG.sync.read(buffer);
    const imageB = PNG.sync.read(buffer);
    const out = new PNG({ width: 4, height: 4 });
    const diff = pixelmatch(imageA.data, imageB.data, out.data, 4, 4, {
      threshold: 0.1,
    });
    expect(diff).toBe(0);
  });

  it('reports diff > 0 when one pixel differs', () => {
    const png = new PNG({ width: 4, height: 4 });
    png.data.fill(0xff);
    const original = PNG.sync.write(png);

    const mutated = PNG.sync.read(original);
    // Flip one R channel byte to deep red.
    mutated.data[0] = 0x00;
    mutated.data[1] = 0x00;
    mutated.data[2] = 0x00;
    const out = new PNG({ width: 4, height: 4 });
    const imageA = PNG.sync.read(original);
    const diff = pixelmatch(imageA.data, mutated.data, out.data, 4, 4, {
      threshold: 0.1,
    });
    expect(diff).toBeGreaterThan(0);
  });
});

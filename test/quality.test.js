import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frameStats, verdict } from '../public/js/quality.js';

const W = 64;
const H = 48;
const image = (fn) => Float32Array.from({ length: W * H }, (_, i) => fn(i % W, Math.floor(i / W)));

test('detects a dark frame', () => {
  const s = frameStats(image(() => 12), W, H);
  assert.equal(verdict(s), 'tooDark');
});

test('a flat (featureless/blurred) frame is blurry when sharpness matters', () => {
  const s = frameStats(image(() => 140), W, H);
  assert.equal(s.sharpness, 0);
  assert.equal(verdict(s, { needSharp: true }), 'blurry');
  assert.equal(verdict(s), 'ok');
});

test('a high-contrast pattern (like text) passes', () => {
  const s = frameStats(image((x, y) => ((x + y) % 4 < 2 ? 30 : 230)), W, H);
  assert.ok(s.sharpness > 1000);
  assert.equal(verdict(s, { needSharp: true }), 'ok');
});

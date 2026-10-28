import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normBox, clock, side, proximity, enrichObjects, topAlert, currencyTotal, findGuidance } from '../lib/spatial.js';

test('normBox clamps and rejects malformed boxes', () => {
  assert.deepEqual(normBox([-5, 10, 1200, 500]), [0, 10, 1000, 500]);
  assert.equal(normBox([500, 500, 400, 600]), null);
  assert.equal(normBox([1, 2, 3]), null);
  assert.equal(normBox('nope'), null);
});

test('clock directions follow the horizontal position', () => {
  assert.equal(clock([300, 450, 600, 550]), 12);
  assert.equal(clock([300, 0, 600, 120]), 11);
  assert.equal(clock([300, 880, 600, 1000]), 1);
  assert.equal(side([0, 0, 100, 100]), 'left');
  assert.equal(side([0, 900, 100, 1000]), 'right');
  assert.equal(side([0, 450, 100, 550]), 'ahead');
});

test('proximity uses apparent size and bottom edge', () => {
  assert.equal(proximity([200, 200, 900, 800]), 'near');
  assert.equal(proximity([400, 400, 600, 600]), 'far');
  assert.equal(proximity([500, 400, 850, 520]), 'mid');
});

test('hazards are ranked by severity, nearness and centrality', () => {
  const objs = enrichObjects([
    { label: 'plant', box_2d: [400, 0, 500, 100], severity: 'none' },
    { label: 'far car', box_2d: [400, 450, 450, 520], severity: 'high' },
    { label: 'open drain', box_2d: [700, 300, 1000, 750], severity: 'high' },
  ]);
  assert.equal(objs[0].label, 'open drain');
  assert.equal(topAlert(objs).label, 'open drain');
  assert.equal(topAlert(enrichObjects([{ label: 'plant', box_2d: [0, 0, 900, 900], severity: 'none' }])), null);
});

test('currency total is computed in code and rejects fake denominations', () => {
  const r = currencyTotal([
    { denomination: 500, kind: 'note' },
    { denomination: 500, kind: 'note' },
    { denomination: 20, kind: 'coin' },
    { denomination: 300, kind: 'note' },
    { denomination: 2000, kind: 'note' },
  ]);
  assert.equal(r.total, 3020);
  assert.equal(r.count, 4);
  assert.equal(r.rejected.length, 1);
  assert.equal(r.has2000, true);
  assert.deepEqual(r.breakdown[1], { denomination: 500, kind: 'note', count: 2 });
});

test('find guidance steers toward the target', () => {
  assert.equal(findGuidance([300, 0, 500, 150]).state, 'left');
  assert.equal(findGuidance([300, 850, 500, 1000]).state, 'right');
  assert.equal(findGuidance([400, 450, 480, 550]).state, 'ahead');
  assert.equal(findGuidance([100, 200, 900, 800]).state, 'reach');
  assert.equal(findGuidance(null).state, 'not_found');
});

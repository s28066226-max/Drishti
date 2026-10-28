import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand } from '../public/js/commands.js';

test('find commands extract the target', () => {
  assert.deepEqual(parseCommand('Find my keys'), { action: 'mode', mode: 'find', query: 'keys' });
  assert.deepEqual(parseCommand('where is the water bottle?'), { action: 'mode', mode: 'find', query: 'water bottle' });
  assert.deepEqual(parseCommand('ढूँढो मेरा चश्मा'), { action: 'mode', mode: 'find', query: 'चश्मा' });
});

test('mode commands in English and Hindi', () => {
  assert.equal(parseCommand('read this for me').mode, 'read');
  assert.equal(parseCommand('How much money is this?').mode, 'money');
  assert.equal(parseCommand('कितने पैसे हैं').mode, 'money');
  assert.equal(parseCommand("what's around me").mode, 'describe');
  assert.equal(parseCommand('guide me').mode, 'guide');
  assert.equal(parseCommand('stop').action, 'stop');
});

test('anything else becomes a question', () => {
  assert.deepEqual(parseCommand('Is the door open?'), { action: 'mode', mode: 'ask', query: 'Is the door open?' });
  assert.equal(parseCommand('   '), null);
});

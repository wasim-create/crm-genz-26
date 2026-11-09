import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePref, resolveTheme } from '../theme';

test('manual choice always wins over the device and the clock', () => {
  assert.equal(resolveTheme('light', true, 23), 'light');
  assert.equal(resolveTheme('dark', false, 12), 'dark');
});

test('auto follows the device', () => {
  assert.equal(resolveTheme('auto', true, 12), 'dark');
  assert.equal(resolveTheme('auto', false, 23), 'light');
});

test('auto falls back to the clock when the device gives no preference', () => {
  assert.equal(resolveTheme('auto', null, 20), 'dark');
  assert.equal(resolveTheme('auto', null, 3), 'dark');
  assert.equal(resolveTheme('auto', null, 7), 'light');
  assert.equal(resolveTheme('auto', null, 18), 'light');
});

test('unknown saved values mean auto', () => {
  assert.equal(parsePref('purple'), 'auto');
  assert.equal(parsePref(null), 'auto');
  assert.equal(parsePref('dark'), 'dark');
});

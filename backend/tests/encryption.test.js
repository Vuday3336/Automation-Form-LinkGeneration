import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { encryptText, decryptText, encryptJson, decryptJson } = await import('../src/utils/encryption.js');

test('round-trips text and JSON', () => {
  assert.equal(decryptText(encryptText('Test Patient Beta')), 'Test Patient Beta');
  assert.deepEqual(decryptJson(encryptJson({ a: 1, b: ['x'] })), { a: 1, b: ['x'] });
});

test('the same value encrypts differently every time (random IV)', () => {
  assert.notEqual(encryptText('same'), encryptText('same'));
});

test('null stays null', () => {
  assert.equal(encryptText(null), null);
  assert.equal(decryptText(null), null);
});

test('rejects unknown formats', () => {
  assert.throws(() => decryptText('not-encrypted'));
});

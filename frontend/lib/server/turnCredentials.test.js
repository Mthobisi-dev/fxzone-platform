const test = require('node:test');
const assert = require('node:assert/strict');
const { credentialTtlSeconds, parseTurnUrls } = require('./turnCredentials.js');

test('accepts standard TURN and TURNS URI forms', () => {
  assert.deepEqual(parseTurnUrls('turn:turn.example.com:3478'), ['turn:turn.example.com:3478']);
  assert.deepEqual(parseTurnUrls('turns:turn.example.com:5349'), ['turns:turn.example.com:5349']);
  assert.deepEqual(parseTurnUrls('turn:one.example.com:3478, turns:two.example.com:5349?transport=tcp'), ['turn:one.example.com:3478', 'turns:two.example.com:5349?transport=tcp']);
});

test('rejects blank, malformed, and non-TURN URI values', () => {
  assert.equal(parseTurnUrls(''), null);
  assert.equal(parseTurnUrls('http://example.com'), null);
  assert.equal(parseTurnUrls('turn:'), null);
  assert.equal(parseTurnUrls('turn:example.com:70000'), null);
  assert.equal(parseTurnUrls('turn:ok.example.com:3478, http://example.com'), null);
});

test('clamps TURN credential lifetimes to safe bounds', () => {
  assert.equal(credentialTtlSeconds(undefined), 3600);
  assert.equal(credentialTtlSeconds('10'), 60);
  assert.equal(credentialTtlSeconds('999999'), 86400);
  assert.equal(credentialTtlSeconds('600'), 600);
});

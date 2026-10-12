// Regression for lib/walletErrors.ts (the app's Connect Wallet failure messages); runs with the server unit tests.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { connectFailure } from '../../../lib/walletErrors.ts';

test('no installed wallet: the exact message the phone logged', () => {
  const f = connectFailure(new Error('Found no installed wallet that supports the mobile wallet protocol.'));
  assert.equal(f.kind, 'no_wallet');
});

test('no installed wallet: by MWA error code', () => {
  assert.equal(connectFailure({ code: 'ERROR_WALLET_NOT_FOUND', message: '' }).kind, 'no_wallet');
});

test('declining in the wallet is not reported as an error', () => {
  assert.equal(connectFailure({ code: -1, message: 'authorization request declined' }).kind, 'cancelled');
  assert.equal(connectFailure(new Error('CancellationException')).kind, 'cancelled');
});

test('wallet timeouts get their own message', () => {
  const f = connectFailure({ code: 'ERROR_SESSION_TIMEOUT', message: '' });
  assert.equal(f.kind, 'error');
  assert.match(f.kind === 'error' ? f.title : '', /didn't respond/);
});

test('anything else is a generic, non-crashing error', () => {
  for (const e of [new Error('boom'), null, undefined, 'text', 42]) {
    assert.equal(connectFailure(e).kind, 'error');
  }
});

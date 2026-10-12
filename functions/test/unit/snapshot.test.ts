// Regression for lib/snapshot.ts (the app's Firestore listener guard); runs with the server unit tests.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { snapshotHandlers, type SnapshotError } from '../../../lib/snapshot.ts';

type Snap = { docs: { id: string; data: () => Record<string, unknown> }[] };
const snapOf = (...ids: string[]): Snap => ({ docs: ids.map(id => ({ id, data: () => ({ title: id }) })) });

function harness() {
  const state = { catalog: ['stale'] as string[], loading: true, errors: [] as SnapshotError[] };
  const [next, fail] = snapshotHandlers<Snap>(
    'test catalog',
    snap => {
      state.catalog = snap.docs.map(d => d.id);
      state.loading = false;
    },
    e => {
      state.errors.push(e);
      state.catalog = [];
      state.loading = false;
    },
  );
  return { state, next, fail };
}

test('a valid snapshot fills the catalog', () => {
  const { state, next } = harness();
  next(snapOf('a', 'b'));
  assert.deepEqual(state.catalog, ['a', 'b']);
  assert.equal(state.loading, false);
  assert.equal(state.errors.length, 0);
});

test('an empty collection gives an empty catalog, not an error', () => {
  const { state, next } = harness();
  next(snapOf());
  assert.deepEqual(state.catalog, []);
  assert.equal(state.loading, false);
  assert.equal(state.errors.length, 0);
});

test('a listener error ends loading and reaches the error handler', () => {
  const { state, fail } = harness();
  fail({ code: 'firestore/failed-precondition', message: 'The query requires an index.' });
  assert.equal(state.loading, false);
  assert.deepEqual(state.catalog, []);
  assert.equal(state.errors[0].code, 'firestore/failed-precondition');
});

test("react-native-firebase's callback(null, error) cannot crash", () => {
  const { state, next } = harness();
  // What @react-native-firebase does when the listen fails and only a success callback was given.
  assert.doesNotThrow(() => (next as (s: unknown, e?: unknown) => void)(null, new Error('x')));
  assert.doesNotThrow(() => next(undefined));
  assert.equal(state.loading, false);
  assert.equal(state.errors.length, 2);
  assert.equal(state.errors[0].code, 'null-snapshot');
});

test('no error handler is fine: errors are only logged', () => {
  const [next, fail] = snapshotHandlers<Snap>('no handler', () => {});
  assert.doesNotThrow(() => next(null));
  assert.doesNotThrow(() => fail({ code: 'permission-denied' }));
});

// onSnapshot callbacks that can't crash. @react-native-firebase calls a listener given only a success
// callback as callback(null, error) when the listen fails (missing index, permission denied,
// network), so `snap.docs` on that null throws. Always pass both handlers from here.
export type SnapshotError = { code?: string; message?: string };

export function snapshotHandlers<S>(
  label: string,
  onData: (snap: S) => void,
  onError?: (e: SnapshotError) => void,
): [(snap: S | null | undefined) => void, (e: SnapshotError) => void] {
  const fail = (e: SnapshotError) => {
    console.log(`${label} listener failed:`, e?.code ?? '', e?.message ?? e);
    onError?.(e);
  };
  const next = (snap: S | null | undefined) => {
    if (snap == null) {
      fail({ code: 'null-snapshot', message: 'listener delivered no snapshot' });
      return;
    }
    onData(snap);
  };
  return [next, fail];
}

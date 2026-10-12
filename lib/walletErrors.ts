// What to tell the user when connecting a wallet fails before any account is connected (so there is
// no wallet screen to show a sign-in error on). Pure, so it can be tested without React Native.
// Codes are Mobile Wallet Adapter's; on React Native the native bridge may pass only the message,
// so both are checked.

export type ConnectFailure =
  | { kind: 'cancelled' }
  | { kind: 'no_wallet'; title: string; message: string }
  | { kind: 'error'; title: string; message: string };

export function connectFailure(e: unknown): ConnectFailure {
  const err = (e ?? {}) as { code?: unknown; message?: unknown };
  const code = err.code;
  const msg = typeof err.message === 'string' ? err.message : String(e ?? '');

  if (code === 'ERROR_WALLET_NOT_FOUND' || /no installed wallet/i.test(msg)) {
    return {
      kind: 'no_wallet',
      title: 'No Solana wallet found',
      message: 'SolFit connects through a Solana wallet app on this phone. Install Phantom or Solflare, set up or import your wallet there, then tap Connect Wallet again.',
    };
  }
  // The user closed the wallet or declined: their choice, not an error.
  if (code === -1 || code === 'ERROR_AUTHORIZATION_FAILED' || /cancel|declin|reject/i.test(msg)) {
    return { kind: 'cancelled' };
  }
  if (code === 'ERROR_SESSION_TIMEOUT' || code === 'ERROR_SESSION_CLOSED' || /timed? ?out|session closed/i.test(msg)) {
    return {
      kind: 'error',
      title: "Wallet didn't respond",
      message: 'The wallet app closed or took too long. Open it once to make sure it is unlocked, then try again.',
    };
  }
  return {
    kind: 'error',
    title: "Couldn't connect wallet",
    message: 'Something went wrong while talking to your wallet app. Try again.',
  };
}

/** Play Store listings for wallets that support Mobile Wallet Adapter. */
export const WALLET_APPS = [
  { name: 'Phantom', url: 'market://details?id=app.phantom' },
  { name: 'Solflare', url: 'market://details?id=com.solflare.mobile' },
] as const;

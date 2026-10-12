import "react-native-get-random-values";
import { Buffer } from "buffer";
global.Buffer = Buffer;

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useState } from 'react';
import { StartupLoader } from '../components/StartupLoader';
import { useWallet, WalletProvider } from '../context/WalletContext';

// The native splash stays until the animated loader has drawn (StartupLoader hides it).
SplashScreen.preventAutoHideAsync().catch(() => {});

/** The app, with the animated loader over it until the wallet session and Firebase Auth are read. */
function AppWithLoader() {
  const { session } = useWallet();
  // Held here, at the root, so the loader runs once per launch and never on navigation.
  const [loaderDone, setLoaderDone] = useState(false);
  const onDone = useCallback(() => setLoaderDone(true), []);
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }}/>
      </Stack>
      {!loaderDone && <StartupLoader ready={session !== 'checking'} onDone={onDone} />}
    </>
  );
}

export default function RootLayout() {
  return (
    <WalletProvider>
      <AppWithLoader />
    </WalletProvider>
  );
}

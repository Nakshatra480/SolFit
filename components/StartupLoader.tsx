// Animated SolFit loading screen, laid over the app while startup work finishes (cached wallet
// session read and Firebase Auth's first state). The app renders underneath the whole time, so this
// adds no delay: it fades away as soon as `ready` is true, or after MAX_WAIT_MS if startup stalls,
// so nobody is ever left on it. Shown once per launch; tab changes never bring it back.
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { NM } from '../constants/naturalMotion';

const LOGO = require('../assets/images/solfit-logo.png');
const ENTER_MS = 800;
const FADE_OUT_MS = 350;
// Startup is local (secure storage and Firebase's disk cache), so this only fires if something hangs.
const MAX_WAIT_MS = 6000;

export function StartupLoader({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const enter = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const fade = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const leaving = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const t = setTimeout(() => setTimedOut(true), MAX_WAIT_MS);
    return () => clearTimeout(t);
  }, []);

  // Entrance, then a slow breath and the loading dots. Started once; re-renders don't restart them.
  useEffect(() => {
    if (reduceMotion) {
      enter.setValue(1);
      return;
    }
    Animated.timing(enter, { toValue: 1, duration: ENTER_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const breath = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const dotLoop = Animated.loop(Animated.stagger(160, dots.map(d => Animated.sequence([
      Animated.timing(d, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(d, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]))));
    breath.start();
    dotLoop.start();
    return () => { breath.stop(); dotLoop.stop(); };
  }, [reduceMotion, enter, breathe, dots]);

  // Leave as soon as startup is done (or has stalled), from wherever the entrance has got to.
  useEffect(() => {
    if (!(ready || timedOut) || leaving.current) return;
    leaving.current = true;
    if (!ready) console.log('Startup still pending after', MAX_WAIT_MS, 'ms; showing the app anyway');
    Animated.timing(fade, { toValue: 0, duration: reduceMotion ? 0 : FADE_OUT_MS, useNativeDriver: true })
      .start(() => onDone());
  }, [ready, timedOut, reduceMotion, fade, onDone]);

  const logoScale = Animated.multiply(
    enter.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }),
    breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }),
  );

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, s.root, { opacity: fade }]}
      pointerEvents="none"
      // The native splash stays up until this has drawn, so launch shows no blank frame.
      onLayout={() => { SplashScreen.hideAsync().catch(() => {}); }}
      accessible
      accessibilityLabel="Loading SolFit"
    >
      <Animated.Image
        source={LOGO}
        style={[s.logo, { opacity: enter, transform: [{ scale: logoScale }] }]}
        resizeMode="contain"
      />
      <View style={s.dots}>
        {dots.map((d, i) => (
          <Animated.View
            key={i}
            style={[s.dot, i === 1 && s.dotSage, {
              opacity: reduceMotion ? 0.8 : d.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
              transform: [{ translateY: reduceMotion ? 0 : d.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
            }]}
          />
        ))}
      </View>
    </Animated.View>
  );
}

// Same logo the loader shows, for brand placements elsewhere (e.g. the Home header).
export function SolFitMark({ size }: { size: number }) {
  return <Image source={LOGO} style={{ width: size, height: size }} resizeMode="contain" accessibilityLabel="SolFit" />;
}

const s = StyleSheet.create({
  root: { backgroundColor: NM.bg, alignItems: 'center', justifyContent: 'center', zIndex: 1000, elevation: 1000 },
  logo: { width: 148, height: 148 },
  dots: { flexDirection: 'row', gap: 10, marginTop: 36, height: 16, alignItems: 'flex-end' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: NM.accent },
  dotSage: { backgroundColor: NM.accentSoft },
});

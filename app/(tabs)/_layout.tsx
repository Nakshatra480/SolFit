import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NM } from '../../constants/naturalMotion';
import { ClaimsProvider, useClaims } from '../../context/ClaimsContext';

function TabIcon({ symbol, color }: { symbol: string; color: string }) {
  return <Text style={{ fontSize: 21, lineHeight: 24, color }}>{symbol}</Text>;
}

/** The Badges icon, with a red dot while any badge can be claimed. */
function BadgesIcon({ color }: { color: string }) {
  const { readyCount } = useClaims();
  return (
    <View>
      <TabIcon symbol="✦" color={color} />
      {readyCount > 0 && (
        <View style={{ position: 'absolute', top: 0, right: -6, width: 8, height: 8, borderRadius: 4, backgroundColor: NM.error }} />
      )}
    </View>
  );
}

export default function TabLayout() {
  // The bar sits above Android's navigation buttons or gesture handle, whatever its height.
  const insets = useSafeAreaInsets();
  return (
    // Badge claims for Goals and Badges alike, and the Badges icon's dot (context/ClaimsContext.tsx).
    <ClaimsProvider>
      <Tabs screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: NM.accent,
        tabBarInactiveTintColor: NM.textSub,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: NM.card,
          borderTopColor: NM.line,
          height: 60 + Math.max(insets.bottom, 8),
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        },
      }}>
        <Tabs.Screen name="index"   options={{ title: 'Home',    tabBarIcon: ({ color }) => <TabIcon symbol="⌂" color={color} /> }}/>
        <Tabs.Screen name="workout" options={{ title: 'Workout', tabBarIcon: ({ color }) => <TabIcon symbol="◉" color={color} /> }}/>
        <Tabs.Screen name="badges"  options={{ title: 'Badges',  tabBarIcon: ({ color }) => <BadgesIcon color={color} /> }}/>
        <Tabs.Screen name="goals"   options={{ title: 'Goals',   tabBarIcon: ({ color }) => <TabIcon symbol="◎" color={color} /> }}/>
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <TabIcon symbol="◐" color={color} /> }}/>
      </Tabs>
    </ClaimsProvider>
  );
}

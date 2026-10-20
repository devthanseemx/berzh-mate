import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { MotiView } from 'moti';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';

// Bottom tab bar for the main areas of the app.
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryStrong,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { ...styles.bar, height: 56 + bottomPad, paddingBottom: bottomPad },
        tabBarLabelStyle: styles.label,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <MotiView key={focused ? 'home-on' : 'home-off'} from={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 13 }}>
              <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
            </MotiView>
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color, size, focused }) => (
            <MotiView key={focused ? 'plan-on' : 'plan-off'} from={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 13 }}>
              <Ionicons name={focused ? 'map' : 'map-outline'} size={size} color={color} />
            </MotiView>
          ),
        }}
      />
      <Tabs.Screen
        name="meter"
        options={{
          title: 'Meter',
          tabBarIcon: ({ color, size, focused }) => (
            <MotiView key={focused ? 'meter-on' : 'meter-off'} from={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 13 }}>
              <Ionicons name={focused ? 'speedometer' : 'speedometer-outline'} size={size} color={color} />
            </MotiView>
          ),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Groups',
          tabBarIcon: ({ color, size, focused }) => (
            <MotiView key={focused ? 'groups-on' : 'groups-off'} from={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 13 }}>
              <Ionicons name={focused ? 'people' : 'people-outline'} size={size} color={color} />
            </MotiView>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size, focused }) => (
            <MotiView key={focused ? 'settings-on' : 'settings-off'} from={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 13 }}>
              <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} />
            </MotiView>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 8,
    elevation: 12,
  },
  label: { fontSize: 11, fontWeight: '600' },
});

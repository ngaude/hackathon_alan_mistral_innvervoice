import { Tabs } from 'expo-router';
import { Mic2, History, User } from 'lucide-react-native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../../constants/theme';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: '700' },
          tabBarStyle: {
            backgroundColor: theme.surfaceElevated,
            borderTopColor: theme.border,
            paddingBottom: Math.max(insets.bottom, 6),
            height: 52 + Math.max(insets.bottom, 0),
          },
          tabBarActiveTintColor: theme.accentCyan,
          tabBarInactiveTintColor: theme.textMuted,
        }}
      >
      <Tabs.Screen
        name="session"
        options={{
          title: 'Session',
          tabBarIcon: ({ color, size }) => <Mic2 color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => <History color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
      </Tabs>
    </View>
  );
}

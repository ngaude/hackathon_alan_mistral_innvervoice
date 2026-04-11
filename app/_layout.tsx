import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { theme } from '../constants/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/voice-capture" options={{ title: 'Empreinte vocale' }} />
      </Stack>
    </>
  );
}

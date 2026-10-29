import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function InicioLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Volver', headerShown: Platform.OS !== 'web' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="complejo/[complejoId]" options={{ title: '', headerTransparent: true }} />
    </Stack>
  );
}

import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function GestionLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Volver', headerShown: Platform.OS !== 'web' }}>
      <Stack.Screen name="index" options={{ title: 'Gestión' }} />
      <Stack.Screen name="[complejoId]" options={{ title: 'Complejo' }} />
      <Stack.Screen name="cancha/[canchaId]" options={{ title: 'Cancha' }} />
    </Stack>
  );
}

import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function TurnosLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Volver', headerShown: Platform.OS !== 'web' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="partido/[partidoId]" options={{ title: 'Partido' }} />
      <Stack.Screen name="amigos" options={{ title: 'Amigos' }} />
      <Stack.Screen name="unirme/[codigo]" options={{ title: 'Invitación' }} />
      <Stack.Screen name="amigo/[userId]" options={{ title: 'Agregar amigo' }} />
    </Stack>
  );
}

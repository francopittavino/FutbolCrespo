import { useAuthActions } from '@convex-dev/auth/react';
import { AuthLoading, Authenticated, Unauthenticated, useQuery } from 'convex/react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { api } from '../../convex/_generated/api';

const NOMBRE_ROL = {
  jugador: 'Jugador',
  duenio: 'Dueño de complejo',
  admin: 'Administrador',
} as const;

export default function InicioScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Futbol Crespo
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centrado}>
          Todas las canchas de fútbol 5 de Crespo en un solo lugar.
        </ThemedText>

        <AuthLoading>
          <ActivityIndicator />
        </AuthLoading>
        <Unauthenticated>
          <BotonGoogle />
        </Unauthenticated>
        <Authenticated>
          <Bienvenida />
        </Authenticated>
      </SafeAreaView>
    </ThemedView>
  );
}

function BotonGoogle() {
  const { signIn } = useAuthActions();
  return (
    <Pressable
      onPress={() => void signIn('google')}
      style={({ pressed }) => [styles.boton, pressed && styles.presionado]}>
      <ThemedText type="smallBold" style={styles.textoBoton}>
        Ingresar con Google
      </ThemedText>
    </Pressable>
  );
}

function Bienvenida() {
  const yo = useQuery(api.usuarios.yo);
  const { signOut } = useAuthActions();
  if (yo === undefined) return <ActivityIndicator />;
  if (yo === null) return null;

  return (
    <ThemedView type="backgroundElement" style={styles.tarjeta}>
      <ThemedText type="subtitle">¡Hola, {yo.nombre.split(' ')[0] || 'jugador'}!</ThemedText>
      <ThemedText themeColor="textSecondary">
        {yo.email} · {NOMBRE_ROL[yo.rol]}
      </ThemedText>
      <Pressable onPress={() => void signOut()} style={({ pressed }) => pressed && styles.presionado}>
        <ThemedText type="link">Cerrar sesión</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
  },
  title: {
    textAlign: 'center',
  },
  centrado: {
    textAlign: 'center',
  },
  boton: {
    backgroundColor: '#1F8A3A',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.three,
  },
  textoBoton: {
    color: '#ffffff',
  },
  tarjeta: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  presionado: {
    opacity: 0.7,
  },
});

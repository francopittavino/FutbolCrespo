import { ConvexError } from 'convex/values';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function mensajeDeError(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data === 'string') return error.data;
  return 'Algo salió mal. Probá de nuevo.';
}

// Contenedor con scroll que respeta la barra de pestañas (abajo en el celular, arriba en la web).
export function Pantalla({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ThemedView style={styles.pantalla}>
      <ScrollView
        contentContainerStyle={[
          styles.contenido,
          {
            paddingTop: Platform.OS === 'web' ? Spacing.six + Spacing.four : Spacing.three,
            paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
          },
        ]}
        keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </ThemedView>
  );
}

// Título de la pantalla: en el celular va en la barra de navegación; en la web, dentro de la página.
export function Encabezado({ titulo, volver = true }: { titulo: string; volver?: boolean }) {
  if (Platform.OS !== 'web') return <Stack.Screen options={{ title: titulo }} />;
  return (
    <View style={styles.fila}>
      {volver && router.canGoBack() && (
        <Pressable onPress={() => router.back()} style={({ pressed }) => pressed && styles.atenuado}>
          <ThemedText type="linkPrimary">← Volver</ThemedText>
        </Pressable>
      )}
      <ThemedText type="smallBold" style={styles.tituloWeb}>
        {titulo}
      </ThemedText>
    </View>
  );
}

export function Cargando() {
  return (
    <ThemedView style={styles.cargando}>
      <ActivityIndicator />
    </ThemedView>
  );
}

export function Tarjeta({ children }: { children: ReactNode }) {
  return (
    <ThemedView type="backgroundElement" style={styles.tarjeta}>
      {children}
    </ThemedView>
  );
}

export function Campo({ etiqueta, ...props }: TextInputProps & { etiqueta: string }) {
  const theme = useTheme();
  return (
    <View style={styles.campo}>
      <ThemedText type="small" themeColor="textSecondary">
        {etiqueta}
      </ThemedText>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        {...props}
        style={[
          styles.input,
          { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
          props.style,
        ]}
      />
    </View>
  );
}

export function Interruptor({
  etiqueta,
  valor,
  onCambio,
}: {
  etiqueta: string;
  valor: boolean;
  onCambio: (valor: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.fila}>
      <ThemedText style={styles.flex}>{etiqueta}</ThemedText>
      <Switch value={valor} onValueChange={onCambio} trackColor={{ true: theme.primary }} />
    </View>
  );
}

export function Boton({
  titulo,
  onPress,
  variante = 'primario',
  cargando = false,
  deshabilitado = false,
}: {
  titulo: string;
  onPress: () => void;
  variante?: 'primario' | 'secundario' | 'peligro';
  cargando?: boolean;
  deshabilitado?: boolean;
}) {
  const theme = useTheme();
  const fondo = variante === 'primario' ? theme.primary : variante === 'peligro' ? theme.danger : 'transparent';
  const colorTexto = variante === 'secundario' ? theme.primary : theme.onPrimary;
  return (
    <Pressable
      onPress={onPress}
      disabled={cargando || deshabilitado}
      style={({ pressed }) => [
        styles.boton,
        { backgroundColor: fondo, borderColor: variante === 'secundario' ? theme.primary : fondo },
        (pressed || deshabilitado) && styles.atenuado,
      ]}>
      {cargando ? (
        <ActivityIndicator color={colorTexto} />
      ) : (
        <ThemedText type="smallBold" style={{ color: colorTexto }}>
          {titulo}
        </ThemedText>
      )}
    </Pressable>
  );
}

export function Chip({ texto, activo, onPress }: { texto: string; activo: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: activo ? theme.primary : theme.border, backgroundColor: activo ? theme.primary : 'transparent' },
      ]}>
      <ThemedText type="small" style={{ color: activo ? theme.onPrimary : theme.text }}>
        {texto}
      </ThemedText>
    </Pressable>
  );
}

export function TextoError({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return (
    <ThemedText type="small" themeColor="danger">
      {mensaje}
    </ThemedText>
  );
}

export const estilosComunes = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  filaEnvuelta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  flex: { flex: 1 },
});

const styles = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  cargando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tarjeta: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.three },
  campo: { gap: Spacing.one },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    fontSize: 16,
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
  boton: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  atenuado: { opacity: 0.6 },
  tituloWeb: { fontSize: 22, lineHeight: 30 },
  chip: {
    borderWidth: 1,
    borderRadius: Spacing.four,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
});

import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fuentes } from '@/constants/theme';

// Foto del jugador o, si no tiene, sus iniciales sobre lima.
export function Avatar({ nombre, foto, tamano = 40 }: { nombre: string; foto?: string | null; tamano?: number }) {
  const redondo = { width: tamano, height: tamano, borderRadius: tamano / 2 };
  if (foto) return <Image source={{ uri: foto }} style={[redondo, styles.borde]} contentFit="cover" />;
  const iniciales = nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  return (
    <View style={[redondo, styles.iniciales]}>
      <ThemedText style={{ fontFamily: Fuentes.titulo, fontSize: tamano * 0.5, lineHeight: tamano * 0.6, color: Colors.onAccent }}>
        {iniciales || '?'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  borde: { borderWidth: 2, borderColor: Colors.accent },
  iniciales: { backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
});

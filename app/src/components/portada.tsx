import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';

// Bloque verde de portada, como el inicio de la web del diseño: etiqueta, título en dos colores y bajada.
export function Portada({
  etiqueta,
  titulo,
  tituloAcento,
  bajada,
  children,
}: {
  etiqueta?: string;
  titulo: string;
  tituloAcento?: string;
  bajada?: string;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.portada, { paddingTop: (Platform.OS === 'web' ? 0 : insets.top) + Spacing.five }]}>
      <LineasDeCancha />
      <View style={styles.contenido}>
        {etiqueta && (
          <ThemedText type="label" themeColor="accent">
            {etiqueta}
          </ThemedText>
        )}
        <View>
          <ThemedText type="title" themeColor="onDark">
            {titulo}
          </ThemedText>
          {tituloAcento && (
            <ThemedText type="title" themeColor="accent">
              {tituloAcento}
            </ThemedText>
          )}
        </View>
        {bajada && (
          <ThemedText themeColor="onDark" style={styles.bajada}>
            {bajada}
          </ThemedText>
        )}
        {children}
      </View>
    </View>
  );
}

// Arco y línea de mitad de cancha de fondo, como en el diseño.
function LineasDeCancha() {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 300" preserveAspectRatio="xMaxYMid slice">
      <Circle cx={400} cy={150} r={110} stroke={Colors.darkLine} strokeWidth={6} fill="none" />
      <Line x1={400} y1={0} x2={400} y2={300} stroke={Colors.darkLine} strokeWidth={6} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  portada: {
    backgroundColor: Colors.brand,
    paddingBottom: Spacing.five,
    paddingHorizontal: Spacing.three,
    overflow: 'hidden',
  },
  contenido: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.three,
  },
  bajada: { maxWidth: 520 },
});

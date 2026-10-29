import { StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Marca } from '@/constants/theme';

// Isotipo de Futbol Crespo (opción A, pelota clásica): una C lima con la pelota en el centro.
export function Isotipo({ tamano = 40, fondo = Marca.verdeCancha }: { tamano?: number; fondo?: string }) {
  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 200 200" accessibilityLabel="Futbol Crespo">
      <Path
        d="M142.9 64 A56 56 0 1 0 142.9 136"
        fill="none"
        stroke={Marca.lima}
        strokeWidth={22}
        strokeLinecap="round"
      />
      <G transform="translate(100 100) scale(0.9333) translate(-100 -100)">
        <Defs>
          <ClipPath id="pelota">
            <Circle cx={100} cy={100} r={30} />
          </ClipPath>
        </Defs>
        <Circle cx={100} cy={100} r={30} fill={Marca.blanco} />
        <G clipPath="url(#pelota)">
          <Path
            d="M112.34 83.01 L107.98 69.59 L119.40 61.30 L130.81 69.59 L126.45 83.01 Z M119.97 106.49 L131.38 98.20 L142.80 106.49 L138.44 119.91 L124.33 119.91 Z M100.00 121.00 L111.41 129.29 L107.05 142.71 L92.95 142.71 L88.59 129.29 Z M80.03 106.49 L75.67 119.91 L61.56 119.91 L57.20 106.49 L68.62 98.20 Z M87.66 83.01 L73.55 83.01 L69.19 69.59 L80.60 61.30 L92.02 69.59 Z"
            fill={fondo}
          />
        </G>
        <Path
          d="M100.00 89.00 L100.00 70.00 M110.46 96.60 L128.53 90.73 M106.47 108.90 L117.63 124.27 M93.53 108.90 L82.37 124.27 M89.54 96.60 L71.47 90.73"
          stroke={fondo}
          strokeWidth={3}
          fill="none"
        />
        <Path d="M100.00 89.00 L110.46 96.60 L106.47 108.90 L93.53 108.90 L89.54 96.60 Z" fill={fondo} />
        <Circle cx={100} cy={100} r={30} fill="none" stroke={fondo} strokeWidth={2.5} />
      </G>
    </Svg>
  );
}

// Logo completo: isotipo + "FUTBOL CRESPO". En una línea (barra de navegación) o en dos (pie, portada).
export function Logo({ tamano = 36, apilado = false }: { tamano?: number; apilado?: boolean }) {
  const letra = { fontSize: tamano * (apilado ? 0.62 : 0.72), lineHeight: tamano * (apilado ? 0.62 : 0.8) };
  return (
    <View style={styles.fila}>
      <Isotipo tamano={tamano} />
      <View style={apilado ? undefined : styles.fila}>
        <ThemedText type="heading" themeColor="onDark" style={[letra, styles.palabra]}>
          FUTBOL{apilado ? '' : ' '}
        </ThemedText>
        <ThemedText type="heading" themeColor="accent" style={[letra, styles.palabra]}>
          CRESPO
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // Teko tiene poco ascendente: este ajuste centra las mayúsculas con el isotipo.
  palabra: { paddingTop: 4 },
});

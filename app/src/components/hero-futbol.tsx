import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, ClipPath, Defs, G, Line, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Colors, Marca, MaxContentWidth, Spacing } from '@/constants/theme';

// Portada de la pantalla principal: el lema y una pelota entrando al arco.
export function HeroFutbol() {
  const insets = useSafeAreaInsets();
  const ancha = useWindowDimensions().width >= 700;
  return (
    <View style={[styles.hero, { paddingTop: (Platform.OS === 'web' ? 0 : insets.top) + Spacing.four }]}>
      <View style={[styles.contenido, ancha && styles.contenidoAncho]}>
        <View style={styles.texto}>
          <ThemedText type="label" themeColor="accent">
            Futbol Crespo
          </ThemedText>
          <View>
            <ThemedText type="title" themeColor="onDark">
              Reservá. Jugá.
            </ThemedText>
            <ThemedText type="title" themeColor="accent">
              Compartilo.
            </ThemedText>
          </View>
          <ThemedText themeColor="onDarkSecondary">Elegí el complejo, la cancha y el horario. En segundos.</ThemedText>
        </View>
        <View style={ancha ? styles.dibujoAncho : styles.dibujo}>
          <PelotaAlArco />
        </View>
      </View>
      <View style={styles.pasto} />
    </View>
  );
}

function PelotaAlArco() {
  const red = [];
  for (let x = 236; x < 390; x += 16) red.push(<Line key={`v${x}`} x1={x} y1={48} x2={x} y2={196} />);
  for (let y = 60; y < 196; y += 16) red.push(<Line key={`h${y}`} x1={226} y1={y} x2={390} y2={y} />);
  return (
    <Svg width="100%" height="100%" viewBox="0 0 400 198" preserveAspectRatio="xMidYMax meet">
      {/* Arco y red */}
      <G stroke={Colors.onDark} strokeOpacity={0.18} strokeWidth={1.5}>
        {red}
      </G>
      <Path d="M226 196 L226 40 L392 40 L392 196" fill="none" stroke={Colors.onDark} strokeWidth={8} strokeLinejoin="round" />
      {/* Estela de la pelota */}
      <G stroke={Marca.lima} strokeLinecap="round">
        <Line x1={20} y1={150} x2={110} y2={136} strokeWidth={6} strokeOpacity={0.35} />
        <Line x1={44} y1={176} x2={118} y2={160} strokeWidth={5} strokeOpacity={0.25} />
        <Line x1={60} y1={118} x2={124} y2={112} strokeWidth={4} strokeOpacity={0.2} />
      </G>
      {/* La pelota del logo, más grande */}
      <G transform="translate(176 136) scale(1.55) translate(-100 -100)">
        <Defs>
          <ClipPath id="pelotaHero">
            <Circle cx={100} cy={100} r={30} />
          </ClipPath>
        </Defs>
        <Circle cx={100} cy={100} r={30} fill={Marca.blanco} />
        <G clipPath="url(#pelotaHero)">
          <Path
            d="M112.34 83.01 L107.98 69.59 L119.40 61.30 L130.81 69.59 L126.45 83.01 Z M119.97 106.49 L131.38 98.20 L142.80 106.49 L138.44 119.91 L124.33 119.91 Z M100.00 121.00 L111.41 129.29 L107.05 142.71 L92.95 142.71 L88.59 129.29 Z M80.03 106.49 L75.67 119.91 L61.56 119.91 L57.20 106.49 L68.62 98.20 Z M87.66 83.01 L73.55 83.01 L69.19 69.59 L80.60 61.30 L92.02 69.59 Z"
            fill={Marca.tinta}
          />
        </G>
        <Path
          d="M100.00 89.00 L100.00 70.00 M110.46 96.60 L128.53 90.73 M106.47 108.90 L117.63 124.27 M93.53 108.90 L82.37 124.27 M89.54 96.60 L71.47 90.73"
          stroke={Marca.tinta}
          strokeWidth={3}
          fill="none"
        />
        <Path d="M100.00 89.00 L110.46 96.60 L106.47 108.90 L93.53 108.90 L89.54 96.60 Z" fill={Marca.tinta} />
        <Circle cx={100} cy={100} r={30.5} fill="none" stroke={Marca.blanco} strokeWidth={2} />
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: Colors.brand,
    paddingHorizontal: Spacing.three,
    overflow: 'hidden',
  },
  contenido: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.two,
  },
  contenidoAncho: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.four },
  texto: { flex: 1, gap: Spacing.three, paddingBottom: Spacing.four },
  dibujo: { height: 150 },
  dibujoAncho: { width: 360, height: 190 },
  pasto: {
    height: 18,
    marginHorizontal: -Spacing.three,
    backgroundColor: '#0F4A36',
    borderTopWidth: 3,
    borderTopColor: Marca.lima,
  },
});

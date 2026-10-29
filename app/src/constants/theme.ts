import { Platform } from 'react-native';

// Paleta de Futbol Crespo (ver el diseño "Logo Futbol Crespo").
export const Marca = {
  verdeCancha: '#0B3D2E', // principal: fondos, dibujo de la pelota, textos sobre claro
  lima: '#C6F432', // acento: la C del logo, "CRESPO", botones
  blanco: '#FFFFFF',
  pastoClaro: '#EEF1EA', // fondos claros y pantallas
  tinta: '#1A1F1C', // texto de lectura sobre claro
} as const;

// Colores por uso. Modo oscuro en verde oscuro, el único tema de la app.
export const Colors = {
  text: '#F2F6F3',
  textSecondary: '#9FB5AA',
  background: '#05211A', // fondo de pantalla, verde casi negro
  backgroundElement: '#0D3226', // tarjetas
  backgroundSelected: '#154535',
  border: '#1E4C3C',
  primary: Marca.lima, // títulos, acentos, elementos activos
  onPrimary: Marca.verdeCancha,
  accent: Marca.lima, // botones principales
  onAccent: Marca.verdeCancha,
  danger: '#FF6B6B',
  // Superficies verde cancha (barra de navegación, portadas, bloques destacados)
  brand: Marca.verdeCancha,
  brandElevado: '#1E4A3E',
  onDark: Marca.blanco,
  onDarkSecondary: '#B7C7BE',
  darkLine: '#2A5A47',
} as const;

export type ThemeColor = keyof typeof Colors;

// Teko para títulos y números (siempre en mayúsculas); Saira para textos y botones.
export const Fuentes = {
  titulo: 'Teko_600SemiBold',
  texto: 'Saira_400Regular',
  textoMedio: 'Saira_500Medium',
  textoNegrita: 'Saira_700Bold',
  mono: Platform.select({ ios: 'ui-monospace', default: 'monospace' }),
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radios = {
  tarjeta: 16,
  campo: 12,
  pildora: 999,
} as const;

// Altura de la barra superior en la web; las pantallas dejan este espacio arriba.
export const AlturaBarraWeb = 72;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

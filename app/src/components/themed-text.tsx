import { StyleSheet, Text, type TextProps } from 'react-native';

import { Colors, Fuentes, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'subtitle'
    | 'heading'
    | 'small'
    | 'smallBold'
    | 'label'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return <Text style={[{ color: theme[themeColor ?? 'text'] }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  default: {
    fontFamily: Fuentes.texto,
    fontSize: 16,
    lineHeight: 24,
  },
  small: {
    fontFamily: Fuentes.texto,
    fontSize: 14,
    lineHeight: 20,
  },
  smallBold: {
    fontFamily: Fuentes.textoNegrita,
    fontSize: 14,
    lineHeight: 20,
  },
  // Títulos en Teko, siempre en mayúsculas como un marcador.
  title: {
    fontFamily: Fuentes.titulo,
    fontSize: 56,
    lineHeight: 54,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: Fuentes.titulo,
    fontSize: 36,
    lineHeight: 36,
    textTransform: 'uppercase',
  },
  heading: {
    fontFamily: Fuentes.titulo,
    fontSize: 24,
    lineHeight: 26,
    textTransform: 'uppercase',
  },
  // Etiqueta chica espaciada ("PASO 1", "CUÁNDO").
  label: {
    fontFamily: Fuentes.textoNegrita,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  link: {
    fontFamily: Fuentes.textoMedio,
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    fontFamily: Fuentes.textoNegrita,
    lineHeight: 30,
    fontSize: 14,
    color: Colors.primary,
  },
  code: {
    fontFamily: Fuentes.mono,
    fontSize: 12,
  },
});

import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { Saira_400Regular, Saira_500Medium, Saira_700Bold } from '@expo-google-fonts/saira';
import { Teko_600SemiBold } from '@expo-google-fonts/teko';
import { DarkTheme, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import AppTabs from '@/components/app-tabs';
import { Colors } from '@/constants/theme';
import { almacenamientoSesion, convex } from '@/lib/convex';

SplashScreen.preventAutoHideAsync();

const temaNavegacion = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.primary,
    background: Colors.background,
    card: Colors.brand, // encabezados en verde cancha
    text: Colors.onDark,
    border: Colors.darkLine,
  },
};

export default function TabLayout() {
  const [fuentesListas, errorFuentes] = useFonts({ Teko_600SemiBold, Saira_400Regular, Saira_500Medium, Saira_700Bold });

  useEffect(() => {
    // Si las fuentes fallan igual se muestra la app, con la letra del sistema.
    if (fuentesListas || errorFuentes) SplashScreen.hideAsync();
  }, [fuentesListas, errorFuentes]);

  if (!fuentesListas && !errorFuentes) return null;

  return (
    <ConvexAuthProvider client={convex} storage={almacenamientoSesion}>
      <ThemeProvider value={temaNavegacion}>
        <StatusBar style="light" />
        <AppTabs />
      </ThemeProvider>
    </ConvexAuthProvider>
  );
}

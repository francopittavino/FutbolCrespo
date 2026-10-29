import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { Platform, Share } from 'react-native';

// Dirección pública de la app. En la web es la del sitio; en el celular se configura con EXPO_PUBLIC_SITIO_URL.
export function urlDe(ruta: string): string {
  const base = process.env.EXPO_PUBLIC_SITIO_URL ?? (Platform.OS === 'web' ? window.location.origin : null);
  return base ? `${base.replace(/\/$/, '')}${ruta}` : Linking.createURL(ruta);
}

// Abre el menú de compartir del sistema (WhatsApp, etc.). Si no hay, copia el texto.
// Devuelve 'copiado' para que la pantalla pueda avisarlo.
export async function compartirTexto(texto: string): Promise<'compartido' | 'copiado'> {
  if (Platform.OS === 'web') {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text: texto });
        return 'compartido';
      } catch {
        // El usuario cerró el menú o el navegador no lo permite: se copia.
      }
    }
    await Clipboard.setStringAsync(texto);
    return 'copiado';
  }
  await Share.share({ message: texto });
  return 'compartido';
}

// Cómo se nombra el sitio en las imágenes para compartir ("Reservá en …").
export function sitioPublico(): string {
  const url = urlDe('/');
  return /^https?:\/\//.test(url) ? url.replace(/^https?:\/\//, '').replace(/\/$/, '') : 'la app Futbol Crespo';
}

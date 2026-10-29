import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Isotipo } from '@/components/logo';
import { Colors } from '@/constants/theme';

// Banner del complejo. Si todavía no subió uno, se muestra el isotipo sobre verde.
// `maxHeight` limita el alto en pantallas anchas (la web), donde el banner ocupa todo el ancho.
export function BannerComplejo({ url, style }: { url: string | null; style?: { maxHeight?: number } }) {
  if (url) return <Image source={{ uri: url }} style={[styles.banner, style]} contentFit="cover" transition={150} />;
  return (
    <View style={[styles.banner, styles.vacio, style]}>
      <Isotipo tamano={64} />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { width: '100%', aspectRatio: 12 / 5, backgroundColor: Colors.brand },
  vacio: { alignItems: 'center', justifyContent: 'center' },
});

import { useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { BannerComplejo } from '@/components/banner-complejo';
import { HeroFutbol } from '@/components/hero-futbol';
import { ThemedText } from '@/components/themed-text';
import { Cargando, Pantalla, Tarjeta } from '@/components/ui/formulario';
import { Colors, Radios, Spacing } from '@/constants/theme';
import { api } from '../../../convex/_generated/api';
import { formatoPrecio } from '../../../convex/lib/horas';

type Complejo = FunctionReturnType<typeof api.complejos.publicos>[number];

// Pantalla principal: la portada y los complejos de Crespo.
export default function InicioScreen() {
  const complejos = useQuery(api.complejos.publicos);
  return (
    <Pantalla cabecera={<HeroFutbol />}>
      <ThemedText type="subtitle" themeColor="onDark">
        Complejos
      </ThemedText>
      {complejos === undefined && <Cargando />}
      {complejos?.length === 0 && (
        <Tarjeta>
          <ThemedText themeColor="textSecondary">Todavía no hay complejos publicados.</ThemedText>
        </Tarjeta>
      )}
      <View style={styles.grilla}>
        {complejos?.map((c) => (
          <TarjetaComplejo key={c._id} complejo={c} />
        ))}
      </View>
    </Pantalla>
  );
}

function TarjetaComplejo({ complejo }: { complejo: Complejo }) {
  const tamanos = [...new Set(complejo.canchas.map((c) => c.jugadoresPorLado))].sort().map((n) => `F${n}`);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/complejo/[complejoId]', params: { complejoId: complejo._id } })}
      style={({ pressed }) => [styles.tarjeta, pressed && styles.presionado]}>
      <BannerComplejo url={complejo.banner} />
      <View style={styles.cuerpo}>
        <ThemedText type="heading" themeColor="onDark" numberOfLines={1}>
          {complejo.nombre}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {complejo.direccion}
        </ThemedText>
        <View style={styles.datos}>
          <Etiqueta texto={`${complejo.canchas.length} ${complejo.canchas.length === 1 ? 'cancha' : 'canchas'}`} />
          {tamanos.length > 0 && <Etiqueta texto={tamanos.join(' · ')} />}
          {complejo.precioDesde !== null && <Etiqueta texto={`Desde ${formatoPrecio(complejo.precioDesde)}`} />}
        </View>
        <ThemedText type="linkPrimary">Ver horarios y reservar →</ThemedText>
      </View>
    </Pressable>
  );
}

function Etiqueta({ texto }: { texto: string }) {
  return (
    <View style={styles.etiqueta}>
      <ThemedText type="small" themeColor="text">
        {texto}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  tarjeta: {
    flexGrow: 1,
    flexBasis: 300,
    backgroundColor: Colors.backgroundElement,
    borderRadius: Radios.tarjeta,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  presionado: { opacity: 0.8 },
  cuerpo: { padding: Spacing.three, gap: Spacing.one },
  datos: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one },
  etiqueta: {
    backgroundColor: Colors.backgroundSelected,
    borderRadius: Radios.pildora,
    paddingHorizontal: Spacing.two + Spacing.one,
    paddingVertical: Spacing.half,
  },
});

import { useQuery } from 'convex/react';
import { router } from 'expo-router';
import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps, TabListProps } from 'expo-router/ui';
import { Pressable, View, StyleSheet, useWindowDimensions } from 'react-native';

import { AlturaBarraWeb, Colors, MaxContentWidth, Radios, Spacing } from '@/constants/theme';

import { Isotipo, Logo } from './logo';
import { ThemedText } from './themed-text';
import { api } from '../../convex/_generated/api';

export default function AppTabs() {
  const yo = useQuery(api.usuarios.yo);
  const gestiona = yo?.rol === 'duenio' || yo?.rol === 'admin';
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>Reservar</TabButton>
          </TabTrigger>
          <TabTrigger name="turnos" href="/turnos" asChild>
            <TabButton>Mis partidos</TabButton>
          </TabTrigger>
          <TabTrigger name="perfil" href="/perfil" asChild>
            <TabButton>Perfil</TabButton>
          </TabTrigger>
          {/* El trigger siempre existe para que la ruta funcione; solo se oculta el botón. */}
          <TabTrigger name="gestion" href="/gestion" asChild>
            <TabButton oculto={!gestiona}>Gestión</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

// El `ref` del tipo de expo-router no coincide con el de React Native 0.88 y el Pressable no lo necesita.
export function TabButton({
  children,
  isFocused,
  oculto = false,
  ref: _ref,
  ...props
}: TabTriggerSlotProps & { oculto?: boolean }) {
  const angosta = useWindowDimensions().width < 600;
  return (
    <Pressable {...props} style={({ pressed }) => [pressed && styles.pressed, oculto && styles.oculto]}>
      <View style={[styles.tabButtonView, angosta && styles.tabAngosta, isFocused && styles.tabActiva]}>
        <ThemedText type="smallBold" style={{ color: isFocused ? Colors.onAccent : Colors.onDark }}>
          {children}
        </ThemedText>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  // En pantallas angostas (celular) solo entra el isotipo junto a los botones.
  const angosta = useWindowDimensions().width < 600;
  return (
    <View {...props} style={styles.tabListContainer}>
      <View style={styles.innerContainer}>
        {/* El logo lleva al inicio de Reservar desde cualquier pantalla. */}
        <Pressable
          onPress={() => {
            // Cierra las pantallas abiertas de la sección actual antes de ir al inicio.
            if (router.canDismiss()) router.dismissAll();
            router.navigate('/');
          }}
          accessibilityRole="link"
          accessibilityLabel="Ir al inicio"
          style={({ pressed }) => [styles.marca, pressed && styles.pressed]}>
          {angosta ? <Isotipo tamano={34} /> : <Logo tamano={34} />}
        </Pressable>
        {props.children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    height: AlturaBarraWeb,
    backgroundColor: Colors.brand,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: Spacing.three,
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.one,
    maxWidth: MaxContentWidth,
  },
  marca: {
    marginRight: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  oculto: {
    display: 'none',
  },
  tabButtonView: {
    paddingVertical: Spacing.one + Spacing.half,
    paddingHorizontal: Spacing.three,
    borderRadius: Radios.pildora,
  },
  tabAngosta: {
    paddingHorizontal: Spacing.two,
  },
  tabActiva: {
    backgroundColor: Colors.accent,
  },
});

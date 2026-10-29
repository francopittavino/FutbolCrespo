import { useQuery } from 'convex/react';
import { NativeTabs } from 'expo-router/native-tabs';

import { Colors, Fuentes } from '@/constants/theme';
import { api } from '../../convex/_generated/api';

export default function AppTabs() {
  const yo = useQuery(api.usuarios.yo);
  const gestiona = yo?.rol === 'duenio' || yo?.rol === 'admin';

  return (
    <NativeTabs
      backgroundColor={Colors.brand}
      indicatorColor={Colors.darkLine}
      iconColor={{ default: Colors.onDarkSecondary, selected: Colors.accent }}
      labelStyle={{
        default: { color: Colors.onDarkSecondary, fontFamily: Fuentes.textoMedio },
        selected: { color: Colors.accent, fontFamily: Fuentes.textoNegrita },
      }}>
      <NativeTabs.Trigger name="(inicio)">
        <NativeTabs.Trigger.Label>Reservar</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="sportscourt" md="sports_soccer" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="turnos">
        <NativeTabs.Trigger.Label>Mis partidos</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="event" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="perfil">
        <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="gestion" hidden={!gestiona}>
        <NativeTabs.Trigger.Label>Gestión</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from 'convex/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { BotonGoogle } from '@/components/boton-google';
import { Portada } from '@/components/portada';
import { ThemedText } from '@/components/themed-text';
import { Boton, Cargando, Pantalla, Tarjeta, TextoError, mensajeDeError } from '@/components/ui/formulario';
import { api } from '../../../../convex/_generated/api';
import { aHora, etiquetaFecha } from '../../../../convex/lib/horas';

// Página a la que llega el link "sumate al partido".
export default function UnirmeScreen() {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const partido = useQuery(api.partidos.porCodigo, { codigo });
  const sumarme = useMutation(api.partidos.sumarme);
  const [sumando, setSumando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (partido === undefined) return <Cargando />;
  if (partido === null) {
    return (
      <Pantalla>
        <Tarjeta>
          <ThemedText>Este link de invitación no es válido o el partido ya no existe.</ThemedText>
        </Tarjeta>
      </Pantalla>
    );
  }

  async function confirmar() {
    setSumando(true);
    setError(null);
    try {
      const partidoId = await sumarme({ codigo });
      router.replace({ pathname: '/turnos/partido/[partidoId]', params: { partidoId } });
    } catch (e) {
      setError(mensajeDeError(e));
      setSumando(false);
    }
  }

  const lleno = partido.anotados >= partido.cupo;
  const cerrado = partido.cancelado || partido.golesA !== undefined;

  return (
    <Pantalla
      cabecera={
        <Portada
          etiqueta={`${partido.organizador} te invita`}
          titulo={etiquetaFecha(partido.fecha)}
          tituloAcento={`${aHora(partido.inicio)} hs`}
          bajada={`${partido.complejo} · ${partido.cancha} · ${partido.direccion}`}
        />
      }>
      <Tarjeta>
        <ThemedText type="heading" themeColor="primary">
          ¿Jugás?
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Ya hay {partido.anotados} anotados de {partido.cupo}. Sumate con tu cuenta y tus partidos quedan en tus
          estadísticas.
        </ThemedText>
        {cerrado ? (
          <ThemedText themeColor="danger">Este partido ya no recibe jugadores.</ThemedText>
        ) : (
          <>
            <AuthLoading>
              <Cargando />
            </AuthLoading>
            <Unauthenticated>
              <BotonGoogle titulo="Ingresar con Google para sumarme" />
            </Unauthenticated>
            <Authenticated>
              {partido.yaEstoy ? (
                <Boton
                  titulo="Ya estás anotado · Ver partido"
                  variante="secundario"
                  onPress={() => router.replace({ pathname: '/turnos/partido/[partidoId]', params: { partidoId: partido._id } })}
                />
              ) : (
                <Boton titulo={lleno ? 'Partido completo' : 'Me sumo'} onPress={confirmar} cargando={sumando} deshabilitado={lleno} />
              )}
            </Authenticated>
          </>
        )}
        <TextoError mensaje={error} />
      </Tarjeta>
    </Pantalla>
  );
}

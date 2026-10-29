import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from 'convex/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { BotonGoogle } from '@/components/boton-google';
import { Portada } from '@/components/portada';
import { ThemedText } from '@/components/themed-text';
import { Boton, Cargando, Pantalla, Tarjeta, TextoError, mensajeDeError } from '@/components/ui/formulario';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';

// Página del link personal "agregame como amigo".
export default function AgregarAmigoScreen() {
  const { userId } = useLocalSearchParams<{ userId: Id<'users'> }>();
  const perfil = useQuery(api.amigos.perfil, { userId });
  const enviar = useMutation(api.amigos.enviarSolicitud);
  const [estado, setEstado] = useState<'pendiente' | 'amigos' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (perfil === undefined) return <Cargando />;
  if (perfil === null) {
    return (
      <Pantalla>
        <Tarjeta>
          <ThemedText>Este link no es válido.</ThemedText>
        </Tarjeta>
      </Pantalla>
    );
  }

  async function agregar() {
    setError(null);
    try {
      setEstado(await enviar({ userId }));
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  const sonAmigos = perfil.yaSonAmigos || estado === 'amigos';
  return (
    <Pantalla cabecera={<Portada etiqueta="Futbol Crespo" titulo="Sumá a" tituloAcento={perfil.nombre} />}>
      <Tarjeta>
        <AuthLoading>
          <Cargando />
        </AuthLoading>
        <Unauthenticated>
          <ThemedText themeColor="textSecondary">
            Ingresá para agregar a {perfil.nombre} y armar partidos juntos.
          </ThemedText>
          <BotonGoogle />
        </Unauthenticated>
        <Authenticated>
          {perfil.soyYo ? (
            <ThemedText>Este es tu link de amigo. Compartilo para que te agreguen.</ThemedText>
          ) : sonAmigos ? (
            <>
              <ThemedText>¡Ya son amigos con {perfil.nombre}!</ThemedText>
              <Boton titulo="Ver mis amigos" variante="secundario" onPress={() => router.replace('/turnos/amigos')} />
            </>
          ) : estado === 'pendiente' ? (
            <ThemedText>Listo, le mandaste la solicitud. Cuando la acepte, van a ser amigos.</ThemedText>
          ) : (
            <Boton titulo={`Agregar a ${perfil.nombre}`} onPress={() => void agregar()} />
          )}
        </Authenticated>
        <TextoError mensaje={error} />
      </Tarjeta>
    </Pantalla>
  );
}

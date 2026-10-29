import { useAuthActions } from '@convex-dev/auth/react';
import { AuthLoading, Authenticated, Unauthenticated, useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BotonGoogle } from '@/components/boton-google';
import { ThemedText } from '@/components/themed-text';
import {
  Boton,
  Campo,
  Cargando,
  Chip,
  Pantalla,
  Tarjeta,
  TextoError,
  estilosComunes,
  mensajeDeError,
} from '@/components/ui/formulario';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { elegirYSubirImagen } from '@/lib/subir-imagen';
import { api } from '../../convex/_generated/api';

type Yo = NonNullable<FunctionReturnType<typeof api.usuarios.yo>>;
type Posicion = NonNullable<Yo['posicion']>;

const POSICIONES: { valor: Posicion; nombre: string }[] = [
  { valor: 'arquero', nombre: 'Arquero' },
  { valor: 'defensor', nombre: 'Defensor' },
  { valor: 'mediocampista', nombre: 'Mediocampista' },
  { valor: 'delantero', nombre: 'Delantero' },
];

const NOMBRE_ROL = { jugador: 'Jugador', duenio: 'Dueño de complejo', admin: 'Administrador' } as const;

export default function PerfilScreen() {
  const yo = useQuery(api.usuarios.yo);
  return (
    <>
      <AuthLoading>
        <Cargando />
      </AuthLoading>
      <Unauthenticated>
        <Pantalla>
          <Tarjeta>
            <ThemedText type="heading" themeColor="primary">
              Tu perfil
            </ThemedText>
            <ThemedText themeColor="textSecondary">Ingresá para armar tu perfil de jugador.</ThemedText>
            <BotonGoogle />
          </Tarjeta>
        </Pantalla>
      </Unauthenticated>
      <Authenticated>{yo ? <Perfil yo={yo} /> : <Cargando />}</Authenticated>
    </>
  );
}

function Perfil({ yo }: { yo: Yo }) {
  const { signOut } = useAuthActions();
  return (
    <Pantalla cabecera={<CabeceraPerfil yo={yo} />}>
      <DatosPerfil yo={yo} />
      <Boton titulo="Mis amigos" variante="secundario" onPress={() => router.push('/turnos/amigos')} />
      <Pressable onPress={() => void signOut()} style={styles.salir}>
        <ThemedText type="smallBold" themeColor="danger">
          Cerrar sesión
        </ThemedText>
      </Pressable>
    </Pantalla>
  );
}

function CabeceraPerfil({ yo }: { yo: Yo }) {
  const insets = useSafeAreaInsets();
  const generarUrl = useMutation(api.archivos.generarUrlSubida);
  const cambiarFoto = useMutation(api.usuarios.cambiarFoto);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function nuevaFoto() {
    setError(null);
    setSubiendo(true);
    try {
      const storageId = await elegirYSubirImagen(generarUrl, [1, 1]);
      if (storageId) await cambiarFoto({ storageId });
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <View style={[styles.cabecera, { paddingTop: (Platform.OS === 'web' ? 0 : insets.top) + Spacing.four }]}>
      <View style={styles.cabeceraContenido}>
        <Avatar nombre={yo.nombre} foto={yo.foto} tamano={96} />
        <View style={styles.identidad}>
          <ThemedText type="subtitle" themeColor="onDark" numberOfLines={2}>
            {yo.nombre}
          </ThemedText>
          <ThemedText type="small" themeColor="onDarkSecondary">
            {[POSICIONES.find((p) => p.valor === yo.posicion)?.nombre, NOMBRE_ROL[yo.rol]].filter(Boolean).join(' · ')}
          </ThemedText>
          <Pressable onPress={() => void nuevaFoto()} disabled={subiendo}>
            <ThemedText type="linkPrimary">{subiendo ? 'Subiendo foto…' : 'Cambiar foto'}</ThemedText>
          </Pressable>
          <TextoError mensaje={error} />
        </View>
      </View>
    </View>
  );
}

function DatosPerfil({ yo }: { yo: Yo }) {
  const actualizar = useMutation(api.usuarios.actualizarPerfil);
  const [nombre, setNombre] = useState(yo.nombre);
  const [telefono, setTelefono] = useState(yo.telefono ?? '');
  const [posicion, setPosicion] = useState<Posicion | undefined>(yo.posicion);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    setError(null);
    setGuardado(false);
    try {
      await actualizar({ nombre, telefono: telefono || undefined, posicion });
      setGuardado(true);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <ThemedText type="heading" themeColor="primary">
        Mis datos
      </ThemedText>
      <Campo etiqueta="Nombre (así te ven en los partidos)" value={nombre} onChangeText={setNombre} />
      <Campo
        etiqueta="Celular (para que el complejo te avise)"
        value={telefono}
        onChangeText={setTelefono}
        keyboardType="phone-pad"
      />
      <ThemedText type="small" themeColor="textSecondary">
        Posición
      </ThemedText>
      <View style={estilosComunes.filaEnvuelta}>
        {POSICIONES.map((p) => (
          <Chip
            key={p.valor}
            texto={p.nombre}
            activo={posicion === p.valor}
            onPress={() => setPosicion(posicion === p.valor ? undefined : p.valor)}
          />
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {yo.email}
      </ThemedText>
      <TextoError mensaje={error} />
      {guardado && (
        <ThemedText type="small" themeColor="primary">
          Perfil guardado.
        </ThemedText>
      )}
      <Boton titulo="Guardar" onPress={guardar} cargando={guardando} />
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  cabecera: { backgroundColor: Colors.brand, paddingHorizontal: Spacing.three, paddingBottom: Spacing.four },
  cabeceraContenido: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  identidad: { flex: 1, gap: Spacing.one },
  salir: { alignSelf: 'center', padding: Spacing.three },
});

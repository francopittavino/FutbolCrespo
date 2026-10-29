import { useMutation, useQuery } from 'convex/react';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  Boton,
  Campo,
  Cargando,
  Encabezado,
  Pantalla,
  Tarjeta,
  TextoError,
  estilosComunes,
  mensajeDeError,
} from '@/components/ui/formulario';
import { api } from '../../../convex/_generated/api';

export default function GestionScreen() {
  const yo = useQuery(api.usuarios.yo);
  const complejos = useQuery(api.complejos.misComplejos);

  if (yo === undefined || complejos === undefined) return <Cargando />;

  if (yo === null || yo.rol === 'jugador') {
    return (
      <Pantalla>
        <Tarjeta>
          <ThemedText type="smallBold">Esta sección es para los complejos</ThemedText>
          <ThemedText themeColor="textSecondary">
            Si tenés un complejo y querés gestionarlo desde Futbol Crespo, contactate con nosotros.
          </ThemedText>
        </Tarjeta>
      </Pantalla>
    );
  }

  return (
    <Pantalla>
      <Encabezado titulo="Gestión" volver={false} />
      {yo.rol === 'admin' && <NuevoComplejo />}

      <ThemedText type="smallBold" themeColor="textSecondary">
        {yo.rol === 'admin' ? 'TODOS LOS COMPLEJOS' : 'MIS COMPLEJOS'}
      </ThemedText>
      {complejos.length === 0 && (
        <ThemedText themeColor="textSecondary">Todavía no hay complejos cargados.</ThemedText>
      )}
      {complejos.map((c) => (
        <Link key={c._id} href={{ pathname: '/gestion/[complejoId]', params: { complejoId: c._id } }} asChild>
          <Pressable style={({ pressed }) => pressed && styles.presionado}>
            <Tarjeta>
              <ThemedText type="smallBold">{c.nombre}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {c.direccion} · {c.activo ? 'Publicado' : 'Oculto'}
              </ThemedText>
            </Tarjeta>
          </Pressable>
        </Link>
      ))}
    </Pantalla>
  );
}

function NuevoComplejo() {
  const crear = useMutation(api.complejos.crear);
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!abierto) return <Boton titulo="+ Nuevo complejo" onPress={() => setAbierto(true)} />;

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const complejoId = await crear({ nombre, direccion, telefono: telefono.trim() || undefined });
      router.push({ pathname: '/gestion/[complejoId]', params: { complejoId } });
      setAbierto(false);
      setNombre('');
      setDireccion('');
      setTelefono('');
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <ThemedText type="smallBold">Nuevo complejo</ThemedText>
      <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} placeholder="Ej.: La Canchita" />
      <Campo etiqueta="Dirección" value={direccion} onChangeText={setDireccion} placeholder="Ej.: San Martín 1234" />
      <Campo
        etiqueta="Teléfono (opcional)"
        value={telefono}
        onChangeText={setTelefono}
        keyboardType="phone-pad"
      />
      <TextoError mensaje={error} />
      <ThemedText type="small" themeColor="textSecondary">
        El complejo se crea oculto. Lo publicás cuando tenga canchas y horarios cargados.
      </ThemedText>
      <View style={estilosComunes.fila}>
        <Boton titulo="Cancelar" variante="secundario" onPress={() => setAbierto(false)} />
        <Boton titulo="Crear" onPress={guardar} cargando={guardando} />
      </View>
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  presionado: { opacity: 0.7 },
});

import { useMutation, useQuery } from 'convex/react';
import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  Boton,
  Campo,
  Cargando,
  Encabezado,
  Interruptor,
  Pantalla,
  Tarjeta,
  TextoError,
  estilosComunes,
  mensajeDeError,
} from '@/components/ui/formulario';
import { api } from '../../../convex/_generated/api';
import type { Doc, Id } from '../../../convex/_generated/dataModel';

export default function ComplejoScreen() {
  const { complejoId } = useLocalSearchParams<{ complejoId: Id<'complejos'> }>();
  const detalle = useQuery(api.complejos.detalle, { complejoId });
  const yo = useQuery(api.usuarios.yo);

  if (detalle === undefined || yo === undefined) return <Cargando />;
  const { complejo, duenio, canchas } = detalle;

  return (
    <Pantalla>
      <Encabezado titulo={complejo.nombre} />
      <Visibilidad complejo={complejo} />
      <Canchas complejoId={complejo._id} canchas={canchas} />
      <DatosYReglas complejo={complejo} />
      {yo?.rol === 'admin' && <Duenio complejoId={complejo._id} duenio={duenio} />}
    </Pantalla>
  );
}

function Visibilidad({ complejo }: { complejo: Doc<'complejos'> }) {
  const cambiar = useMutation(api.complejos.cambiarVisibilidad);
  const [error, setError] = useState<string | null>(null);

  async function alternar(activo: boolean) {
    setError(null);
    try {
      await cambiar({ complejoId: complejo._id, activo });
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  return (
    <Tarjeta>
      <Interruptor etiqueta="Publicado (visible para los jugadores)" valor={complejo.activo} onCambio={alternar} />
      <TextoError mensaje={error} />
    </Tarjeta>
  );
}

function Canchas({ complejoId, canchas }: { complejoId: Id<'complejos'>; canchas: Doc<'canchas'>[] }) {
  const crear = useMutation(api.canchas.crear);
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function agregar() {
    setError(null);
    try {
      await crear({ complejoId, nombre, jugadoresPorLado: 5, techada: false });
      setNombre('');
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  return (
    <Tarjeta>
      <ThemedText type="smallBold">Canchas</ThemedText>
      {canchas.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Agregá la primera cancha y después cargale los horarios.
        </ThemedText>
      )}
      {canchas.map((c) => (
        <Link key={c._id} href={{ pathname: '/gestion/cancha/[canchaId]', params: { canchaId: c._id } }} asChild>
          <Pressable style={({ pressed }) => [estilosComunes.fila, pressed && styles.presionado]}>
            <ThemedText style={estilosComunes.flex}>
              {c.nombre}
              {!c.activa && ' (inactiva)'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Fútbol {c.jugadoresPorLado} · Horarios ›
            </ThemedText>
          </Pressable>
        </Link>
      ))}
      <View style={estilosComunes.fila}>
        <View style={estilosComunes.flex}>
          <Campo etiqueta="Nueva cancha" value={nombre} onChangeText={setNombre} placeholder="Ej.: Cancha 1" />
        </View>
        <View style={styles.botonAlineado}>
          <Boton titulo="Agregar" onPress={agregar} deshabilitado={!nombre.trim()} />
        </View>
      </View>
      <TextoError mensaje={error} />
    </Tarjeta>
  );
}

function DatosYReglas({ complejo }: { complejo: Doc<'complejos'> }) {
  const actualizar = useMutation(api.complejos.actualizar);
  const [nombre, setNombre] = useState(complejo.nombre);
  const [direccion, setDireccion] = useState(complejo.direccion);
  const [telefono, setTelefono] = useState(complejo.telefono ?? '');
  const [whatsapp, setWhatsapp] = useState(complejo.whatsapp ?? '');
  const [descripcion, setDescripcion] = useState(complejo.descripcion ?? '');
  const [requiereSenia, setRequiereSenia] = useState(complejo.requiereSenia);
  const [montoSenia, setMontoSenia] = useState(complejo.montoSenia?.toString() ?? '');
  const [minutosPago, setMinutosPago] = useState(String(complejo.minutosParaPagarSenia));
  const [horasCancelacion, setHorasCancelacion] = useState(String(complejo.horasCancelacionGratis));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  async function guardar() {
    setGuardando(true);
    setError(null);
    setGuardado(false);
    try {
      await actualizar({
        complejoId: complejo._id,
        nombre,
        direccion,
        telefono: telefono.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        descripcion: descripcion.trim() || undefined,
        requiereSenia,
        montoSenia: requiereSenia ? Number(montoSenia) || undefined : undefined,
        minutosParaPagarSenia: Number(minutosPago) || 0,
        horasCancelacionGratis: Number(horasCancelacion) || 0,
      });
      setGuardado(true);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <ThemedText type="smallBold">Datos del complejo</ThemedText>
      <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} />
      <Campo etiqueta="Dirección" value={direccion} onChangeText={setDireccion} />
      <Campo etiqueta="Teléfono" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" />
      <Campo
        etiqueta="WhatsApp"
        value={whatsapp}
        onChangeText={setWhatsapp}
        keyboardType="phone-pad"
        placeholder="Ej.: 3434123456"
      />
      <Campo
        etiqueta="Descripción"
        value={descripcion}
        onChangeText={setDescripcion}
        multiline
        placeholder="Vestuarios, estacionamiento, buffet..."
      />

      <ThemedText type="smallBold">Reglas de reserva</ThemedText>
      <Interruptor etiqueta="Pedir seña por Mercado Pago" valor={requiereSenia} onCambio={setRequiereSenia} />
      {requiereSenia && (
        <>
          <Campo etiqueta="Monto de la seña ($)" value={montoSenia} onChangeText={setMontoSenia} keyboardType="numeric" />
          <Campo
            etiqueta="Minutos para pagarla (después se libera el turno)"
            value={minutosPago}
            onChangeText={setMinutosPago}
            keyboardType="numeric"
          />
        </>
      )}
      <Campo
        etiqueta="Cancelación gratis hasta (horas antes del turno)"
        value={horasCancelacion}
        onChangeText={setHorasCancelacion}
        keyboardType="numeric"
      />

      <TextoError mensaje={error} />
      {guardado && (
        <ThemedText type="small" themeColor="primary">
          Cambios guardados.
        </ThemedText>
      )}
      <Boton titulo="Guardar cambios" onPress={guardar} cargando={guardando} />
    </Tarjeta>
  );
}

function Duenio({
  complejoId,
  duenio,
}: {
  complejoId: Id<'complejos'>;
  duenio: { nombre: string; email: string } | null;
}) {
  const asignar = useMutation(api.complejos.asignarDuenio);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);
    try {
      await asignar({ complejoId, email });
      setEmail('');
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  return (
    <Tarjeta>
      <ThemedText type="smallBold">Dueño (solo admin)</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {duenio ? `${duenio.nombre} · ${duenio.email}` : 'Sin dueño asignado.'}
      </ThemedText>
      <Campo
        etiqueta="Email de Google del dueño"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextoError mensaje={error} />
      <Boton titulo="Asignar dueño" variante="secundario" onPress={guardar} deshabilitado={!email.trim()} />
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  presionado: { opacity: 0.7 },
  botonAlineado: { alignSelf: 'flex-end' },
});

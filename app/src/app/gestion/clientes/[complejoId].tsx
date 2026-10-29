import { useMutation, useQuery } from 'convex/react';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { SelectorCliente } from '@/components/gestion/selector-cliente';
import { ThemedText } from '@/components/themed-text';
import {
  Boton,
  Campo,
  Cargando,
  Chip,
  Encabezado,
  Pantalla,
  Tarjeta,
  TextoError,
  estilosComunes,
  mensajeDeError,
} from '@/components/ui/formulario';
import { Spacing } from '@/constants/theme';
import { enlaceWhatsapp } from '@/lib/whatsapp';
import { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import {
  DIAS_CORTOS,
  DIAS_SEMANA,
  aHora,
  aMinutos,
  diaSemanaDe,
  etiquetaFecha,
  hoyEnArgentina,
  sumarDias,
} from '../../../../convex/lib/horas';

export default function ClientesScreen() {
  const { complejoId } = useLocalSearchParams<{ complejoId: Id<'complejos'> }>();
  return (
    <Pantalla>
      <Encabezado titulo="Clientes y turnos fijos" />
      <TurnosFijos complejoId={complejoId} />
      <NuevoTurnoFijo complejoId={complejoId} />
      <Clientes complejoId={complejoId} />
    </Pantalla>
  );
}

function TurnosFijos({ complejoId }: { complejoId: Id<'complejos'> }) {
  const fijos = useQuery(api.clientes.turnosFijos, { complejoId });
  const finalizar = useMutation(api.clientes.finalizarTurnoFijo);
  const [dandoDeBaja, setDandoDeBaja] = useState<Id<'turnosFijos'> | null>(null);

  if (fijos === undefined) return <Cargando />;
  return (
    <Tarjeta>
      <ThemedText type="smallBold">Turnos fijos</ThemedText>
      {fijos.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Los equipos que juegan todas las semanas a la misma hora. Su horario queda ocupado automáticamente.
        </ThemedText>
      )}
      {fijos.map((f) => (
        <View key={f._id} style={styles.item}>
          <View style={estilosComunes.fila}>
            <View style={estilosComunes.flex}>
              <ThemedText>{f.cliente}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {DIAS_SEMANA[f.diaSemana]} {aHora(f.inicio)} · {f.cancha}
                {f.desde > hoyEnArgentina() ? ` · empieza ${etiquetaFecha(f.desde)}` : ''}
              </ThemedText>
            </View>
            {dandoDeBaja !== f._id && (
              <Pressable onPress={() => setDandoDeBaja(f._id)} hitSlop={8}>
                <ThemedText type="small" themeColor="danger">
                  Dar de baja
                </ThemedText>
              </Pressable>
            )}
          </View>
          {dandoDeBaja === f._id && (
            <View style={estilosComunes.fila}>
              <ThemedText type="small" style={estilosComunes.flex}>
                Se libera desde hoy. ¿Confirmás?
              </ThemedText>
              <Boton titulo="No" variante="secundario" onPress={() => setDandoDeBaja(null)} />
              <Boton
                titulo="Dar de baja"
                variante="peligro"
                onPress={() => void finalizar({ turnoFijoId: f._id }).then(() => setDandoDeBaja(null))}
              />
            </View>
          )}
        </View>
      ))}
    </Tarjeta>
  );
}

// Próxima fecha (hoy incluido) que cae en ese día de la semana.
function proximaFecha(diaSemana: number): string {
  const hoy = hoyEnArgentina();
  return sumarDias(hoy, (diaSemana - diaSemanaDe(hoy) + 7) % 7);
}

function NuevoTurnoFijo({ complejoId }: { complejoId: Id<'complejos'> }) {
  const detalle = useQuery(api.complejos.detalle, { complejoId });
  const crear = useMutation(api.clientes.crearTurnoFijo);
  const [abierto, setAbierto] = useState(false);
  const [cliente, setCliente] = useState<Doc<'clientes'> | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [canchaId, setCanchaId] = useState<Id<'canchas'> | null>(null);
  const [dia, setDia] = useState<number | null>(null);
  const [hora, setHora] = useState('21:00');
  const [semanaQueViene, setSemanaQueViene] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!abierto) return <Boton titulo="+ Nuevo turno fijo" variante="secundario" onPress={() => setAbierto(true)} />;

  const canchas = detalle?.canchas.filter((c) => c.activa) ?? [];
  const desde = dia === null ? null : sumarDias(proximaFecha(dia), semanaQueViene ? 7 : 0);

  async function guardar() {
    const inicio = aMinutos(hora);
    if (!cliente || !canchaId || dia === null || !desde) return;
    if (inicio === null) {
      setError('Escribí la hora con el formato HH:MM, por ejemplo 21:00.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await crear({ canchaId, clienteId: cliente._id, diaSemana: dia, inicio, desde });
      setAbierto(false);
      setCliente(null);
      setBusqueda('');
      setDia(null);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <ThemedText type="smallBold">Nuevo turno fijo</ThemedText>
      <SelectorCliente
        complejoId={complejoId}
        elegido={cliente}
        onElegir={setCliente}
        texto={busqueda}
        onTexto={setBusqueda}
      />
      <ThemedText type="small" themeColor="textSecondary">
        Cancha
      </ThemedText>
      <View style={estilosComunes.filaEnvuelta}>
        {canchas.map((c) => (
          <Chip key={c._id} texto={c.nombre} activo={canchaId === c._id} onPress={() => setCanchaId(c._id)} />
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Día
      </ThemedText>
      <View style={estilosComunes.filaEnvuelta}>
        {DIAS_CORTOS.map((d, i) => (
          <Chip key={d} texto={d} activo={dia === i} onPress={() => setDia(i)} />
        ))}
      </View>
      <Campo etiqueta="Hora" value={hora} onChangeText={setHora} placeholder="21:00" />
      {desde && (
        <View style={estilosComunes.fila}>
          <ThemedText type="small" style={estilosComunes.flex}>
            Empieza: {etiquetaFecha(desde)}
          </ThemedText>
          <Chip
            texto="Empezar la semana que viene"
            activo={semanaQueViene}
            onPress={() => setSemanaQueViene(!semanaQueViene)}
          />
        </View>
      )}
      <TextoError mensaje={error} />
      <View style={estilosComunes.fila}>
        <Boton titulo="Cancelar" variante="secundario" onPress={() => setAbierto(false)} />
        <View style={estilosComunes.flex}>
          <Boton
            titulo="Crear turno fijo"
            onPress={guardar}
            cargando={guardando}
            deshabilitado={!cliente || !canchaId || dia === null}
          />
        </View>
      </View>
    </Tarjeta>
  );
}

function Clientes({ complejoId }: { complejoId: Id<'complejos'> }) {
  const clientes = useQuery(api.clientes.listar, { complejoId });
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<Id<'clientes'> | 'nuevo' | null>(null);

  if (clientes === undefined) return <Cargando />;
  const texto = busqueda.toLowerCase().trim();
  const filtrados = clientes.filter(
    (c) => !texto || c.nombre.toLowerCase().includes(texto) || c.telefono?.includes(texto),
  );

  return (
    <Tarjeta>
      <View style={estilosComunes.fila}>
        <ThemedText type="smallBold" style={estilosComunes.flex}>
          Clientes ({clientes.length})
        </ThemedText>
        <Chip texto="+ Nuevo" activo={editando === 'nuevo'} onPress={() => setEditando('nuevo')} />
      </View>
      {editando === 'nuevo' && <FormCliente complejoId={complejoId} onListo={() => setEditando(null)} />}
      {clientes.length > 5 && <Campo etiqueta="Buscar" value={busqueda} onChangeText={setBusqueda} />}
      {filtrados.map((c) =>
        editando === c._id ? (
          <FormCliente key={c._id} complejoId={complejoId} cliente={c} onListo={() => setEditando(null)} />
        ) : (
          <Pressable key={c._id} onPress={() => setEditando(c._id)} style={styles.item}>
            <ThemedText>{c.nombre}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {[c.telefono, c.notas].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
            </ThemedText>
          </Pressable>
        ),
      )}
    </Tarjeta>
  );
}

function FormCliente({
  complejoId,
  cliente,
  onListo,
}: {
  complejoId: Id<'complejos'>;
  cliente?: Doc<'clientes'>;
  onListo: () => void;
}) {
  const crear = useMutation(api.clientes.crear);
  const actualizar = useMutation(api.clientes.actualizar);
  const [nombre, setNombre] = useState(cliente?.nombre ?? '');
  const [telefono, setTelefono] = useState(cliente?.telefono ?? '');
  const [notas, setNotas] = useState(cliente?.notas ?? '');
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);
    try {
      const datos = { nombre, telefono: telefono || undefined, notas: notas || undefined };
      if (cliente) await actualizar({ clienteId: cliente._id, ...datos });
      else await crear({ complejoId, ...datos });
      onListo();
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  return (
    <View style={styles.form}>
      <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} />
      <Campo etiqueta="Teléfono" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" />
      <Campo etiqueta="Notas" value={notas} onChangeText={setNotas} placeholder="Ej.: paga siempre en efectivo" />
      {cliente?.telefono && (
        <Pressable onPress={() => void Linking.openURL(enlaceWhatsapp(cliente.telefono!))}>
          <ThemedText type="linkPrimary">Escribir por WhatsApp</ThemedText>
        </Pressable>
      )}
      <TextoError mensaje={error} />
      <View style={estilosComunes.fila}>
        <Boton titulo="Cancelar" variante="secundario" onPress={onListo} />
        <View style={estilosComunes.flex}>
          <Boton titulo="Guardar" onPress={guardar} deshabilitado={!nombre.trim()} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  item: { gap: Spacing.one },
  form: { gap: Spacing.two },
});

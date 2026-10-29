import { useMutation, useQuery } from 'convex/react';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  Boton,
  Campo,
  Cargando,
  Chip,
  Encabezado,
  Interruptor,
  Pantalla,
  Tarjeta,
  TextoError,
  estilosComunes,
  mensajeDeError,
} from '@/components/ui/formulario';
import { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { DIAS_CORTOS, DIAS_SEMANA, aHora, aMinutos, formatoPrecio } from '../../../../convex/lib/horas';

export default function CanchaScreen() {
  const { canchaId } = useLocalSearchParams<{ canchaId: Id<'canchas'> }>();
  const detalle = useQuery(api.canchas.detalle, { canchaId });

  if (detalle === undefined) return <Cargando />;
  const { cancha, complejo, franjas } = detalle;

  return (
    <Pantalla>
      <Encabezado titulo={`${cancha.nombre} · ${complejo.nombre}`} />
      <Franjas franjas={franjas} />
      <NuevaFranja canchaId={cancha._id} />
      <DatosCancha cancha={cancha} />
    </Pantalla>
  );
}

function Franjas({ franjas }: { franjas: Doc<'franjasHorarias'>[] }) {
  const eliminar = useMutation(api.canchas.eliminarFranja);

  return (
    <Tarjeta>
      <ThemedText type="smallBold">Horarios y precios</ThemedText>
      {franjas.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Todavía no hay horarios. Cargalos abajo: podés elegir varios días a la vez.
        </ThemedText>
      )}
      {DIAS_SEMANA.map((dia, i) => {
        const delDia = franjas.filter((f) => f.diaSemana === i);
        if (delDia.length === 0) return null;
        return (
          <View key={dia} style={styles.dia}>
            <ThemedText type="small" themeColor="textSecondary">
              {dia}
            </ThemedText>
            {delDia.map((f) => (
              <View key={f._id} style={estilosComunes.fila}>
                <ThemedText style={estilosComunes.flex}>
                  {aHora(f.inicio)} a {aHora(f.fin)} · turnos de {f.duracionTurno} min · {formatoPrecio(f.precio)}
                </ThemedText>
                <Pressable onPress={() => void eliminar({ franjaId: f._id })} hitSlop={8}>
                  <ThemedText type="small" themeColor="danger">
                    Quitar
                  </ThemedText>
                </Pressable>
              </View>
            ))}
          </View>
        );
      })}
    </Tarjeta>
  );
}

function NuevaFranja({ canchaId }: { canchaId: Id<'canchas'> }) {
  const agregar = useMutation(api.canchas.agregarFranjas);
  const [dias, setDias] = useState<number[]>([]);
  const [desde, setDesde] = useState('18:00');
  const [hasta, setHasta] = useState('24:00');
  const [duracion, setDuracion] = useState('60');
  const [precio, setPrecio] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function alternarDia(dia: number) {
    setDias((actuales) => (actuales.includes(dia) ? actuales.filter((d) => d !== dia) : [...actuales, dia]));
  }

  async function guardar() {
    setError(null);
    const inicio = aMinutos(desde);
    let fin = aMinutos(hasta);
    if (inicio === null || fin === null) {
      setError('Escribí las horas con el formato HH:MM, por ejemplo 18:00.');
      return;
    }
    // "Hasta 01:00" con apertura a las 18:00 significa que cierra pasada la medianoche.
    if (fin <= inicio) fin += 1440;
    setGuardando(true);
    try {
      await agregar({ canchaId, dias, inicio, fin, duracionTurno: Number(duracion), precio: Number(precio) });
      setDias([]);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <ThemedText type="smallBold">Agregar horario</ThemedText>
      <View style={estilosComunes.filaEnvuelta}>
        {DIAS_CORTOS.map((dia, i) => (
          <Chip key={dia} texto={dia} activo={dias.includes(i)} onPress={() => alternarDia(i)} />
        ))}
        <Chip texto="Lun a Vie" activo={false} onPress={() => setDias([1, 2, 3, 4, 5])} />
        <Chip texto="Todos" activo={false} onPress={() => setDias([0, 1, 2, 3, 4, 5, 6])} />
      </View>
      <View style={estilosComunes.fila}>
        <View style={estilosComunes.flex}>
          <Campo etiqueta="Desde" value={desde} onChangeText={setDesde} placeholder="18:00" />
        </View>
        <View style={estilosComunes.flex}>
          <Campo etiqueta="Hasta" value={hasta} onChangeText={setHasta} placeholder="24:00" />
        </View>
      </View>
      <View style={estilosComunes.fila}>
        <View style={estilosComunes.flex}>
          <Campo etiqueta="Duración del turno (min)" value={duracion} onChangeText={setDuracion} keyboardType="numeric" />
        </View>
        <View style={estilosComunes.flex}>
          <Campo etiqueta="Precio del turno ($)" value={precio} onChangeText={setPrecio} keyboardType="numeric" />
        </View>
      </View>
      <TextoError mensaje={error} />
      <Boton titulo="Agregar horario" onPress={guardar} cargando={guardando} deshabilitado={dias.length === 0} />
    </Tarjeta>
  );
}

function DatosCancha({ cancha }: { cancha: Doc<'canchas'> }) {
  const actualizar = useMutation(api.canchas.actualizar);
  const [nombre, setNombre] = useState(cancha.nombre);
  const [jugadores, setJugadores] = useState(String(cancha.jugadoresPorLado));
  const [superficie, setSuperficie] = useState(cancha.superficie ?? '');
  const [techada, setTechada] = useState(cancha.techada);
  const [activa, setActiva] = useState(cancha.activa);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  async function guardar() {
    setGuardando(true);
    setError(null);
    setGuardado(false);
    try {
      await actualizar({
        canchaId: cancha._id,
        nombre,
        jugadoresPorLado: Number(jugadores) || 5,
        superficie: superficie.trim() || undefined,
        techada,
        activa,
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
      <ThemedText type="smallBold">Datos de la cancha</ThemedText>
      <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} />
      <Campo etiqueta="Jugadores por equipo" value={jugadores} onChangeText={setJugadores} keyboardType="numeric" />
      <Campo etiqueta="Superficie" value={superficie} onChangeText={setSuperficie} placeholder="Sintético, cemento..." />
      <Interruptor etiqueta="Techada" valor={techada} onCambio={setTechada} />
      <Interruptor etiqueta="Activa (se puede reservar)" valor={activa} onCambio={setActiva} />
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

const styles = StyleSheet.create({
  dia: { gap: 4 },
});

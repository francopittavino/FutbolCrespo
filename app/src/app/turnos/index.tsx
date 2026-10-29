import { AuthLoading, Authenticated, Unauthenticated, useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { AliasSenia } from '@/components/alias-senia';
import { BotonGoogle } from '@/components/boton-google';
import { Portada } from '@/components/portada';
import { ThemedText } from '@/components/themed-text';
import {
  Boton,
  Cargando,
  Pantalla,
  Tarjeta,
  TextoError,
  estilosComunes,
  mensajeDeError,
} from '@/components/ui/formulario';
import { Colors, Radios, Spacing } from '@/constants/theme';
import { useAhora } from '@/hooks/use-ahora';
import { enlaceWhatsapp } from '@/lib/whatsapp';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { aHora, etiquetaFecha, formatoPrecio, hoyEnArgentina } from '../../../convex/lib/horas';

type Reserva = FunctionReturnType<typeof api.reservas.misReservas>[number];
type PartidoMio = FunctionReturnType<typeof api.partidos.misPartidos>[number];

const NOMBRE_ESTADO: Record<Reserva['estado'], string> = {
  pendiente_pago: 'Esperando la seña',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  completada: 'Jugada',
  ausente: 'No se presentó',
};

export default function TurnosScreen() {
  return (
    <Pantalla cabecera={<Portada titulo="Mis" tituloAcento="partidos" />}>
      <AuthLoading>
        <Cargando />
      </AuthLoading>
      <Unauthenticated>
        <Tarjeta>
          <ThemedText type="heading" themeColor="primary">
            Tus partidos
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            Ingresá para ver tus reservas, armar los equipos y llevar tus estadísticas.
          </ThemedText>
          <BotonGoogle />
        </Tarjeta>
      </Unauthenticated>
      <Authenticated>
        <MiMes />
        <ListaDeTurnos />
        <Boton titulo="Amigos" variante="secundario" onPress={() => router.push('/turnos/amigos')} />
      </Authenticated>
    </Pantalla>
  );
}

// "Mi mes en la cancha", como la imagen del diseño.
function MiMes() {
  const mes = hoyEnArgentina().slice(0, 7);
  const stats = useQuery(api.partidos.miMes, { mes });
  if (!stats) return null;
  const datos = [
    { valor: stats.partidos, nombre: 'Partidos' },
    { valor: stats.ganados, nombre: 'Ganados' },
    { valor: stats.golesAFavor, nombre: 'Goles a favor' },
    { valor: stats.rachaGanadora, nombre: 'Racha ganadora' },
  ];
  return (
    <View style={styles.mes}>
      <View>
        <ThemedText type="heading" themeColor="onDark">
          Mi mes en
        </ThemedText>
        <ThemedText type="heading" themeColor="accent">
          la cancha
        </ThemedText>
      </View>
      <View style={styles.cuadros}>
        {datos.map((d) => (
          <View key={d.nombre} style={styles.cuadro}>
            <ThemedText type="title" themeColor="accent">
              {d.valor}
            </ThemedText>
            <ThemedText type="label" themeColor="onDark">
              {d.nombre}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

function ListaDeTurnos() {
  const reservas = useQuery(api.reservas.misReservas);
  const partidos = useQuery(api.partidos.misPartidos);
  const ahora = useAhora();
  if (reservas === undefined || partidos === undefined) return <Cargando />;

  const partidoDeReserva = new Map(partidos.map((p) => [p.reservaId, p._id]));
  const proximas = reservas
    .filter((r) => r.comienzaEn > ahora && r.estado !== 'cancelada')
    .sort((a, b) => a.comienzaEn - b.comienzaEn);
  // Partidos a los que me invitaron (los míos ya aparecen como reserva).
  const invitado = partidos
    .filter((p) => !p.soyOrganizador && p.comienzaEn > ahora && !p.cancelado)
    .sort((a, b) => a.comienzaEn - b.comienzaEn);
  const jugados = partidos.filter((p) => p.comienzaEn <= ahora && !p.cancelado);
  const historial = reservas.filter((r) => !proximas.includes(r) && !partidoDeReserva.has(r._id));

  return (
    <>
      <ThemedText type="heading" themeColor="primary">
        Próximos
      </ThemedText>
      {proximas.length === 0 && invitado.length === 0 && (
        <ThemedText themeColor="textSecondary">No tenés partidos reservados. ¡Buscá una cancha en Reservar!</ThemedText>
      )}
      {proximas.map((r) => (
        <TurnoProximo key={r._id} reserva={r} ahora={ahora} partidoId={partidoDeReserva.get(r._id)} />
      ))}
      {invitado.map((p) => (
        <TarjetaPartido key={p._id} partido={p} />
      ))}

      {jugados.length + historial.length > 0 && (
        <ThemedText type="heading" themeColor="primary">
          Historial
        </ThemedText>
      )}
      {jugados.map((p) => (
        <TarjetaPartido key={p._id} partido={p} />
      ))}
      {historial.map((r) => (
        <Tarjeta key={r._id}>
          <ThemedText type="small">
            {r.complejo} · {r.cancha} · {etiquetaFecha(r.fecha)} {aHora(r.inicio)} · {NOMBRE_ESTADO[r.estado]}
          </ThemedText>
        </Tarjeta>
      ))}
    </>
  );
}

function TarjetaPartido({ partido }: { partido: PartidoMio }) {
  const conResultado = partido.golesA !== undefined;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/turnos/partido/[partidoId]', params: { partidoId: partido._id } })}
      style={({ pressed }) => pressed && styles.presionado}>
      <Tarjeta>
        <View style={estilosComunes.fila}>
          <View style={estilosComunes.flex}>
            <ThemedText type="heading" themeColor="primary">
              {etiquetaFecha(partido.fecha)} · {aHora(partido.inicio)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {partido.complejo} · {partido.cancha}
              {partido.soyOrganizador ? '' : ` · Organiza ${partido.organizador}`}
            </ThemedText>
          </View>
          <ThemedText type="heading" themeColor={conResultado ? 'primary' : 'textSecondary'}>
            {conResultado ? `${partido.golesA}-${partido.golesB}` : 'Ver ›'}
          </ThemedText>
        </View>
      </Tarjeta>
    </Pressable>
  );
}

function TurnoProximo({
  reserva,
  ahora,
  partidoId,
}: {
  reserva: Reserva;
  ahora: number;
  partidoId?: Id<'partidos'>;
}) {
  const cancelar = useMutation(api.reservas.cancelar);
  const crearPartido = useMutation(api.partidos.crear);
  const [confirmando, setConfirmando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const horasQueFaltan = (reserva.comienzaEn - ahora) / 3_600_000;
  const pierdeSenia = reserva.seniaPagada && horasQueFaltan < reserva.horasCancelacionGratis;

  async function abrirPartido() {
    setError(null);
    try {
      const id = partidoId ?? (await crearPartido({ reservaId: reserva._id }));
      router.push({ pathname: '/turnos/partido/[partidoId]', params: { partidoId: id } });
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  async function confirmarCancelacion() {
    setCancelando(true);
    setError(null);
    try {
      await cancelar({ reservaId: reserva._id });
    } catch (e) {
      setError(mensajeDeError(e));
      setCancelando(false);
    }
  }

  return (
    <Tarjeta>
      <View>
        <ThemedText type="heading" themeColor="primary">
          {etiquetaFecha(reserva.fecha)} · {aHora(reserva.inicio)}
        </ThemedText>
        <ThemedText>
          {reserva.complejo} · {reserva.cancha}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {reserva.direccion} · {formatoPrecio(reserva.precio)} · {NOMBRE_ESTADO[reserva.estado]}
          {reserva.montoSenia !== undefined && reserva.seniaPagada ? ' · Seña pagada' : ''}
        </ThemedText>
      </View>

      <Boton
        titulo={partidoId ? 'Ver partido' : 'Armar partido e invitar'}
        variante={partidoId ? 'secundario' : 'primario'}
        onPress={() => void abrirPartido()}
      />

      {reserva.montoSenia !== undefined && !reserva.seniaPagada && (
        <AliasSenia monto={reserva.montoSenia} alias={reserva.aliasPago} conWhatsapp={Boolean(reserva.whatsapp)} />
      )}

      {reserva.whatsapp && (
        <Pressable onPress={() => void Linking.openURL(enlaceWhatsapp(reserva.whatsapp!))}>
          <ThemedText type="linkPrimary">Escribir al complejo por WhatsApp</ThemedText>
        </Pressable>
      )}

      {confirmando ? (
        <View style={styles.confirmacion}>
          <ThemedText type="small">
            {pierdeSenia
              ? `Faltan menos de ${reserva.horasCancelacionGratis} h: si cancelás, perdés la seña. ¿Cancelar igual?`
              : '¿Seguro que querés cancelar este turno?'}
          </ThemedText>
          <View style={estilosComunes.fila}>
            <Boton titulo="No" variante="secundario" onPress={() => setConfirmando(false)} />
            <View style={estilosComunes.flex}>
              <Boton titulo="Sí, cancelar" variante="peligro" onPress={confirmarCancelacion} cargando={cancelando} />
            </View>
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setConfirmando(true)}>
          <ThemedText type="small" themeColor="danger">
            Cancelar turno
          </ThemedText>
        </Pressable>
      )}
      <TextoError mensaje={error} />
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  confirmacion: { gap: Spacing.two },
  presionado: { opacity: 0.7 },
  mes: {
    backgroundColor: Colors.brand,
    borderRadius: Radios.tarjeta,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  cuadros: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  cuadro: {
    flexGrow: 1,
    flexBasis: '45%',
    borderWidth: 1,
    borderColor: Colors.darkLine,
    borderRadius: Radios.tarjeta,
    padding: Spacing.three,
    backgroundColor: Colors.brandElevado,
  },
});

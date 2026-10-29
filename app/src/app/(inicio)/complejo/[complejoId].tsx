import { Authenticated, Unauthenticated, useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AliasSenia } from '@/components/alias-senia';
import { BannerComplejo } from '@/components/banner-complejo';
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
import { Colors, MaxContentWidth, Radios, Spacing } from '@/constants/theme';
import { useAhora } from '@/hooks/use-ahora';
import { enlaceWhatsapp } from '@/lib/whatsapp';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import {
  aHora,
  etiquetaFecha,
  formatoPrecio,
  hoyEnArgentina,
  inicioDelTurno,
  sumarDias,
} from '../../../../convex/lib/horas';

const DIAS_VISIBLES = 14;

type Complejo = NonNullable<FunctionReturnType<typeof api.complejos.publico>>;
type Turno = { inicio: number; fin: number; precio: number };

export default function ComplejoScreen() {
  const { complejoId } = useLocalSearchParams<{ complejoId: Id<'complejos'> }>();
  const complejo = useQuery(api.complejos.publico, { complejoId });

  if (complejo === undefined) return <Cargando />;
  if (complejo === null) {
    return (
      <Pantalla>
        <Tarjeta>
          <ThemedText>Este complejo no está disponible.</ThemedText>
        </Tarjeta>
        <Boton titulo="Ver todos los complejos" variante="secundario" onPress={() => router.replace('/')} />
      </Pantalla>
    );
  }
  return <Reservar complejo={complejo} />;
}

function Reservar({ complejo }: { complejo: Complejo }) {
  const hoy = hoyEnArgentina();
  const ahora = useAhora();
  const [fecha, setFecha] = useState(hoy);
  const [canchaId, setCanchaId] = useState<Id<'canchas'> | null>(complejo.canchas[0]?._id ?? null);
  const [turno, setTurno] = useState<Turno | null>(null);
  const [reservaHecha, setReservaHecha] = useState<{ reservaId: Id<'reservas'>; turno: Turno; cancha: string } | null>(null);
  const disponibilidad = useQuery(api.disponibilidad.delComplejo, { complejoId: complejo._id, fecha });

  const cancha = complejo.canchas.find((c) => c._id === canchaId);
  const turnos =
    disponibilidad
      ?.find((d) => d.canchaId === canchaId)
      ?.turnos.filter((t) => t.libre && inicioDelTurno(fecha, t.inicio) > ahora) ?? [];

  function elegirFecha(f: string) {
    setFecha(f);
    setTurno(null);
    setReservaHecha(null);
  }

  return (
    <Pantalla cabecera={<Cabecera complejo={complejo} />}>
      <Paso numero={1} titulo="Elegí el día">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilosComunes.fila}>
          {Array.from({ length: DIAS_VISIBLES }, (_, i) => sumarDias(hoy, i)).map((f) => (
            <Chip key={f} texto={etiquetaFecha(f, hoy)} activo={f === fecha} onPress={() => elegirFecha(f)} />
          ))}
        </ScrollView>
      </Paso>

      <Paso numero={2} titulo="Elegí la cancha">
        <View style={estilosComunes.filaEnvuelta}>
          {complejo.canchas.map((c) => (
            <Pressable
              key={c._id}
              onPress={() => {
                setCanchaId(c._id);
                setTurno(null);
              }}
              style={[styles.cancha, c._id === canchaId && styles.canchaElegida]}>
              <ThemedText type="smallBold" themeColor={c._id === canchaId ? 'onPrimary' : 'text'}>
                {c.nombre}
              </ThemedText>
              <ThemedText type="small" themeColor={c._id === canchaId ? 'onPrimary' : 'textSecondary'}>
                Fútbol {c.jugadoresPorLado}
                {c.techada ? ' · Techada' : ''}
                {c.superficie ? ` · ${c.superficie}` : ''}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </Paso>

      <Paso numero={3} titulo="Elegí el horario">
        {disponibilidad === undefined ? (
          <Cargando />
        ) : turnos.length === 0 ? (
          <ThemedText themeColor="textSecondary">No quedan turnos libres en esta cancha ese día. Probá otro día.</ThemedText>
        ) : (
          <View style={estilosComunes.filaEnvuelta}>
            {turnos.map((t) => (
              <BotonTurno
                key={t.inicio}
                turno={t}
                elegido={turno?.inicio === t.inicio}
                onPress={() => {
                  setTurno(t);
                  setReservaHecha(null);
                }}
              />
            ))}
          </View>
        )}
      </Paso>

      {turno && cancha && (
        <Confirmar
          complejo={complejo}
          cancha={cancha.nombre}
          canchaId={cancha._id}
          fecha={fecha}
          turno={turno}
          onCancelar={() => setTurno(null)}
          onReservada={(reservaId) => {
            setReservaHecha({ reservaId, turno, cancha: cancha.nombre });
            setTurno(null);
          }}
        />
      )}
      {reservaHecha && <ReservaHecha complejo={complejo} fecha={fecha} {...reservaHecha} />}
    </Pantalla>
  );
}

function Cabecera({ complejo }: { complejo: Complejo }) {
  return (
    <View>
      <BannerComplejo url={complejo.banner} style={styles.banner} />
      <View style={styles.datos}>
        <ThemedText type="subtitle" themeColor="onDark">
          {complejo.nombre}
        </ThemedText>
        <ThemedText themeColor="textSecondary">{complejo.direccion}</ThemedText>
        {complejo.descripcion && <ThemedText type="small">{complejo.descripcion}</ThemedText>}
        <View style={estilosComunes.filaEnvuelta}>
          {complejo.precioDesde !== null && (
            <ThemedText type="small" themeColor="primary">
              Desde {formatoPrecio(complejo.precioDesde)} el turno
            </ThemedText>
          )}
          {complejo.requiereSenia && complejo.montoSenia && (
            <ThemedText type="small" themeColor="textSecondary">
              · Seña {formatoPrecio(complejo.montoSenia)}
            </ThemedText>
          )}
          <ThemedText type="small" themeColor="textSecondary">
            · Cancelás gratis hasta {complejo.horasCancelacionGratis} h antes
          </ThemedText>
        </View>
        {complejo.whatsapp && (
          <Pressable onPress={() => void Linking.openURL(enlaceWhatsapp(complejo.whatsapp!))}>
            <ThemedText type="linkPrimary">Consultar por WhatsApp</ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Paso({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) {
  return (
    <View style={styles.paso}>
      <View style={estilosComunes.fila}>
        <View style={styles.numero}>
          <ThemedText type="smallBold" themeColor="onAccent">
            {numero}
          </ThemedText>
        </View>
        <ThemedText type="heading" themeColor="onDark">
          {titulo}
        </ThemedText>
      </View>
      {children}
    </View>
  );
}

function BotonTurno({ turno, elegido, onPress }: { turno: Turno; elegido: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.turno, elegido && styles.turnoElegido, pressed && styles.presionado]}>
      <ThemedText type="heading" themeColor={elegido ? 'onPrimary' : 'onDark'}>
        {aHora(turno.inicio)}
      </ThemedText>
      <ThemedText type="small" themeColor={elegido ? 'onPrimary' : 'textSecondary'}>
        {formatoPrecio(turno.precio)}
      </ThemedText>
    </Pressable>
  );
}

function Confirmar({
  complejo,
  cancha,
  canchaId,
  fecha,
  turno,
  onCancelar,
  onReservada,
}: {
  complejo: Complejo;
  cancha: string;
  canchaId: Id<'canchas'>;
  fecha: string;
  turno: Turno;
  onCancelar: () => void;
  onReservada: (reservaId: Id<'reservas'>) => void;
}) {
  const reservar = useMutation(api.reservas.reservar);
  const yo = useQuery(api.usuarios.yo);
  const [telefono, setTelefono] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    setGuardando(true);
    setError(null);
    try {
      onReservada(
        await reservar({ canchaId, fecha, inicio: turno.inicio, telefono: telefono.trim() || yo?.telefono || undefined }),
      );
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <ThemedText type="heading" themeColor="primary">
        Confirmá tu reserva
      </ThemedText>
      <ThemedText>
        {cancha} · {etiquetaFecha(fecha)} de {aHora(turno.inicio)} a {aHora(turno.fin)} · {formatoPrecio(turno.precio)}
      </ThemedText>
      {complejo.requiereSenia && complejo.montoSenia !== undefined && (
        <AliasSenia monto={complejo.montoSenia} alias={complejo.aliasPago} conWhatsapp={Boolean(complejo.whatsapp)} />
      )}
      <Unauthenticated>
        <ThemedText type="small" themeColor="textSecondary">
          Para reservar tenés que ingresar con tu cuenta de Google.
        </ThemedText>
        <BotonGoogle titulo="Ingresar con Google para reservar" />
      </Unauthenticated>
      <Authenticated>
        {!yo?.telefono && (
          <Campo
            etiqueta="Tu celular (opcional, para que el complejo te avise)"
            value={telefono}
            onChangeText={setTelefono}
            keyboardType="phone-pad"
          />
        )}
        <TextoError mensaje={error} />
        <View style={estilosComunes.fila}>
          <Boton titulo="Cancelar" variante="secundario" onPress={onCancelar} />
          <View style={estilosComunes.flex}>
            <Boton titulo="Confirmar reserva" onPress={confirmar} cargando={guardando} />
          </View>
        </View>
      </Authenticated>
    </Tarjeta>
  );
}

function ReservaHecha({
  complejo,
  fecha,
  reservaId,
  turno,
  cancha,
}: {
  complejo: Complejo;
  fecha: string;
  reservaId: Id<'reservas'>;
  turno: Turno;
  cancha: string;
}) {
  const crearPartido = useMutation(api.partidos.crear);
  const [error, setError] = useState<string | null>(null);

  async function armarPartido() {
    try {
      const partidoId = await crearPartido({ reservaId });
      router.push({ pathname: '/turnos/partido/[partidoId]', params: { partidoId } });
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  return (
    <View style={styles.hecha}>
      <ThemedText type="label" themeColor="accent">
        Cancha reservada
      </ThemedText>
      <ThemedText type="subtitle" themeColor="onDark">
        {etiquetaFecha(fecha)} · {aHora(turno.inicio)}
      </ThemedText>
      <ThemedText themeColor="onDarkSecondary">
        {complejo.nombre} · {cancha}
      </ThemedText>
      {complejo.requiereSenia && complejo.montoSenia !== undefined && (
        <AliasSenia monto={complejo.montoSenia} alias={complejo.aliasPago} conWhatsapp={Boolean(complejo.whatsapp)} />
      )}
      <Boton titulo="Armar partido e invitar" onPress={() => void armarPartido()} />
      <TextoError mensaje={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: Platform.select({ web: { maxHeight: 340 }, default: {} }),
  datos: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.one,
  },
  paso: { gap: Spacing.three },
  numero: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancha: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundElement,
    borderRadius: Radios.tarjeta,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  canchaElegida: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  turno: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundElement,
    borderRadius: Radios.campo,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    minWidth: 84,
  },
  turnoElegido: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  presionado: { opacity: 0.7 },
  hecha: {
    backgroundColor: Colors.brand,
    borderRadius: Radios.tarjeta,
    padding: Spacing.four,
    gap: Spacing.two,
  },
});

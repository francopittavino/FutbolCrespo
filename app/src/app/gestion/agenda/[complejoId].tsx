import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MEDIOS_DE_PAGO, NOMBRE_MEDIO, type MedioPago } from '@/components/gestion/medios-de-pago';
import { SelectorCliente } from '@/components/gestion/selector-cliente';
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
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { enlaceWhatsapp } from '@/lib/whatsapp';
import { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { aHora, etiquetaFecha, formatoPrecio, hoyEnArgentina, sumarDias } from '../../../../convex/lib/horas';

type Agenda = FunctionReturnType<typeof api.agenda.delDia>;
type Turno = Agenda['canchas'][number]['turnos'][number];
type Celda = Turno['celda'];

const ORIGEN: Record<'app' | 'complejo' | 'turno_fijo', string> = {
  app: 'Por la app',
  complejo: 'Cargada por el complejo',
  turno_fijo: 'Turno fijo',
};

const ESTADO: Record<string, string> = {
  pendiente_pago: 'Esperando seña',
  confirmada: 'Confirmada',
  completada: 'Jugaron',
  ausente: 'No vinieron',
};

export default function AgendaScreen() {
  const { complejoId } = useLocalSearchParams<{ complejoId: Id<'complejos'> }>();
  const hoy = hoyEnArgentina();
  const [fecha, setFecha] = useState(hoy);
  const [abierto, setAbierto] = useState<string | null>(null);
  const agenda = useQuery(api.agenda.delDia, { complejoId, fecha });

  const todos = agenda?.canchas.flatMap((c) => c.turnos) ?? [];
  const ocupados = todos.filter((t) => t.celda.tipo === 'reserva' || t.celda.tipo === 'fijo');
  const ingresos = ocupados.reduce((suma, t) => suma + t.precio, 0);
  const cobrado = todos.reduce((suma, t) => suma + (t.celda.tipo === 'reserva' ? t.celda.cobrado : 0), 0);

  return (
    <Pantalla>
      <Encabezado titulo={agenda ? `Agenda · ${agenda.complejo.nombre}` : 'Agenda'} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilosComunes.fila}>
        {Array.from({ length: 15 }, (_, i) => sumarDias(hoy, i - 1)).map((f) => (
          <Chip
            key={f}
            texto={f === sumarDias(hoy, -1) ? 'Ayer' : etiquetaFecha(f, hoy)}
            activo={f === fecha}
            onPress={() => {
              setFecha(f);
              setAbierto(null);
            }}
          />
        ))}
      </ScrollView>

      {agenda === undefined ? (
        <Cargando />
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {ocupados.length} de {todos.length} turnos ocupados · {formatoPrecio(ingresos)} estimado ·{' '}
            {formatoPrecio(cobrado)} cobrado
          </ThemedText>
          {agenda.canchas.length === 0 && (
            <Tarjeta>
              <ThemedText themeColor="textSecondary">No hay canchas activas en este complejo.</ThemedText>
            </Tarjeta>
          )}
          {agenda.canchas.map((cancha) => (
            <Tarjeta key={cancha._id}>
              <ThemedText type="smallBold">{cancha.nombre}</ThemedText>
              {cancha.turnos.length === 0 && (
                <ThemedText type="small" themeColor="textSecondary">
                  Esta cancha no tiene horarios este día.
                </ThemedText>
              )}
              {cancha.turnos.map((turno) => {
                const clave = `${cancha._id}-${turno.inicio}`;
                return (
                  <FilaTurno
                    key={clave}
                    turno={turno}
                    abierta={abierto === clave}
                    onAlternar={() => setAbierto(abierto === clave ? null : clave)}>
                    <Acciones
                      complejoId={complejoId}
                      canchaId={cancha._id}
                      fecha={fecha}
                      turno={turno}
                      onListo={() => setAbierto(null)}
                    />
                  </FilaTurno>
                );
              })}
            </Tarjeta>
          ))}
        </>
      )}
    </Pantalla>
  );
}

function colorDe(celda: Celda): ThemeColor {
  if (celda.tipo === 'libre') return 'border';
  if (celda.tipo === 'bloqueo') return 'textSecondary';
  if (celda.tipo === 'reserva' && celda.estado === 'ausente') return 'danger';
  return 'primary';
}

function FilaTurno({
  turno,
  abierta,
  onAlternar,
  children,
}: {
  turno: Turno;
  abierta: boolean;
  onAlternar: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  const { celda } = turno;
  return (
    <View style={[styles.fila, { borderLeftColor: theme[colorDe(celda)] }]}>
      <Pressable onPress={onAlternar} style={({ pressed }) => [estilosComunes.fila, pressed && styles.presionado]}>
        <ThemedText type="smallBold" style={styles.hora}>
          {aHora(turno.inicio)}
        </ThemedText>
        <View style={estilosComunes.flex}>
          <Resumen celda={celda} precio={turno.precio} />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {abierta ? '▲' : '▼'}
        </ThemedText>
      </Pressable>
      {abierta && <View style={styles.acciones}>{children}</View>}
    </View>
  );
}

function Resumen({ celda, precio }: { celda: Celda; precio: number }) {
  switch (celda.tipo) {
    case 'libre':
      return (
        <ThemedText type="small" themeColor="textSecondary">
          Libre · {formatoPrecio(precio)}
        </ThemedText>
      );
    case 'bloqueo':
      return (
        <ThemedText type="small" themeColor="textSecondary">
          Bloqueado{celda.motivo ? ` · ${celda.motivo}` : ''}
        </ThemedText>
      );
    case 'fijo':
      return (
        <>
          <ThemedText>{celda.nombre}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Turno fijo · {formatoPrecio(precio)}
          </ThemedText>
        </>
      );
    case 'reserva': {
      const saldo = celda.precio - celda.cobrado;
      const pago = celda.cobrado === 0 ? '' : saldo <= 0 ? ' · Pagó todo' : ` · Debe ${formatoPrecio(saldo)}`;
      const senia =
        celda.cobrado > 0 && saldo <= 0
          ? ''
          : celda.montoSenia !== undefined
          ? celda.seniaPagada
            ? ' · Seña cobrada'
            : ` · Seña ${formatoPrecio(celda.montoSenia)} pendiente`
          : '';
      return (
        <>
          <ThemedText>{celda.nombre}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {ORIGEN[celda.origen]} · {ESTADO[celda.estado] ?? celda.estado}
            {senia}
            {pago}
          </ThemedText>
        </>
      );
    }
  }
}

function Acciones({
  complejoId,
  canchaId,
  fecha,
  turno,
  onListo,
}: {
  complejoId: Id<'complejos'>;
  canchaId: Id<'canchas'>;
  fecha: string;
  turno: Turno;
  onListo: () => void;
}) {
  const { celda } = turno;
  switch (celda.tipo) {
    case 'libre':
      return <AccionesLibre complejoId={complejoId} canchaId={canchaId} fecha={fecha} inicio={turno.inicio} onListo={onListo} />;
    case 'reserva':
      return <AccionesReserva celda={celda} />;
    case 'bloqueo':
      return <AccionesBloqueo bloqueoId={celda.bloqueoId} />;
    case 'fijo':
      return <AccionesFijo celda={celda} fecha={fecha} />;
  }
}

// Ejecuta una acción y muestra el error si falla.
function useAccion() {
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function ejecutar(accion: () => Promise<unknown>, alTerminar?: () => void) {
    setEnCurso(true);
    setError(null);
    try {
      await accion();
      alTerminar?.();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnCurso(false);
    }
  }
  return { enCurso, error, ejecutar };
}

function AccionesLibre({
  complejoId,
  canchaId,
  fecha,
  inicio,
  onListo,
}: {
  complejoId: Id<'complejos'>;
  canchaId: Id<'canchas'>;
  fecha: string;
  inicio: number;
  onListo: () => void;
}) {
  const reservar = useMutation(api.agenda.reservarManual);
  const bloquear = useMutation(api.agenda.bloquear);
  const [modo, setModo] = useState<'reservar' | 'bloquear'>('reservar');
  const [cliente, setCliente] = useState<Doc<'clientes'> | null>(null);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [guardarCliente, setGuardarCliente] = useState(true);
  const [motivo, setMotivo] = useState('');
  const { enCurso, error, ejecutar } = useAccion();

  return (
    <>
      <View style={estilosComunes.fila}>
        <Chip texto="Reservar" activo={modo === 'reservar'} onPress={() => setModo('reservar')} />
        <Chip texto="Bloquear horario" activo={modo === 'bloquear'} onPress={() => setModo('bloquear')} />
      </View>
      {modo === 'reservar' ? (
        <>
          <SelectorCliente
            complejoId={complejoId}
            elegido={cliente}
            onElegir={setCliente}
            texto={nombre}
            onTexto={setNombre}
            permitirNuevo
          />
          {!cliente && (
            <>
              <Campo etiqueta="Teléfono (opcional)" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" />
              <Interruptor etiqueta="Guardar como cliente" valor={guardarCliente} onCambio={setGuardarCliente} />
            </>
          )}
          <TextoError mensaje={error} />
          <Boton
            titulo="Confirmar reserva"
            cargando={enCurso}
            deshabilitado={!cliente && !nombre.trim()}
            onPress={() =>
              ejecutar(
                () =>
                  reservar({
                    canchaId,
                    fecha,
                    inicio,
                    clienteId: cliente?._id,
                    nombre,
                    telefono: telefono || undefined,
                    guardarCliente: !cliente && guardarCliente,
                  }),
                onListo,
              )
            }
          />
        </>
      ) : (
        <>
          <Campo etiqueta="Motivo (opcional)" value={motivo} onChangeText={setMotivo} placeholder="Mantenimiento, torneo..." />
          <TextoError mensaje={error} />
          <Boton
            titulo="Bloquear"
            variante="secundario"
            cargando={enCurso}
            onPress={() => ejecutar(() => bloquear({ canchaId, fecha, inicio, motivo }), onListo)}
          />
        </>
      )}
    </>
  );
}

function AccionesReserva({ celda }: { celda: Extract<Celda, { tipo: 'reserva' }> }) {
  const cambiarEstado = useMutation(api.agenda.cambiarEstado);
  const marcarSenia = useMutation(api.agenda.marcarSenia);
  const [confirmandoCancelacion, setConfirmandoCancelacion] = useState(false);
  const { enCurso, error, ejecutar } = useAccion();
  const reservaId = celda.reservaId;

  return (
    <>
      {celda.telefono && (
        <Pressable onPress={() => void Linking.openURL(enlaceWhatsapp(celda.telefono!))}>
          <ThemedText type="linkPrimary">WhatsApp · {celda.telefono}</ThemedText>
        </Pressable>
      )}
      <View style={estilosComunes.filaEnvuelta}>
        {celda.estado === 'confirmada' ? (
          <>
            <Chip texto="Jugaron" activo={false} onPress={() => ejecutar(() => cambiarEstado({ reservaId, estado: 'completada' }))} />
            <Chip texto="No vinieron" activo={false} onPress={() => ejecutar(() => cambiarEstado({ reservaId, estado: 'ausente' }))} />
          </>
        ) : (
          <Chip
            texto="Volver a confirmada"
            activo={false}
            onPress={() => ejecutar(() => cambiarEstado({ reservaId, estado: 'confirmada' }))}
          />
        )}
        {celda.montoSenia !== undefined && (
          <Chip
            texto={celda.seniaPagada ? 'Seña cobrada ✓' : 'Marcar seña cobrada'}
            activo={celda.seniaPagada}
            onPress={() => ejecutar(() => marcarSenia({ reservaId, pagada: !celda.seniaPagada }))}
          />
        )}
      </View>
      {celda.estado !== 'cancelada' && <Cobrar key={celda.cobrado} celda={celda} />}
      {confirmandoCancelacion ? (
        <View style={estilosComunes.fila}>
          <ThemedText type="small" style={estilosComunes.flex}>
            ¿Cancelar la reserva de {celda.nombre}?
          </ThemedText>
          <Boton titulo="No" variante="secundario" onPress={() => setConfirmandoCancelacion(false)} />
          <Boton
            titulo="Sí, cancelar"
            variante="peligro"
            cargando={enCurso}
            onPress={() => ejecutar(() => cambiarEstado({ reservaId, estado: 'cancelada' }))}
          />
        </View>
      ) : (
        <Pressable onPress={() => setConfirmandoCancelacion(true)}>
          <ThemedText type="small" themeColor="danger">
            Cancelar reserva
          </ThemedText>
        </Pressable>
      )}
      <TextoError mensaje={error} />
    </>
  );
}

// Cobro del turno: propone lo que falta (precio menos seña y pagos) y queda en la caja de hoy.
function Cobrar({ celda }: { celda: Extract<Celda, { tipo: 'reserva' }> }) {
  const cobrar = useMutation(api.caja.cobrarTurno);
  const saldo = Math.max(celda.precio - celda.cobrado, 0);
  const [monto, setMonto] = useState(String(saldo));
  const [medio, setMedio] = useState<MedioPago>('efectivo');
  const { enCurso, error, ejecutar } = useAccion();

  if (saldo === 0) {
    return (
      <ThemedText type="small" themeColor="primary">
        Pagó todo ({formatoPrecio(celda.cobrado)}). Los cobros están en la caja.
      </ThemedText>
    );
  }
  return (
    <View style={styles.cobro}>
      <ThemedText type="smallBold">
        Cobrar · {celda.cobrado > 0 ? `ya pagó ${formatoPrecio(celda.cobrado)}, ` : ''}falta {formatoPrecio(saldo)}
      </ThemedText>
      <View style={estilosComunes.filaEnvuelta}>
        {MEDIOS_DE_PAGO.map((m) => (
          <Chip key={m} texto={NOMBRE_MEDIO[m]} activo={medio === m} onPress={() => setMedio(m)} />
        ))}
      </View>
      <View style={estilosComunes.fila}>
        <View style={estilosComunes.flex}>
          <Campo
            etiqueta="Monto"
            value={monto}
            onChangeText={(t) => setMonto(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
          />
        </View>
        <View style={styles.alineadoAbajo}>
          <Boton
            titulo="Cobrar"
            cargando={enCurso}
            deshabilitado={!Number(monto)}
            onPress={() => ejecutar(() => cobrar({ reservaId: celda.reservaId, monto: Number(monto), medio }))}
          />
        </View>
      </View>
      <TextoError mensaje={error} />
    </View>
  );
}

function AccionesBloqueo({ bloqueoId }: { bloqueoId: Id<'bloqueos'> }) {
  const desbloquear = useMutation(api.agenda.desbloquear);
  const { enCurso, error, ejecutar } = useAccion();
  return (
    <>
      <Boton titulo="Desbloquear" variante="secundario" cargando={enCurso} onPress={() => ejecutar(() => desbloquear({ bloqueoId }))} />
      <TextoError mensaje={error} />
    </>
  );
}

function AccionesFijo({ celda, fecha }: { celda: Extract<Celda, { tipo: 'fijo' }>; fecha: string }) {
  const registrar = useMutation(api.agenda.registrarTurnoFijo);
  const { error, ejecutar } = useAccion();
  const turnoFijoId = celda.turnoFijoId;
  return (
    <>
      {celda.telefono && (
        <Pressable onPress={() => void Linking.openURL(enlaceWhatsapp(celda.telefono!))}>
          <ThemedText type="linkPrimary">WhatsApp · {celda.telefono}</ThemedText>
        </Pressable>
      )}
      <View style={estilosComunes.filaEnvuelta}>
        <Chip texto="Jugaron" activo={false} onPress={() => ejecutar(() => registrar({ turnoFijoId, fecha, estado: 'completada' }))} />
        <Chip texto="No vinieron" activo={false} onPress={() => ejecutar(() => registrar({ turnoFijoId, fecha, estado: 'ausente' }))} />
        <Chip
          texto="Liberar este día"
          activo={false}
          onPress={() => ejecutar(() => registrar({ turnoFijoId, fecha, estado: 'cancelada' }))}
        />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        &quot;Liberar este día&quot; deja el horario disponible para otros solo en esta fecha.
      </ThemedText>
      <TextoError mensaje={error} />
    </>
  );
}

const styles = StyleSheet.create({
  fila: { borderLeftWidth: 4, paddingLeft: Spacing.two, gap: Spacing.two },
  hora: { width: 52 },
  acciones: { gap: Spacing.two, paddingBottom: Spacing.two },
  presionado: { opacity: 0.7 },
  cobro: { gap: Spacing.two },
  alineadoAbajo: { alignSelf: 'flex-end' },
});

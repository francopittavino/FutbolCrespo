import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

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
import { Colors, Fuentes, Radios, Spacing } from '@/constants/theme';
import { useAhora } from '@/hooks/use-ahora';
import { compartirTexto, urlDe } from '@/lib/compartir';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { aHora, etiquetaFecha } from '../../../../convex/lib/horas';

type Partido = FunctionReturnType<typeof api.partidos.detalle>;
type Jugador = Partido['jugadores'][number];

export default function PartidoScreen() {
  const { partidoId } = useLocalSearchParams<{ partidoId: Id<'partidos'> }>();
  const partido = useQuery(api.partidos.detalle, { partidoId });
  const ahora = useAhora();

  if (partido === undefined) return <Cargando />;
  const conResultado = partido.golesA !== undefined && partido.golesB !== undefined;
  const empezo = ahora >= partido.comienzaEn;
  const editable = partido.soyOrganizador && !conResultado && !partido.cancelado;

  return (
    <Pantalla>
      <Encabezado titulo="Partido" volverA="/turnos" />
      <Resumen partido={partido} />
      {partido.cancelado && (
        <Tarjeta>
          <ThemedText themeColor="danger">La reserva de este partido se canceló.</ThemedText>
        </Tarjeta>
      )}
      {conResultado ? (
        <Marcador partido={partido} />
      ) : (
        partido.soyOrganizador && empezo && !partido.cancelado && <CargarResultado partido={partido} />
      )}
      <Jugadores partido={partido} editable={editable} />
      {editable && <Invitar partido={partido} />}
      {editable && <NombresEquipos partido={partido} />}
    </Pantalla>
  );
}

function Resumen({ partido }: { partido: Partido }) {
  return (
    <View style={styles.resumen}>
      <ThemedText type="label" themeColor="accent">
        {partido.golesA !== undefined ? 'Resultado final' : 'Partido reservado'}
      </ThemedText>
      <ThemedText type="subtitle" themeColor="onDark">
        {etiquetaFecha(partido.fecha)} · {aHora(partido.inicio)}
      </ThemedText>
      <ThemedText themeColor="onDark">
        {partido.complejo} · {partido.cancha}
      </ThemedText>
      <ThemedText type="small" themeColor="onDarkSecondary">
        Organiza {partido.organizador} · {partido.direccion}
      </ThemedText>
    </View>
  );
}

function Marcador({ partido }: { partido: Partido }) {
  return (
    <View style={styles.marcador}>
      <ThemedText type="heading" themeColor="primary" style={styles.equipoMarcador} numberOfLines={2}>
        {partido.nombreEquipoA}
      </ThemedText>
      <View style={styles.goles}>
        <ThemedText type="title" themeColor="onAccent">
          {partido.golesA} - {partido.golesB}
        </ThemedText>
      </View>
      <ThemedText type="heading" themeColor="primary" style={styles.equipoMarcador} numberOfLines={2}>
        {partido.nombreEquipoB}
      </ThemedText>
    </View>
  );
}

function CargarResultado({ partido }: { partido: Partido }) {
  const cargar = useMutation(api.partidos.cargarResultado);
  const [golesA, setGolesA] = useState('');
  const [golesB, setGolesB] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await cargar({ partidoId: partido._id, golesA: Number(golesA), golesB: Number(golesB) });
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <ThemedText type="heading" themeColor="primary">
        ¿Cómo salió?
      </ThemedText>
      <View style={estilosComunes.fila}>
        <CampoGoles etiqueta={partido.nombreEquipoA} valor={golesA} onCambio={setGolesA} />
        <ThemedText type="subtitle" themeColor="primary">
          -
        </ThemedText>
        <CampoGoles etiqueta={partido.nombreEquipoB} valor={golesB} onCambio={setGolesB} />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Las estadísticas de cada jugador (ganados, goles a favor, racha) cuentan si armaste los equipos.
      </ThemedText>
      <TextoError mensaje={error} />
      <Boton titulo="Guardar resultado" onPress={guardar} cargando={guardando} deshabilitado={golesA === '' || golesB === ''} />
    </Tarjeta>
  );
}

function CampoGoles({ etiqueta, valor, onCambio }: { etiqueta: string; valor: string; onCambio: (v: string) => void }) {
  return (
    <View style={styles.campoGoles}>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {etiqueta}
      </ThemedText>
      <TextInput
        value={valor}
        onChangeText={(t) => onCambio(t.replace(/\D/g, '').slice(0, 2))}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={Colors.textSecondary}
        style={styles.inputGoles}
      />
    </View>
  );
}

function Jugadores({ partido, editable }: { partido: Partido; editable: boolean }) {
  const asignar = useMutation(api.partidos.asignarEquipo);
  const quitar = useMutation(api.partidos.quitarJugador);
  const [error, setError] = useState<string | null>(null);
  const cupo = partido.jugadoresPorLado * 2 + 4;
  const hayEquipos = partido.jugadores.some((j) => j.equipo);

  async function accion(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  function bajarme(jugador: Jugador) {
    void accion(async () => {
      await quitar({ jugadorId: jugador._id });
      router.replace('/turnos');
    });
  }

  const grupos: { titulo: string; lista: Jugador[] }[] = hayEquipos
    ? [
        { titulo: partido.nombreEquipoA, lista: partido.jugadores.filter((j) => j.equipo === 'A') },
        { titulo: partido.nombreEquipoB, lista: partido.jugadores.filter((j) => j.equipo === 'B') },
        { titulo: 'Sin equipo', lista: partido.jugadores.filter((j) => !j.equipo) },
      ]
    : [{ titulo: '', lista: partido.jugadores }];

  return (
    <Tarjeta>
      <ThemedText type="heading" themeColor="primary">
        Jugadores ({partido.jugadores.length}/{cupo})
      </ThemedText>
      {editable && (
        <ThemedText type="small" themeColor="textSecondary">
          Armar equipos es opcional: tocá A o B al lado de cada jugador.
        </ThemedText>
      )}
      {grupos
        .filter((g) => g.lista.length > 0)
        .map((g) => (
          <View key={g.titulo} style={styles.grupo}>
            {g.titulo !== '' && (
              <ThemedText type="label" themeColor="textSecondary">
                {g.titulo}
              </ThemedText>
            )}
            {g.lista.map((j) => (
              <View key={j._id} style={estilosComunes.fila}>
                <ThemedText style={estilosComunes.flex} numberOfLines={1}>
                  {j.nombre}
                  {!j.conCuenta && <ThemedText type="small" themeColor="textSecondary"> · invitado</ThemedText>}
                </ThemedText>
                {editable && (
                  <>
                    <Chip
                      texto="A"
                      activo={j.equipo === 'A'}
                      onPress={() => void accion(() => asignar({ jugadorId: j._id, equipo: j.equipo === 'A' ? null : 'A' }))}
                    />
                    <Chip
                      texto="B"
                      activo={j.equipo === 'B'}
                      onPress={() => void accion(() => asignar({ jugadorId: j._id, equipo: j.equipo === 'B' ? null : 'B' }))}
                    />
                    {!j.soyYo && (
                      <Pressable onPress={() => void accion(() => quitar({ jugadorId: j._id }))} hitSlop={8}>
                        <ThemedText type="small" themeColor="danger">
                          Quitar
                        </ThemedText>
                      </Pressable>
                    )}
                  </>
                )}
                {!partido.soyOrganizador && j.soyYo && partido.golesA === undefined && (
                  <Pressable onPress={() => bajarme(j)} hitSlop={8}>
                    <ThemedText type="small" themeColor="danger">
                      Bajarme
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        ))}
      <TextoError mensaje={error} />
    </Tarjeta>
  );
}

function Invitar({ partido }: { partido: Partido }) {
  const amigos = useQuery(api.amigos.misAmigos);
  const agregarAmigo = useMutation(api.partidos.agregarAmigo);
  const agregarInvitado = useMutation(api.partidos.agregarInvitado);
  const [invitado, setInvitado] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enlace = urlDe(`/turnos/unirme/${partido.codigoInvitacion}`);
  const yaEstan = new Set(partido.jugadores.map((j) => j.userId));
  const amigosLibres = amigos?.amigos.filter((a) => !yaEstan.has(a.userId)) ?? [];

  async function compartir() {
    const texto = `⚽ ${etiquetaFecha(partido.fecha)} ${aHora(partido.inicio)} en ${partido.complejo} (${partido.cancha}). Sumate al partido: ${enlace}`;
    const resultado = await compartirTexto(texto);
    setAviso(resultado === 'copiado' ? 'Link copiado. Pegalo en el grupo de WhatsApp.' : null);
  }

  async function accion(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  return (
    <Tarjeta>
      <ThemedText type="heading" themeColor="primary">
        Sumar jugadores
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Mandá el link al grupo: cada uno se suma con su cuenta y va sumando estadísticas.
      </ThemedText>
      <Boton titulo="Compartir link del partido" onPress={() => void compartir()} />
      {aviso && (
        <ThemedText type="small" themeColor="primary">
          {aviso}
        </ThemedText>
      )}

      {amigosLibres.length > 0 && (
        <>
          <ThemedText type="label" themeColor="textSecondary">
            Tus amigos
          </ThemedText>
          <View style={estilosComunes.filaEnvuelta}>
            {amigosLibres.map((a) => (
              <Chip
                key={a.userId}
                texto={`+ ${a.nombre}`}
                activo={false}
                onPress={() => void accion(() => agregarAmigo({ partidoId: partido._id, amigoId: a.userId }))}
              />
            ))}
          </View>
        </>
      )}

      <View style={estilosComunes.fila}>
        <View style={estilosComunes.flex}>
          <Campo
            etiqueta="Alguien sin cuenta (no suma estadísticas)"
            value={invitado}
            onChangeText={setInvitado}
            placeholder="Nombre"
          />
        </View>
        <View style={styles.alineadoAbajo}>
          <Boton
            titulo="Agregar"
            variante="secundario"
            deshabilitado={!invitado.trim()}
            onPress={() =>
              void accion(async () => {
                await agregarInvitado({ partidoId: partido._id, nombre: invitado });
                setInvitado('');
              })
            }
          />
        </View>
      </View>
      <TextoError mensaje={error} />
    </Tarjeta>
  );
}

function NombresEquipos({ partido }: { partido: Partido }) {
  const nombrar = useMutation(api.partidos.nombrarEquipos);
  const [a, setA] = useState(partido.nombreEquipoA);
  const [b, setB] = useState(partido.nombreEquipoB);
  const cambio = a !== partido.nombreEquipoA || b !== partido.nombreEquipoB;
  return (
    <Tarjeta>
      <ThemedText type="heading" themeColor="primary">
        Nombres de los equipos
      </ThemedText>
      <View style={estilosComunes.fila}>
        <View style={estilosComunes.flex}>
          <Campo etiqueta="Equipo A" value={a} onChangeText={setA} />
        </View>
        <View style={estilosComunes.flex}>
          <Campo etiqueta="Equipo B" value={b} onChangeText={setB} />
        </View>
      </View>
      {cambio && (
        <Boton
          titulo="Guardar nombres"
          variante="secundario"
          onPress={() => void nombrar({ partidoId: partido._id, nombreEquipoA: a, nombreEquipoB: b })}
        />
      )}
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  resumen: {
    backgroundColor: Colors.brand,
    borderRadius: Radios.tarjeta,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  marcador: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  equipoMarcador: { flex: 1, textAlign: 'center' },
  goles: {
    backgroundColor: Colors.accent,
    borderRadius: Radios.tarjeta,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  campoGoles: { flex: 1, gap: Spacing.one, alignItems: 'center' },
  inputGoles: {
    width: '100%',
    textAlign: 'center',
    fontFamily: Fuentes.titulo,
    fontSize: 48,
    color: Colors.primary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radios.campo,
    backgroundColor: Colors.background,
  },
  grupo: { gap: Spacing.two },
  alineadoAbajo: { alignSelf: 'flex-end' },
});

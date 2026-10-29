import { useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { NOMBRE_MEDIO, MEDIOS_DE_PAGO } from '@/components/gestion/medios-de-pago';
import { ThemedText } from '@/components/themed-text';
import { Cargando, Chip, Encabezado, Pantalla, Tarjeta, estilosComunes } from '@/components/ui/formulario';
import { Colors, Radios, Spacing } from '@/constants/theme';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { aHora, etiquetaFecha, formatoPrecio, hoyEnArgentina, sumarDias } from '../../../../convex/lib/horas';

type Resumen = FunctionReturnType<typeof api.reportes.resumen>;

type Periodo = { clave: string; nombre: string; desde: string; hasta: string };

function periodos(hoy: string): Periodo[] {
  const inicioMes = `${hoy.slice(0, 7)}-01`;
  const finMesPasado = sumarDias(inicioMes, -1);
  return [
    { clave: 'mes', nombre: 'Este mes', desde: inicioMes, hasta: hoy },
    { clave: 'pasado', nombre: 'Mes pasado', desde: `${finMesPasado.slice(0, 7)}-01`, hasta: finMesPasado },
    { clave: '7', nombre: 'Últimos 7 días', desde: sumarDias(hoy, -6), hasta: hoy },
    { clave: '30', nombre: 'Últimos 30 días', desde: sumarDias(hoy, -29), hasta: hoy },
  ];
}

function porcentaje(valor: number) {
  return `${Math.round(valor * 100)}%`;
}

export default function ReportesScreen() {
  const { complejoId } = useLocalSearchParams<{ complejoId: Id<'complejos'> }>();
  const opciones = periodos(hoyEnArgentina());
  const [clave, setClave] = useState('mes');
  const periodo = opciones.find((p) => p.clave === clave) ?? opciones[0];
  const resumen = useQuery(api.reportes.resumen, { complejoId, desde: periodo.desde, hasta: periodo.hasta });

  return (
    <Pantalla>
      <Encabezado titulo="Reportes" />
      <View style={estilosComunes.filaEnvuelta}>
        {opciones.map((p) => (
          <Chip key={p.clave} texto={p.nombre} activo={p.clave === clave} onPress={() => setClave(p.clave)} />
        ))}
      </View>
      {resumen === undefined ? (
        <Cargando />
      ) : (
        <>
          <Indicadores resumen={resumen} />
          <IngresosPorDia porDia={resumen.dinero.porDia} />
          <MediosDePago resumen={resumen} />
          <Turnos resumen={resumen} />
          <Ranking
            titulo="Horarios más pedidos"
            vacio="Todavía no hay turnos ocupados en este período."
            filas={resumen.horarios.map((h) => ({
              clave: String(h.inicio),
              nombre: aHora(h.inicio),
              cantidad: h.cantidad,
            }))}
          />
          <Ranking
            titulo="Los que más juegan"
            vacio="Todavía no hay turnos ocupados en este período."
            filas={resumen.clientes.map((c) => ({ clave: c.clave, nombre: c.nombre, cantidad: c.cantidad }))}
          />
          <PorCobrar resumen={resumen} />
        </>
      )}
    </Pantalla>
  );
}

function Indicadores({ resumen }: { resumen: Resumen }) {
  const { dinero, turnos } = resumen;
  const datos = [
    { nombre: 'Ingresos', valor: formatoPrecio(dinero.ingresos) },
    { nombre: 'Gastos', valor: formatoPrecio(dinero.egresos) },
    { nombre: 'Neto', valor: formatoPrecio(dinero.saldo) },
    {
      nombre: 'Ocupación',
      valor: porcentaje(turnos.ocupacion),
      detalle: `${turnos.ocupados} de ${turnos.total} turnos`,
    },
  ];
  return (
    <View style={styles.indicadores}>
      {datos.map((d) => (
        <View key={d.nombre} style={styles.indicador}>
          <ThemedText type="label" themeColor="onDarkSecondary">
            {d.nombre}
          </ThemedText>
          <ThemedText type="subtitle" themeColor="onDark" numberOfLines={1}>
            {d.valor}
          </ThemedText>
          {d.detalle && (
            <ThemedText type="small" themeColor="onDarkSecondary">
              {d.detalle}
            </ThemedText>
          )}
        </View>
      ))}
    </View>
  );
}

// Barras de ingresos por día. Tocando una barra se ve el día y el monto.
function IngresosPorDia({ porDia }: { porDia: Resumen['dinero']['porDia'] }) {
  const [elegido, setElegido] = useState<string | null>(null);
  const maximo = Math.max(...porDia.map((d) => d.ingresos), 0);
  const dia = porDia.find((d) => d.fecha === elegido);
  const mejor = porDia.reduce((a, b) => (b.ingresos > a.ingresos ? b : a), porDia[0]);

  return (
    <Tarjeta>
      <ThemedText type="heading" themeColor="primary">
        Ingresos por día
      </ThemedText>
      {maximo === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No hubo ingresos en este período.
        </ThemedText>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {dia
              ? `${etiquetaFecha(dia.fecha)}: ${formatoPrecio(dia.ingresos)}`
              : `Mejor día: ${etiquetaFecha(mejor.fecha)} con ${formatoPrecio(mejor.ingresos)}. Tocá una barra para ver cada día.`}
          </ThemedText>
          <View style={styles.grafico}>
            <View style={styles.guia} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.maximo}>
              {formatoPrecio(maximo)}
            </ThemedText>
            <View style={styles.barras}>
              {porDia.map((d) => (
                <Pressable
                  key={d.fecha}
                  onPress={() => setElegido(elegido === d.fecha ? null : d.fecha)}
                  style={styles.columna}
                  accessibilityLabel={`${etiquetaFecha(d.fecha)}: ${formatoPrecio(d.ingresos)}`}>
                  <View
                    style={[
                      styles.barra,
                      { height: `${(d.ingresos / maximo) * 100}%`, opacity: elegido && elegido !== d.fecha ? 0.45 : 1 },
                    ]}
                  />
                </Pressable>
              ))}
            </View>
          </View>
          <View style={estilosComunes.fila}>
            <ThemedText type="small" themeColor="textSecondary" style={estilosComunes.flex}>
              {etiquetaFecha(porDia[0].fecha)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {etiquetaFecha(porDia[porDia.length - 1].fecha)}
            </ThemedText>
          </View>
        </>
      )}
    </Tarjeta>
  );
}

function MediosDePago({ resumen }: { resumen: Resumen }) {
  const { porMedio } = resumen.dinero;
  const medios = MEDIOS_DE_PAGO.filter((m) => porMedio[m] !== 0);
  if (medios.length === 0) return null;
  return (
    <Tarjeta>
      <ThemedText type="heading" themeColor="primary">
        Por medio de pago
      </ThemedText>
      {medios.map((m) => (
        <View key={m} style={estilosComunes.fila}>
          <ThemedText style={estilosComunes.flex}>{NOMBRE_MEDIO[m]}</ThemedText>
          <ThemedText type="smallBold">{formatoPrecio(porMedio[m])}</ThemedText>
        </View>
      ))}
      <ThemedText type="small" themeColor="textSecondary">
        Neto de cada medio (lo que entró menos los gastos pagados con él).
      </ThemedText>
    </Tarjeta>
  );
}

function Medidor({ nombre, valor, detalle }: { nombre: string; valor: number; detalle: string }) {
  return (
    <View style={styles.medidor}>
      <View style={estilosComunes.fila}>
        <ThemedText style={estilosComunes.flex}>{nombre}</ThemedText>
        <ThemedText type="smallBold">{detalle}</ThemedText>
      </View>
      <View style={styles.pista}>
        <View style={[styles.relleno, { width: `${Math.min(valor, 1) * 100}%` }]} />
      </View>
    </View>
  );
}

function Turnos({ resumen }: { resumen: Resumen }) {
  const { turnos, porCancha } = resumen;
  const origenes = [
    { nombre: 'Por la app', cantidad: turnos.porOrigen.app },
    { nombre: 'Cargados por el complejo', cantidad: turnos.porOrigen.complejo },
    { nombre: 'Turnos fijos', cantidad: turnos.porOrigen.turnoFijo },
  ];
  const totalOrigen = origenes.reduce((s, o) => s + o.cantidad, 0);
  return (
    <Tarjeta>
      <ThemedText type="heading" themeColor="primary">
        Turnos
      </ThemedText>
      <View style={estilosComunes.fila}>
        <Cifra nombre="Jugados" valor={turnos.jugados} />
        <Cifra nombre="No vinieron" valor={turnos.ausentes} />
        <Cifra nombre="Cancelados" valor={turnos.cancelados} />
      </View>
      {porCancha.length > 1 && (
        <>
          <ThemedText type="label" themeColor="textSecondary">
            Ocupación por cancha
          </ThemedText>
          {porCancha.map((c) => (
            <Medidor
              key={c.canchaId}
              nombre={c.nombre}
              valor={c.ocupacion}
              detalle={`${porcentaje(c.ocupacion)} · ${c.ocupados}/${c.turnos}`}
            />
          ))}
        </>
      )}
      {totalOrigen > 0 && (
        <>
          <ThemedText type="label" themeColor="textSecondary">
            Cómo se reservaron
          </ThemedText>
          {origenes.map((o) => (
            <Medidor
              key={o.nombre}
              nombre={o.nombre}
              valor={o.cantidad / totalOrigen}
              detalle={`${o.cantidad} · ${porcentaje(o.cantidad / totalOrigen)}`}
            />
          ))}
        </>
      )}
    </Tarjeta>
  );
}

function Cifra({ nombre, valor }: { nombre: string; valor: number }) {
  return (
    <View style={[styles.cifra, estilosComunes.flex]}>
      <ThemedText type="subtitle" themeColor="primary">
        {valor}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {nombre}
      </ThemedText>
    </View>
  );
}

function Ranking({
  titulo,
  vacio,
  filas,
}: {
  titulo: string;
  vacio: string;
  filas: { clave: string; nombre: string; cantidad: number }[];
}) {
  return (
    <Tarjeta>
      <ThemedText type="heading" themeColor="primary">
        {titulo}
      </ThemedText>
      {filas.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          {vacio}
        </ThemedText>
      )}
      {filas.map((f, i) => (
        <View key={f.clave} style={estilosComunes.fila}>
          <ThemedText type="heading" themeColor="textSecondary" style={styles.puesto}>
            {i + 1}
          </ThemedText>
          <ThemedText style={estilosComunes.flex} numberOfLines={1}>
            {f.nombre}
          </ThemedText>
          <ThemedText type="smallBold">
            {f.cantidad} {f.cantidad === 1 ? 'turno' : 'turnos'}
          </ThemedText>
        </View>
      ))}
    </Tarjeta>
  );
}

function PorCobrar({ resumen }: { resumen: Resumen }) {
  const { porCobrar } = resumen;
  return (
    <Tarjeta>
      <ThemedText type="heading" themeColor="primary">
        Por cobrar
      </ThemedText>
      {porCobrar.cantidad === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Todos los turnos jugados están cobrados.
        </ThemedText>
      ) : (
        <>
          <ThemedText>
            {porCobrar.cantidad} {porCobrar.cantidad === 1 ? 'turno jugado debe' : 'turnos jugados deben'}{' '}
            <ThemedText type="smallBold" themeColor="danger">
              {formatoPrecio(porCobrar.total)}
            </ThemedText>
          </ThemedText>
          {porCobrar.turnos.map((t) => (
            <View key={t.reservaId} style={estilosComunes.fila}>
              <View style={estilosComunes.flex}>
                <ThemedText numberOfLines={1}>{t.nombre}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {etiquetaFecha(t.fecha)} · {aHora(t.inicio)} · {t.cancha}
                </ThemedText>
              </View>
              <ThemedText type="smallBold">{formatoPrecio(t.saldo)}</ThemedText>
            </View>
          ))}
          <ThemedText type="small" themeColor="textSecondary">
            Se cobran desde la agenda, tocando el turno de ese día.
          </ThemedText>
        </>
      )}
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  indicadores: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  indicador: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: Colors.brand,
    borderRadius: Radios.tarjeta,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  grafico: { height: 140, paddingTop: Spacing.four },
  guia: {
    position: 'absolute',
    top: Spacing.four,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    borderStyle: 'dashed',
  },
  maximo: { position: 'absolute', top: 0, right: 0 },
  barras: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  columna: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  barra: { backgroundColor: Colors.accent, borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 0 },
  medidor: { gap: Spacing.one },
  pista: { height: 8, borderRadius: 4, backgroundColor: Colors.backgroundSelected, overflow: 'hidden' },
  relleno: { height: '100%', borderRadius: 4, backgroundColor: Colors.accent },
  cifra: { backgroundColor: Colors.background, borderRadius: Radios.campo, padding: Spacing.three },
  puesto: { width: 24 },
});

import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

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
import { MEDIOS_DE_PAGO, NOMBRE_MEDIO, type MedioPago } from '@/components/gestion/medios-de-pago';
import { Colors, Radios, Spacing } from '@/constants/theme';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { etiquetaFecha, formatoPrecio, hoyEnArgentina, sumarDias } from '../../../../convex/lib/horas';

type Caja = FunctionReturnType<typeof api.caja.delDia>;

export default function CajaScreen() {
  const { complejoId } = useLocalSearchParams<{ complejoId: Id<'complejos'> }>();
  const hoy = hoyEnArgentina();
  const [fecha, setFecha] = useState(hoy);
  const caja = useQuery(api.caja.delDia, { complejoId, fecha });

  return (
    <Pantalla>
      <Encabezado titulo="Caja" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilosComunes.fila}>
        {Array.from({ length: 14 }, (_, i) => sumarDias(hoy, -i)).map((f) => (
          <Chip
            key={f}
            texto={f === sumarDias(hoy, -1) ? 'Ayer' : etiquetaFecha(f, hoy)}
            activo={f === fecha}
            onPress={() => setFecha(f)}
          />
        ))}
      </ScrollView>
      {caja === undefined ? (
        <Cargando />
      ) : (
        <>
          <Totales caja={caja} />
          <NuevoMovimiento complejoId={complejoId} fecha={fecha} />
          <Movimientos caja={caja} />
        </>
      )}
    </Pantalla>
  );
}

function Totales({ caja }: { caja: Caja }) {
  const { totales } = caja;
  const medios = MEDIOS_DE_PAGO.filter((m) => totales.porMedio[m] !== 0);
  return (
    <View style={styles.totales}>
      <ThemedText type="label" themeColor="accent">
        Saldo del día
      </ThemedText>
      <ThemedText type="title" themeColor={totales.saldo < 0 ? 'danger' : 'onDark'}>
        {formatoPrecio(totales.saldo)}
      </ThemedText>
      <View style={estilosComunes.fila}>
        <Dato nombre="Entró" valor={totales.ingresos} />
        <Dato nombre="Salió" valor={totales.egresos} />
      </View>
      {medios.length > 0 && (
        <View style={styles.medios}>
          {medios.map((m) => (
            <View key={m} style={estilosComunes.fila}>
              <ThemedText type="small" themeColor="onDarkSecondary" style={estilosComunes.flex}>
                {NOMBRE_MEDIO[m]}
              </ThemedText>
              <ThemedText type="smallBold" themeColor="onDark">
                {formatoPrecio(totales.porMedio[m])}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function Dato({ nombre, valor }: { nombre: string; valor: number }) {
  return (
    <View style={[styles.dato, estilosComunes.flex]}>
      <ThemedText type="label" themeColor="onDarkSecondary">
        {nombre}
      </ThemedText>
      <ThemedText type="heading" themeColor="onDark">
        {formatoPrecio(valor)}
      </ThemedText>
    </View>
  );
}

function NuevoMovimiento({ complejoId, fecha }: { complejoId: Id<'complejos'>; fecha: string }) {
  const registrar = useMutation(api.caja.registrar);
  const [tipo, setTipo] = useState<'ingreso' | 'egreso'>('egreso');
  const [monto, setMonto] = useState('');
  const [medio, setMedio] = useState<MedioPago>('efectivo');
  const [concepto, setConcepto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await registrar({ complejoId, fecha, tipo, monto: Number(monto), medio, concepto });
      setMonto('');
      setConcepto('');
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <ThemedText type="heading" themeColor="primary">
        Anotar un movimiento
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Los turnos se cobran desde la agenda. Acá van los gastos y otros ingresos (bebidas, pecheras, luz...).
      </ThemedText>
      <View style={estilosComunes.fila}>
        <Chip texto="Gasto" activo={tipo === 'egreso'} onPress={() => setTipo('egreso')} />
        <Chip texto="Ingreso" activo={tipo === 'ingreso'} onPress={() => setTipo('ingreso')} />
      </View>
      <View style={estilosComunes.fila}>
        <View style={styles.monto}>
          <Campo
            etiqueta="Monto"
            value={monto}
            onChangeText={(t) => setMonto(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
            placeholder="0"
          />
        </View>
        <View style={estilosComunes.flex}>
          <Campo etiqueta="Concepto" value={concepto} onChangeText={setConcepto} placeholder="Ej. bebidas" />
        </View>
      </View>
      <View style={estilosComunes.filaEnvuelta}>
        {MEDIOS_DE_PAGO.map((m) => (
          <Chip key={m} texto={NOMBRE_MEDIO[m]} activo={medio === m} onPress={() => setMedio(m)} />
        ))}
      </View>
      <TextoError mensaje={error} />
      <Boton
        titulo={tipo === 'egreso' ? 'Anotar gasto' : 'Anotar ingreso'}
        onPress={guardar}
        cargando={guardando}
        deshabilitado={!monto || !concepto.trim()}
      />
    </Tarjeta>
  );
}

function Movimientos({ caja }: { caja: Caja }) {
  const eliminar = useMutation(api.caja.eliminar);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Tarjeta>
      <ThemedText type="heading" themeColor="primary">
        Movimientos
      </ThemedText>
      {caja.movimientos.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          No hay movimientos este día.
        </ThemedText>
      )}
      {caja.movimientos.map((m) => (
        <View key={m._id} style={styles.movimiento}>
          <View style={estilosComunes.fila}>
            <View style={estilosComunes.flex}>
              <ThemedText numberOfLines={2}>{m.concepto}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {new Date(m.hora).toLocaleTimeString('es-AR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'America/Argentina/Buenos_Aires',
                })}{' '}
                · {NOMBRE_MEDIO[m.medio]}
                {m.registradoPor ? ` · ${m.registradoPor}` : ''}
              </ThemedText>
            </View>
            <ThemedText type="smallBold" themeColor={m.tipo === 'ingreso' ? 'primary' : 'danger'}>
              {m.tipo === 'ingreso' ? '+' : '−'}
              {formatoPrecio(m.monto)}
            </ThemedText>
          </View>
          {borrando === m._id ? (
            <View style={estilosComunes.fila}>
              <ThemedText type="small" style={estilosComunes.flex}>
                ¿Borrar este movimiento?
              </ThemedText>
              <Boton titulo="No" variante="secundario" onPress={() => setBorrando(null)} />
              <Boton
                titulo="Borrar"
                variante="peligro"
                onPress={async () => {
                  setError(null);
                  try {
                    await eliminar({ movimientoId: m._id });
                  } catch (e) {
                    setError(mensajeDeError(e));
                  }
                  setBorrando(null);
                }}
              />
            </View>
          ) : (
            <Pressable onPress={() => setBorrando(m._id)} hitSlop={8} style={styles.borrar}>
              <ThemedText type="small" themeColor="danger">
                Borrar
              </ThemedText>
            </Pressable>
          )}
        </View>
      ))}
      <TextoError mensaje={error} />
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  totales: { backgroundColor: Colors.brand, borderRadius: Radios.tarjeta, padding: Spacing.four, gap: Spacing.two },
  dato: { backgroundColor: Colors.brandElevado, borderRadius: Radios.campo, padding: Spacing.three },
  medios: { gap: Spacing.one, paddingTop: Spacing.two },
  monto: { width: 120 },
  movimiento: { gap: Spacing.one, paddingBottom: Spacing.two, borderBottomWidth: 1, borderBottomColor: Colors.border },
  borrar: { alignSelf: 'flex-start' },
});

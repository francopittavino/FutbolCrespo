import type { ReactNode } from "react";
import { StyleSheet, Text, View, type TextStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Isotipo } from "@/components/logo";
import { Fuentes, Marca } from "@/constants/theme";
import {
  DIAS_SEMANA,
  diaSemanaDe,
  hoyEnArgentina,
  sumarDias,
} from "../../../convex/lib/horas";

// Imágenes para compartir en redes, copiadas del diseño "Logo Futbol Crespo".
// Se dibujan en "píxeles de diseño" (1080 de ancho) multiplicados por `u`, así la misma tarjeta
// sirve de vista previa en pantalla y se exporta a 1080 px.

export const FORMATOS = {
  cuadrado: { ancho: 1080, alto: 1080 },
  vertical: { ancho: 1080, alto: 1350 },
  historia: { ancho: 1080, alto: 1920 },
} as const;
export type Formato = keyof typeof FORMATOS;

const LINEA_CANCHA = "rgba(198, 244, 50, 0.14)";
const GRIS = "#B7C7BE";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

// "Hoy", "Mañana" o "Jueves 30/10".
export function diaLargo(fecha: string, hoy = hoyEnArgentina()): string {
  if (fecha === hoy) return "Hoy";
  if (fecha === sumarDias(hoy, 1)) return "Mañana";
  const [, mes, dia] = fecha.split("-");
  return `${DIAS_SEMANA[diaSemanaDe(fecha)]} ${dia}/${mes}`;
}

// Para el título de la historia: "Hoy jugamos", "El jueves jugamos", "El 12/11 jugamos".
export function cuandoJugamos(fecha: string, hoy = hoyEnArgentina()): string {
  if (fecha === hoy) return "Hoy";
  if (fecha === sumarDias(hoy, 1)) return "Mañana";
  if (fecha < sumarDias(hoy, 7))
    return `El ${DIAS_SEMANA[diaSemanaDe(fecha)].toLowerCase()}`;
  const [, mes, dia] = fecha.split("-");
  return `El ${dia}/${mes}`;
}

// "2026-10" → "Octubre".
export function nombreDelMes(mes: string): string {
  return MESES[Number(mes.slice(5, 7)) - 1] ?? "";
}

// Datos comunes del pie: dónde se juega y desde dónde se reserva.
export type Pie = { lugar: string; sitio: string };

function Marco({
  formato,
  u,
  pie,
  decoracion,
  arriba,
  children,
}: {
  formato: Formato;
  u: number;
  pie: Pie;
  decoracion?: ReactNode;
  arriba: number;
  children: ReactNode;
}) {
  const { ancho, alto } = FORMATOS[formato];
  const abajo = formato === "historia" ? 110 : 80;
  return (
    <View style={[styles.marco, { width: ancho * u, height: alto * u }]}>
      {decoracion}
      <View
        style={[
          styles.contenido,
          {
            paddingHorizontal: 90 * u,
            paddingTop: arriba * u,
            paddingBottom: abajo * u,
          },
        ]}
      >
        <View style={styles.cuerpo}>{children}</View>
        <PieDeImagen u={u} pie={pie} />
      </View>
    </View>
  );
}

function PieDeImagen({ u, pie }: { u: number; pie: Pie }) {
  return (
    <View style={[styles.pie, { borderTopWidth: 2 * u, paddingTop: 46 * u }]}>
      <View style={styles.flex}>
        <Text
          numberOfLines={1}
          style={texto(u, "textoNegrita", 36, Marca.blanco, {
            textTransform: "uppercase",
          })}
        >
          {pie.lugar}
        </Text>
        <Text
          numberOfLines={1}
          style={texto(u, "textoMedio", 26, GRIS, { marginTop: 10 * u })}
        >
          Reservá en {pie.sitio}
        </Text>
      </View>
      <View style={[styles.fila, { gap: 22 * u }]}>
        <Text
          style={texto(u, "textoMedio", 21, GRIS, {
            textAlign: "right",
            lineHeight: 32 * u,
          })}
        >
          {"Hecho con\nla app"}
        </Text>
        <Isotipo tamano={70 * u} />
        <View>
          <Text style={titulo(u, 40, Marca.blanco)}>Futbol</Text>
          <Text style={titulo(u, 40, Marca.lima)}>Crespo</Text>
        </View>
      </View>
    </View>
  );
}

function texto(
  u: number,
  fuente: "texto" | "textoMedio" | "textoNegrita",
  tamano: number,
  color: string,
  extra?: TextStyle,
): TextStyle {
  return {
    fontFamily: Fuentes[fuente],
    fontSize: tamano * u,
    lineHeight: tamano * 1.3 * u,
    color,
    ...extra,
  };
}

function titulo(
  u: number,
  tamano: number,
  color: string,
  extra?: TextStyle,
): TextStyle {
  return {
    fontFamily: Fuentes.titulo,
    fontSize: tamano * u,
    lineHeight: tamano * 0.98 * u,
    color,
    textTransform: "uppercase",
    ...extra,
  };
}

// Achica el título si el texto es largo, para que entre en el ancho útil (900 px de diseño).
// `ancho` es el ancho promedio de una letra de Teko en relación al tamaño (los números son más angostos).
function tamanoQueEntra(
  textoLargo: string,
  maximo: number,
  ancho = 0.4,
  anchoUtil = 900,
) {
  return Math.min(maximo, Math.floor(anchoUtil / (textoLargo.length * ancho)));
}

function Etiqueta({
  u,
  children,
  color = Marca.lima,
}: {
  u: number;
  children: ReactNode;
  color?: string;
}) {
  return (
    <Text
      style={texto(u, "textoNegrita", 28, color, {
        letterSpacing: 9 * u,
        textTransform: "uppercase",
      })}
    >
      {children}
    </Text>
  );
}

// Dibujos de la cancha de fondo: círculo central, línea media y punto.
function Circulo({
  u,
  x,
  y,
  r,
}: {
  u: number;
  x: number;
  y: number;
  r: number;
}) {
  return (
    <View
      style={{
        position: "absolute",
        left: (x - r) * u,
        top: (y - r) * u,
        width: r * 2 * u,
        height: r * 2 * u,
        borderRadius: r * u,
        borderWidth: (r < 40 ? 0 : 12) * u,
        borderColor: LINEA_CANCHA,
        backgroundColor: r < 40 ? LINEA_CANCHA : "transparent",
      }}
    />
  );
}

function LineaMedia({
  u,
  desde,
  hasta,
}: {
  u: number;
  desde: number;
  hasta: number;
}) {
  return (
    <View
      style={{
        position: "absolute",
        left: 533 * u,
        top: desde * u,
        width: 14 * u,
        height: (hasta - desde) * u,
        backgroundColor: LINEA_CANCHA,
      }}
    />
  );
}

// ——— 1 · Al reservar: cancha reservada (cuadrado) ———
export type DatosTurno = {
  dia: string; // "Hoy", "Mañana", "Jueves 30/10"
  hora: string;
  cancha: string;
  organizador: string;
  complejo: string;
};

export function ImagenCanchaReservada({
  u,
  turno,
  pie,
}: {
  u: number;
  turno: DatosTurno;
  pie: Pie;
}) {
  return (
    <Marco
      formato="cuadrado"
      u={u}
      pie={pie}
      arriba={88}
      decoracion={<Circulo u={u} x={1360} y={110} r={440} />}
    >
      <View style={[styles.fila, { gap: 30 * u }]}>
        <View
          style={[
            styles.check,
            { width: 88 * u, height: 88 * u, borderRadius: 44 * u },
          ]}
        >
          <Svg width={44 * u} height={44 * u} viewBox="0 0 24 24">
            <Path
              d="M4 12.5 L9.5 18 L20 6.5"
              stroke={Marca.verdeCancha}
              strokeWidth={3.4}
              fill="none"
              strokeLinecap="round"
            />
          </Svg>
        </View>
        <Etiqueta u={u}>Cancha reservada</Etiqueta>
      </View>
      <View style={[styles.centrado, { gap: 26 * u }]}>
        <View>
          <Text style={titulo(u, tamanoQueEntra(turno.dia, 210), Marca.blanco)}>
            {turno.dia}
          </Text>
          <Text style={titulo(u, 210, Marca.lima)}>{turno.hora}</Text>
        </View>
        <Text
          numberOfLines={2}
          style={texto(u, "textoNegrita", 40, Marca.blanco)}
        >
          {turno.cancha} · Organiza {turno.organizador}
        </Text>
      </View>
    </Marco>
  );
}

// ——— 1 · Al reservar: hoy jugamos (historia) ———
export function ImagenHoyJugamos({
  u,
  turno,
  cuando,
  pie,
}: {
  u: number;
  turno: DatosTurno;
  cuando: string; // "Hoy", "Mañana", "El jueves"
  pie: Pie;
}) {
  const datos = [
    { etiqueta: "Cuándo", valor: `${turno.dia} · ${turno.hora}` },
    { etiqueta: "Dónde", valor: `${turno.complejo} · ${turno.cancha}` },
    { etiqueta: "Organiza", valor: turno.organizador },
  ];
  return (
    <Marco
      formato="historia"
      u={u}
      pie={pie}
      arriba={150}
      decoracion={
        <>
          <LineaMedia u={u} desde={200} hasta={1800} />
          <Circulo u={u} x={540} y={1000} r={480} />
          <Circulo u={u} x={540} y={1000} r={24} />
        </>
      }
    >
      <View>
        <Etiqueta u={u}>Partido reservado</Etiqueta>
        <Text
          style={titulo(u, tamanoQueEntra(cuando, 220, 0.47), Marca.blanco, {
            marginTop: 24 * u,
          })}
        >
          {cuando}
        </Text>
        <Text style={titulo(u, 220, Marca.lima)}>jugamos</Text>
      </View>
      <View style={[styles.centrado, { gap: 22 * u }]}>
        {datos.map((d) => (
          <View
            key={d.etiqueta}
            style={[
              styles.caja,
              {
                borderRadius: 30 * u,
                borderWidth: 2 * u,
                padding: 38 * u,
                gap: 14 * u,
              },
            ]}
          >
            <Text
              style={texto(u, "textoNegrita", 24, Marca.lima, {
                letterSpacing: 6 * u,
                textTransform: "uppercase",
              })}
            >
              {d.etiqueta}
            </Text>
            <Text
              numberOfLines={2}
              style={texto(u, "textoNegrita", 44, Marca.blanco)}
            >
              {d.valor}
            </Text>
          </View>
        ))}
      </View>
    </Marco>
  );
}

// ——— 2 · Opcional: equipos armados (vertical) ———
export function ImagenEquipos({
  u,
  encabezado,
  equipos,
  pie,
}: {
  u: number;
  encabezado: string; // "Jue 30/10 · 21:00 · Cancha 1"
  equipos: { nombre: string; jugadores: string[] }[];
  pie: Pie;
}) {
  const mayor = Math.max(...equipos.map((e) => e.jugadores.length), 1);
  const fila = Math.min(86, Math.floor(480 / mayor));
  const letra = Math.min(34, Math.floor(fila * 0.42));
  return (
    <Marco formato="vertical" u={u} pie={pie} arriba={90}>
      <View>
        <Etiqueta u={u}>{encabezado}</Etiqueta>
        <Text style={titulo(u, 150, Marca.blanco, { marginTop: 16 * u })}>
          Equipos
        </Text>
        <Text style={titulo(u, 150, Marca.lima)}>armados</Text>
      </View>
      <View style={[styles.centrado, { paddingVertical: 40 * u }]}>
        <View style={[styles.fila, { gap: 24 * u, alignItems: "stretch" }]}>
          {equipos.map((equipo, i) => {
            const claro = i === 0;
            const color = claro ? Marca.verdeCancha : Marca.blanco;
            return (
              <View
                key={i}
                style={[
                  styles.equipo,
                  {
                    borderRadius: 36 * u,
                    padding: 36 * u,
                    borderWidth: 3 * u,
                    backgroundColor: claro ? Marca.lima : "transparent",
                    borderColor: claro
                      ? Marca.lima
                      : "rgba(255, 255, 255, 0.25)",
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={titulo(u, 68, color, { marginBottom: 10 * u })}
                >
                  {equipo.nombre}
                </Text>
                {equipo.jugadores.map((nombre, j) => (
                  <View
                    key={j}
                    style={[
                      styles.fila,
                      {
                        height: fila * u,
                        gap: 26 * u,
                        borderBottomWidth: 2 * u,
                        borderBottomColor: claro
                          ? "rgba(11, 61, 46, 0.15)"
                          : "rgba(255, 255, 255, 0.15)",
                      },
                    ]}
                  >
                    <Text
                      style={titulo(u, letra * 1.3, color, { width: 32 * u })}
                    >
                      {j + 1}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        texto(u, "textoNegrita", letra, color),
                        styles.flex,
                      ]}
                    >
                      {nombre}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      </View>
    </Marco>
  );
}

// ——— 3 · Al cargar el resultado (cuadrado e historia) ———
export type DatosResultado = {
  equipoA: string;
  equipoB: string;
  golesA: number;
  golesB: number;
  detalle: string; // "Jue 30/10 · Cancha 1"
};

export function ImagenResultado({
  u,
  resultado,
  pie,
}: {
  u: number;
  resultado: DatosResultado;
  pie: Pie;
}) {
  const nombre = (n: string) => (
    <Text
      numberOfLines={3}
      style={[
        titulo(u, 84, Marca.blanco, { textAlign: "center" }),
        styles.flex,
      ]}
    >
      {n}
    </Text>
  );
  return (
    <Marco
      formato="cuadrado"
      u={u}
      pie={pie}
      arriba={92}
      decoracion={
        <>
          <LineaMedia u={u} desde={0} hasta={1040} />
          <Circulo u={u} x={540} y={390} r={390} />
          <Circulo u={u} x={540} y={390} r={20} />
        </>
      }
    >
      <View style={{ gap: 18 * u }}>
        <Etiqueta u={u}>Resultado final</Etiqueta>
        <Text style={texto(u, "textoNegrita", 32, GRIS)}>
          {resultado.detalle}
        </Text>
      </View>
      <View
        style={[
          styles.fila,
          styles.centrado,
          { gap: 10 * u, marginHorizontal: -50 * u },
        ]}
      >
        {nombre(resultado.equipoA)}
        <Marcador
          u={u}
          a={resultado.golesA}
          b={resultado.golesB}
          tamano={220}
        />
        {nombre(resultado.equipoB)}
      </View>
    </Marco>
  );
}

export function ImagenResultadoHistoria({
  u,
  resultado,
  pie,
}: {
  u: number;
  resultado: DatosResultado;
  pie: Pie;
}) {
  return (
    <Marco
      formato="historia"
      u={u}
      pie={pie}
      arriba={150}
      decoracion={
        <>
          <Circulo u={u} x={1080} y={1100} r={480} />
          <Circulo u={u} x={1080} y={1100} r={24} />
        </>
      }
    >
      <View style={{ gap: 26 * u }}>
        <Etiqueta u={u}>Resultado final</Etiqueta>
        <Text numberOfLines={1} style={texto(u, "textoNegrita", 34, GRIS)}>
          {resultado.detalle}
        </Text>
      </View>
      <View style={[styles.centrado, { alignItems: "center", gap: 36 * u }]}>
        <Text
          numberOfLines={2}
          style={titulo(u, 130, Marca.blanco, { textAlign: "center" })}
        >
          {resultado.equipoA}
        </Text>
        <Marcador
          u={u}
          a={resultado.golesA}
          b={resultado.golesB}
          tamano={300}
          ancho
        />
        <Text
          numberOfLines={2}
          style={titulo(u, 130, Marca.blanco, { textAlign: "center" })}
        >
          {resultado.equipoB}
        </Text>
      </View>
    </Marco>
  );
}

function Marcador({
  u,
  a,
  b,
  tamano,
  ancho,
}: {
  u: number;
  a: number;
  b: number;
  tamano: number;
  ancho?: boolean;
}) {
  return (
    <View
      style={[
        styles.marcador,
        {
          borderRadius: 32 * u,
          paddingHorizontal: (ancho ? 70 : 40) * u,
          paddingTop: tamano * 0.12 * u,
          alignSelf: ancho ? "stretch" : "center",
        },
      ]}
    >
      <Text
        style={titulo(u, tamano, Marca.verdeCancha, { textAlign: "center" })}
      >
        {a} - {b}
      </Text>
    </View>
  );
}

// ——— 4 · Resumen del mes (vertical) ———
export function ImagenMiMes({
  u,
  encabezado,
  datos,
  pie,
}: {
  u: number;
  encabezado: string; // "Franco · Octubre"
  datos: { valor: number; nombre: string }[];
  pie: Pie;
}) {
  return (
    <Marco formato="vertical" u={u} pie={pie} arriba={90}>
      <View>
        <Etiqueta u={u}>{encabezado}</Etiqueta>
        <Text style={titulo(u, 170, Marca.blanco, { marginTop: 16 * u })}>
          Mi mes en
        </Text>
        <Text style={titulo(u, 170, Marca.lima)}>la cancha</Text>
      </View>
      <View style={[styles.centrado, styles.cuadros, { gap: 22 * u }]}>
        {datos.map((d) => (
          <View
            key={d.nombre}
            style={[
              styles.caja,
              styles.cuadro,
              {
                borderRadius: 30 * u,
                borderWidth: 2 * u,
                paddingHorizontal: 38 * u,
                paddingVertical: 30 * u,
              },
            ]}
          >
            <Text style={titulo(u, 150, Marca.lima)}>{d.valor}</Text>
            <Text
              style={texto(u, "textoNegrita", 28, Marca.blanco, {
                letterSpacing: 6 * u,
                textTransform: "uppercase",
              })}
            >
              {d.nombre}
            </Text>
          </View>
        ))}
      </View>
    </Marco>
  );
}

const styles = StyleSheet.create({
  marco: { backgroundColor: Marca.verdeCancha, overflow: "hidden" },
  contenido: { flex: 1 },
  cuerpo: { flex: 1 },
  centrado: { flex: 1, justifyContent: "center" },
  flex: { flex: 1 },
  fila: { flexDirection: "row", alignItems: "center" },
  pie: {
    flexDirection: "row",
    alignItems: "center",
    borderTopColor: "rgba(255, 255, 255, 0.2)",
  },
  check: {
    backgroundColor: Marca.lima,
    alignItems: "center",
    justifyContent: "center",
  },
  caja: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderColor: "rgba(255, 255, 255, 0.16)",
  },
  equipo: { flex: 1 },
  marcador: { backgroundColor: Marca.lima },
  cuadros: { flexDirection: "row", flexWrap: "wrap", alignContent: "center" },
  cuadro: { flexBasis: "48%", flexGrow: 1 },
});

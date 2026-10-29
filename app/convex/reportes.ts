import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { totalesDe } from "./caja";
import { diaSemanaDe, esFechaValida, hoyEnArgentina, seSuperponen, sumarDias } from "./lib/horas";
import { requerirGestorDe } from "./lib/permisos";
import { ocupaTurno, turnoFijoVigente } from "./lib/turnos";

const MAXIMO_DIAS = 93;

function diasEntre(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  for (let f = desde; f <= hasta && dias.length <= MAXIMO_DIAS; f = sumarDias(f, 1)) dias.push(f);
  return dias;
}

// Resumen de un período: plata, ocupación de las canchas, horarios y clientes que más juegan, y lo que falta cobrar.
// Los turnos fijos cuentan como ocupados aunque ese día no se hayan registrado en la agenda.
export const resumen = query({
  args: { complejoId: v.id("complejos"), desde: v.string(), hasta: v.string() },
  handler: async (ctx, { complejoId, desde, hasta }) => {
    await requerirGestorDe(ctx, complejoId);
    if (!esFechaValida(desde) || !esFechaValida(hasta) || desde > hasta) throw new ConvexError("Período inválido.");
    const dias = diasEntre(desde, hasta);
    if (dias.length > MAXIMO_DIAS) throw new ConvexError("Elegí un período de hasta 3 meses.");

    const [canchas, reservas, movimientos, fijos] = await Promise.all([
      ctx.db
        .query("canchas")
        .withIndex("by_complejo", (q) => q.eq("complejoId", complejoId))
        .collect(),
      ctx.db
        .query("reservas")
        .withIndex("by_complejo_fecha", (q) => q.eq("complejoId", complejoId).gte("fecha", desde).lte("fecha", hasta))
        .collect(),
      ctx.db
        .query("movimientosCaja")
        .withIndex("by_complejo_fecha", (q) => q.eq("complejoId", complejoId).gte("fecha", desde).lte("fecha", hasta))
        .collect(),
      ctx.db
        .query("turnosFijos")
        .withIndex("by_complejo", (q) => q.eq("complejoId", complejoId))
        .collect(),
    ]);

    // ——— Plata ———
    const ingresosPorDia = new Map<string, number>(dias.map((d) => [d, 0]));
    for (const m of movimientos) {
      if (m.tipo === "ingreso") ingresosPorDia.set(m.fecha, (ingresosPorDia.get(m.fecha) ?? 0) + m.monto);
    }

    // ——— Ocupación ———
    // Cada turno de la grilla cuenta una vez: ocupado por una reserva, un turno fijo, o libre. Los bloqueados no cuentan.
    const porCancha: { canchaId: Id<"canchas">; nombre: string; turnos: number; ocupados: number }[] = [];
    const porHorario = new Map<number, number>();
    const ocupadosPorClave = new Map<string, number>(); // cliente → turnos jugados o reservados
    const nombreDeClave = new Map<string, string>();
    let fijosSinRegistrar = 0;

    function sumarCliente(clave: string, nombre: string) {
      ocupadosPorClave.set(clave, (ocupadosPorClave.get(clave) ?? 0) + 1);
      nombreDeClave.set(clave, nombre);
    }

    for (const cancha of canchas.filter((c) => c.activa)) {
      const [franjas, bloqueos] = await Promise.all([
        ctx.db
          .query("franjasHorarias")
          .withIndex("by_cancha_dia", (q) => q.eq("canchaId", cancha._id))
          .collect(),
        ctx.db
          .query("bloqueos")
          .withIndex("by_cancha_fecha", (q) => q.eq("canchaId", cancha._id).gte("fecha", desde).lte("fecha", hasta))
          .collect(),
      ]);
      const fila = { canchaId: cancha._id, nombre: cancha.nombre, turnos: 0, ocupados: 0 };
      for (const fecha of dias) {
        const diaSemana = diaSemanaDe(fecha);
        const reservasDelDia = reservas.filter((r) => r.canchaId === cancha._id && r.fecha === fecha);
        const ocupan = reservasDelDia.filter(ocupaTurno);
        const fijosDelDia = fijos.filter(
          (f) =>
            f.canchaId === cancha._id &&
            f.diaSemana === diaSemana &&
            turnoFijoVigente(f, fecha) &&
            !reservasDelDia.some((r) => r.turnoFijoId === f._id),
        );
        for (const franja of franjas.filter((f) => f.diaSemana === diaSemana)) {
          for (
            let inicio = franja.inicio;
            inicio + franja.duracionTurno <= franja.fin;
            inicio += franja.duracionTurno
          ) {
            const h = { inicio, fin: inicio + franja.duracionTurno };
            if (bloqueos.some((b) => b.fecha === fecha && seSuperponen(b, h))) continue;
            fila.turnos++;
            const reserva = ocupan.find((r) => seSuperponen(r, h));
            const fijo = reserva ? undefined : fijosDelDia.find((f) => seSuperponen(f, h));
            if (!reserva && !fijo) continue;
            fila.ocupados++;
            porHorario.set(inicio, (porHorario.get(inicio) ?? 0) + 1);
            if (reserva) {
              const clave = reserva.clienteId ?? reserva.jugadorId ?? `nombre:${reserva.nombreContacto.toLowerCase()}`;
              sumarCliente(clave, reserva.nombreContacto);
            } else if (fijo) {
              fijosSinRegistrar++;
              const cliente = await ctx.db.get(fijo.clienteId);
              sumarCliente(fijo.clienteId, cliente?.nombre ?? "Turno fijo");
            }
          }
        }
      }
      porCancha.push(fila);
    }

    const turnos = porCancha.reduce((s, c) => s + c.turnos, 0);
    const ocupados = porCancha.reduce((s, c) => s + c.ocupados, 0);
    const contar = (estado: Doc<"reservas">["estado"]) => reservas.filter((r) => r.estado === estado).length;
    const activas = reservas.filter(ocupaTurno);

    // ——— Por cobrar: turnos ya jugados con saldo pendiente ———
    const hoy = hoyEnArgentina();
    const porCobrar: {
      reservaId: Id<"reservas">;
      fecha: string;
      inicio: number;
      nombre: string;
      cancha: string;
      saldo: number;
    }[] = [];
    for (const r of reservas) {
      if (r.estado !== "completada" && !(r.estado === "confirmada" && r.fecha < hoy)) continue;
      const pagos = await ctx.db
        .query("movimientosCaja")
        .withIndex("by_reserva", (q) => q.eq("reservaId", r._id))
        .collect();
      const cobrado = pagos.reduce((s, m) => s + (m.tipo === "ingreso" ? m.monto : -m.monto), 0);
      if (cobrado < r.precio) {
        porCobrar.push({
          reservaId: r._id,
          fecha: r.fecha,
          inicio: r.inicio,
          nombre: r.nombreContacto,
          cancha: canchas.find((c) => c._id === r.canchaId)?.nombre ?? "",
          saldo: r.precio - cobrado,
        });
      }
    }
    porCobrar.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.inicio - a.inicio);

    return {
      dinero: {
        ...totalesDe(movimientos),
        porDia: dias.map((fecha) => ({ fecha, ingresos: ingresosPorDia.get(fecha) ?? 0 })),
      },
      turnos: {
        total: turnos,
        ocupados,
        ocupacion: turnos === 0 ? 0 : ocupados / turnos,
        jugados: contar("completada"),
        ausentes: contar("ausente"),
        cancelados: contar("cancelada"),
        porOrigen: {
          app: activas.filter((r) => r.origen === "app").length,
          complejo: activas.filter((r) => r.origen === "complejo").length,
          turnoFijo: activas.filter((r) => r.origen === "turno_fijo").length + fijosSinRegistrar,
        },
      },
      porCancha: porCancha.map((c) => ({ ...c, ocupacion: c.turnos === 0 ? 0 : c.ocupados / c.turnos })),
      horarios: [...porHorario.entries()]
        .map(([inicio, cantidad]) => ({ inicio, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad || a.inicio - b.inicio)
        .slice(0, 5),
      clientes: [...ocupadosPorClave.entries()]
        .map(([clave, cantidad]) => ({ clave, nombre: nombreDeClave.get(clave) ?? "", cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 5),
      porCobrar: {
        total: porCobrar.reduce((s, p) => s + p.saldo, 0),
        turnos: porCobrar.slice(0, 20),
        cantidad: porCobrar.length,
      },
    };
  },
});

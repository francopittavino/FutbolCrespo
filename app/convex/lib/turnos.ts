import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { diaSemanaDe, seSuperponen } from "./horas";

export type Turno = { inicio: number; fin: number; precio: number; libre: boolean };

// Estados que ocupan el turno (una reserva cancelada lo libera).
export function ocupaTurno(reserva: Doc<"reservas">): boolean {
  return reserva.estado !== "cancelada";
}

export function turnoFijoVigente(fijo: Doc<"turnosFijos">, fecha: string): boolean {
  return fijo.activo && fijo.desde <= fecha && (fijo.hasta === undefined || fecha <= fijo.hasta);
}

// Todo lo que pasa en una cancha en una fecha: la grilla de horarios y lo que la ocupa.
// Un turno fijo cuenta solo si ese día todavía no tiene su propia reserva (asistió, se liberó, etc.).
export async function grillaDeCancha(ctx: QueryCtx, cancha: Doc<"canchas">, fecha: string) {
  const diaSemana = diaSemanaDe(fecha);
  const [franjas, reservas, bloqueos, fijos] = await Promise.all([
    ctx.db
      .query("franjasHorarias")
      .withIndex("by_cancha_dia", (q) => q.eq("canchaId", cancha._id).eq("diaSemana", diaSemana))
      .collect(),
    ctx.db
      .query("reservas")
      .withIndex("by_cancha_fecha", (q) => q.eq("canchaId", cancha._id).eq("fecha", fecha))
      .collect(),
    ctx.db
      .query("bloqueos")
      .withIndex("by_cancha_fecha", (q) => q.eq("canchaId", cancha._id).eq("fecha", fecha))
      .collect(),
    ctx.db
      .query("turnosFijos")
      .withIndex("by_cancha_dia", (q) => q.eq("canchaId", cancha._id).eq("diaSemana", diaSemana))
      .collect(),
  ]);

  const horarios: { inicio: number; fin: number; precio: number }[] = [];
  for (const franja of franjas.sort((a, b) => a.inicio - b.inicio)) {
    for (let inicio = franja.inicio; inicio + franja.duracionTurno <= franja.fin; inicio += franja.duracionTurno) {
      horarios.push({ inicio, fin: inicio + franja.duracionTurno, precio: franja.precio });
    }
  }

  return {
    horarios,
    reservas: reservas.filter(ocupaTurno),
    bloqueos,
    fijos: fijos.filter((f) => turnoFijoVigente(f, fecha) && !reservas.some((r) => r.turnoFijoId === f._id)),
  };
}

// Turnos de una cancha en una fecha, marcando cuáles están libres.
export async function turnosDeCancha(ctx: QueryCtx, cancha: Doc<"canchas">, fecha: string): Promise<Turno[]> {
  const { horarios, reservas, bloqueos, fijos } = await grillaDeCancha(ctx, cancha, fecha);
  const ocupados = [...reservas, ...bloqueos, ...fijos];
  return horarios.map((h) => ({ ...h, libre: !ocupados.some((o) => seSuperponen(o, h)) }));
}

import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { seSuperponen } from "./lib/horas";
import { requerirGestorDe, requerirGestorDeCancha } from "./lib/permisos";

const datosCancha = {
  nombre: v.string(),
  jugadoresPorLado: v.number(),
  superficie: v.optional(v.string()),
  techada: v.boolean(),
};

export const crear = mutation({
  args: { complejoId: v.id("complejos"), ...datosCancha },
  handler: async (ctx, { complejoId, ...datos }) => {
    await requerirGestorDe(ctx, complejoId);
    if (!datos.nombre.trim()) throw new ConvexError("Poné un nombre a la cancha.");
    return await ctx.db.insert("canchas", { complejoId, ...datos, nombre: datos.nombre.trim(), activa: true });
  },
});

export const actualizar = mutation({
  args: { canchaId: v.id("canchas"), activa: v.boolean(), ...datosCancha },
  handler: async (ctx, { canchaId, ...datos }) => {
    await requerirGestorDeCancha(ctx, canchaId);
    if (!datos.nombre.trim()) throw new ConvexError("Poné un nombre a la cancha.");
    await ctx.db.patch(canchaId, { ...datos, nombre: datos.nombre.trim() });
  },
});

export const detalle = query({
  args: { canchaId: v.id("canchas") },
  handler: async (ctx, { canchaId }) => {
    const { cancha, complejo } = await requerirGestorDeCancha(ctx, canchaId);
    const franjas = await ctx.db
      .query("franjasHorarias")
      .withIndex("by_cancha_dia", (q) => q.eq("canchaId", canchaId))
      .collect();
    franjas.sort((a, b) => a.diaSemana - b.diaSemana || a.inicio - b.inicio);
    return { cancha, complejo: { _id: complejo._id, nombre: complejo.nombre }, franjas };
  },
});

// Crea la misma franja en varios días a la vez (ej. lunes a viernes de 18 a 24).
export const agregarFranjas = mutation({
  args: {
    canchaId: v.id("canchas"),
    dias: v.array(v.number()),
    inicio: v.number(),
    fin: v.number(),
    duracionTurno: v.number(),
    precio: v.number(),
  },
  handler: async (ctx, { canchaId, dias, ...franja }) => {
    await requerirGestorDeCancha(ctx, canchaId);
    if (dias.length === 0) throw new ConvexError("Elegí al menos un día.");
    if (dias.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) throw new ConvexError("Día inválido.");
    if (franja.fin <= franja.inicio) throw new ConvexError("La hora de cierre tiene que ser posterior a la de apertura.");
    if (franja.duracionTurno < 30) throw new ConvexError("Cada turno tiene que durar al menos 30 minutos.");
    if ((franja.fin - franja.inicio) % franja.duracionTurno !== 0) {
      throw new ConvexError("El horario no se divide en turnos completos. Revisá la duración o las horas.");
    }
    if (!(franja.precio > 0)) throw new ConvexError("Indicá el precio del turno.");

    for (const dia of new Set(dias)) {
      const existentes = await ctx.db
        .query("franjasHorarias")
        .withIndex("by_cancha_dia", (q) => q.eq("canchaId", canchaId).eq("diaSemana", dia))
        .collect();
      if (existentes.some((e) => seSuperponen(e, franja))) {
        throw new ConvexError("Ese horario se superpone con otro ya cargado para alguno de los días elegidos.");
      }
    }
    for (const dia of new Set(dias)) {
      await ctx.db.insert("franjasHorarias", { canchaId, diaSemana: dia, ...franja });
    }
  },
});

export const eliminarFranja = mutation({
  args: { franjaId: v.id("franjasHorarias") },
  handler: async (ctx, { franjaId }) => {
    const franja = await ctx.db.get(franjaId);
    if (franja === null) return;
    await requerirGestorDeCancha(ctx, franja.canchaId);
    await ctx.db.delete(franjaId);
  },
});

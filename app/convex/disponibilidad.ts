import { ConvexError, v } from "convex/values";

import { query } from "./_generated/server";
import { esFechaValida } from "./lib/horas";
import { turnosDeCancha } from "./lib/turnos";

// Turnos de todos los complejos publicados para una fecha. Es pública: se puede mirar sin iniciar sesión.
// Los turnos que ya pasaron los filtra la app, así la consulta no cambia minuto a minuto.
export const delDia = query({
  args: { fecha: v.string() },
  handler: async (ctx, { fecha }) => {
    if (!esFechaValida(fecha)) throw new ConvexError("Fecha inválida.");
    const complejos = await ctx.db
      .query("complejos")
      .withIndex("by_activo", (q) => q.eq("activo", true))
      .collect();

    return await Promise.all(
      complejos.map(async (complejo) => {
        const canchas = await ctx.db
          .query("canchas")
          .withIndex("by_complejo", (q) => q.eq("complejoId", complejo._id))
          .collect();
        return {
          complejo: {
            _id: complejo._id,
            nombre: complejo.nombre,
            direccion: complejo.direccion,
            whatsapp: complejo.whatsapp,
            requiereSenia: complejo.requiereSenia,
            montoSenia: complejo.montoSenia,
            aliasPago: complejo.requiereSenia ? complejo.aliasPago : undefined,
          },
          canchas: await Promise.all(
            canchas
              .filter((c) => c.activa)
              .map(async (cancha) => ({
                _id: cancha._id,
                nombre: cancha.nombre,
                jugadoresPorLado: cancha.jugadoresPorLado,
                techada: cancha.techada,
                superficie: cancha.superficie,
                turnos: await turnosDeCancha(ctx, cancha, fecha),
              })),
          ),
        };
      }),
    );
  },
});

// Turnos de cada cancha de un complejo para una fecha (la pantalla del complejo).
export const delComplejo = query({
  args: { complejoId: v.id("complejos"), fecha: v.string() },
  handler: async (ctx, { complejoId, fecha }) => {
    if (!esFechaValida(fecha)) throw new ConvexError("Fecha inválida.");
    const complejo = await ctx.db.get(complejoId);
    if (!complejo || !complejo.activo) return [];
    const canchas = await ctx.db
      .query("canchas")
      .withIndex("by_complejo", (q) => q.eq("complejoId", complejoId))
      .collect();
    return await Promise.all(
      canchas
        .filter((c) => c.activa)
        .map(async (cancha) => ({ canchaId: cancha._id, turnos: await turnosDeCancha(ctx, cancha, fecha) })),
    );
  },
});

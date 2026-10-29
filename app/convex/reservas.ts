import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { esFechaValida, hoyEnArgentina, inicioDelTurno, sumarDias } from "./lib/horas";
import { nombreVisible } from "./lib/perfil";
import { requerirUsuario, usuarioActual } from "./lib/permisos";
import { turnosDeCancha } from "./lib/turnos";

const DIAS_DE_ANTICIPACION = 30;
const MAX_RESERVAS_ACTIVAS = 3;

// Las mutations de Convex son transacciones: si dos personas reservan el mismo turno a la vez,
// una de las dos se reintenta, ve el turno ocupado y recibe el error. Nunca quedan dos reservas.
export const reservar = mutation({
  args: {
    canchaId: v.id("canchas"),
    fecha: v.string(),
    inicio: v.number(),
    telefono: v.optional(v.string()),
  },
  handler: async (ctx, { canchaId, fecha, inicio, telefono }) => {
    const usuario = await requerirUsuario(ctx);
    const cancha = await ctx.db.get(canchaId);
    const complejo = cancha && (await ctx.db.get(cancha.complejoId));
    if (!cancha || !complejo || !cancha.activa || !complejo.activo) {
      throw new ConvexError("Esta cancha no está disponible para reservar.");
    }

    const hoy = hoyEnArgentina();
    if (!esFechaValida(fecha) || fecha < hoy || fecha > sumarDias(hoy, DIAS_DE_ANTICIPACION)) {
      throw new ConvexError(`Se puede reservar desde hoy hasta ${DIAS_DE_ANTICIPACION} días adelante.`);
    }
    if (inicioDelTurno(fecha, inicio) <= Date.now()) throw new ConvexError("Ese turno ya pasó.");

    const turno = (await turnosDeCancha(ctx, cancha, fecha)).find((t) => t.inicio === inicio);
    if (!turno) throw new ConvexError("Ese horario no existe para esta cancha.");
    if (!turno.libre) throw new ConvexError("Uy, alguien reservó ese turno recién. Elegí otro.");

    const activas = await ctx.db
      .query("reservas")
      .withIndex("by_jugador", (q) => q.eq("jugadorId", usuario._id))
      .filter((q) => q.and(q.gte(q.field("fecha"), hoy), q.neq(q.field("estado"), "cancelada")))
      .collect();
    if (activas.length >= MAX_RESERVAS_ACTIVAS) {
      throw new ConvexError(`Podés tener hasta ${MAX_RESERVAS_ACTIVAS} reservas activas a la vez.`);
    }

    // Mientras no esté Mercado Pago, la reserva queda confirmada y el jugador transfiere la seña al alias
    // del complejo. El complejo la marca como cobrada desde la agenda.
    return await ctx.db.insert("reservas", {
      complejoId: complejo._id,
      canchaId,
      fecha,
      inicio,
      fin: turno.fin,
      estado: "confirmada",
      origen: "app",
      jugadorId: usuario._id,
      nombreContacto: nombreVisible(usuario),
      telefonoContacto: telefono?.trim() || undefined,
      precio: turno.precio,
      montoSenia: complejo.requiereSenia ? complejo.montoSenia : undefined,
      seniaPagada: false,
    });
  },
});

export const misReservas = query({
  args: {},
  handler: async (ctx) => {
    const usuario = await usuarioActual(ctx);
    if (usuario === null) return [];
    const reservas = await ctx.db
      .query("reservas")
      .withIndex("by_jugador", (q) => q.eq("jugadorId", usuario._id))
      .order("desc")
      .take(50);

    return await Promise.all(
      reservas.map(async (r) => {
        const [complejo, cancha] = await Promise.all([ctx.db.get(r.complejoId), ctx.db.get(r.canchaId)]);
        return {
          _id: r._id,
          fecha: r.fecha,
          inicio: r.inicio,
          fin: r.fin,
          estado: r.estado,
          precio: r.precio,
          montoSenia: r.montoSenia,
          seniaPagada: r.seniaPagada,
          comienzaEn: inicioDelTurno(r.fecha, r.inicio),
          complejo: complejo?.nombre ?? "",
          direccion: complejo?.direccion ?? "",
          whatsapp: complejo?.whatsapp,
          aliasPago: complejo?.aliasPago,
          horasCancelacionGratis: complejo?.horasCancelacionGratis ?? 0,
          cancha: cancha?.nombre ?? "",
        };
      }),
    );
  },
});

export const cancelar = mutation({
  args: { reservaId: v.id("reservas") },
  handler: async (ctx, { reservaId }) => {
    const usuario = await requerirUsuario(ctx);
    const reserva = await ctx.db.get(reservaId);
    if (!reserva || reserva.jugadorId !== usuario._id) throw new ConvexError("No encontramos esa reserva.");
    if (reserva.estado !== "confirmada" && reserva.estado !== "pendiente_pago") {
      throw new ConvexError("Esta reserva ya no se puede cancelar.");
    }
    const comienzaEn = inicioDelTurno(reserva.fecha, reserva.inicio);
    if (comienzaEn <= Date.now()) throw new ConvexError("El turno ya empezó.");

    const complejo = await ctx.db.get(reserva.complejoId);
    const horasAntes = (comienzaEn - Date.now()) / 3_600_000;
    const pierdeSenia = reserva.seniaPagada && horasAntes < (complejo?.horasCancelacionGratis ?? 0);

    await ctx.db.patch(reservaId, { estado: "cancelada", canceladaPor: "jugador" });
    return { pierdeSenia };
  },
});

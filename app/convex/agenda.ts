import { ConvexError, v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { cobradoDe, registrarSenia } from "./caja";
import { esFechaValida, seSuperponen } from "./lib/horas";
import { requerirGestorDe, requerirGestorDeCancha } from "./lib/permisos";
import { grillaDeCancha } from "./lib/turnos";

export type Celda =
  | { tipo: "libre" }
  | {
      tipo: "reserva";
      reservaId: Doc<"reservas">["_id"];
      nombre: string;
      telefono?: string;
      estado: Doc<"reservas">["estado"];
      origen: Doc<"reservas">["origen"];
      montoSenia?: number;
      seniaPagada: boolean;
      precio: number;
      cobrado: number; // seña + pagos registrados en la caja
    }
  | { tipo: "bloqueo"; bloqueoId: Doc<"bloqueos">["_id"]; motivo?: string }
  | { tipo: "fijo"; turnoFijoId: Doc<"turnosFijos">["_id"]; nombre: string; telefono?: string };

// La agenda de un día: cada cancha con todos sus horarios y qué hay en cada uno.
export const delDia = query({
  args: { complejoId: v.id("complejos"), fecha: v.string() },
  handler: async (ctx, { complejoId, fecha }) => {
    const { complejo } = await requerirGestorDe(ctx, complejoId);
    if (!esFechaValida(fecha)) throw new ConvexError("Fecha inválida.");
    const canchas = await ctx.db
      .query("canchas")
      .withIndex("by_complejo", (q) => q.eq("complejoId", complejoId))
      .collect();

    const resultado = await Promise.all(
      canchas
        .filter((c) => c.activa)
        .map(async (cancha) => {
          const { horarios, reservas, bloqueos, fijos } = await grillaDeCancha(ctx, cancha, fecha);
          const turnos = await Promise.all(
            horarios.map(async (h) => {
              const reserva = reservas.find((r) => seSuperponen(r, h));
              const bloqueo = bloqueos.find((b) => seSuperponen(b, h));
              const fijo = fijos.find((f) => seSuperponen(f, h));
              let celda: Celda = { tipo: "libre" };
              if (reserva) {
                celda = {
                  tipo: "reserva",
                  reservaId: reserva._id,
                  nombre: reserva.nombreContacto,
                  telefono: reserva.telefonoContacto,
                  estado: reserva.estado,
                  origen: reserva.origen,
                  montoSenia: reserva.montoSenia,
                  seniaPagada: reserva.seniaPagada,
                  precio: reserva.precio,
                  cobrado: await cobradoDe(ctx, reserva._id),
                };
              } else if (bloqueo) {
                celda = { tipo: "bloqueo", bloqueoId: bloqueo._id, motivo: bloqueo.motivo };
              } else if (fijo) {
                const cliente = await ctx.db.get(fijo.clienteId);
                celda = { tipo: "fijo", turnoFijoId: fijo._id, nombre: cliente?.nombre ?? "", telefono: cliente?.telefono };
              }
              return { ...h, celda };
            }),
          );
          return { _id: cancha._id, nombre: cancha.nombre, turnos };
        }),
    );
    return { complejo: { _id: complejo._id, nombre: complejo.nombre }, canchas: resultado };
  },
});

async function verificarLibre(ctx: QueryCtx, cancha: Doc<"canchas">, fecha: string, inicio: number) {
  const { horarios, reservas, bloqueos, fijos } = await grillaDeCancha(ctx, cancha, fecha);
  const horario = horarios.find((h) => h.inicio === inicio);
  if (!horario) throw new ConvexError("Ese horario no existe para esta cancha.");
  if ([...reservas, ...bloqueos, ...fijos].some((o) => seSuperponen(o, horario))) {
    throw new ConvexError("Ese turno ya está ocupado.");
  }
  return horario;
}

// Reserva que toma el complejo (por teléfono, en persona). Puede ser de un cliente guardado o de alguien nuevo.
export const reservarManual = mutation({
  args: {
    canchaId: v.id("canchas"),
    fecha: v.string(),
    inicio: v.number(),
    clienteId: v.optional(v.id("clientes")),
    nombre: v.string(),
    telefono: v.optional(v.string()),
    guardarCliente: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { cancha, complejo } = await requerirGestorDeCancha(ctx, args.canchaId);
    if (!esFechaValida(args.fecha)) throw new ConvexError("Fecha inválida.");
    const horario = await verificarLibre(ctx, cancha, args.fecha, args.inicio);

    let clienteId = args.clienteId;
    let nombre = args.nombre.trim();
    let telefono = args.telefono?.trim() || undefined;
    if (clienteId) {
      const cliente = await ctx.db.get(clienteId);
      if (!cliente || cliente.complejoId !== complejo._id) throw new ConvexError("Cliente inválido.");
      nombre = cliente.nombre;
      telefono = telefono ?? cliente.telefono;
    } else {
      if (!nombre) throw new ConvexError("Indicá a nombre de quién es la reserva.");
      if (args.guardarCliente) {
        clienteId = await ctx.db.insert("clientes", { complejoId: complejo._id, nombre, telefono });
      }
    }

    return await ctx.db.insert("reservas", {
      complejoId: complejo._id,
      canchaId: cancha._id,
      fecha: args.fecha,
      inicio: horario.inicio,
      fin: horario.fin,
      estado: "confirmada",
      origen: "complejo",
      clienteId,
      nombreContacto: nombre,
      telefonoContacto: telefono,
      precio: horario.precio,
      seniaPagada: false,
    });
  },
});

export const cambiarEstado = mutation({
  args: {
    reservaId: v.id("reservas"),
    estado: v.union(v.literal("confirmada"), v.literal("cancelada"), v.literal("completada"), v.literal("ausente")),
  },
  handler: async (ctx, { reservaId, estado }) => {
    const reserva = await ctx.db.get(reservaId);
    if (!reserva) throw new ConvexError("La reserva no existe.");
    await requerirGestorDe(ctx, reserva.complejoId);
    await ctx.db.patch(reservaId, {
      estado,
      canceladaPor: estado === "cancelada" ? "complejo" : undefined,
      vencePagoEn: undefined,
    });
  },
});

export const marcarSenia = mutation({
  args: { reservaId: v.id("reservas"), pagada: v.boolean() },
  handler: async (ctx, { reservaId, pagada }) => {
    const reserva = await ctx.db.get(reservaId);
    if (!reserva) throw new ConvexError("La reserva no existe.");
    const { usuario } = await requerirGestorDe(ctx, reserva.complejoId);
    await ctx.db.patch(reservaId, { seniaPagada: pagada });
    await registrarSenia(ctx, reserva, usuario._id, pagada);
  },
});

export const bloquear = mutation({
  args: { canchaId: v.id("canchas"), fecha: v.string(), inicio: v.number(), motivo: v.optional(v.string()) },
  handler: async (ctx, { canchaId, fecha, inicio, motivo }) => {
    const { cancha } = await requerirGestorDeCancha(ctx, canchaId);
    if (!esFechaValida(fecha)) throw new ConvexError("Fecha inválida.");
    const horario = await verificarLibre(ctx, cancha, fecha, inicio);
    await ctx.db.insert("bloqueos", {
      canchaId,
      fecha,
      inicio: horario.inicio,
      fin: horario.fin,
      motivo: motivo?.trim() || undefined,
    });
  },
});

export const desbloquear = mutation({
  args: { bloqueoId: v.id("bloqueos") },
  handler: async (ctx, { bloqueoId }) => {
    const bloqueo = await ctx.db.get(bloqueoId);
    if (!bloqueo) return;
    await requerirGestorDeCancha(ctx, bloqueo.canchaId);
    await ctx.db.delete(bloqueoId);
  },
});

// Registra lo que pasó con un turno fijo en una fecha puntual: jugó, no vino, o se libera ese día.
// Crea la reserva de ese día; desde ahí se maneja como cualquier otra reserva.
export const registrarTurnoFijo = mutation({
  args: {
    turnoFijoId: v.id("turnosFijos"),
    fecha: v.string(),
    estado: v.union(v.literal("confirmada"), v.literal("cancelada"), v.literal("completada"), v.literal("ausente")),
  },
  handler: async (ctx, { turnoFijoId, fecha, estado }) => {
    const fijo = await ctx.db.get(turnoFijoId);
    if (!fijo) throw new ConvexError("El turno fijo no existe.");
    const { cancha } = await requerirGestorDeCancha(ctx, fijo.canchaId);
    const { horarios, fijos } = await grillaDeCancha(ctx, cancha, fecha);
    if (!fijos.some((f) => f._id === turnoFijoId)) {
      throw new ConvexError("Ese turno fijo no corresponde a esta fecha o ya fue registrado.");
    }
    const cliente = await ctx.db.get(fijo.clienteId);
    const precio = horarios.find((h) => h.inicio === fijo.inicio)?.precio ?? 0;
    await ctx.db.insert("reservas", {
      complejoId: fijo.complejoId,
      canchaId: fijo.canchaId,
      fecha,
      inicio: fijo.inicio,
      fin: fijo.fin,
      estado,
      origen: "turno_fijo",
      clienteId: fijo.clienteId,
      turnoFijoId,
      nombreContacto: cliente?.nombre ?? "",
      telefonoContacto: cliente?.telefono,
      precio,
      seniaPagada: false,
      canceladaPor: estado === "cancelada" ? "complejo" : undefined,
    });
  },
});

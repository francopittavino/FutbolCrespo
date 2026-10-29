import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { aHora, esFechaValida, hoyEnArgentina } from "./lib/horas";
import { requerirGestorDe } from "./lib/permisos";
import { nombreVisible } from "./lib/perfil";

export const medioPago = v.union(
  v.literal("efectivo"),
  v.literal("transferencia"),
  v.literal("mercadopago"),
  v.literal("otro"),
);
export type MedioPago = Doc<"movimientosCaja">["medio"];
export const MEDIOS: MedioPago[] = ["efectivo", "transferencia", "mercadopago", "otro"];

// Lo que ya se cobró de una reserva (seña + pagos del turno).
export async function cobradoDe(ctx: QueryCtx, reservaId: Id<"reservas">): Promise<number> {
  const movimientos = await ctx.db
    .query("movimientosCaja")
    .withIndex("by_reserva", (q) => q.eq("reservaId", reservaId))
    .collect();
  return movimientos.reduce((suma, m) => suma + (m.tipo === "ingreso" ? m.monto : -m.monto), 0);
}

export function totalesDe(movimientos: Doc<"movimientosCaja">[]) {
  const porMedio = Object.fromEntries(MEDIOS.map((m) => [m, 0])) as Record<MedioPago, number>;
  let ingresos = 0;
  let egresos = 0;
  for (const m of movimientos) {
    if (m.tipo === "ingreso") ingresos += m.monto;
    else egresos += m.monto;
    porMedio[m.medio] += m.tipo === "ingreso" ? m.monto : -m.monto;
  }
  return { ingresos, egresos, saldo: ingresos - egresos, porMedio };
}

function validarMonto(monto: number) {
  if (!Number.isInteger(monto) || monto <= 0)
    throw new ConvexError("El monto tiene que ser un número entero mayor a cero.");
}

async function conceptoDeTurno(ctx: QueryCtx, reserva: Doc<"reservas">, prefijo: string) {
  const cancha = await ctx.db.get(reserva.canchaId);
  return `${prefijo} · ${cancha?.nombre ?? "Cancha"} ${aHora(reserva.inicio)} · ${reserva.nombreContacto}`;
}

// La caja de un día: movimientos, totales por medio de pago y quién lo registró.
export const delDia = query({
  args: { complejoId: v.id("complejos"), fecha: v.string() },
  handler: async (ctx, { complejoId, fecha }) => {
    await requerirGestorDe(ctx, complejoId);
    if (!esFechaValida(fecha)) throw new ConvexError("Fecha inválida.");
    const movimientos = await ctx.db
      .query("movimientosCaja")
      .withIndex("by_complejo_fecha", (q) => q.eq("complejoId", complejoId).eq("fecha", fecha))
      .collect();
    const nombres = new Map<Id<"users">, string>();
    for (const m of movimientos) {
      if (!nombres.has(m.registradoPor)) {
        const usuario = await ctx.db.get(m.registradoPor);
        nombres.set(m.registradoPor, usuario ? nombreVisible(usuario) : "");
      }
    }
    return {
      totales: totalesDe(movimientos),
      movimientos: movimientos
        .sort((a, b) => b._creationTime - a._creationTime)
        .map((m) => ({
          _id: m._id,
          hora: m._creationTime,
          tipo: m.tipo,
          monto: m.monto,
          medio: m.medio,
          concepto: m.concepto,
          deTurno: m.reservaId !== undefined,
          registradoPor: nombres.get(m.registradoPor) ?? "",
        })),
    };
  },
});

// Ingreso o gasto suelto: venta de bebidas, alquiler de pecheras, luz, sueldos...
export const registrar = mutation({
  args: {
    complejoId: v.id("complejos"),
    fecha: v.string(),
    tipo: v.union(v.literal("ingreso"), v.literal("egreso")),
    monto: v.number(),
    medio: medioPago,
    concepto: v.string(),
  },
  handler: async (ctx, args) => {
    const { usuario } = await requerirGestorDe(ctx, args.complejoId);
    if (!esFechaValida(args.fecha)) throw new ConvexError("Fecha inválida.");
    validarMonto(args.monto);
    const concepto = args.concepto.trim();
    if (!concepto) throw new ConvexError("Escribí un concepto (ej. bebidas, luz).");
    return await ctx.db.insert("movimientosCaja", { ...args, concepto, registradoPor: usuario._id });
  },
});

export const eliminar = mutation({
  args: { movimientoId: v.id("movimientosCaja") },
  handler: async (ctx, { movimientoId }) => {
    const movimiento = await ctx.db.get(movimientoId);
    if (!movimiento) return;
    await requerirGestorDe(ctx, movimiento.complejoId);
    await ctx.db.delete(movimientoId);
    // Si era la seña, la reserva vuelve a figurar con la seña pendiente.
    if (movimiento.esSenia && movimiento.reservaId) {
      await ctx.db.patch(movimiento.reservaId, { seniaPagada: false });
    }
  },
});

// Cobro de un turno (todo o una parte). Queda en la caja del día en que se cobra.
export const cobrarTurno = mutation({
  args: { reservaId: v.id("reservas"), monto: v.number(), medio: medioPago },
  handler: async (ctx, { reservaId, monto, medio }) => {
    const reserva = await ctx.db.get(reservaId);
    if (!reserva) throw new ConvexError("La reserva no existe.");
    const { usuario } = await requerirGestorDe(ctx, reserva.complejoId);
    if (reserva.estado === "cancelada") throw new ConvexError("La reserva está cancelada.");
    validarMonto(monto);
    await ctx.db.insert("movimientosCaja", {
      complejoId: reserva.complejoId,
      fecha: hoyEnArgentina(),
      tipo: "ingreso",
      monto,
      medio,
      concepto: await conceptoDeTurno(ctx, reserva, "Turno"),
      reservaId,
      clienteId: reserva.clienteId,
      registradoPor: usuario._id,
    });
  },
});

// Marcar la seña como cobrada la anota en la caja (por transferencia, hasta que esté Mercado Pago).
// Desmarcarla borra ese movimiento.
export async function registrarSenia(
  ctx: MutationCtx,
  reserva: Doc<"reservas">,
  usuarioId: Id<"users">,
  pagada: boolean,
) {
  const movimientos = await ctx.db
    .query("movimientosCaja")
    .withIndex("by_reserva", (q) => q.eq("reservaId", reserva._id))
    .collect();
  const senia = movimientos.find((m) => m.esSenia);
  if (pagada && !senia && reserva.montoSenia) {
    await ctx.db.insert("movimientosCaja", {
      complejoId: reserva.complejoId,
      fecha: hoyEnArgentina(),
      tipo: "ingreso",
      monto: reserva.montoSenia,
      medio: "transferencia",
      concepto: await conceptoDeTurno(ctx, reserva, "Seña"),
      reservaId: reserva._id,
      esSenia: true,
      clienteId: reserva.clienteId,
      registradoPor: usuarioId,
    });
  }
  if (!pagada && senia) await ctx.db.delete(senia._id);
}

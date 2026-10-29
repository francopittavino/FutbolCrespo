import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { aHora, DIAS_SEMANA, diaSemanaDe, esFechaValida, hoyEnArgentina, seSuperponen, sumarDias } from "./lib/horas";
import { requerirGestorDe, requerirGestorDeCancha } from "./lib/permisos";
import { ocupaTurno, turnoFijoVigente } from "./lib/turnos";

// ---------- Clientes ----------

export const listar = query({
  args: { complejoId: v.id("complejos") },
  handler: async (ctx, { complejoId }) => {
    await requerirGestorDe(ctx, complejoId);
    const clientes = await ctx.db
      .query("clientes")
      .withIndex("by_complejo", (q) => q.eq("complejoId", complejoId))
      .collect();
    return clientes.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  },
});

const datosCliente = {
  nombre: v.string(),
  telefono: v.optional(v.string()),
  notas: v.optional(v.string()),
};

function limpiar(datos: { nombre: string; telefono?: string; notas?: string }) {
  const nombre = datos.nombre.trim();
  if (!nombre) throw new ConvexError("El cliente necesita un nombre.");
  return { nombre, telefono: datos.telefono?.trim() || undefined, notas: datos.notas?.trim() || undefined };
}

export const crear = mutation({
  args: { complejoId: v.id("complejos"), ...datosCliente },
  handler: async (ctx, { complejoId, ...datos }) => {
    await requerirGestorDe(ctx, complejoId);
    return await ctx.db.insert("clientes", { complejoId, ...limpiar(datos) });
  },
});

export const actualizar = mutation({
  args: { clienteId: v.id("clientes"), ...datosCliente },
  handler: async (ctx, { clienteId, ...datos }) => {
    const cliente = await ctx.db.get(clienteId);
    if (!cliente) throw new ConvexError("El cliente no existe.");
    await requerirGestorDe(ctx, cliente.complejoId);
    await ctx.db.patch(clienteId, limpiar(datos));
  },
});

// ---------- Turnos fijos ----------

export const turnosFijos = query({
  args: { complejoId: v.id("complejos") },
  handler: async (ctx, { complejoId }) => {
    await requerirGestorDe(ctx, complejoId);
    const fijos = await ctx.db
      .query("turnosFijos")
      .withIndex("by_complejo", (q) => q.eq("complejoId", complejoId))
      .collect();
    const hoy = hoyEnArgentina();
    const vigentes = fijos.filter((f) => f.activo && (f.hasta === undefined || f.hasta >= hoy));
    const conNombres = await Promise.all(
      vigentes.map(async (f) => {
        const [cliente, cancha] = await Promise.all([ctx.db.get(f.clienteId), ctx.db.get(f.canchaId)]);
        return { ...f, cliente: cliente?.nombre ?? "", cancha: cancha?.nombre ?? "" };
      }),
    );
    return conNombres.sort((a, b) => a.diaSemana - b.diaSemana || a.inicio - b.inicio);
  },
});

const SEMANAS_A_REVISAR = 26;

export const crearTurnoFijo = mutation({
  args: {
    canchaId: v.id("canchas"),
    clienteId: v.id("clientes"),
    diaSemana: v.number(),
    inicio: v.number(),
    desde: v.string(),
  },
  handler: async (ctx, { canchaId, clienteId, diaSemana, inicio, desde }) => {
    const { complejo } = await requerirGestorDeCancha(ctx, canchaId);
    const cliente = await ctx.db.get(clienteId);
    if (!cliente || cliente.complejoId !== complejo._id) throw new ConvexError("Cliente inválido.");
    if (!esFechaValida(desde) || diaSemanaDe(desde) !== diaSemana) {
      throw new ConvexError(`La fecha de inicio tiene que ser un ${DIAS_SEMANA[diaSemana]}.`);
    }

    const franja = (
      await ctx.db
        .query("franjasHorarias")
        .withIndex("by_cancha_dia", (q) => q.eq("canchaId", canchaId).eq("diaSemana", diaSemana))
        .collect()
    ).find((f) => inicio >= f.inicio && inicio + f.duracionTurno <= f.fin && (inicio - f.inicio) % f.duracionTurno === 0);
    if (!franja) throw new ConvexError("Ese horario no existe para esta cancha ese día.");
    const turno = { inicio, fin: inicio + franja.duracionTurno };

    const otrosFijos = await ctx.db
      .query("turnosFijos")
      .withIndex("by_cancha_dia", (q) => q.eq("canchaId", canchaId).eq("diaSemana", diaSemana))
      .collect();
    if (otrosFijos.some((f) => f.activo && (f.hasta === undefined || f.hasta >= desde) && seSuperponen(f, turno))) {
      throw new ConvexError("Ya hay un turno fijo en ese horario.");
    }

    // No pisar reservas ya tomadas en las próximas semanas: se avisa la primera fecha en conflicto.
    for (let semana = 0; semana < SEMANAS_A_REVISAR; semana++) {
      const fecha = sumarDias(desde, semana * 7);
      const reservas = await ctx.db
        .query("reservas")
        .withIndex("by_cancha_fecha", (q) => q.eq("canchaId", canchaId).eq("fecha", fecha))
        .collect();
      const choque = reservas.find((r) => ocupaTurno(r) && seSuperponen(r, turno));
      if (choque) {
        throw new ConvexError(
          `El ${fecha.split("-").reverse().join("/")} a las ${aHora(inicio)} ya está reservado por ${choque.nombreContacto}. ` +
            "Empezá el turno fijo después de esa fecha o cancelá esa reserva.",
        );
      }
    }

    return await ctx.db.insert("turnosFijos", {
      complejoId: complejo._id,
      canchaId,
      clienteId,
      diaSemana,
      inicio: turno.inicio,
      fin: turno.fin,
      desde,
      activo: true,
    });
  },
});

// Da de baja un turno fijo desde hoy. Las fechas pasadas quedan en el historial.
export const finalizarTurnoFijo = mutation({
  args: { turnoFijoId: v.id("turnosFijos") },
  handler: async (ctx, { turnoFijoId }) => {
    const fijo = await ctx.db.get(turnoFijoId);
    if (!fijo) throw new ConvexError("El turno fijo no existe.");
    await requerirGestorDe(ctx, fijo.complejoId);
    const ayer = sumarDias(hoyEnArgentina(), -1);
    if (fijo.desde > ayer || !turnoFijoVigente(fijo, ayer)) {
      // Todavía no había empezado: se desactiva sin dejar historial.
      await ctx.db.patch(turnoFijoId, { activo: false });
    } else {
      await ctx.db.patch(turnoFijoId, { hasta: ayer });
    }
  },
});

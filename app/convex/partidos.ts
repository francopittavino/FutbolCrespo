import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { inicioDelTurno } from "./lib/horas";
import { sonAmigos } from "./lib/amistades";
import { fotoDe, nombreVisible as nombreDe } from "./lib/perfil";
import { requerirUsuario, usuarioActual } from "./lib/permisos";

const SUPLENTES = 4; // además de los titulares de los dos equipos

const equipo = v.union(v.literal("A"), v.literal("B"));


function generarCodigo(): string {
  const letras = "abcdefghjkmnpqrstuvwxyz23456789"; // sin caracteres que se confunden (l, 1, o, 0)
  let codigo = "";
  for (let i = 0; i < 10; i++) codigo += letras[Math.floor(Math.random() * letras.length)];
  return codigo;
}

async function requerirOrganizador(ctx: QueryCtx, partidoId: Id<"partidos">) {
  const usuario = await requerirUsuario(ctx);
  const partido = await ctx.db.get(partidoId);
  if (!partido) throw new ConvexError("El partido no existe.");
  if (partido.organizadorId !== usuario._id) {
    throw new ConvexError("Solo el que organiza el partido puede hacer esto.");
  }
  return { usuario, partido };
}

async function jugadoresDe(ctx: QueryCtx, partidoId: Id<"partidos">) {
  return await ctx.db
    .query("jugadoresPartido")
    .withIndex("by_partido", (q) => q.eq("partidoId", partidoId))
    .collect();
}

// Datos para mostrar un partido (y para las imágenes para compartir).
async function resumen(ctx: QueryCtx, partido: Doc<"partidos">) {
  const [complejo, cancha, organizador, reserva] = await Promise.all([
    ctx.db.get(partido.complejoId),
    ctx.db.get(partido.canchaId),
    ctx.db.get(partido.organizadorId),
    ctx.db.get(partido.reservaId),
  ]);
  return {
    _id: partido._id,
    fecha: partido.fecha,
    inicio: partido.inicio,
    fin: reserva?.fin ?? partido.inicio,
    comienzaEn: inicioDelTurno(partido.fecha, partido.inicio),
    cancelado: reserva?.estado === "cancelada",
    complejo: complejo?.nombre ?? "",
    direccion: complejo?.direccion ?? "",
    cancha: cancha?.nombre ?? "",
    jugadoresPorLado: cancha?.jugadoresPorLado ?? 5,
    organizador: organizador ? nombreDe(organizador) : "",
    nombreEquipoA: partido.nombreEquipoA,
    nombreEquipoB: partido.nombreEquipoB,
    golesA: partido.golesA,
    golesB: partido.golesB,
  };
}

// ---------- Crear y ver ----------

// Arma el partido de una reserva propia (si ya existe, devuelve el mismo).
export const crear = mutation({
  args: { reservaId: v.id("reservas") },
  handler: async (ctx, { reservaId }) => {
    const usuario = await requerirUsuario(ctx);
    const reserva = await ctx.db.get(reservaId);
    if (!reserva || reserva.jugadorId !== usuario._id) throw new ConvexError("No encontramos esa reserva.");
    if (reserva.estado === "cancelada") throw new ConvexError("La reserva está cancelada.");

    const existente = await ctx.db
      .query("partidos")
      .withIndex("by_reserva", (q) => q.eq("reservaId", reservaId))
      .unique();
    if (existente) return existente._id;

    let codigoInvitacion = generarCodigo();
    while (await ctx.db.query("partidos").withIndex("by_codigo", (q) => q.eq("codigoInvitacion", codigoInvitacion)).first()) {
      codigoInvitacion = generarCodigo();
    }
    const partidoId = await ctx.db.insert("partidos", {
      reservaId,
      organizadorId: usuario._id,
      complejoId: reserva.complejoId,
      canchaId: reserva.canchaId,
      fecha: reserva.fecha,
      inicio: reserva.inicio,
      codigoInvitacion,
      nombreEquipoA: "Equipo A",
      nombreEquipoB: "Equipo B",
    });
    await ctx.db.insert("jugadoresPartido", { partidoId, userId: usuario._id, nombre: nombreDe(usuario) });
    return partidoId;
  },
});

// El partido completo. Lo ven el organizador y los jugadores anotados.
export const detalle = query({
  args: { partidoId: v.id("partidos") },
  handler: async (ctx, { partidoId }) => {
    const usuario = await requerirUsuario(ctx);
    const partido = await ctx.db.get(partidoId);
    if (!partido) throw new ConvexError("El partido no existe.");
    const jugadores = await jugadoresDe(ctx, partidoId);
    const soyOrganizador = partido.organizadorId === usuario._id;
    if (!soyOrganizador && !jugadores.some((j) => j.userId === usuario._id)) {
      throw new ConvexError("No estás anotado en este partido.");
    }
    return {
      ...(await resumen(ctx, partido)),
      soyOrganizador,
      codigoInvitacion: partido.codigoInvitacion,
      // Los que tienen cuenta se muestran con su nombre y foto actuales del perfil.
      jugadores: await Promise.all(
        jugadores.map(async (j) => {
          const cuenta = j.userId ? await ctx.db.get(j.userId) : null;
          return {
            _id: j._id,
            nombre: cuenta ? nombreDe(cuenta) : j.nombre,
            foto: cuenta ? await fotoDe(ctx, cuenta) : undefined,
            equipo: j.equipo,
            conCuenta: j.userId !== undefined,
            soyYo: j.userId === usuario._id,
            userId: j.userId,
          };
        }),
      ),
    };
  },
});

// Para la página de invitación: datos básicos, sin la lista de jugadores. Pública (con el código alcanza).
export const porCodigo = query({
  args: { codigo: v.string() },
  handler: async (ctx, { codigo }) => {
    const partido = await ctx.db
      .query("partidos")
      .withIndex("by_codigo", (q) => q.eq("codigoInvitacion", codigo))
      .unique();
    if (!partido) return null;
    const usuario = await usuarioActual(ctx);
    const jugadores = await jugadoresDe(ctx, partido._id);
    const info = await resumen(ctx, partido);
    return {
      ...info,
      anotados: jugadores.length,
      cupo: info.jugadoresPorLado * 2 + SUPLENTES,
      yaEstoy: usuario !== null && jugadores.some((j) => j.userId === usuario._id),
    };
  },
});

// Partidos en los que estoy anotado (organizados por mí o no).
export const misPartidos = query({
  args: {},
  handler: async (ctx) => {
    const usuario = await usuarioActual(ctx);
    if (usuario === null) return [];
    const mios = await ctx.db
      .query("jugadoresPartido")
      .withIndex("by_user", (q) => q.eq("userId", usuario._id))
      .collect();
    const partidos = await Promise.all(
      mios.map(async (j) => {
        const partido = await ctx.db.get(j.partidoId);
        if (!partido) return null;
        return {
          ...(await resumen(ctx, partido)),
          reservaId: partido.reservaId,
          soyOrganizador: partido.organizadorId === usuario._id,
          miEquipo: j.equipo,
        };
      }),
    );
    return partidos.filter((p) => p !== null).sort((a, b) => b.comienzaEn - a.comienzaEn);
  },
});

// ---------- Jugadores ----------

async function verificarCupo(ctx: QueryCtx, partido: Doc<"partidos">) {
  const cancha = await ctx.db.get(partido.canchaId);
  const cupo = (cancha?.jugadoresPorLado ?? 5) * 2 + SUPLENTES;
  if ((await jugadoresDe(ctx, partido._id)).length >= cupo) {
    throw new ConvexError(`El partido ya tiene ${cupo} jugadores.`);
  }
}

async function verificarSinResultado(partido: Doc<"partidos">) {
  if (partido.golesA !== undefined) throw new ConvexError("El partido ya tiene resultado.");
}

export const sumarme = mutation({
  args: { codigo: v.string() },
  handler: async (ctx, { codigo }) => {
    const usuario = await requerirUsuario(ctx);
    const partido = await ctx.db
      .query("partidos")
      .withIndex("by_codigo", (q) => q.eq("codigoInvitacion", codigo))
      .unique();
    if (!partido) throw new ConvexError("El link de invitación no es válido.");
    const ya = await ctx.db
      .query("jugadoresPartido")
      .withIndex("by_partido_user", (q) => q.eq("partidoId", partido._id).eq("userId", usuario._id))
      .unique();
    if (ya) return partido._id;
    await verificarSinResultado(partido);
    await verificarCupo(ctx, partido);
    await ctx.db.insert("jugadoresPartido", { partidoId: partido._id, userId: usuario._id, nombre: nombreDe(usuario) });
    return partido._id;
  },
});

// Alguien sin cuenta: queda en la lista y en las imágenes, pero no suma estadísticas.
export const agregarInvitado = mutation({
  args: { partidoId: v.id("partidos"), nombre: v.string() },
  handler: async (ctx, { partidoId, nombre }) => {
    const { partido } = await requerirOrganizador(ctx, partidoId);
    const limpio = nombre.trim();
    if (!limpio) throw new ConvexError("Escribí el nombre del jugador.");
    await verificarSinResultado(partido);
    await verificarCupo(ctx, partido);
    await ctx.db.insert("jugadoresPartido", { partidoId, nombre: limpio });
  },
});

export const agregarAmigo = mutation({
  args: { partidoId: v.id("partidos"), amigoId: v.id("users") },
  handler: async (ctx, { partidoId, amigoId }) => {
    const { usuario, partido } = await requerirOrganizador(ctx, partidoId);
    if (!(await sonAmigos(ctx, usuario._id, amigoId))) throw new ConvexError("Solo podés agregar a tus amigos.");
    const ya = await ctx.db
      .query("jugadoresPartido")
      .withIndex("by_partido_user", (q) => q.eq("partidoId", partidoId).eq("userId", amigoId))
      .unique();
    if (ya) return;
    await verificarSinResultado(partido);
    await verificarCupo(ctx, partido);
    const amigo = await ctx.db.get(amigoId);
    await ctx.db.insert("jugadoresPartido", { partidoId, userId: amigoId, nombre: amigo ? nombreDe(amigo) : "Jugador" });
  },
});

// El organizador saca a cualquiera (menos a sí mismo); cada jugador puede bajarse solo.
export const quitarJugador = mutation({
  args: { jugadorId: v.id("jugadoresPartido") },
  handler: async (ctx, { jugadorId }) => {
    const usuario = await requerirUsuario(ctx);
    const jugador = await ctx.db.get(jugadorId);
    if (!jugador) return;
    const partido = await ctx.db.get(jugador.partidoId);
    if (!partido) return;
    const esOrganizador = partido.organizadorId === usuario._id;
    if (!esOrganizador && jugador.userId !== usuario._id) throw new ConvexError("No podés sacar a otro jugador.");
    if (jugador.userId === partido.organizadorId) throw new ConvexError("El organizador no se puede bajar del partido.");
    await verificarSinResultado(partido);
    await ctx.db.delete(jugadorId);
  },
});

// ---------- Equipos y resultado (solo el organizador) ----------

export const asignarEquipo = mutation({
  args: { jugadorId: v.id("jugadoresPartido"), equipo: v.union(equipo, v.null()) },
  handler: async (ctx, { jugadorId, equipo: nuevo }) => {
    const jugador = await ctx.db.get(jugadorId);
    if (!jugador) throw new ConvexError("El jugador no existe.");
    const { partido } = await requerirOrganizador(ctx, jugador.partidoId);
    await verificarSinResultado(partido);
    await ctx.db.patch(jugadorId, { equipo: nuevo ?? undefined });
  },
});

export const nombrarEquipos = mutation({
  args: { partidoId: v.id("partidos"), nombreEquipoA: v.string(), nombreEquipoB: v.string() },
  handler: async (ctx, { partidoId, nombreEquipoA, nombreEquipoB }) => {
    await requerirOrganizador(ctx, partidoId);
    await ctx.db.patch(partidoId, {
      nombreEquipoA: nombreEquipoA.trim() || "Equipo A",
      nombreEquipoB: nombreEquipoB.trim() || "Equipo B",
    });
  },
});

export const cargarResultado = mutation({
  args: { partidoId: v.id("partidos"), golesA: v.number(), golesB: v.number() },
  handler: async (ctx, { partidoId, golesA, golesB }) => {
    const { partido } = await requerirOrganizador(ctx, partidoId);
    const reserva = await ctx.db.get(partido.reservaId);
    if (reserva?.estado === "cancelada") throw new ConvexError("La reserva de este partido se canceló.");
    if (Date.now() < inicioDelTurno(partido.fecha, partido.inicio)) {
      throw new ConvexError("El resultado se carga una vez que empezó el partido.");
    }
    for (const goles of [golesA, golesB]) {
      if (!Number.isInteger(goles) || goles < 0 || goles > 99) throw new ConvexError("Revisá el resultado.");
    }
    await ctx.db.patch(partidoId, { golesA, golesB });
  },
});

// ---------- Estadísticas ----------

// "Mi mes en la cancha": partidos con resultado del mes ("YYYY-MM").
// Ganados, goles a favor y racha solo cuentan los partidos en los que el jugador tenía equipo asignado.
export const miMes = query({
  args: { mes: v.string() },
  handler: async (ctx, { mes }) => {
    const usuario = await usuarioActual(ctx);
    if (usuario === null) return null;
    const mios = await ctx.db
      .query("jugadoresPartido")
      .withIndex("by_user", (q) => q.eq("userId", usuario._id))
      .collect();

    const jugados: { comienzaEn: number; resultado?: "G" | "E" | "P"; golesAFavor: number }[] = [];
    for (const j of mios) {
      const partido = await ctx.db.get(j.partidoId);
      if (!partido || !partido.fecha.startsWith(mes) || partido.golesA === undefined || partido.golesB === undefined) {
        continue;
      }
      const reserva = await ctx.db.get(partido.reservaId);
      if (reserva?.estado === "cancelada") continue;
      const comienzaEn = inicioDelTurno(partido.fecha, partido.inicio);
      if (!j.equipo) {
        jugados.push({ comienzaEn, golesAFavor: 0 });
        continue;
      }
      const propios = j.equipo === "A" ? partido.golesA : partido.golesB;
      const rivales = j.equipo === "A" ? partido.golesB : partido.golesA;
      jugados.push({
        comienzaEn,
        golesAFavor: propios,
        resultado: propios > rivales ? "G" : propios === rivales ? "E" : "P",
      });
    }

    jugados.sort((a, b) => a.comienzaEn - b.comienzaEn);
    let racha = 0;
    let mejorRacha = 0;
    for (const p of jugados) {
      if (!p.resultado) continue;
      racha = p.resultado === "G" ? racha + 1 : 0;
      mejorRacha = Math.max(mejorRacha, racha);
    }
    return {
      nombre: nombreDe(usuario),
      partidos: jugados.length,
      ganados: jugados.filter((p) => p.resultado === "G").length,
      empatados: jugados.filter((p) => p.resultado === "E").length,
      perdidos: jugados.filter((p) => p.resultado === "P").length,
      golesAFavor: jugados.reduce((suma, p) => suma + p.golesAFavor, 0),
      rachaGanadora: mejorRacha,
    };
  },
});

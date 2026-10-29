import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { sonAmigos } from "./lib/amistades";
import { fotoDe, nombreVisible } from "./lib/perfil";
import { requerirUsuario, usuarioActual } from "./lib/permisos";

const MAX_COMPANEROS = 20;

// Amigos aceptados, solicitudes recibidas y enviadas.
export const misAmigos = query({
  args: {},
  handler: async (ctx) => {
    const usuario = await usuarioActual(ctx);
    if (usuario === null) return null;
    const [enviadas, recibidas] = await Promise.all([
      ctx.db.query("amistades").withIndex("by_de", (q) => q.eq("de", usuario._id)).collect(),
      ctx.db.query("amistades").withIndex("by_para", (q) => q.eq("para", usuario._id)).collect(),
    ]);
    const conDatos = async (amistadId: Id<"amistades">, otroId: Id<"users">) => {
      const otro = await ctx.db.get(otroId);
      return {
        amistadId,
        userId: otroId,
        nombre: otro ? nombreVisible(otro) : "Jugador",
        foto: otro ? await fotoDe(ctx, otro) : undefined,
      };
    };
    const amigos = await Promise.all([
      ...enviadas.filter((a) => a.aceptada).map((a) => conDatos(a._id, a.para)),
      ...recibidas.filter((a) => a.aceptada).map((a) => conDatos(a._id, a.de)),
    ]);
    return {
      miId: usuario._id,
      amigos: amigos.sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
      recibidas: await Promise.all(recibidas.filter((a) => !a.aceptada).map((a) => conDatos(a._id, a.de))),
      enviadas: await Promise.all(enviadas.filter((a) => !a.aceptada).map((a) => conDatos(a._id, a.para))),
    };
  },
});

// Gente con la que jugué y todavía no es amiga: sugerencias para agregar.
export const companeros = query({
  args: {},
  handler: async (ctx) => {
    const usuario = await usuarioActual(ctx);
    if (usuario === null) return [];
    const mios = await ctx.db
      .query("jugadoresPartido")
      .withIndex("by_user", (q) => q.eq("userId", usuario._id))
      .collect();
    const vistos = new Map<Id<"users">, string>();
    for (const j of mios) {
      const delPartido = await ctx.db
        .query("jugadoresPartido")
        .withIndex("by_partido", (q) => q.eq("partidoId", j.partidoId))
        .collect();
      for (const otro of delPartido) {
        if (otro.userId && otro.userId !== usuario._id) vistos.set(otro.userId, otro.nombre);
      }
    }
    const sugerencias = [];
    for (const [userId, nombre] of vistos) {
      const [ida, vuelta] = await Promise.all([
        ctx.db.query("amistades").withIndex("by_par", (q) => q.eq("de", usuario._id).eq("para", userId)).unique(),
        ctx.db.query("amistades").withIndex("by_par", (q) => q.eq("de", userId).eq("para", usuario._id)).unique(),
      ]);
      if (!ida && !vuelta) sugerencias.push({ userId, nombre });
      if (sugerencias.length >= MAX_COMPANEROS) break;
    }
    return sugerencias;
  },
});

// Nombre y foto de alguien, para la página "agregar amigo" del link personal.
export const perfil = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const usuario = await usuarioActual(ctx);
    const otro = await ctx.db.get(userId);
    if (!otro) return null;
    return {
      nombre: nombreVisible(otro),
      foto: await fotoDe(ctx, otro),
      soyYo: usuario?._id === userId,
      yaSonAmigos: usuario ? await sonAmigos(ctx, usuario._id, userId) : false,
    };
  },
});

// Si la otra persona ya me había mandado solicitud, se acepta directamente.
export const enviarSolicitud = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const usuario = await requerirUsuario(ctx);
    if (userId === usuario._id) throw new ConvexError("No te podés agregar a vos mismo.");
    if (!(await ctx.db.get(userId))) throw new ConvexError("Ese usuario no existe.");
    const [ida, vuelta] = await Promise.all([
      ctx.db.query("amistades").withIndex("by_par", (q) => q.eq("de", usuario._id).eq("para", userId)).unique(),
      ctx.db.query("amistades").withIndex("by_par", (q) => q.eq("de", userId).eq("para", usuario._id)).unique(),
    ]);
    if (vuelta) {
      if (!vuelta.aceptada) await ctx.db.patch(vuelta._id, { aceptada: true });
      return "amigos";
    }
    if (ida) return ida.aceptada ? "amigos" : "pendiente";
    await ctx.db.insert("amistades", { de: usuario._id, para: userId, aceptada: false });
    return "pendiente";
  },
});

export const responder = mutation({
  args: { amistadId: v.id("amistades"), aceptar: v.boolean() },
  handler: async (ctx, { amistadId, aceptar }) => {
    const usuario = await requerirUsuario(ctx);
    const amistad = await ctx.db.get(amistadId);
    if (!amistad || amistad.para !== usuario._id) throw new ConvexError("No encontramos esa solicitud.");
    if (aceptar) await ctx.db.patch(amistadId, { aceptada: true });
    else await ctx.db.delete(amistadId);
  },
});

// Sirve para cancelar una solicitud enviada o eliminar a un amigo.
export const eliminar = mutation({
  args: { amistadId: v.id("amistades") },
  handler: async (ctx, { amistadId }) => {
    const usuario = await requerirUsuario(ctx);
    const amistad = await ctx.db.get(amistadId);
    if (!amistad) return;
    if (amistad.de !== usuario._id && amistad.para !== usuario._id) throw new ConvexError("No encontramos esa amistad.");
    await ctx.db.delete(amistadId);
  },
});

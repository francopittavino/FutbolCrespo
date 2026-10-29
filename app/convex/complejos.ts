import { ConvexError, v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { validarImagen } from "./archivos";
import { nombreVisible } from "./lib/perfil";
import { requerirAdmin, requerirGestorDe, rolDe, usuarioActual } from "./lib/permisos";

// Complejos que puede gestionar el usuario: todos si es admin, los suyos si es dueño.
export const misComplejos = query({
  args: {},
  handler: async (ctx) => {
    const usuario = await usuarioActual(ctx);
    if (usuario === null) return [];
    const rol = rolDe(usuario);
    if (rol === "admin") return await ctx.db.query("complejos").collect();
    if (rol === "duenio") {
      return await ctx.db
        .query("complejos")
        .withIndex("by_duenio", (q) => q.eq("duenioId", usuario._id))
        .collect();
    }
    return [];
  },
});

// Ficha completa para la pantalla de gestión.
export const detalle = query({
  args: { complejoId: v.id("complejos") },
  handler: async (ctx, { complejoId }) => {
    const { complejo } = await requerirGestorDe(ctx, complejoId);
    const duenio = complejo.duenioId ? await ctx.db.get(complejo.duenioId) : null;
    const canchas = await ctx.db
      .query("canchas")
      .withIndex("by_complejo", (q) => q.eq("complejoId", complejoId))
      .collect();
    return {
      complejo,
      banner: complejo.fotoId ? await ctx.storage.getUrl(complejo.fotoId) : null,
      duenio: duenio && { nombre: nombreVisible(duenio), email: duenio.email ?? "" },
      canchas,
    };
  },
});

export const crear = mutation({
  args: {
    nombre: v.string(),
    direccion: v.string(),
    telefono: v.optional(v.string()),
    whatsapp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requerirAdmin(ctx);
    if (!args.nombre.trim() || !args.direccion.trim()) {
      throw new ConvexError("El nombre y la dirección son obligatorios.");
    }
    return await ctx.db.insert("complejos", {
      ...args,
      nombre: args.nombre.trim(),
      direccion: args.direccion.trim(),
      activo: false, // se publica cuando tenga canchas y horarios cargados
      requiereSenia: false,
      minutosParaPagarSenia: 15,
      horasCancelacionGratis: 6,
    });
  },
});

export const actualizar = mutation({
  args: {
    complejoId: v.id("complejos"),
    nombre: v.string(),
    direccion: v.string(),
    telefono: v.optional(v.string()),
    whatsapp: v.optional(v.string()),
    descripcion: v.optional(v.string()),
    requiereSenia: v.boolean(),
    montoSenia: v.optional(v.number()),
    aliasPago: v.optional(v.string()),
    minutosParaPagarSenia: v.number(),
    horasCancelacionGratis: v.number(),
  },
  handler: async (ctx, { complejoId, ...datos }) => {
    await requerirGestorDe(ctx, complejoId);
    if (!datos.nombre.trim() || !datos.direccion.trim()) {
      throw new ConvexError("El nombre y la dirección son obligatorios.");
    }
    if (datos.requiereSenia && !(datos.montoSenia && datos.montoSenia > 0)) {
      throw new ConvexError("Indicá el monto de la seña.");
    }
    if (datos.requiereSenia && !datos.aliasPago?.trim()) {
      throw new ConvexError("Indicá el alias donde los jugadores transfieren la seña.");
    }
    datos.aliasPago = datos.aliasPago?.trim() || undefined;
    if (datos.minutosParaPagarSenia < 5 || datos.horasCancelacionGratis < 0) {
      throw new ConvexError("Revisá los tiempos de seña y cancelación.");
    }
    await ctx.db.patch(complejoId, datos);
  },
});

// Publicar u ocultar el complejo para los jugadores.
export const cambiarVisibilidad = mutation({
  args: { complejoId: v.id("complejos"), activo: v.boolean() },
  handler: async (ctx, { complejoId, activo }) => {
    await requerirGestorDe(ctx, complejoId);
    if (activo) {
      const canchas = await ctx.db
        .query("canchas")
        .withIndex("by_complejo", (q) => q.eq("complejoId", complejoId))
        .collect();
      if (!canchas.some((c) => c.activa)) {
        throw new ConvexError("Cargá al menos una cancha activa antes de publicar el complejo.");
      }
    }
    await ctx.db.patch(complejoId, { activo });
  },
});

// El dueño tiene que haber ingresado a la app al menos una vez con ese email.
export const asignarDuenio = mutation({
  args: { complejoId: v.id("complejos"), email: v.string() },
  handler: async (ctx, { complejoId, email }) => {
    await requerirAdmin(ctx);
    const usuario = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email.trim().toLowerCase()))
      .unique();
    if (usuario === null) {
      throw new ConvexError(
        "No hay ningún usuario con ese email. Pedile al dueño que ingrese una vez a la app con Google y volvé a intentar.",
      );
    }
    if (rolDe(usuario) === "jugador") await ctx.db.patch(usuario._id, { rol: "duenio" });
    await ctx.db.patch(complejoId, { duenioId: usuario._id });
  },
});

// `storageId` null quita el banner.
export const cambiarBanner = mutation({
  args: { complejoId: v.id("complejos"), storageId: v.union(v.id("_storage"), v.null()) },
  handler: async (ctx, { complejoId, storageId }) => {
    const { complejo } = await requerirGestorDe(ctx, complejoId);
    if (storageId) await validarImagen(ctx, storageId);
    if (complejo.fotoId) await ctx.storage.delete(complejo.fotoId);
    await ctx.db.patch(complejoId, { fotoId: storageId ?? undefined });
  },
});

// ---------- Para los jugadores (públicas) ----------

async function fichaPublica(ctx: QueryCtx, complejo: Doc<"complejos">) {
  const canchas = (
    await ctx.db
      .query("canchas")
      .withIndex("by_complejo", (q) => q.eq("complejoId", complejo._id))
      .collect()
  ).filter((c) => c.activa);
  const precios: number[] = [];
  for (const cancha of canchas) {
    const franjas = await ctx.db
      .query("franjasHorarias")
      .withIndex("by_cancha_dia", (q) => q.eq("canchaId", cancha._id))
      .collect();
    precios.push(...franjas.map((f) => f.precio));
  }
  return {
    _id: complejo._id,
    nombre: complejo.nombre,
    direccion: complejo.direccion,
    descripcion: complejo.descripcion,
    whatsapp: complejo.whatsapp,
    banner: complejo.fotoId ? await ctx.storage.getUrl(complejo.fotoId) : null,
    requiereSenia: complejo.requiereSenia,
    montoSenia: complejo.montoSenia,
    aliasPago: complejo.requiereSenia ? complejo.aliasPago : undefined,
    horasCancelacionGratis: complejo.horasCancelacionGratis,
    precioDesde: precios.length ? Math.min(...precios) : null,
    canchas: canchas.map((c) => ({
      _id: c._id,
      nombre: c.nombre,
      jugadoresPorLado: c.jugadoresPorLado,
      techada: c.techada,
      superficie: c.superficie,
    })),
  };
}

// La pantalla principal: todos los complejos publicados con su banner.
export const publicos = query({
  args: {},
  handler: async (ctx) => {
    const complejos = await ctx.db
      .query("complejos")
      .withIndex("by_activo", (q) => q.eq("activo", true))
      .collect();
    const fichas = await Promise.all(complejos.map((c) => fichaPublica(ctx, c)));
    return fichas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  },
});

export const publico = query({
  args: { complejoId: v.id("complejos") },
  handler: async (ctx, { complejoId }) => {
    const complejo = await ctx.db.get(complejoId);
    if (!complejo || !complejo.activo) return null;
    return await fichaPublica(ctx, complejo);
  },
});

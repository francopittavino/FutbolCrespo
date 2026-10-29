import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
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
      duenio: duenio && { nombre: duenio.name ?? "", email: duenio.email ?? "" },
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

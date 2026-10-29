import { ConvexError, v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import { validarImagen } from "./archivos";
import { fotoDe, nombreVisible } from "./lib/perfil";
import { requerirUsuario, rolDe, usuarioActual } from "./lib/permisos";

const posicion = v.union(v.literal("arquero"), v.literal("defensor"), v.literal("mediocampista"), v.literal("delantero"));

// Datos del usuario logueado (o null si no inició sesión).
export const yo = query({
  args: {},
  handler: async (ctx) => {
    const usuario = await usuarioActual(ctx);
    if (usuario === null) return null;
    return {
      _id: usuario._id,
      nombre: nombreVisible(usuario),
      email: usuario.email ?? "",
      foto: await fotoDe(ctx, usuario),
      telefono: usuario.telefono,
      posicion: usuario.posicion,
      rol: rolDe(usuario),
    };
  },
});

export const actualizarPerfil = mutation({
  args: { nombre: v.string(), telefono: v.optional(v.string()), posicion: v.optional(posicion) },
  handler: async (ctx, { nombre, telefono, posicion }) => {
    const usuario = await requerirUsuario(ctx);
    const limpio = nombre.trim();
    if (limpio.length < 2 || limpio.length > 40) throw new ConvexError("El nombre tiene que tener entre 2 y 40 letras.");
    await ctx.db.patch(usuario._id, { nombrePerfil: limpio, telefono: telefono?.trim() || undefined, posicion });
  },
});

// `storageId` null vuelve a la foto de Google.
export const cambiarFoto = mutation({
  args: { storageId: v.union(v.id("_storage"), v.null()) },
  handler: async (ctx, { storageId }) => {
    const usuario = await requerirUsuario(ctx);
    if (storageId) await validarImagen(ctx, storageId);
    if (usuario.fotoId) await ctx.storage.delete(usuario.fotoId);
    await ctx.db.patch(usuario._id, { fotoId: storageId ?? undefined });
  },
});

// Solo se puede ejecutar desde la terminal o el panel de Convex, nunca desde la app:
//   npx convex run usuarios:asignarRol '{"email":"alguien@gmail.com","rol":"admin"}'
export const asignarRol = internalMutation({
  args: {
    email: v.string(),
    rol: v.union(v.literal("jugador"), v.literal("duenio"), v.literal("admin")),
  },
  handler: async (ctx, { email, rol }) => {
    const usuario = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    if (usuario === null) {
      throw new Error(`No hay ningún usuario con el email ${email}. Primero tiene que iniciar sesión en la app.`);
    }
    await ctx.db.patch(usuario._id, { rol });
    return `${email} ahora es ${rol}`;
  },
});

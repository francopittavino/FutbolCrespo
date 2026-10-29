import { v } from "convex/values";

import { internalMutation, query } from "./_generated/server";
import { rolDe, usuarioActual } from "./lib/permisos";

// Datos del usuario logueado (o null si no inició sesión).
export const yo = query({
  args: {},
  handler: async (ctx) => {
    const usuario = await usuarioActual(ctx);
    if (usuario === null) return null;
    return {
      _id: usuario._id,
      nombre: usuario.name ?? "",
      email: usuario.email ?? "",
      foto: usuario.image,
      rol: rolDe(usuario),
    };
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

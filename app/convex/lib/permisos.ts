import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export type Rol = "jugador" | "duenio" | "admin";

export function rolDe(usuario: Doc<"users">): Rol {
  return usuario.rol ?? "jugador";
}

export async function usuarioActual(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  return userId === null ? null : await ctx.db.get(userId);
}

export async function requerirUsuario(ctx: QueryCtx): Promise<Doc<"users">> {
  const usuario = await usuarioActual(ctx);
  if (usuario === null) throw new ConvexError("Tenés que iniciar sesión.");
  return usuario;
}

export async function requerirAdmin(ctx: QueryCtx): Promise<Doc<"users">> {
  const usuario = await requerirUsuario(ctx);
  if (rolDe(usuario) !== "admin") throw new ConvexError("Solo el administrador puede hacer esto.");
  return usuario;
}

// El dueño del complejo o el admin.
export async function requerirGestorDe(
  ctx: QueryCtx,
  complejoId: Id<"complejos">,
): Promise<{ usuario: Doc<"users">; complejo: Doc<"complejos"> }> {
  const usuario = await requerirUsuario(ctx);
  const complejo = await ctx.db.get(complejoId);
  if (complejo === null) throw new ConvexError("El complejo no existe.");
  if (rolDe(usuario) !== "admin" && complejo.duenioId !== usuario._id) {
    throw new ConvexError("No tenés permiso sobre este complejo.");
  }
  return { usuario, complejo };
}

export async function requerirGestorDeCancha(ctx: QueryCtx, canchaId: Id<"canchas">) {
  const cancha = await ctx.db.get(canchaId);
  if (cancha === null) throw new ConvexError("La cancha no existe.");
  const { usuario, complejo } = await requerirGestorDe(ctx, cancha.complejoId);
  return { usuario, cancha, complejo };
}

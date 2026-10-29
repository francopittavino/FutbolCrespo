import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

// Nombre a mostrar: el que eligió en su perfil o, si no, el de Google.
export function nombreVisible(usuario: Doc<"users">): string {
  return usuario.nombrePerfil ?? usuario.name ?? usuario.email ?? "Jugador";
}

// Foto subida en el perfil o, si no, la de Google.
export async function fotoDe(ctx: QueryCtx, usuario: Doc<"users">): Promise<string | undefined> {
  if (usuario.fotoId) return (await ctx.storage.getUrl(usuario.fotoId)) ?? usuario.image;
  return usuario.image;
}

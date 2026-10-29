import { ConvexError } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { mutation, type MutationCtx } from "./_generated/server";
import { requerirUsuario } from "./lib/permisos";

const MAX_BYTES = 5 * 1024 * 1024;

// Paso 1 de una subida: la app pide una URL temporal y manda la imagen ahí.
export const generarUrlSubida = mutation({
  args: {},
  handler: async (ctx) => {
    await requerirUsuario(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// Paso 2: antes de guardar el archivo en un perfil o complejo se verifica que sea una imagen razonable.
// Si no lo es, se borra.
export async function validarImagen(ctx: MutationCtx, storageId: Id<"_storage">) {
  const archivo = await ctx.db.system.get(storageId);
  if (!archivo) throw new ConvexError("No encontramos la imagen subida.");
  if (!archivo.contentType?.startsWith("image/") || archivo.size > MAX_BYTES) {
    await ctx.storage.delete(storageId);
    throw new ConvexError("Subí una imagen (JPG o PNG) de hasta 5 MB.");
  }
}

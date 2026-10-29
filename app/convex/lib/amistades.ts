import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export async function sonAmigos(ctx: QueryCtx, a: Id<"users">, b: Id<"users">): Promise<boolean> {
  const [ida, vuelta] = await Promise.all([
    ctx.db.query("amistades").withIndex("by_par", (q) => q.eq("de", a).eq("para", b)).unique(),
    ctx.db.query("amistades").withIndex("by_par", (q) => q.eq("de", b).eq("para", a)).unique(),
  ]);
  return Boolean(ida?.aceptada || vuelta?.aceptada);
}

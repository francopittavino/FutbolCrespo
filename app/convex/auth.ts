import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";

// Google lee AUTH_GOOGLE_ID y AUTH_GOOGLE_SECRET de las variables de entorno de Convex.
// "Iniciar con Apple" se agrega cuando publiquemos en la App Store.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google],
});

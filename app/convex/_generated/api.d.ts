/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agenda from "../agenda.js";
import type * as amigos from "../amigos.js";
import type * as archivos from "../archivos.js";
import type * as auth from "../auth.js";
import type * as caja from "../caja.js";
import type * as canchas from "../canchas.js";
import type * as clientes from "../clientes.js";
import type * as complejos from "../complejos.js";
import type * as disponibilidad from "../disponibilidad.js";
import type * as http from "../http.js";
import type * as lib_amistades from "../lib/amistades.js";
import type * as lib_horas from "../lib/horas.js";
import type * as lib_perfil from "../lib/perfil.js";
import type * as lib_permisos from "../lib/permisos.js";
import type * as lib_turnos from "../lib/turnos.js";
import type * as partidos from "../partidos.js";
import type * as reportes from "../reportes.js";
import type * as reservas from "../reservas.js";
import type * as usuarios from "../usuarios.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agenda: typeof agenda;
  amigos: typeof amigos;
  archivos: typeof archivos;
  auth: typeof auth;
  caja: typeof caja;
  canchas: typeof canchas;
  clientes: typeof clientes;
  complejos: typeof complejos;
  disponibilidad: typeof disponibilidad;
  http: typeof http;
  "lib/amistades": typeof lib_amistades;
  "lib/horas": typeof lib_horas;
  "lib/perfil": typeof lib_perfil;
  "lib/permisos": typeof lib_permisos;
  "lib/turnos": typeof lib_turnos;
  partidos: typeof partidos;
  reportes: typeof reportes;
  reservas: typeof reservas;
  usuarios: typeof usuarios;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

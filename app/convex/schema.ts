import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Convenciones:
// - Fechas de turnos: string "YYYY-MM-DD" en hora de Argentina (America/Argentina/Buenos_Aires).
// - Horas: minutos desde la medianoche (ej. 20:30 -> 1230). Evita problemas de zona horaria.
// - Montos: pesos argentinos, números enteros.

const rol = v.union(v.literal("jugador"), v.literal("duenio"), v.literal("admin"));

const estadoReserva = v.union(
  v.literal("pendiente_pago"), // esperando la seña de Mercado Pago (vence en `vencePagoEn`)
  v.literal("confirmada"),
  v.literal("cancelada"),
  v.literal("completada"),
  v.literal("ausente"), // no se presentaron
);

const medioPago = v.union(
  v.literal("efectivo"),
  v.literal("transferencia"),
  v.literal("mercadopago"),
  v.literal("otro"),
);

export default defineSchema({
  ...authTables,

  // Reemplaza la tabla `users` de Convex Auth para agregarle el rol y el teléfono.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    rol: v.optional(rol), // sin rol = jugador
    // Perfil editable. Google vuelve a escribir `name` e `image` en cada ingreso, por eso van aparte.
    nombrePerfil: v.optional(v.string()),
    fotoId: v.optional(v.id("_storage")),
    telefono: v.optional(v.string()),
    posicion: v.optional(
      v.union(v.literal("arquero"), v.literal("defensor"), v.literal("mediocampista"), v.literal("delantero")),
    ),
  }).index("email", ["email"]),

  complejos: defineTable({
    nombre: v.string(),
    direccion: v.string(),
    telefono: v.optional(v.string()),
    whatsapp: v.optional(v.string()),
    descripcion: v.optional(v.string()),
    fotoId: v.optional(v.id("_storage")), // banner del complejo
    duenioId: v.optional(v.id("users")),
    activo: v.boolean(), // visible para los jugadores
    // Reglas que define cada dueño
    requiereSenia: v.boolean(),
    montoSenia: v.optional(v.number()),
    aliasPago: v.optional(v.string()), // alias/CBU para transferir la seña mientras no haya Mercado Pago
    minutosParaPagarSenia: v.number(), // después se libera el turno (para cuando se integre Mercado Pago)
    horasCancelacionGratis: v.number(), // cancelar antes de esto no pierde la seña
  })
    .index("by_duenio", ["duenioId"])
    .index("by_activo", ["activo"]),

  canchas: defineTable({
    complejoId: v.id("complejos"),
    nombre: v.string(), // "Cancha 1"
    jugadoresPorLado: v.number(), // 5, 7, ...
    superficie: v.optional(v.string()), // "sintético", "cemento"
    techada: v.boolean(),
    activa: v.boolean(),
  }).index("by_complejo", ["complejoId"]),

  // Horario de apertura de una cancha por día de la semana, con su precio.
  franjasHorarias: defineTable({
    canchaId: v.id("canchas"),
    diaSemana: v.number(), // 0 = domingo ... 6 = sábado
    inicio: v.number(),
    fin: v.number(), // puede pasar de 1440 si cierra después de medianoche
    duracionTurno: v.number(), // en minutos, ej. 60
    precio: v.number(),
  }).index("by_cancha_dia", ["canchaId", "diaSemana"]),

  reservas: defineTable({
    complejoId: v.id("complejos"),
    canchaId: v.id("canchas"),
    fecha: v.string(),
    inicio: v.number(),
    fin: v.number(),
    estado: estadoReserva,
    origen: v.union(v.literal("app"), v.literal("complejo"), v.literal("turno_fijo")),
    jugadorId: v.optional(v.id("users")), // si reservó desde la app
    clienteId: v.optional(v.id("clientes")), // si la cargó el complejo
    nombreContacto: v.string(),
    telefonoContacto: v.optional(v.string()),
    precio: v.number(),
    montoSenia: v.optional(v.number()),
    seniaPagada: v.boolean(),
    vencePagoEn: v.optional(v.number()), // timestamp, solo en "pendiente_pago"
    turnoFijoId: v.optional(v.id("turnosFijos")),
    canceladaPor: v.optional(v.union(v.literal("jugador"), v.literal("complejo"), v.literal("sistema"))),
  })
    .index("by_cancha_fecha", ["canchaId", "fecha"])
    .index("by_complejo_fecha", ["complejoId", "fecha"])
    .index("by_jugador", ["jugadorId"]),

  // Horarios cerrados puntualmente (mantenimiento, torneo, feriado).
  bloqueos: defineTable({
    canchaId: v.id("canchas"),
    fecha: v.string(),
    inicio: v.number(),
    fin: v.number(),
    motivo: v.optional(v.string()),
  }).index("by_cancha_fecha", ["canchaId", "fecha"]),

  clientes: defineTable({
    complejoId: v.id("complejos"),
    nombre: v.string(),
    telefono: v.optional(v.string()),
    notas: v.optional(v.string()),
    userId: v.optional(v.id("users")), // si además usa la app
  }).index("by_complejo", ["complejoId"]),

  turnosFijos: defineTable({
    complejoId: v.id("complejos"),
    canchaId: v.id("canchas"),
    clienteId: v.id("clientes"),
    diaSemana: v.number(),
    inicio: v.number(),
    fin: v.number(),
    desde: v.string(), // fecha de inicio
    hasta: v.optional(v.string()),
    activo: v.boolean(),
  })
    .index("by_complejo", ["complejoId"])
    .index("by_cancha_dia", ["canchaId", "diaSemana"]),

  movimientosCaja: defineTable({
    complejoId: v.id("complejos"),
    fecha: v.string(),
    tipo: v.union(v.literal("ingreso"), v.literal("egreso")),
    monto: v.number(),
    medio: medioPago,
    concepto: v.string(),
    reservaId: v.optional(v.id("reservas")),
    clienteId: v.optional(v.id("clientes")),
    registradoPor: v.id("users"),
  }).index("by_complejo_fecha", ["complejoId", "fecha"]),

  // Partido armado sobre una reserva: jugadores, equipos (opcionales) y resultado.
  partidos: defineTable({
    reservaId: v.id("reservas"),
    organizadorId: v.id("users"), // el que reservó: el único que arma equipos y carga el resultado
    complejoId: v.id("complejos"),
    canchaId: v.id("canchas"),
    fecha: v.string(),
    inicio: v.number(),
    codigoInvitacion: v.string(), // para el link "sumate al partido"
    nombreEquipoA: v.string(),
    nombreEquipoB: v.string(),
    golesA: v.optional(v.number()),
    golesB: v.optional(v.number()),
  })
    .index("by_reserva", ["reservaId"])
    .index("by_codigo", ["codigoInvitacion"]),

  // Jugadores de un partido. Con `userId` suman estadísticas; sin `userId` son invitados (solo nombre).
  jugadoresPartido: defineTable({
    partidoId: v.id("partidos"),
    userId: v.optional(v.id("users")),
    nombre: v.string(),
    equipo: v.optional(v.union(v.literal("A"), v.literal("B"))),
  })
    .index("by_partido", ["partidoId"])
    .index("by_user", ["userId"])
    .index("by_partido_user", ["partidoId", "userId"]),

  // Amistad entre dos usuarios: `de` la pidió, `para` la acepta.
  amistades: defineTable({
    de: v.id("users"),
    para: v.id("users"),
    aceptada: v.boolean(),
  })
    .index("by_de", ["de"])
    .index("by_para", ["para"])
    .index("by_par", ["de", "para"]),

  favoritos: defineTable({
    userId: v.id("users"),
    complejoId: v.id("complejos"),
  })
    .index("by_user", ["userId"])
    .index("by_user_complejo", ["userId", "complejoId"]),
});

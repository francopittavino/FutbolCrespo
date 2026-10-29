/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, vi } from 'vitest';

import type { Id } from './_generated/dataModel';
import schema from './schema';

export const modules = import.meta.glob('./**/*.ts');

// Jueves 29/10/2026 a las 12:00 de Argentina (15:00 UTC).
export const AHORA = new Date('2026-10-29T15:00:00Z');
export const HOY = '2026-10-29';
export const MANIANA = '2026-10-30'; // viernes

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AHORA);
});
afterEach(() => {
  vi.useRealTimers();
});

export async function preparar() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const admin = await ctx.db.insert('users', { name: 'Admin', email: 'admin@x.com', rol: 'admin' });
    const ana = await ctx.db.insert('users', { name: 'Ana', email: 'ana@x.com' });
    const beto = await ctx.db.insert('users', { name: 'Beto', email: 'beto@x.com' });
    const complejoId = await ctx.db.insert('complejos', {
      nombre: 'La Canchita',
      direccion: 'San Martín 1',
      activo: true,
      requiereSenia: false,
      minutosParaPagarSenia: 15,
      horasCancelacionGratis: 6,
    });
    const canchaId = await ctx.db.insert('canchas', {
      complejoId,
      nombre: 'Cancha 1',
      jugadoresPorLado: 5,
      techada: false,
      activa: true,
    });
    // Todos los días de 18 a 24, turnos de 1 hora.
    for (let dia = 0; dia < 7; dia++) {
      await ctx.db.insert('franjasHorarias', {
        canchaId,
        diaSemana: dia,
        inicio: 18 * 60,
        fin: 24 * 60,
        duracionTurno: 60,
        precio: 20000,
      });
    }
    return { admin, ana, beto, complejoId, canchaId };
  });
  const como = (userId: Id<'users'>) => t.withIdentity({ subject: `${userId}|sesion` });
  return { t, ...ids, como };
}

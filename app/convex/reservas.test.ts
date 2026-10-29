import type { convexTest } from 'convex-test';
import { describe, expect, test, vi } from 'vitest';

import { api } from './_generated/api';
import { HOY, MANIANA, preparar } from './prueba.helpers';

async function libres(t: ReturnType<typeof convexTest>, fecha: string) {
  const datos = await t.query(api.disponibilidad.delDia, { fecha });
  return datos[0].canchas[0].turnos.filter((x) => x.libre).map((x) => x.inicio);
}

describe('reservas', () => {
  test('un turno libre se reserva y deja de aparecer como libre', async () => {
    const { t, ana, canchaId, como } = await preparar();
    expect(await libres(t, MANIANA)).toEqual([1080, 1140, 1200, 1260, 1320, 1380]);

    await como(ana).mutation(api.reservas.reservar, { canchaId, fecha: MANIANA, inicio: 1200 });

    expect(await libres(t, MANIANA)).toEqual([1080, 1140, 1260, 1320, 1380]);
    const mias = await como(ana).query(api.reservas.misReservas, {});
    expect(mias).toHaveLength(1);
    expect(mias[0]).toMatchObject({ fecha: MANIANA, inicio: 1200, fin: 1260, precio: 20000, estado: 'confirmada' });
  });

  test('nadie puede reservar un turno ya ocupado', async () => {
    const { ana, beto, canchaId, como } = await preparar();
    await como(ana).mutation(api.reservas.reservar, { canchaId, fecha: MANIANA, inicio: 1200 });
    await expect(
      como(beto).mutation(api.reservas.reservar, { canchaId, fecha: MANIANA, inicio: 1200 }),
    ).rejects.toThrow(/alguien reservó ese turno/);
    expect(await como(beto).query(api.reservas.misReservas, {})).toHaveLength(0);
  });

  test('hay que iniciar sesión para reservar', async () => {
    const { t, canchaId } = await preparar();
    await expect(t.mutation(api.reservas.reservar, { canchaId, fecha: MANIANA, inicio: 1200 })).rejects.toThrow(
      /iniciar sesión/,
    );
  });

  test('no se puede reservar un turno que ya pasó ni un horario inexistente', async () => {
    const { ana, canchaId, como } = await preparar();
    await expect(
      como(ana).mutation(api.reservas.reservar, { canchaId, fecha: '2026-10-28', inicio: 1200 }),
    ).rejects.toThrow(/desde hoy/);
    // Hoy a las 18:00 todavía no pasó (son las 12:00), pero un horario fuera de la grilla no existe.
    await expect(
      como(ana).mutation(api.reservas.reservar, { canchaId, fecha: HOY, inicio: 1110 }),
    ).rejects.toThrow(/no existe/);
    await como(ana).mutation(api.reservas.reservar, { canchaId, fecha: HOY, inicio: 1080 });

    vi.setSystemTime(new Date('2026-10-29T22:30:00Z')); // 19:30 en Argentina
    await expect(
      como(ana).mutation(api.reservas.reservar, { canchaId, fecha: HOY, inicio: 1140 }),
    ).rejects.toThrow(/ya pasó/);
  });

  test('cancelar libera el turno para otro jugador', async () => {
    const { t, ana, beto, canchaId, como } = await preparar();
    const reservaId = await como(ana).mutation(api.reservas.reservar, { canchaId, fecha: MANIANA, inicio: 1200 });

    await expect(como(beto).mutation(api.reservas.cancelar, { reservaId })).rejects.toThrow(/No encontramos/);
    await como(ana).mutation(api.reservas.cancelar, { reservaId });

    expect(await libres(t, MANIANA)).toContain(1200);
    await como(beto).mutation(api.reservas.reservar, { canchaId, fecha: MANIANA, inicio: 1200 });
  });

  test('un jugador no puede tener más de 3 reservas activas', async () => {
    const { ana, canchaId, como } = await preparar();
    for (const inicio of [1080, 1140, 1200]) {
      await como(ana).mutation(api.reservas.reservar, { canchaId, fecha: MANIANA, inicio });
    }
    await expect(
      como(ana).mutation(api.reservas.reservar, { canchaId, fecha: MANIANA, inicio: 1260 }),
    ).rejects.toThrow(/hasta 3 reservas/);
  });

  test('los turnos fijos y los bloqueos ocupan el horario', async () => {
    const { t, complejoId, canchaId } = await preparar();
    await t.run(async (ctx) => {
      const clienteId = await ctx.db.insert('clientes', { complejoId, nombre: 'Los del viernes' });
      await ctx.db.insert('turnosFijos', {
        complejoId,
        canchaId,
        clienteId,
        diaSemana: 5, // viernes
        inicio: 1260,
        fin: 1320,
        desde: HOY,
        activo: true,
      });
      await ctx.db.insert('bloqueos', { canchaId, fecha: MANIANA, inicio: 1080, fin: 1200 });
    });
    expect(await libres(t, MANIANA)).toEqual([1200, 1320, 1380]);
    // El sábado el turno fijo no aplica y no hay bloqueos.
    expect(await libres(t, '2026-10-31')).toEqual([1080, 1140, 1200, 1260, 1320, 1380]);
  });

  test('un complejo oculto no aparece ni se puede reservar', async () => {
    const { t, ana, complejoId, canchaId, como } = await preparar();
    await t.run((ctx) => ctx.db.patch(complejoId, { activo: false }));
    expect(await t.query(api.disponibilidad.delDia, { fecha: MANIANA })).toEqual([]);
    await expect(
      como(ana).mutation(api.reservas.reservar, { canchaId, fecha: MANIANA, inicio: 1200 }),
    ).rejects.toThrow(/no está disponible/);
  });
});

describe('gestión', () => {
  test('solo el admin crea complejos y solo el dueño o el admin los editan', async () => {
    const { admin, ana, beto, como } = await preparar();
    await expect(
      como(ana).mutation(api.complejos.crear, { nombre: 'Trucho', direccion: 'X' }),
    ).rejects.toThrow(/Solo el administrador/);

    const complejoId = await como(admin).mutation(api.complejos.crear, { nombre: 'Nuevo', direccion: 'Y' });
    await como(admin).mutation(api.complejos.asignarDuenio, { complejoId, email: 'ana@x.com' });
    expect((await como(ana).query(api.usuarios.yo, {}))?.rol).toBe('duenio');

    await como(ana).mutation(api.canchas.crear, { complejoId, nombre: 'C1', jugadoresPorLado: 5, techada: false });
    await expect(
      como(beto).mutation(api.canchas.crear, { complejoId, nombre: 'C2', jugadoresPorLado: 5, techada: false }),
    ).rejects.toThrow(/No tenés permiso/);
  });

  test('si el complejo pide seña tiene que indicar el alias, y el jugador lo ve', async () => {
    const { t, admin, complejoId, como } = await preparar();
    const base = {
      complejoId,
      nombre: 'La Canchita',
      direccion: 'San Martín 1',
      requiereSenia: true,
      montoSenia: 5000,
      minutosParaPagarSenia: 15,
      horasCancelacionGratis: 6,
    };
    await expect(como(admin).mutation(api.complejos.actualizar, base)).rejects.toThrow(/alias/);
    await como(admin).mutation(api.complejos.actualizar, { ...base, aliasPago: '  canchita.crespo ' });
    const [{ complejo }] = await t.query(api.disponibilidad.delDia, { fecha: MANIANA });
    expect(complejo).toMatchObject({ requiereSenia: true, montoSenia: 5000, aliasPago: 'canchita.crespo' });
  });

  test('no se pueden cargar horarios superpuestos', async () => {
    const { admin, canchaId, como } = await preparar();
    await expect(
      como(admin).mutation(api.canchas.agregarFranjas, {
        canchaId,
        dias: [1, 2],
        inicio: 20 * 60,
        fin: 23 * 60,
        duracionTurno: 60,
        precio: 1,
      }),
    ).rejects.toThrow(/se superpone/);
  });
});

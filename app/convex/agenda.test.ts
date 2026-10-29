import { describe, expect, test, vi } from 'vitest';

import { api } from './_generated/api';
import { HOY, MANIANA, preparar } from './prueba.helpers';

const PROXIMO_VIERNES = '2026-11-06';

async function celdas(p: Awaited<ReturnType<typeof preparar>>, fecha: string) {
  const agenda = await p.como(p.admin).query(api.agenda.delDia, { complejoId: p.complejoId, fecha });
  return Object.fromEntries(agenda.canchas[0].turnos.map((t) => [t.inicio, t.celda]));
}

async function libresParaJugadores(p: Awaited<ReturnType<typeof preparar>>, fecha: string) {
  const datos = await p.t.query(api.disponibilidad.delDia, { fecha });
  return datos[0].canchas[0].turnos.filter((x) => x.libre).map((x) => x.inicio);
}

describe('agenda del complejo', () => {
  test('muestra reservas de la app, reservas manuales y bloqueos', async () => {
    const p = await preparar();
    await p.como(p.ana).mutation(api.reservas.reservar, { canchaId: p.canchaId, fecha: MANIANA, inicio: 1080 });
    await p.como(p.admin).mutation(api.agenda.reservarManual, {
      canchaId: p.canchaId,
      fecha: MANIANA,
      inicio: 1140,
      nombre: 'Carlos',
      telefono: '343111',
      guardarCliente: true,
    });
    await p.como(p.admin).mutation(api.agenda.bloquear, {
      canchaId: p.canchaId,
      fecha: MANIANA,
      inicio: 1200,
      motivo: 'Mantenimiento',
    });

    const c = await celdas(p, MANIANA);
    expect(c[1080]).toMatchObject({ tipo: 'reserva', nombre: 'Ana', origen: 'app' });
    expect(c[1140]).toMatchObject({ tipo: 'reserva', nombre: 'Carlos', telefono: '343111', origen: 'complejo' });
    expect(c[1200]).toMatchObject({ tipo: 'bloqueo', motivo: 'Mantenimiento' });
    expect(c[1260]).toEqual({ tipo: 'libre' });

    // El cliente nuevo quedó guardado.
    const clientes = await p.como(p.admin).query(api.clientes.listar, { complejoId: p.complejoId });
    expect(clientes.map((x) => x.nombre)).toEqual(['Carlos']);

    // No se puede reservar ni bloquear algo ocupado.
    await expect(
      p.como(p.admin).mutation(api.agenda.bloquear, { canchaId: p.canchaId, fecha: MANIANA, inicio: 1080 }),
    ).rejects.toThrow(/ocupado/);
  });

  test('un jugador o un dueño ajeno no ven la agenda', async () => {
    const p = await preparar();
    await expect(
      p.como(p.ana).query(api.agenda.delDia, { complejoId: p.complejoId, fecha: MANIANA }),
    ).rejects.toThrow(/No tenés permiso/);
  });

  test('cancelar desde el complejo libera el turno', async () => {
    const p = await preparar();
    const reservaId = await p
      .como(p.ana)
      .mutation(api.reservas.reservar, { canchaId: p.canchaId, fecha: MANIANA, inicio: 1080 });
    await p.como(p.admin).mutation(api.agenda.cambiarEstado, { reservaId, estado: 'cancelada' });
    expect(await libresParaJugadores(p, MANIANA)).toContain(1080);
    const [mia] = await p.como(p.ana).query(api.reservas.misReservas, {});
    expect(mia.estado).toBe('cancelada');
  });
});

describe('turnos fijos', () => {
  async function conTurnoFijo() {
    const p = await preparar();
    const clienteId = await p
      .como(p.admin)
      .mutation(api.clientes.crear, { complejoId: p.complejoId, nombre: 'Los del viernes', telefono: '343222' });
    const turnoFijoId = await p.como(p.admin).mutation(api.clientes.crearTurnoFijo, {
      canchaId: p.canchaId,
      clienteId,
      diaSemana: 5,
      inicio: 1260,
      desde: MANIANA,
    });
    return { ...p, clienteId, turnoFijoId };
  }

  test('ocupa el horario todas las semanas', async () => {
    const p = await conTurnoFijo();
    for (const fecha of [MANIANA, PROXIMO_VIERNES]) {
      expect((await celdas(p, fecha))[1260]).toMatchObject({ tipo: 'fijo', nombre: 'Los del viernes' });
      expect(await libresParaJugadores(p, fecha)).not.toContain(1260);
    }
    // Otro día de la semana no se ve afectado.
    expect(await libresParaJugadores(p, '2026-10-31')).toContain(1260);
  });

  test('liberar un día deja reservar solo ese día', async () => {
    const p = await conTurnoFijo();
    await p.como(p.admin).mutation(api.agenda.registrarTurnoFijo, {
      turnoFijoId: p.turnoFijoId,
      fecha: MANIANA,
      estado: 'cancelada',
    });
    expect(await libresParaJugadores(p, MANIANA)).toContain(1260);
    expect(await libresParaJugadores(p, PROXIMO_VIERNES)).not.toContain(1260);
    await p.como(p.beto).mutation(api.reservas.reservar, { canchaId: p.canchaId, fecha: MANIANA, inicio: 1260 });
  });

  test('registrar que jugaron lo deja como reserva completada', async () => {
    const p = await conTurnoFijo();
    await p.como(p.admin).mutation(api.agenda.registrarTurnoFijo, {
      turnoFijoId: p.turnoFijoId,
      fecha: MANIANA,
      estado: 'completada',
    });
    expect((await celdas(p, MANIANA))[1260]).toMatchObject({
      tipo: 'reserva',
      estado: 'completada',
      origen: 'turno_fijo',
    });
    await expect(
      p.como(p.admin).mutation(api.agenda.registrarTurnoFijo, {
        turnoFijoId: p.turnoFijoId,
        fecha: MANIANA,
        estado: 'completada',
      }),
    ).rejects.toThrow(/ya fue registrado/);
  });

  test('no se crea un turno fijo encima de una reserva existente ni de otro fijo', async () => {
    const p = await conTurnoFijo();
    await p.como(p.ana).mutation(api.reservas.reservar, { canchaId: p.canchaId, fecha: PROXIMO_VIERNES, inicio: 1320 });
    await expect(
      p.como(p.admin).mutation(api.clientes.crearTurnoFijo, {
        canchaId: p.canchaId,
        clienteId: p.clienteId,
        diaSemana: 5,
        inicio: 1320,
        desde: MANIANA,
      }),
    ).rejects.toThrow(/06\/11\/2026 a las 22:00 ya está reservado por Ana/);
    await expect(
      p.como(p.admin).mutation(api.clientes.crearTurnoFijo, {
        canchaId: p.canchaId,
        clienteId: p.clienteId,
        diaSemana: 5,
        inicio: 1260,
        desde: MANIANA,
      }),
    ).rejects.toThrow(/Ya hay un turno fijo/);
    await expect(
      p.como(p.admin).mutation(api.clientes.crearTurnoFijo, {
        canchaId: p.canchaId,
        clienteId: p.clienteId,
        diaSemana: 5,
        inicio: 1260,
        desde: HOY, // es jueves
      }),
    ).rejects.toThrow(/tiene que ser un Viernes/);
  });

  test('finalizar un turno fijo libera las semanas siguientes', async () => {
    const p = await conTurnoFijo();
    vi.setSystemTime(new Date('2026-11-04T15:00:00Z')); // miércoles siguiente
    await p.como(p.admin).mutation(api.clientes.finalizarTurnoFijo, { turnoFijoId: p.turnoFijoId });
    expect(await libresParaJugadores(p, PROXIMO_VIERNES)).toContain(1260);
    // El viernes que ya pasó sigue figurando como turno fijo en la agenda.
    expect((await celdas(p, MANIANA))[1260]).toMatchObject({ tipo: 'fijo' });
    expect(await p.como(p.admin).query(api.clientes.turnosFijos, { complejoId: p.complejoId })).toEqual([]);
  });
});

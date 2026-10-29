import { describe, expect, test } from 'vitest';

import { api } from './_generated/api';
import { HOY, MANIANA, preparar } from './prueba.helpers';

async function reservaManual(
  p: Awaited<ReturnType<typeof preparar>>,
  fecha: string,
  inicio: number,
  nombre = 'Carlos',
) {
  return await p
    .como(p.admin)
    .mutation(api.agenda.reservarManual, { canchaId: p.canchaId, fecha, inicio, nombre, guardarCliente: false });
}

describe('caja', () => {
  test('cobrar un turno lo anota en la caja de hoy y la agenda muestra lo cobrado', async () => {
    const p = await preparar();
    const reservaId = await reservaManual(p, MANIANA, 1080);
    await p.como(p.admin).mutation(api.caja.cobrarTurno, { reservaId, monto: 15000, medio: 'efectivo' });
    await p
      .como(p.admin)
      .mutation(api.caja.registrar, {
        complejoId: p.complejoId,
        fecha: HOY,
        tipo: 'egreso',
        monto: 3000,
        medio: 'efectivo',
        concepto: 'Hielo',
      });

    const caja = await p.como(p.admin).query(api.caja.delDia, { complejoId: p.complejoId, fecha: HOY });
    expect(caja.totales).toMatchObject({ ingresos: 15000, egresos: 3000, saldo: 12000 });
    expect(caja.totales.porMedio.efectivo).toBe(12000);
    expect(caja.movimientos.map((m) => m.concepto)).toContain('Turno · Cancha 1 18:00 · Carlos');

    const agenda = await p.como(p.admin).query(api.agenda.delDia, { complejoId: p.complejoId, fecha: MANIANA });
    expect(agenda.canchas[0].turnos[0].celda).toMatchObject({ tipo: 'reserva', precio: 20000, cobrado: 15000 });
  });

  test('marcar la seña la cobra por transferencia; desmarcarla la saca de la caja', async () => {
    const p = await preparar();
    await p.t.run(async (ctx) => {
      await ctx.db.patch(p.complejoId, { requiereSenia: true, montoSenia: 5000 });
    });
    const reservaId = await p
      .como(p.ana)
      .mutation(api.reservas.reservar, { canchaId: p.canchaId, fecha: MANIANA, inicio: 1140 });

    await p.como(p.admin).mutation(api.agenda.marcarSenia, { reservaId, pagada: true });
    let caja = await p.como(p.admin).query(api.caja.delDia, { complejoId: p.complejoId, fecha: HOY });
    expect(caja.totales.porMedio.transferencia).toBe(5000);

    await p.como(p.admin).mutation(api.agenda.marcarSenia, { reservaId, pagada: false });
    caja = await p.como(p.admin).query(api.caja.delDia, { complejoId: p.complejoId, fecha: HOY });
    expect(caja.movimientos).toHaveLength(0);
  });

  test('solo el dueño o el admin manejan la caja', async () => {
    const p = await preparar();
    await expect(p.como(p.ana).query(api.caja.delDia, { complejoId: p.complejoId, fecha: HOY })).rejects.toThrow(
      /No tenés permiso/,
    );
    await expect(
      p
        .como(p.admin)
        .mutation(api.caja.registrar, {
          complejoId: p.complejoId,
          fecha: HOY,
          tipo: 'ingreso',
          monto: -5,
          medio: 'otro',
          concepto: 'x',
        }),
    ).rejects.toThrow(/mayor a cero/);
  });
});

describe('cada dueño ve solo lo suyo', () => {
  test('un dueño no puede ver ni tocar el complejo de otro', async () => {
    const p = await preparar();
    // La Canchita es de Beto; Ana es dueña de otro complejo.
    const otroId = await p.t.run(async (ctx) => {
      await ctx.db.patch(p.complejoId, { duenioId: p.beto });
      await ctx.db.patch(p.beto, { rol: 'duenio' });
      await ctx.db.patch(p.ana, { rol: 'duenio' });
      return await ctx.db.insert('complejos', {
        nombre: 'El Potrero',
        direccion: 'Belgrano 2',
        duenioId: p.ana,
        activo: true,
        requiereSenia: false,
        minutosParaPagarSenia: 15,
        horasCancelacionGratis: 6,
      });
    });
    const reservaId = await reservaManual(p, HOY, 1080);

    const mios = await p.como(p.ana).query(api.complejos.misComplejos, {});
    expect(mios.map((c) => c._id)).toEqual([otroId]);

    const ana = p.como(p.ana);
    const ajeno = { complejoId: p.complejoId };
    await expect(ana.query(api.complejos.detalle, ajeno)).rejects.toThrow(/No tenés permiso/);
    await expect(ana.query(api.agenda.delDia, { ...ajeno, fecha: HOY })).rejects.toThrow(/No tenés permiso/);
    await expect(ana.query(api.caja.delDia, { ...ajeno, fecha: HOY })).rejects.toThrow(/No tenés permiso/);
    await expect(ana.query(api.reportes.resumen, { ...ajeno, desde: HOY, hasta: HOY })).rejects.toThrow(
      /No tenés permiso/,
    );
    await expect(ana.query(api.clientes.listar, ajeno)).rejects.toThrow(/No tenés permiso/);
    await expect(ana.mutation(api.caja.cobrarTurno, { reservaId, monto: 1000, medio: 'efectivo' })).rejects.toThrow(
      /No tenés permiso/,
    );
    await expect(ana.mutation(api.agenda.cambiarEstado, { reservaId, estado: 'cancelada' })).rejects.toThrow(
      /No tenés permiso/,
    );

    // Beto sí maneja el suyo.
    await p.como(p.beto).mutation(api.caja.cobrarTurno, { reservaId, monto: 1000, medio: 'efectivo' });
    const caja = await p.como(p.beto).query(api.caja.delDia, { ...ajeno, fecha: HOY });
    expect(caja.totales.ingresos).toBe(1000);
  });
});

describe('reportes', () => {
  test('ocupación, turnos fijos, horarios más pedidos y lo que falta cobrar', async () => {
    const p = await preparar();
    // Ayer (miércoles) jugaron dos turnos: uno pagó todo (se cobró hoy), el otro nada.
    const ayer = '2026-10-28';
    const pago = await reservaManual(p, ayer, 1200, 'Carlos');
    const debe = await reservaManual(p, ayer, 1260, 'Dani');
    await p.como(p.admin).mutation(api.agenda.cambiarEstado, { reservaId: pago, estado: 'completada' });
    await p.como(p.admin).mutation(api.agenda.cambiarEstado, { reservaId: debe, estado: 'completada' });
    await p.como(p.admin).mutation(api.caja.cobrarTurno, { reservaId: pago, monto: 20000, medio: 'efectivo' });
    // Un turno fijo los miércoles a las 18:00 que nunca se registró en la agenda.
    const clienteId = await p
      .como(p.admin)
      .mutation(api.clientes.crear, { complejoId: p.complejoId, nombre: 'Los del miércoles' });
    await p
      .como(p.admin)
      .mutation(api.clientes.crearTurnoFijo, {
        canchaId: p.canchaId,
        clienteId,
        diaSemana: 3,
        inicio: 1080,
        desde: ayer,
      });

    const r = await p.como(p.admin).query(api.reportes.resumen, { complejoId: p.complejoId, desde: ayer, hasta: HOY });
    expect(r.turnos.total).toBe(12); // de 18 a 24, dos días
    expect(r.turnos.ocupados).toBe(3);
    expect(r.turnos.porOrigen).toEqual({ app: 0, complejo: 2, turnoFijo: 1 });
    expect(r.clientes.map((c) => c.nombre)).toContain('Los del miércoles');
    expect(r.turnos.jugados).toBe(2);
    expect(r.dinero.ingresos).toBe(20000);
    expect(r.porCobrar.total).toBe(20000);
    expect(r.porCobrar.turnos[0]).toMatchObject({ nombre: 'Dani', saldo: 20000 });
    expect(r.horarios.map((h) => h.inicio)).toContain(1260);
  });

  test('no acepta períodos de más de 3 meses', async () => {
    const p = await preparar();
    await expect(
      p.como(p.admin).query(api.reportes.resumen, { complejoId: p.complejoId, desde: '2026-01-01', hasta: HOY }),
    ).rejects.toThrow(/3 meses/);
  });
});

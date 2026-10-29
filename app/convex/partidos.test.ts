import { describe, expect, test, vi } from 'vitest';

import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { MANIANA, preparar } from './prueba.helpers';

// Ana reserva para mañana a las 20 y arma el partido.
async function conPartido() {
  const p = await preparar();
  const reservaId = await p.como(p.ana).mutation(api.reservas.reservar, { canchaId: p.canchaId, fecha: MANIANA, inicio: 1200 });
  const partidoId = await p.como(p.ana).mutation(api.partidos.crear, { reservaId });
  const { codigoInvitacion } = await p.como(p.ana).query(api.partidos.detalle, { partidoId });
  return { ...p, reservaId, partidoId, codigo: codigoInvitacion };
}

// Avanza el reloj hasta después del partido (mañana 20:00 Argentina = 23:00 UTC).
function despuesDelPartido() {
  vi.setSystemTime(new Date('2026-10-30T23:30:00Z'));
}

async function jugadorIdDe(p: Awaited<ReturnType<typeof conPartido>>, nombre: string): Promise<Id<'jugadoresPartido'>> {
  const { jugadores } = await p.como(p.ana).query(api.partidos.detalle, { partidoId: p.partidoId });
  return jugadores.find((j) => j.nombre === nombre)!._id;
}

describe('partidos', () => {
  test('el que reservó arma el partido y queda anotado; crear de nuevo devuelve el mismo', async () => {
    const p = await conPartido();
    expect(await p.como(p.ana).mutation(api.partidos.crear, { reservaId: p.reservaId })).toBe(p.partidoId);
    const detalle = await p.como(p.ana).query(api.partidos.detalle, { partidoId: p.partidoId });
    expect(detalle).toMatchObject({ soyOrganizador: true, complejo: 'La Canchita', cancha: 'Cancha 1', organizador: 'Ana' });
    expect(detalle.jugadores.map((j) => j.nombre)).toEqual(['Ana']);
    await expect(p.como(p.beto).mutation(api.partidos.crear, { reservaId: p.reservaId })).rejects.toThrow(/No encontramos/);
  });

  test('con el link se suma cualquiera con cuenta; sin estar anotado no se ve el partido', async () => {
    const p = await conPartido();
    await expect(p.como(p.beto).query(api.partidos.detalle, { partidoId: p.partidoId })).rejects.toThrow(/No estás anotado/);

    const invitacion = await p.t.query(api.partidos.porCodigo, { codigo: p.codigo });
    expect(invitacion).toMatchObject({ organizador: 'Ana', anotados: 1, cupo: 14, yaEstoy: false });

    await p.como(p.beto).mutation(api.partidos.sumarme, { codigo: p.codigo });
    await p.como(p.beto).mutation(api.partidos.sumarme, { codigo: p.codigo }); // dos veces no duplica
    const detalle = await p.como(p.beto).query(api.partidos.detalle, { partidoId: p.partidoId });
    expect(detalle.jugadores.map((j) => j.nombre)).toEqual(['Ana', 'Beto']);
    expect(detalle.soyOrganizador).toBe(false);
    await expect(p.t.mutation(api.partidos.sumarme, { codigo: 'inventado' })).rejects.toThrow();
  });

  test('solo el organizador agrega invitados, arma equipos y carga el resultado', async () => {
    const p = await conPartido();
    await p.como(p.beto).mutation(api.partidos.sumarme, { codigo: p.codigo });
    await p.como(p.ana).mutation(api.partidos.agregarInvitado, { partidoId: p.partidoId, nombre: 'Primo de Ana' });

    await expect(
      p.como(p.beto).mutation(api.partidos.agregarInvitado, { partidoId: p.partidoId, nombre: 'X' }),
    ).rejects.toThrow(/Solo el que organiza/);
    const betoId = await jugadorIdDe(p, 'Beto');
    await expect(p.como(p.beto).mutation(api.partidos.asignarEquipo, { jugadorId: betoId, equipo: 'A' })).rejects.toThrow(
      /Solo el que organiza/,
    );

    await p.como(p.ana).mutation(api.partidos.asignarEquipo, { jugadorId: betoId, equipo: 'B' });
    despuesDelPartido();
    await expect(
      p.como(p.beto).mutation(api.partidos.cargarResultado, { partidoId: p.partidoId, golesA: 1, golesB: 0 }),
    ).rejects.toThrow(/Solo el que organiza/);
    await p.como(p.ana).mutation(api.partidos.cargarResultado, { partidoId: p.partidoId, golesA: 3, golesB: 5 });
    expect(await p.como(p.beto).query(api.partidos.detalle, { partidoId: p.partidoId })).toMatchObject({ golesA: 3, golesB: 5 });
  });

  test('el resultado no se carga antes de que empiece el partido', async () => {
    const p = await conPartido();
    await expect(
      p.como(p.ana).mutation(api.partidos.cargarResultado, { partidoId: p.partidoId, golesA: 1, golesB: 0 }),
    ).rejects.toThrow(/una vez que empezó/);
  });

  test('un jugador se puede bajar; el organizador no', async () => {
    const p = await conPartido();
    await p.como(p.beto).mutation(api.partidos.sumarme, { codigo: p.codigo });
    await p.como(p.beto).mutation(api.partidos.quitarJugador, { jugadorId: await jugadorIdDe(p, 'Beto') });
    await expect(
      p.como(p.ana).mutation(api.partidos.quitarJugador, { jugadorId: await jugadorIdDe(p, 'Ana') }),
    ).rejects.toThrow(/no se puede bajar/);
  });
});

describe('amigos', () => {
  test('solicitud, aceptación y agregar al amigo a un partido', async () => {
    const p = await conPartido();
    await expect(p.como(p.ana).mutation(api.partidos.agregarAmigo, { partidoId: p.partidoId, amigoId: p.beto })).rejects.toThrow(
      /Solo podés agregar a tus amigos/,
    );

    expect(await p.como(p.ana).mutation(api.amigos.enviarSolicitud, { userId: p.beto })).toBe('pendiente');
    const deBeto = await p.como(p.beto).query(api.amigos.misAmigos, {});
    expect(deBeto?.recibidas.map((r) => r.nombre)).toEqual(['Ana']);
    await p.como(p.beto).mutation(api.amigos.responder, { amistadId: deBeto!.recibidas[0].amistadId, aceptar: true });

    expect((await p.como(p.ana).query(api.amigos.misAmigos, {}))?.amigos.map((a) => a.nombre)).toEqual(['Beto']);
    await p.como(p.ana).mutation(api.partidos.agregarAmigo, { partidoId: p.partidoId, amigoId: p.beto });
    const detalle = await p.como(p.beto).query(api.partidos.detalle, { partidoId: p.partidoId });
    expect(detalle.jugadores.map((j) => j.nombre)).toEqual(['Ana', 'Beto']);
  });

  test('si los dos se mandan solicitud, quedan amigos; los compañeros aparecen como sugerencia', async () => {
    const p = await conPartido();
    await p.como(p.beto).mutation(api.partidos.sumarme, { codigo: p.codigo });
    expect((await p.como(p.ana).query(api.amigos.companeros, {})).map((c) => c.nombre)).toEqual(['Beto']);

    await p.como(p.ana).mutation(api.amigos.enviarSolicitud, { userId: p.beto });
    expect(await p.como(p.beto).mutation(api.amigos.enviarSolicitud, { userId: p.ana })).toBe('amigos');
    expect(await p.como(p.ana).query(api.amigos.companeros, {})).toEqual([]);
    await expect(p.como(p.ana).mutation(api.amigos.enviarSolicitud, { userId: p.ana })).rejects.toThrow(/vos mismo/);
  });
});

describe('estadísticas del mes', () => {
  test('cuenta partidos, ganados, goles a favor y la mejor racha', async () => {
    const p = await preparar();
    // Tres partidos de Ana con Beto: Ana gana 2 y empata 1; Beto (equipo B) pierde 2.
    const fechas = ['2026-10-30', '2026-10-31', '2026-11-01'];
    const resultados = [
      [3, 1],
      [2, 0],
      [4, 4],
    ];
    for (const [i, fecha] of fechas.entries()) {
      vi.setSystemTime(new Date('2026-10-29T15:00:00Z'));
      const reservaId = await p.como(p.ana).mutation(api.reservas.reservar, { canchaId: p.canchaId, fecha, inicio: 1200 });
      const partidoId = await p.como(p.ana).mutation(api.partidos.crear, { reservaId });
      const { codigoInvitacion, jugadores } = await p.como(p.ana).query(api.partidos.detalle, { partidoId });
      await p.como(p.beto).mutation(api.partidos.sumarme, { codigo: codigoInvitacion });
      const betoId = (await p.como(p.ana).query(api.partidos.detalle, { partidoId })).jugadores.find((j) => j.nombre === 'Beto')!._id;
      await p.como(p.ana).mutation(api.partidos.asignarEquipo, { jugadorId: jugadores[0]._id, equipo: 'A' });
      await p.como(p.ana).mutation(api.partidos.asignarEquipo, { jugadorId: betoId, equipo: 'B' });
      vi.setSystemTime(new Date(`${fecha}T23:30:00Z`));
      await p.como(p.ana).mutation(api.partidos.cargarResultado, { partidoId, golesA: resultados[i][0], golesB: resultados[i][1] });
    }

    expect(await p.como(p.ana).query(api.partidos.miMes, { mes: '2026-10' })).toMatchObject({
      partidos: 2,
      ganados: 2,
      golesAFavor: 5,
      rachaGanadora: 2,
    });
    expect(await p.como(p.ana).query(api.partidos.miMes, { mes: '2026-11' })).toMatchObject({
      partidos: 1,
      ganados: 0,
      empatados: 1,
      golesAFavor: 4,
    });
    expect(await p.como(p.beto).query(api.partidos.miMes, { mes: '2026-10' })).toMatchObject({
      partidos: 2,
      ganados: 0,
      perdidos: 2,
      golesAFavor: 1,
      rachaGanadora: 0,
    });
  });
});

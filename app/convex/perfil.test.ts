import { describe, expect, test } from 'vitest';

import { api } from './_generated/api';
import { MANIANA, preparar } from './prueba.helpers';

describe('perfil', () => {
  test('el nombre del perfil reemplaza al de Google en todos lados', async () => {
    const p = await preparar();
    await p.como(p.ana).mutation(api.usuarios.actualizarPerfil, { nombre: '  Anita 10 ', posicion: 'delantero' });
    expect(await p.como(p.ana).query(api.usuarios.yo, {})).toMatchObject({ nombre: 'Anita 10', posicion: 'delantero' });

    const reservaId = await p.como(p.ana).mutation(api.reservas.reservar, { canchaId: p.canchaId, fecha: MANIANA, inicio: 1200 });
    const partidoId = await p.como(p.ana).mutation(api.partidos.crear, { reservaId });
    const partido = await p.como(p.ana).query(api.partidos.detalle, { partidoId });
    expect(partido.organizador).toBe('Anita 10');
    expect(partido.jugadores[0].nombre).toBe('Anita 10');

    await expect(p.como(p.ana).mutation(api.usuarios.actualizarPerfil, { nombre: 'A' })).rejects.toThrow(/entre 2 y 40/);
  });

  test('foto de perfil: acepta imágenes y rechaza otros archivos', async () => {
    const p = await preparar();
    const imagen = await p.t.run((ctx) => ctx.storage.store(new Blob(['png'], { type: 'image/png' })));
    await p.como(p.ana).mutation(api.usuarios.cambiarFoto, { storageId: imagen });
    expect((await p.como(p.ana).query(api.usuarios.yo, {}))?.foto).toBeTruthy();

    const texto = await p.t.run((ctx) => ctx.storage.store(new Blob(['hola'], { type: 'text/plain' })));
    await expect(p.como(p.ana).mutation(api.usuarios.cambiarFoto, { storageId: texto })).rejects.toThrow(/Subí una imagen/);
  });
});

describe('complejos públicos', () => {
  test('la portada lista los complejos publicados con banner y precio desde', async () => {
    const p = await preparar();
    const imagen = await p.t.run((ctx) => ctx.storage.store(new Blob(['jpg'], { type: 'image/jpeg' })));
    await expect(
      p.como(p.ana).mutation(api.complejos.cambiarBanner, { complejoId: p.complejoId, storageId: imagen }),
    ).rejects.toThrow(/No tenés permiso/);
    await p.como(p.admin).mutation(api.complejos.cambiarBanner, { complejoId: p.complejoId, storageId: imagen });

    const [ficha] = await p.t.query(api.complejos.publicos, {});
    expect(ficha).toMatchObject({ nombre: 'La Canchita', precioDesde: 20000 });
    expect(ficha.banner).toBeTruthy();
    expect(ficha.canchas.map((c) => c.nombre)).toEqual(['Cancha 1']);

    const turnos = await p.t.query(api.disponibilidad.delComplejo, { complejoId: p.complejoId, fecha: MANIANA });
    expect(turnos[0].turnos.map((t) => t.inicio)).toEqual([1080, 1140, 1200, 1260, 1320, 1380]);
  });
});

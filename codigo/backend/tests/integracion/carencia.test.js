import { describe, it, beforeAll as before, afterAll as after } from 'vitest';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { verificarCarencia, validarCarenciaParaCosecha, CarenciaError } from '../../src/utils/carencia.js';

const prisma = new PrismaClient();

// Helper para crear fechas
const dia = (offset) => {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};

describe('Verificación de período de carencia', () => {
  let finca, lote, campania, trabajador, usuario;

  before(async () => {
    // Crear datos de prueba
    finca = await prisma.finca.create({
      data: { nombre: 'Finca Test Carencia', hectareas: 1 }
    });

    lote = await prisma.lote.create({
      data: {
        fincaId: finca.id,
        codigo: 'TEST-01',
        nombre: 'Lote de prueba',
        areaHa: 0.5
      }
    });

    campania = await prisma.campania.create({
      data: {
        loteId: lote.id,
        cultivo: 'Tomate',
        fechaSiembra: dia(-30)
      }
    });

    trabajador = await prisma.trabajador.create({
      data: {
        fincaId: finca.id,
        nombre: 'Test Worker',
        jornalBs: 100
      }
    });

    usuario = await prisma.usuario.create({
      data: {
        fincaId: finca.id,
        nombre: 'Test User',
        email: `test-carencia-${Date.now()}@test.local`,
        passwordHash: 'hash',
        rol: 'PROPIETARIO'
      }
    });
  });

  after(async () => {
    // Limpiar datos de prueba
    await prisma.labor.deleteMany({ where: { loteId: lote.id } });
    await prisma.campania.deleteMany({ where: { loteId: lote.id } });
    await prisma.lote.deleteMany({ where: { fincaId: finca.id } });
    await prisma.usuario.deleteMany({ where: { fincaId: finca.id } });
    await prisma.trabajador.deleteMany({ where: { fincaId: finca.id } });
    await prisma.finca.deleteMany({ where: { id: finca.id } });
    await prisma.$disconnect();
  });

  it('verificarCarencia() retorna enCarencia:false si no hay aplicaciones', async () => {
    const resultado = await verificarCarencia(lote.id);
    assert.equal(resultado.enCarencia, false);
  });

  it('verificarCarencia() detecta aplicación en carencia', async () => {
    // Crear aplicación hace 3 días con carencia de 14 días
    const labor = await prisma.labor.create({
      data: {
        loteId: lote.id,
        campaniaId: campania.id,
        tipo: 'FUMIGACION',
        fecha: dia(-3),
        horas: 4,
        costoBs: 100,
        aplicacion: {
          create: {
            producto: 'Test Product',
            periodoCarenciaDias: 14,
            responsableTecnico: 'Ing. Test'
          }
        }
      },
      include: { aplicacion: true }
    });

    const resultado = await verificarCarencia(lote.id, dia(0));
    assert.equal(resultado.enCarencia, true);
    assert.ok(resultado.aplicacion);
    assert.equal(resultado.aplicacion.producto, 'Test Product');
    assert.ok(resultado.fechaFinCarencia);

    // Limpiar
    await prisma.labor.delete({ where: { id: labor.id } });
  });

  it('verificarCarencia() permite cosecha fuera de carencia', async () => {
    // Crear aplicación hace 20 días con carencia de 14 días
    const labor = await prisma.labor.create({
      data: {
        loteId: lote.id,
        campaniaId: campania.id,
        tipo: 'FUMIGACION',
        fecha: dia(-20),
        horas: 4,
        costoBs: 100,
        aplicacion: {
          create: {
            producto: 'Old Product',
            periodoCarenciaDias: 14,
            responsableTecnico: 'Ing. Test'
          }
        }
      }
    });

    const resultado = await verificarCarencia(lote.id, dia(0));
    assert.equal(resultado.enCarencia, false);

    // Limpiar
    await prisma.labor.delete({ where: { id: labor.id } });
  });

  it('verificarCarencia() usa la aplicación más reciente con carencia vigente', async () => {
    // Crear dos aplicaciones
    const labor1 = await prisma.labor.create({
      data: {
        loteId: lote.id,
        campaniaId: campania.id,
        tipo: 'FUMIGACION',
        fecha: dia(-20),
        horas: 4,
        costoBs: 100,
        aplicacion: {
          create: {
            producto: 'Old Product',
            periodoCarenciaDias: 14,
            responsableTecnico: 'Ing. Test'
          }
        }
      }
    });

    const labor2 = await prisma.labor.create({
      data: {
        loteId: lote.id,
        campaniaId: campania.id,
        tipo: 'FUMIGACION',
        fecha: dia(-5),
        horas: 4,
        costoBs: 100,
        aplicacion: {
          create: {
            producto: 'Recent Product',
            periodoCarenciaDias: 10,
            responsableTecnico: 'Ing. Test'
          }
        }
      }
    });

    const resultado = await verificarCarencia(lote.id, dia(0));
    assert.equal(resultado.enCarencia, true);
    assert.equal(resultado.aplicacion.producto, 'Recent Product');

    // Limpiar
    await prisma.labor.deleteMany({ where: { loteId: lote.id } });
  });

  it('validarCarenciaParaCosecha() lanza CarenciaError si está en carencia', async () => {
    const labor = await prisma.labor.create({
      data: {
        loteId: lote.id,
        campaniaId: campania.id,
        tipo: 'FUMIGACION',
        fecha: dia(-3),
        horas: 4,
        costoBs: 100,
        aplicacion: {
          create: {
            producto: 'Test Product',
            periodoCarenciaDias: 14,
            responsableTecnico: 'Ing. Test'
          }
        }
      }
    });

    await assert.rejects(
      async () => await validarCarenciaParaCosecha(lote.id, usuario, false),
      (error) => error instanceof CarenciaError
    );

    // Limpiar
    await prisma.labor.delete({ where: { id: labor.id } });
  });

  it('validarCarenciaParaCosecha() permite si no hay carencia', async () => {
    const resultado = await validarCarenciaParaCosecha(lote.id, usuario, false);
    assert.equal(resultado.permitido, true);
  });

  it('validarCarenciaParaCosecha() permite forzar con justificación (PROPIETARIO)', async () => {
    const labor = await prisma.labor.create({
      data: {
        loteId: lote.id,
        campaniaId: campania.id,
        tipo: 'FUMIGACION',
        fecha: dia(-3),
        horas: 4,
        costoBs: 100,
        aplicacion: {
          create: {
            producto: 'Test Product',
            periodoCarenciaDias: 14,
            responsableTecnico: 'Ing. Test'
          }
        }
      }
    });

    const resultado = await validarCarenciaParaCosecha(
      lote.id,
      usuario,
      true,
      'Urgencia de mercado - cliente importante esperando'
    );

    assert.equal(resultado.permitido, true);
    assert.ok(resultado.advertencia);

    // Limpiar
    await prisma.labor.delete({ where: { id: labor.id } });
  });

  it('validarCarenciaParaCosecha() rechaza forzar sin justificación', async () => {
    const labor = await prisma.labor.create({
      data: {
        loteId: lote.id,
        campaniaId: campania.id,
        tipo: 'FUMIGACION',
        fecha: dia(-3),
        horas: 4,
        costoBs: 100,
        aplicacion: {
          create: {
            producto: 'Test Product',
            periodoCarenciaDias: 14,
            responsableTecnico: 'Ing. Test'
          }
        }
      }
    });

    await assert.rejects(
      async () => await validarCarenciaParaCosecha(lote.id, usuario, true, ''),
      (error) => error.message.includes('Justificación requerida')
    );

    // Limpiar
    await prisma.labor.delete({ where: { id: labor.id } });
  });

  it('validarCarenciaParaCosecha() rechaza forzar si justificación muy corta', async () => {
    const labor = await prisma.labor.create({
      data: {
        loteId: lote.id,
        campaniaId: campania.id,
        tipo: 'FUMIGACION',
        fecha: dia(-3),
        horas: 4,
        costoBs: 100,
        aplicacion: {
          create: {
            producto: 'Test Product',
            periodoCarenciaDias: 14,
            responsableTecnico: 'Ing. Test'
          }
        }
      }
    });

    await assert.rejects(
      async () => await validarCarenciaParaCosecha(lote.id, usuario, true, 'urgente'),
      (error) => error.message.includes('mínimo 10 caracteres')
    );

    // Limpiar
    await prisma.labor.delete({ where: { id: labor.id } });
  });

  it('cálculo de fechas - casos límite', async () => {
    // Aplicación con carencia 0 días (no debe bloquear)
    const labor = await prisma.labor.create({
      data: {
        loteId: lote.id,
        campaniaId: campania.id,
        tipo: 'FERTILIZACION',
        fecha: dia(-1),
        horas: 4,
        costoBs: 100,
        aplicacion: {
          create: {
            producto: 'Fertilizante sin carencia',
            periodoCarenciaDias: 0,
            responsableTecnico: 'Ing. Test'
          }
        }
      }
    });

    const resultado = await verificarCarencia(lote.id, dia(0));
    assert.equal(resultado.enCarencia, false);

    // Limpiar
    await prisma.labor.delete({ where: { id: labor.id } });
  });
});

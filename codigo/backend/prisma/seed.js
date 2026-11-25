// Datos 100% FICTICIOS para demostración. Ningún nombre, documento o teléfono es real.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

// Generador pseudoaleatorio determinista (siempre los mismos datos)
let semilla = 42;
const azar = () => ((semilla = (semilla * 16807) % 2147483647) - 1) / 2147483646;
const elegir = (arr) => arr[Math.floor(azar() * arr.length)];
const dia = (offset) => {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};

async function main() {
  console.log('🌱 Limpiando datos…');
  for (const m of ['movimientoInsumo', 'insumo', 'mensajeWhatsApp', 'accionPendiente', 'eventoTrazabilidad', 'loteCosecha', 'aplicacion', 'labor', 'observacion', 'pago', 'asistencia', 'siembra', 'parcela', 'trabajador', 'auditoria', 'usuario', 'finca']) {
    await prisma[m].deleteMany();
  }

  const finca = await prisma.finca.create({
    data: {
      nombre: 'Finca Los Molles',
      municipio: 'Comarapa',
      departamento: 'Santa Cruz',
      lat: -17.9135,
      lng: -64.5312,
      hectareas: 6.5,
      modulosActivos: JSON.stringify(['M1', 'M2', 'M3', 'M4', 'M5', 'M6']),
      telefonoWa: '59170000000',
    },
  });

  const hash = await bcrypt.hash('Agro2026!', 10);
  const usuarios = {};
  for (const [clave, nombre, rol, tel] of [
    ['admin', 'Ana Quispe (Admin)', 'ADMIN', '59170000001'],
    ['tecnico', 'Ing. Bruno Rojas (Técnico)', 'TECNICO', '59170000002'],
    ['supervisor', 'Carla Mamani (Capataz)', 'SUPERVISOR', '59170000003'],
    ['consulta', 'Diego Vargas (Consulta)', 'CONSULTA', '59170000004'],
  ]) {
    usuarios[clave] = await prisma.usuario.create({ data: { nombre, email: `${clave}@finca.test`, passwordHash: hash, rol, telefono: tel, fincaId: finca.id } });
  }

  const defParcelas = [
    ['P-01', 'Bajío del río', 1.2, 'Franco arenoso', 'GOTEO', 'Tomate', 'Santa Cruz Kada', -95],
    ['P-02', 'Ladera norte', 0.9, 'Franco', 'ASPERSION', 'Pimentón', 'California Wonder', -80],
    ['P-03', 'Media luna', 1.0, 'Franco arcilloso', 'GOTEO', 'Frutilla', 'Albión', -150],
    ['P-04', 'El molle grande', 1.5, 'Franco', 'GRAVEDAD', 'Papa', 'Desirée', -110],
    ['P-05', 'Potrero chico', 0.8, 'Arenoso', 'ASPERSION', 'Cebolla', 'Roja arequipeña', -70],
    ['P-06', 'La esquina', 1.1, 'Franco limoso', 'SECANO', 'Maíz choclo', 'Blanco Comarapa', -60],
  ];
  const parcelas = [];
  for (const [i, [codigo, nombre, areaHa, tipoSuelo, riego, cultivo, variedad, hace]] of defParcelas.entries()) {
    const p = await prisma.parcela.create({
      data: {
        fincaId: finca.id, codigo, nombre, areaHa, tipoSuelo, riego,
        lat: -17.9135 + (Math.floor(i / 3) - 0.5) * 0.0024 + (azar() - 0.5) * 0.0006,
        lng: -64.5312 + ((i % 3) - 1) * 0.0028 + (azar() - 0.5) * 0.0006,
      },
    });
    const s = await prisma.siembra.create({ data: { parcelaId: p.id, cultivo, variedad, fechaSiembra: dia(hace), fechaCosechaEst: dia(hace + 120) } });
    parcelas.push({ ...p, siembra: s });
  }

  const nombres = ['Juan Pérez Choque', 'María Flores Condori', 'Pedro Gutiérrez Mamani', 'Rosa Copa Huanca', 'Luis Ticona Apaza', 'Elena Cruz Saavedra', 'Marcos Limachi Ríos', 'Sofía Arce Velasco'];
  const cargos = ['CAPATAZ', 'JORNALERO', 'TRACTORISTA', 'JORNALERO', 'REGADOR', 'JORNALERO', 'JORNALERO', 'JORNALERO'];
  const trabajadores = [];
  for (const [i, nombre] of nombres.entries()) {
    trabajadores.push(await prisma.trabajador.create({
      data: { fincaId: finca.id, nombre, documento: `FICT-${1000 + i}`, telefono: `5917100${String(i).padStart(4, '0')}`, cargo: cargos[i], jornalBs: cargos[i] === 'CAPATAZ' ? 150 : cargos[i] === 'TRACTORISTA' ? 140 : 110 },
    }));
  }

  // Asistencias de los últimos 30 días (lunes a sábado)
  for (let d = -30; d <= 0; d++) {
    const fecha = dia(d);
    if (fecha.getUTCDay() === 0) continue;
    for (const t of trabajadores) {
      if (azar() < 0.15) continue; // faltas
      await prisma.asistencia.create({ data: { trabajadorId: t.id, fecha, horas: elegir([8, 8, 8, 6, 4, 9]), tarea: elegir(['RIEGO', 'DESHIERBE', 'COSECHA', 'PODA', 'FUMIGACION']), parcelaId: elegir(parcelas).id } });
    }
  }

  // Labores de campo
  const tipos = ['RIEGO', 'RIEGO', 'DESHIERBE', 'FERTILIZACION', 'FUMIGACION', 'PODA', 'MONITOREO'];
  const productosFicticios = [['AgroProtect 50 (ficticio)', 'Ingrediente A', 14], ['FitoVerde SC (ficticio)', 'Ingrediente B', 7], ['NutriSuelo 15-15-15 (ficticio)', null, null]];
  for (let k = 0; k < 70; k++) {
    const p = elegir(parcelas);
    const tipo = elegir(tipos);
    const conAplicacion = tipo === 'FUMIGACION' || tipo === 'FERTILIZACION';
    const prod = tipo === 'FERTILIZACION' ? productosFicticios[2] : elegir(productosFicticios.slice(0, 2));
    await prisma.labor.create({
      data: {
        parcelaId: p.id, siembraId: p.siembra.id, tipo, fecha: dia(-Math.floor(azar() * 45)),
        horas: elegir([2, 3, 4, 6, 8]), costoBs: Math.round(50 + azar() * 250), trabajadorId: elegir(trabajadores).id,
        descripcion: `${tipo.toLowerCase()} de rutina en ${p.nombre}`,
        origen: elegir(['WEB', 'WEB', 'WEB', 'WHATSAPP']), registradoPorId: elegir([usuarios.tecnico.id, usuarios.supervisor.id]),
        ...(conAplicacion ? { aplicacion: { create: { producto: prod[0], ingredienteActivo: prod[1], cantidadUsada: Math.round(azar() * 40) / 10 + 0.5, unidad: tipo === 'FERTILIZACION' ? 'kg' : 'L', periodoCarenciaDias: prod[2], responsableTecnico: usuarios.tecnico.nombre } } } : {}),
      },
    });
  }

  // Observaciones fitosanitarias
  const obs = [['PLAGA', 'Presencia de pulgón en el envés de las hojas'], ['ENFERMEDAD', 'Manchas de tizón en hojas bajeras'], ['PLAGA', 'Daño de gusano cogollero'], ['CLIMA', 'Granizada leve, hojas perforadas'], ['ENFERMEDAD', 'Síntomas de oídio en frutilla'], ['SUELO', 'Encharcamiento en la cabecera']];
  for (let k = 0; k < 12; k++) {
    const [tipo, nota] = elegir(obs);
    await prisma.observacion.create({ data: { parcelaId: elegir(parcelas).id, tipo, nota, severidad: 1 + Math.floor(azar() * 5), fecha: dia(-Math.floor(azar() * 20)), origen: elegir(['WEB', 'WHATSAPP']) } });
  }

  // Lotes de cosecha con trazabilidad
  const cosechas = [[2, 380, 'Mercado Abasto Santa Cruz', -12], [2, 260, 'Feria de Comarapa', -5], [0, 520, 'Supermercado (ficticio)', -8], [0, 410, 'Mercado Abasto Santa Cruz', -2], [1, 300, 'Intermediario local', -3]];
  for (const [n, [pi, kg, destino, d]] of cosechas.entries()) {
    const p = parcelas[pi];
    const f = dia(d);
    await prisma.loteCosecha.create({
      data: {
        codigo: `FLM-${f.getUTCFullYear()}-${String(n + 1).padStart(4, '0')}`,
        siembraId: p.siembra.id, fechaCosecha: f, cantidadKg: kg, calidad: n === 4 ? 'SEGUNDA' : 'PRIMERA', destino,
        tokenPublico: crypto.randomBytes(12).toString('base64url'),
        eventos: { create: [
          { tipo: 'COSECHA', fecha: f, detalle: `Cosecha manual en ${p.codigo}` },
          { tipo: 'ACOPIO', fecha: new Date(f.getTime() + 3 * 3600000), detalle: 'Acopio en galpón de la finca' },
          { tipo: 'EMPAQUE', fecha: new Date(f.getTime() + 6 * 3600000), detalle: 'Cajas de 20 kg, etiqueta con QR' },
          ...(d < -3 ? [{ tipo: 'DESPACHO', fecha: new Date(f.getTime() + 24 * 3600000), detalle: `Despachado a ${destino}` }] : []),
        ] },
      },
    });
  }

  // M6 Insumos
  for (const [nombre, categoria, unidad, stock, stockMinimo, costoUnitBs] of [
    ['Semilla de tomate (sobre 1000 u)', 'SEMILLA', 'sobre', 6, 2, 180],
    ['NutriSuelo 15-15-15 (ficticio)', 'FERTILIZANTE', 'kg', 120, 50, 9.5],
    ['AgroProtect 50 (ficticio)', 'AGROQUIMICO', 'L', 3, 5, 145],
    ['FitoVerde SC (ficticio)', 'AGROQUIMICO', 'L', 8, 2, 210],
    ['Cinta de goteo 16 mm', 'OTRO', 'rollo', 4, 1, 650],
    ['Cajas plásticas 20 kg', 'OTRO', 'u', 90, 40, 35],
    ['Mochila fumigadora 20 L', 'HERRAMIENTA', 'u', 3, 2, 420],
  ]) {
    await prisma.insumo.create({ data: { fincaId: finca.id, nombre, categoria, unidad, stock, stockMinimo, costoUnitBs } });
  }

  // Conversación de ejemplo por WhatsApp
  for (const [direccion, texto] of [
    ['ENTRANTE', 'regué la parcela 1 por 3 horas'],
    ['SALIENTE', '📝 Voy a registrar:\nLabor *RIEGO* en P-01, 3 h.\n¿Confirmas? Responde *SI* para guardar o *NO* para cancelar.'],
    ['ENTRANTE', 'si'],
    ['SALIENTE', '✅ Registrado. Labor guardada en P-01.'],
    ['ENTRANTE', 'cuánto mancozeb le echo a la mochila?'],
    ['SALIENTE', '⚠️ No puedo recomendar productos, dosis ni mezclas de agroquímicos. Consulte al ingeniero agrónomo responsable.'],
  ]) {
    await prisma.mensajeWhatsApp.create({ data: { fincaId: finca.id, telefono: '59170000003', direccion, texto } });
  }

  console.log('✅ Datos ficticios cargados. Usuarios: admin|tecnico|supervisor|consulta @finca.test · clave: Agro2026!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

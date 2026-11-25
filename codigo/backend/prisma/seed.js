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
  // Eliminar en orden inverso a las dependencias
  for (const m of ['cobro', 'detalleVenta', 'venta', 'detallePedido', 'pedido', 'movimientoProducto', 'productoCosechado', 'movimientoInsumo', 'insumo', 'cliente', 'mensajeWhatsApp', 'accionPendiente', 'eventoTrazabilidad', 'loteCosecha', 'aplicacion', 'laborProgramada', 'labor', 'observacion', 'pago', 'asistencia', 'campania', 'lote', 'trabajador', 'auditoria', 'usuario', 'moduloFinca', 'finca']) {
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
      whatsappActivo: true,
      telefonoWa: '59170000000',
    },
  });

  // Activar módulos M1-M5 (funcionalidades actuales implementadas)
  for (const codigo of ['M1', 'M2', 'M3', 'M4', 'M5']) {
    await prisma.moduloFinca.create({ data: { fincaId: finca.id, codigo, activo: true } });
  }

  const hash = await bcrypt.hash('Agro2026!', 10);

  // Crear trabajadores primero (para vincular usuarios)
  const nombres = ['Juan Pérez Choque', 'María Flores Condori', 'Pedro Gutiérrez Mamani', 'Rosa Copa Huanca', 'Luis Ticona Apaza', 'Elena Cruz Saavedra', 'Marcos Limachi Ríos', 'Sofía Arce Velasco'];
  const cargos = ['CAPATAZ', 'JORNALERO', 'TRACTORISTA', 'JORNALERO', 'REGADOR', 'JORNALERO', 'JORNALERO', 'JORNALERO'];
  const trabajadores = [];
  for (const [i, nombre] of nombres.entries()) {
    trabajadores.push(await prisma.trabajador.create({
      data: {
        fincaId: finca.id,
        nombre,
        documento: `FICT-${1000 + i}`,
        telefono: `5917100${String(i).padStart(4, '0')}`,
        cargo: cargos[i],
        jornalBs: cargos[i] === 'CAPATAZ' ? 150 : cargos[i] === 'TRACTORISTA' ? 140 : 110,
        consentimientoWhatsapp: i < 4, // primeros 4 dan consentimiento
        fechaConsentimiento: i < 4 ? dia(-15) : null,
      },
    }));
  }

  // Usuarios con nuevos roles
  const usuarios = {};
  for (const [clave, nombre, rol, tel, trabajadorId] of [
    ['propietario', 'Ana Quispe (Propietaria)', 'PROPIETARIO', '59170000001', null],
    ['encargado', 'Ing. Bruno Rojas (Encargado)', 'ENCARGADO', '59170000002', null],
    ['trabajador', 'Juan Pérez (Capataz)', 'TRABAJADOR', '59170000003', trabajadores[0].id], // vinculado al capataz
  ]) {
    usuarios[clave] = await prisma.usuario.create({
      data: {
        nombre,
        email: `${clave}@finca.test`,
        passwordHash: hash,
        rol,
        telefono: tel,
        fincaId: finca.id,
        trabajadorId
      }
    });
  }

  // Lotes de campo (antes "Parcelas")
  const defLotes = [
    ['L-01', 'Bajío del río', 1.2, 'Franco arenoso', 'GOTEO', 'Tomate', 'Santa Cruz Kada', -95],
    ['L-02', 'Ladera norte', 0.9, 'Franco', 'ASPERSION', 'Pimentón', 'California Wonder', -80],
    ['L-03', 'Media luna', 1.0, 'Franco arcilloso', 'GOTEO', 'Frutilla', 'Albión', -150],
    ['L-04', 'El molle grande', 1.5, 'Franco', 'GRAVEDAD', 'Papa', 'Desirée', -110],
    ['L-05', 'Potrero chico', 0.8, 'Arenoso', 'ASPERSION', 'Cebolla', 'Roja arequipeña', -70],
    ['L-06', 'La esquina', 1.1, 'Franco limoso', 'SECANO', 'Maíz choclo', 'Blanco Comarapa', -60],
  ];
  const lotes = [];
  for (const [i, [codigo, nombre, areaHa, tipoSuelo, riego, cultivo, variedad, hace]] of defLotes.entries()) {
    const l = await prisma.lote.create({
      data: {
        fincaId: finca.id, codigo, nombre, areaHa, tipoSuelo, riego,
        lat: -17.9135 + (Math.floor(i / 3) - 0.5) * 0.0024 + (azar() - 0.5) * 0.0006,
        lng: -64.5312 + ((i % 3) - 1) * 0.0028 + (azar() - 0.5) * 0.0006,
      },
    });
    const c = await prisma.campania.create({
      data: {
        loteId: l.id,
        cultivo,
        variedad,
        fechaSiembra: dia(hace),
        fechaCosechaEst: dia(hace + 120)
      }
    });
    lotes.push({ ...l, campania: c });
  }

  // Asistencias de los últimos 30 días (lunes a sábado)
  for (let d = -30; d <= 0; d++) {
    const fecha = dia(d);
    if (fecha.getUTCDay() === 0) continue; // sin domingos
    for (const t of trabajadores) {
      if (azar() < 0.15) continue; // 15% de faltas
      await prisma.asistencia.create({
        data: {
          trabajadorId: t.id,
          fecha,
          horas: elegir([8, 8, 8, 6, 4, 9]),
          tarea: elegir(['RIEGO', 'DESHIERBE', 'COSECHA', 'PODA', 'FUMIGACION']),
          loteId: elegir(lotes).id
        }
      });
    }
  }

  // Labores de campo
  const tipos = ['RIEGO', 'RIEGO', 'DESHIERBE', 'FERTILIZACION', 'FUMIGACION', 'PODA', 'MONITOREO'];
  const productosFicticios = [
    ['AgroProtect 50 (ficticio)', 'Ingrediente A', 14],
    ['FitoVerde SC (ficticio)', 'Ingrediente B', 7],
    ['NutriSuelo 15-15-15 (ficticio)', null, null]
  ];
  const motivosPlagas = ['Pulgón', 'Mosca blanca', 'Gusano cogollero', 'Ácaros', 'Trips', null];
  const laboresRealizadas = [];
  for (let k = 0; k < 70; k++) {
    const l = elegir(lotes);
    const tipo = elegir(tipos);
    const conAplicacion = tipo === 'FUMIGACION' || tipo === 'FERTILIZACION';
    const prod = tipo === 'FERTILIZACION' ? productosFicticios[2] : elegir(productosFicticios.slice(0, 2));
    const labor = await prisma.labor.create({
      data: {
        loteId: l.id,
        campaniaId: l.campania.id,
        tipo,
        fecha: dia(-Math.floor(azar() * 45)),
        horas: elegir([2, 3, 4, 6, 8]),
        costoBs: Math.round(50 + azar() * 250),
        trabajadorId: elegir(trabajadores).id,
        descripcion: `${tipo.toLowerCase()} de rutina en ${l.nombre}`,
        origen: elegir(['WEB', 'WEB', 'WEB', 'WHATSAPP']),
        registradoPorId: elegir([usuarios.encargado.id, usuarios.trabajador.id]),
        ...(conAplicacion ? {
          aplicacion: {
            create: {
              producto: prod[0],
              motivo: tipo === 'FUMIGACION' ? elegir(motivosPlagas) : null,
              dosisEtiqueta: tipo === 'FUMIGACION' ? (azar() > 0.5 ? '2.5 L/ha según etiqueta del producto' : null) : null,
              ingredienteActivo: prod[1],
              cantidadUsada: Math.round(azar() * 40) / 10 + 0.5,
              unidad: tipo === 'FERTILIZACION' ? 'kg' : 'L',
              periodoCarenciaDias: prod[2],
              responsableTecnico: usuarios.encargado.nombre
            }
          }
        } : {}),
      },
    });
    laboresRealizadas.push(labor);
  }

  // Aplicación reciente con carencia vigente en el primer lote (hace 3 días, carencia 14 días)
  const aplicacionCarencia = await prisma.labor.create({
    data: {
      loteId: lotes[0].id,
      campaniaId: lotes[0].campania.id,
      tipo: 'FUMIGACION',
      fecha: dia(-3),
      horas: 4,
      costoBs: 180,
      trabajadorId: trabajadores[0].id,
      descripcion: 'Aplicación de fungicida contra tizón',
      origen: 'WEB',
      registradoPorId: usuarios.encargado.id,
      aplicacion: {
        create: {
          producto: 'FungiProtect Ultra (ficticio)',
          motivo: 'Tizón tardío',
          dosisEtiqueta: '3.0 L/ha según etiqueta del producto',
          ingredienteActivo: 'Ingrediente C',
          cantidadUsada: 3.0,
          unidad: 'L',
          periodoCarenciaDias: 14,
          responsableTecnico: usuarios.encargado.nombre
        }
      }
    },
  });
  laboresRealizadas.push(aplicacionCarencia);

  // Labores programadas (calendario)
  const tiposProgramadas = ['RIEGO', 'FERTILIZACION', 'FUMIGACION', 'DESHIERBE', 'PODA', 'MONITOREO'];
  const estadosProgramadas = ['PENDIENTE', 'HECHA', 'CANCELADA'];

  // Labores programadas pendientes
  for (let k = 0; k < 8; k++) {
    await prisma.laborProgramada.create({
      data: {
        loteId: elegir(lotes).id,
        tipo: elegir(tiposProgramadas),
        fechaProgramada: dia(Math.floor(azar() * 20) + 1), // futuras
        responsableId: azar() > 0.3 ? elegir(trabajadores).id : null,
        estado: 'PENDIENTE',
        descripcion: `${elegir(tiposProgramadas).toLowerCase()} programado`,
      },
    });
  }

  // Labores programadas ya realizadas (con laborRealizadaId)
  for (let k = 0; k < 4; k++) {
    const labor = laboresRealizadas[k];
    await prisma.laborProgramada.create({
      data: {
        loteId: labor.loteId,
        tipo: labor.tipo,
        fechaProgramada: new Date(labor.fecha.getTime() - 24 * 3600000), // programada 1 día antes
        responsableId: labor.trabajadorId,
        estado: 'HECHA',
        descripcion: labor.descripcion,
        laborRealizadaId: labor.id,
      },
    });
  }

  // Labores programadas canceladas
  for (let k = 0; k < 3; k++) {
    await prisma.laborProgramada.create({
      data: {
        loteId: elegir(lotes).id,
        tipo: elegir(tiposProgramadas),
        fechaProgramada: dia(-Math.floor(azar() * 10) - 1), // pasadas
        responsableId: azar() > 0.5 ? elegir(trabajadores).id : null,
        estado: 'CANCELADA',
        descripcion: 'Cancelada por condiciones climáticas',
      },
    });
  }

  // Observaciones fitosanitarias
  const obs = [
    ['PLAGA', 'Presencia de pulgón en el envés de las hojas'],
    ['ENFERMEDAD', 'Manchas de tizón en hojas bajeras'],
    ['PLAGA', 'Daño de gusano cogollero'],
    ['CLIMA', 'Granizada leve, hojas perforadas'],
    ['ENFERMEDAD', 'Síntomas de oídio en frutilla'],
    ['SUELO', 'Encharcamiento en la cabecera']
  ];
  for (let k = 0; k < 12; k++) {
    const [tipo, nota] = elegir(obs);
    await prisma.observacion.create({
      data: {
        loteId: elegir(lotes).id,
        tipo,
        nota,
        severidad: 1 + Math.floor(azar() * 5),
        fecha: dia(-Math.floor(azar() * 20)),
        origen: elegir(['WEB', 'WHATSAPP'])
      }
    });
  }

  // Lotes de cosecha con trazabilidad (QR)
  const cosechas = [
    [1, 380, 'Mercado Abasto Santa Cruz', -12],
    [1, 260, 'Feria de Comarapa', -5],
    [3, 520, 'Supermercado (ficticio)', -8],
    [3, 410, 'Mercado Abasto Santa Cruz', -2],
    [0, 300, 'Intermediario local', -3]
  ];
  const lotesCosecha = [];
  for (const [n, [li, kg, destino, d]] of cosechas.entries()) {
    const l = lotes[li];
    const f = dia(d);
    const lc = await prisma.loteCosecha.create({
      data: {
        codigo: `FLM-${f.getUTCFullYear()}-${String(n + 1).padStart(4, '0')}`,
        campaniaId: l.campania.id,
        fechaCosecha: f,
        cantidadKg: kg,
        calidad: n === 4 ? 'SEGUNDA' : 'PRIMERA',
        destino,
        tokenPublico: crypto.randomBytes(12).toString('base64url'),
        eventos: {
          create: [
            { tipo: 'COSECHA', fecha: f, detalle: `Cosecha manual en ${l.codigo}` },
            { tipo: 'ACOPIO', fecha: new Date(f.getTime() + 3 * 3600000), detalle: 'Acopio en galpón de la finca' },
            { tipo: 'EMPAQUE', fecha: new Date(f.getTime() + 6 * 3600000), detalle: 'Cajas de 20 kg, etiqueta con QR' },
            ...(d < -3 ? [{ tipo: 'DESPACHO', fecha: new Date(f.getTime() + 24 * 3600000), detalle: `Despachado a ${destino}` }] : []),
          ]
        },
      },
    });
    lotesCosecha.push(lc);
  }

  // M4 Inventario de insumos
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

  // M4 Inventario de productos cosechados
  const productos = [];
  for (const [nombre, cultivo, unidad, stock, stockMinimo, precioVentaBs] of [
    ['Tomate Cherry', 'TOMATE', 'kg', 85, 20, 28],
    ['Pimentón Rojo', 'PIMENTON', 'kg', 45, 15, 22],
    ['Frutilla Primera', 'FRUTILLA', 'kg', 12, 5, 45],
    ['Papa Desirée', 'PAPA', 'kg', 180, 50, 8],
    ['Cebolla Roja', 'CEBOLLA', 'kg', 55, 20, 12],
  ]) {
    productos.push(await prisma.productoCosechado.create({
      data: { fincaId: finca.id, nombre, cultivo, unidad, stock, stockMinimo, precioVentaBs }
    }));
  }

  // Movimientos de inventario de productos (entradas por cosecha)
  for (let i = 0; i < lotesCosecha.length; i++) {
    const lc = lotesCosecha[i];
    const producto = productos[i % productos.length];
    await prisma.movimientoProducto.create({
      data: {
        productoId: producto.id,
        tipo: 'ENTRADA',
        cantidad: lc.cantidadKg,
        motivo: 'COSECHA',
        referencia: `LC-${lc.id}`,
        fecha: lc.fechaCosecha
      }
    });
  }

  // M5 Clientes (nuevos)
  const clientes = [];
  for (const [nombre, tipo, telefono, consentimiento, direccion, nit] of [
    ['Mercado Abasto Santa Cruz', 'MAYORISTA', '59133445566', true, 'Av. Irala #245, Santa Cruz', 'FICT-10345678'],
    ['Supermercado El Frutero (ficticio)', 'MAYORISTA', '59144556677', true, 'Calle Libertad #890, Comarapa', 'FICT-20456789'],
    ['Restaurante La Quinta (ficticio)', 'RESTAURANTE', '59155667788', true, 'Plaza Principal s/n, Comarapa', 'FICT-30567890'],
    ['Feria de Comarapa', 'MERCADO', null, false, 'Plaza de la Feria, Comarapa', null],
    ['María González (minorista)', 'MINORISTA', '59166778899', false, null, null],
    ['Pedro Suárez (intermediario)', 'MINORISTA', '59177889900', true, null, null],
  ]) {
    clientes.push(await prisma.cliente.create({
      data: {
        fincaId: finca.id,
        nombre,
        tipo,
        telefono,
        consentimientoWhatsapp: consentimiento,
        fechaConsentimiento: consentimiento ? dia(-20) : null,
        direccion,
        nit,
      }
    }));
  }

  // M5 Pedidos (algunos pendientes, otros entregados)
  const pedidos = [];
  pedidos.push(await prisma.pedido.create({
    data: {
      clienteId: clientes[0].id, // Mercado Abasto
      fecha: dia(-10),
      fechaEntrega: dia(-8),
      estado: 'ENTREGADO',
      total: 2800,
      notas: 'Entrega temprana, 6:00 AM',
      detalles: {
        create: [
          { producto: 'Tomate Cherry', cantidad: 50, unidad: 'kg', precioBs: 28, subtotal: 1400 },
          { producto: 'Pimentón Rojo', cantidad: 40, unidad: 'kg', precioBs: 22, subtotal: 880 },
          { producto: 'Cebolla Roja', cantidad: 50, unidad: 'kg', precioBs: 10.4, subtotal: 520 },
        ]
      }
    }
  }));

  pedidos.push(await prisma.pedido.create({
    data: {
      clienteId: clientes[1].id, // Supermercado
      fecha: dia(-3),
      fechaEntrega: dia(2),
      estado: 'CONFIRMADO',
      total: 1980,
      notas: 'Entrega entre 10-12 PM',
      detalles: {
        create: [
          { producto: 'Frutilla Primera', cantidad: 20, unidad: 'kg', precioBs: 45, subtotal: 900 },
          { producto: 'Tomate Cherry', cantidad: 30, unidad: 'kg', precioBs: 28, subtotal: 840 },
          { producto: 'Papa Desirée', cantidad: 30, unidad: 'kg', precioBs: 8, subtotal: 240 },
        ]
      }
    }
  }));

  pedidos.push(await prisma.pedido.create({
    data: {
      clienteId: clientes[2].id, // Restaurante
      fecha: dia(-1),
      fechaEntrega: dia(1),
      estado: 'PENDIENTE',
      total: 650,
      notas: 'Productos frescos para el fin de semana',
      detalles: {
        create: [
          { producto: 'Tomate Cherry', cantidad: 10, unidad: 'kg', precioBs: 28, subtotal: 280 },
          { producto: 'Pimentón Rojo', cantidad: 10, unidad: 'kg', precioBs: 22, subtotal: 220 },
          { producto: 'Cebolla Roja', cantidad: 15, unidad: 'kg', precioBs: 10, subtotal: 150 },
        ]
      }
    }
  }));

  // M5 Ventas con detalles vinculados a lotes de cosecha y cobros
  const ventas = [];

  // Venta 1: Totalmente pagada (hace 10 días)
  ventas.push(await prisma.venta.create({
    data: {
      clienteId: clientes[0].id, // Mercado Abasto
      fecha: dia(-10),
      total: 10640,
      pagado: 10640,
      saldo: 0,
      estado: 'PAGADO',
      notas: 'Pago al contado',
      detalles: {
        create: [
          { producto: 'Tomate Cherry', cantidad: 380, unidad: 'kg', precioBs: 28, subtotal: 10640, loteCosechaId: lotesCosecha[0].id }
        ]
      },
      cobros: {
        create: [
          { fecha: dia(-10), montoBs: 10640, metodo: 'TRANSFERENCIA', recibo: 'TRF-001-2026' }
        ]
      }
    }
  }));

  // Venta 2: Pago parcial (hace 7 días, vencida)
  ventas.push(await prisma.venta.create({
    data: {
      clienteId: clientes[1].id, // Supermercado
      fecha: dia(-7),
      total: 11440,
      pagado: 6000,
      saldo: 5440,
      estado: 'VENCIDO',
      notas: 'Crédito a 5 días, pendiente saldo',
      detalles: {
        create: [
          { producto: 'Frutilla Primera', cantidad: 260, unidad: 'kg', precioBs: 44, subtotal: 11440, loteCosechaId: lotesCosecha[1].id }
        ]
      },
      cobros: {
        create: [
          { fecha: dia(-7), montoBs: 6000, metodo: 'EFECTIVO', recibo: 'REC-001' }
        ]
      }
    }
  }));

  // Venta 3: Totalmente pagada (hace 6 días)
  ventas.push(await prisma.venta.create({
    data: {
      clienteId: clientes[2].id, // Restaurante
      fecha: dia(-6),
      total: 23400,
      pagado: 23400,
      saldo: 0,
      estado: 'PAGADO',
      notas: 'Pago en efectivo',
      detalles: {
        create: [
          { producto: 'Frutilla Primera', cantidad: 520, unidad: 'kg', precioBs: 45, subtotal: 23400, loteCosechaId: lotesCosecha[2].id }
        ]
      },
      cobros: {
        create: [
          { fecha: dia(-6), montoBs: 23400, metodo: 'EFECTIVO', recibo: 'REC-002' }
        ]
      }
    }
  }));

  // Venta 4: Sin pago todavía (hace 3 días, aún no vencida)
  ventas.push(await prisma.venta.create({
    data: {
      clienteId: clientes[0].id, // Mercado Abasto
      fecha: dia(-3),
      total: 9020,
      pagado: 0,
      saldo: 9020,
      estado: 'PENDIENTE',
      notas: 'Crédito a 7 días',
      detalles: {
        create: [
          { producto: 'Frutilla Primera', cantidad: 410, unidad: 'kg', precioBs: 22, subtotal: 9020, loteCosechaId: lotesCosecha[3].id }
        ]
      }
    }
  }));

  // Venta 5: Sin trazabilidad (producto genérico)
  ventas.push(await prisma.venta.create({
    data: {
      clienteId: clientes[4].id, // María González (minorista)
      fecha: dia(-2),
      total: 560,
      pagado: 560,
      saldo: 0,
      estado: 'PAGADO',
      notas: 'Venta directa en finca',
      detalles: {
        create: [
          { producto: 'Tomate Cherry', cantidad: 10, unidad: 'kg', precioBs: 28, subtotal: 280, loteCosechaId: null },
          { producto: 'Pimentón Rojo', cantidad: 8, unidad: 'kg', precioBs: 22, subtotal: 176, loteCosechaId: null },
          { producto: 'Papa Desirée', cantidad: 13, unidad: 'kg', precioBs: 8, subtotal: 104, loteCosechaId: null },
        ]
      },
      cobros: {
        create: [
          { fecha: dia(-2), montoBs: 560, metodo: 'EFECTIVO', recibo: null }
        ]
      }
    }
  }));

  // Movimientos de salida por ventas
  await prisma.movimientoProducto.create({
    data: { productoId: productos[0].id, tipo: 'SALIDA', cantidad: 380, motivo: 'VENTA', referencia: `V-${ventas[0].id}`, fecha: dia(-10) }
  });
  await prisma.movimientoProducto.create({
    data: { productoId: productos[2].id, tipo: 'SALIDA', cantidad: 260, motivo: 'VENTA', referencia: `V-${ventas[1].id}`, fecha: dia(-7) }
  });
  await prisma.movimientoProducto.create({
    data: { productoId: productos[2].id, tipo: 'SALIDA', cantidad: 520, motivo: 'VENTA', referencia: `V-${ventas[2].id}`, fecha: dia(-6) }
  });
  await prisma.movimientoProducto.create({
    data: { productoId: productos[2].id, tipo: 'SALIDA', cantidad: 410, motivo: 'VENTA', referencia: `V-${ventas[3].id}`, fecha: dia(-3) }
  });
  await prisma.movimientoProducto.create({
    data: { productoId: productos[0].id, tipo: 'SALIDA', cantidad: 10, motivo: 'VENTA', referencia: `V-${ventas[4].id}`, fecha: dia(-2) }
  });
  await prisma.movimientoProducto.create({
    data: { productoId: productos[1].id, tipo: 'SALIDA', cantidad: 8, motivo: 'VENTA', referencia: `V-${ventas[4].id}`, fecha: dia(-2) }
  });
  await prisma.movimientoProducto.create({
    data: { productoId: productos[3].id, tipo: 'SALIDA', cantidad: 13, motivo: 'VENTA', referencia: `V-${ventas[4].id}`, fecha: dia(-2) }
  });

  // Conversación de ejemplo por WhatsApp
  for (const [direccion, texto] of [
    ['ENTRANTE', 'regué el lote 1 por 3 horas'],
    ['SALIENTE', '📝 Voy a registrar:\nLabor *RIEGO* en L-01, 3 h.\n¿Confirmas? Responde *SI* para guardar o *NO* para cancelar.'],
    ['ENTRANTE', 'si'],
    ['SALIENTE', '✅ Registrado. Labor guardada en L-01.'],
    ['ENTRANTE', 'cuánto mancozeb le echo a la mochila?'],
    ['SALIENTE', '⚠️ No puedo recomendar productos, dosis ni mezclas de agroquímicos. Consulte al ingeniero agrónomo responsable.'],
  ]) {
    await prisma.mensajeWhatsApp.create({ data: { fincaId: finca.id, telefono: '59170000003', direccion, texto } });
  }

  console.log('✅ Datos ficticios cargados.');
  console.log('   Usuarios: propietario|encargado|trabajador @finca.test · clave: Agro2026!');
  console.log('   Módulos activos: M1-M5 (Control campo, Trazabilidad, Trabajadores, Inventarios, Ventas)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

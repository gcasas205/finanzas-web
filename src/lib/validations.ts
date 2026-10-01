import { z } from "zod";
import { roundMoney } from "@/lib/utils";

/**
 * Schemas de entrada de la API. Son la frontera: todo lo que llega del cliente
 * pasa por acá, se normaliza (trim, redondeo a centavos) y se validan las reglas
 * de negocio que el formulario también valida (el cliente es opcional).
 * Zod descarta por defecto los campos desconocidos.
 */

const MAX_MONTO = 10_000_000_000;

/** Fecha ISO de solo-día (YYYY-MM-DD) que además exista en el calendario. */
const fechaISO = (campo: string) =>
  z
    .string({ required_error: `Indicá la ${campo}`, invalid_type_error: `La ${campo} no es válida` })
    .regex(/^\d{4}-\d{2}-\d{2}$/, `La ${campo} tiene que tener el formato AAAA-MM-DD`)
    .refine((s) => {
      const [y, m, d] = s.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
    }, `La ${campo} no existe en el calendario`);

/** Monto > 0 redondeado a centavos. */
const montoPositivo = (msg: string) =>
  z
    .number({ required_error: msg, invalid_type_error: msg })
    .finite(msg)
    .positive(msg)
    .max(MAX_MONTO, "El monto es demasiado grande")
    .transform(roundMoney);

/** Monto ≥ 0 opcional redondeado a centavos. */
const montoOpcional = z
  .number({ invalid_type_error: "Tiene que ser un número" })
  .finite()
  .min(0, "No puede ser negativo")
  .max(MAX_MONTO, "El monto es demasiado grande")
  .transform(roundMoney)
  .optional();

/** "regla", "emergencia", "largo" o la clave de un sobre. */
const origen = z.string().trim().regex(/^[a-z0-9_]{1,24}$/, "Origen inválido");

/** Datos opcionales del recibo al cargar un sueldo a mano. */
export const DatosReciboSchema = z.object({
  empresa: z.string().trim().max(80, "Máximo 80 caracteres").optional(),
  cargo: z.string().trim().max(80, "Máximo 80 caracteres").optional(),
  periodoTrabajado: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Elegí un mes válido")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  bruto: montoOpcional,
  jubilacion: montoOpcional,
  obraSocial: montoOpcional,
  ley19032: montoOpcional,
  otrosDescuentos: montoOpcional,
});

export const TransactionSchema = z
  .object({
    id: z.string().trim().min(1).max(64).optional(),
    fechaConsumo: fechaISO("fecha de consumo"),
    fechaPago: fechaISO("fecha de pago").optional(),
    tipo: z.enum(["ingreso", "egreso"], { errorMap: () => ({ message: "Elegí ingreso o gasto" }) }),
    descripcion: z
      .string({ required_error: "Poné una descripción" })
      .trim()
      .min(2, "La descripción tiene que tener al menos 2 caracteres")
      .max(100, "La descripción no puede superar los 100 caracteres"),
    monto: montoPositivo("Poné un monto mayor a 0"),
    moneda: z.enum(["ARS", "USD"], { errorMap: () => ({ message: "Elegí ARS o USD" }) }).default("ARS"),
    categoria: z.string().trim().min(1, "Elegí una categoría").max(60),
    subcategoria: z.string().trim().min(1, "Elegí una subcategoría").max(60),
    fuente: z.enum(["manual", "tarjeta", "recibo"], { errorMap: () => ({ message: "Fuente inválida" }) }).default("manual"),
    cuotaTotal: z.number().int("Las cuotas son un número entero").min(1, "Mínimo 1 cuota").max(120, "Máximo 120 cuotas").default(1),
    cuotaNumero: z.number().int("La cuota es un número entero").min(1, "La cuota empieza en 1").max(120).default(1),
    notas: z.string().trim().max(500, "Las notas no pueden superar los 500 caracteres").optional(),
    createdAt: z.string().max(40).optional(),
    origen: origen.optional(),
    asigMediano: montoOpcional,
    asigLargo: montoOpcional,
    grupoCuotas: z.string().trim().max(64).optional(),
    /** Alta en cuotas: crear también las cuotas que faltan (por defecto sí) */
    crearCuotas: z.boolean().optional(),
    /** Edición de una cuota: aplicar los cambios también a las siguientes del grupo */
    aplicarAGrupo: z.boolean().optional(),
    /** Sueldo cargado a mano: datos del recibo para la hoja Sueldos */
    recibo: DatosReciboSchema.optional(),
  })
  .refine((t) => t.cuotaNumero <= t.cuotaTotal, {
    message: "La cuota no puede ser mayor que el total de cuotas",
    path: ["cuotaNumero"],
  })
  .refine(
    (t) => t.moneda !== "USD" || t.tipo !== "ingreso" || roundMoney((t.asigMediano ?? 0) + (t.asigLargo ?? 0)) <= t.monto,
    { message: "Lo asignado a mediano y largo supera el monto del ingreso", path: ["asigMediano"] },
  );

export type TransactionInput = z.infer<typeof TransactionSchema>;

/** Plan de ahorro editable (Ajustes). */
export const AhorroConfigSchema = z.object({
  emergenciaObjetivo: z.number({ invalid_type_error: "Tiene que ser un número" }).min(0, "No puede ser negativo").max(10_000_000),
  /** En % (7 = 7% anual) */
  sp500RetornoPct: z.number({ invalid_type_error: "Tiene que ser un número" }).min(-50, "Demasiado bajo").max(100, "Demasiado alto"),
  sobres: z
    .array(z.object({
      key: z.string().trim().regex(/^[a-z0-9_]{1,24}$/)
        .refine((k) => !["regla", "emergencia", "largo"].includes(k), "Clave reservada").optional(),
      nombre: z.string().trim().min(1, "Poné un nombre").max(40, "Máximo 40 caracteres"),
      pct: z.number({ invalid_type_error: "Tiene que ser un número" }).min(0, "No puede ser negativo").max(100, "Máximo 100%"),
      objetivo: z.number({ invalid_type_error: "Tiene que ser un número" }).min(0, "No puede ser negativo").max(10_000_000),
      fechaObjetivo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Elegí un mes válido").optional().or(z.literal("").transform(() => undefined)),
    }))
    .max(20, "Máximo 20 sobres"),
});

export type AhorroConfigInput = z.infer<typeof AhorroConfigSchema>;

/** Pase de plata entre destinos del ahorro. */
export const MovAhorroSchema = z
  .object({
    fecha: fechaISO("fecha del pase"),
    desde: origen,
    hacia: origen,
    montoUSD: montoPositivo("Poné un monto en USD mayor a 0"),
    notas: z.string().trim().max(200, "Máximo 200 caracteres").optional(),
  })
  .refine((m) => m.desde !== m.hacia, { message: "Elegí un destino distinto del origen", path: ["hacia"] })
  .refine((m) => m.desde !== "regla" && m.hacia !== "regla", { message: "Elegí un destino concreto", path: ["desde"] });

/** Presupuesto mensual por categoría, en pesos (0 = sin presupuesto). */
export const PresupuestosSchema = z.object({
  presupuestos: z.record(
    z.string().trim().min(1).max(60),
    z.number({ invalid_type_error: "Tiene que ser un número" }).min(0, "No puede ser negativo").max(MAX_MONTO),
  ),
});

/** Categorías editables (Ajustes). `renombres`: nombre viejo → nuevo, para migrar movimientos. */
export const CategoriasSchema = z
  .object({
    categorias: z
      .array(z.object({
        name: z.string().trim().min(1, "Poné un nombre").max(40, "Máximo 40 caracteres"),
        subcategories: z.array(z.string().trim().min(1).max(40)).min(1, "Poné al menos una subcategoría").max(30),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido"),
      }))
      .min(1)
      .max(40, "Máximo 40 categorías"),
    renombres: z.record(z.string().trim().min(1).max(40), z.string().trim().min(1).max(40)).default({}),
  })
  .refine((b) => new Set(b.categorias.map((c) => c.name.toLowerCase())).size === b.categorias.length, {
    message: "Hay dos categorías con el mismo nombre", path: ["categorias"],
  })
  .refine((b) => b.categorias.some((c) => c.name === "Ingresos") && b.categorias.some((c) => c.name === "Otros"), {
    message: "Las categorías Ingresos y Otros no se pueden quitar ni renombrar", path: ["categorias"],
  });

/** Gasto fijo mensual. */
export const RecurrenteSchema = z.object({
  id: z.string().trim().min(1).max(64).optional(),
  descripcion: z.string().trim().min(2, "La descripción tiene que tener al menos 2 caracteres").max(100),
  monto: montoPositivo("Poné un monto mayor a 0"),
  moneda: z.enum(["ARS", "USD"]).default("ARS"),
  tipo: z.enum(["ingreso", "egreso"]).default("egreso"),
  categoria: z.string().trim().min(1, "Elegí una categoría").max(60),
  subcategoria: z.string().trim().min(1, "Elegí una subcategoría").max(60),
  fuente: z.enum(["manual", "tarjeta", "recibo"]).default("manual"),
  dia: z.number({ invalid_type_error: "Tiene que ser un número" }).int("Tiene que ser un número entero").min(1, "Del 1 al 31").max(31, "Del 1 al 31"),
  activo: z.boolean().default(true),
});

/** Cargar los gastos fijos elegidos en un mes. */
export const CargarRecurrentesSchema = z.object({
  ids: z.array(z.string().trim().min(1).max(64)).min(1, "Elegí al menos uno").max(100),
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mes inválido"),
});

/** Cambio de categoría de varios movimientos a la vez. */
export const RecategorizarSchema = z.object({
  ids: z.array(z.string().trim().min(1).max(64)).min(1, "Elegí al menos un movimiento").max(500, "Máximo 500 movimientos a la vez"),
  categoria: z.string().trim().min(1, "Elegí una categoría").max(60),
  subcategoria: z.string().trim().min(1, "Elegí una subcategoría").max(60),
});

/** Lista revisada que manda la pantalla de importación. */
export const TransactionImportSchema = z
  .array(TransactionSchema)
  .max(500, "No se pueden importar más de 500 movimientos a la vez");

export const IdSchema = z.object({
  id: z.string({ required_error: "Falta el id" }).trim().min(1, "Falta el id").max(64),
});

/** Borrar un movimiento; con `grupo`, también las cuotas siguientes de su compra. */
export const DeleteTransactionSchema = IdSchema.extend({ grupo: z.boolean().optional() });

export const DolarOpSchema = z
  .object({
    id: z.string().trim().min(1).max(64).optional(),
    fecha: fechaISO("fecha de la operación"),
    tipo: z.enum(["compra", "venta"], { errorMap: () => ({ message: "Elegí compra o venta" }) }).default("compra"),
    montoUSD: montoPositivo("Poné un monto en USD mayor a 0"),
    precioARS: montoPositivo("Poné un precio mayor a 0"),
    notas: z.string().trim().max(500, "Las notas no pueden superar los 500 caracteres").optional(),
    createdAt: z.string().max(40).optional(),
    asigMediano: montoOpcional,
    asigLargo: montoOpcional,
    origen: origen.optional(),
  })
  .refine(
    (op) => op.tipo !== "compra" || roundMoney((op.asigMediano ?? 0) + (op.asigLargo ?? 0)) <= op.montoUSD,
    { message: "Lo asignado a mediano y largo supera el monto comprado", path: ["asigMediano"] },
  );

export type DolarOpInput = z.infer<typeof DolarOpSchema>;

/** Ajustes editables (hoja Config). Todos opcionales: se guarda lo que venga. */
export const ConfigSchema = z.object({
  nombre: z.string().trim().max(40, "El nombre no puede superar los 40 caracteres").optional(),
  mpTna: z
    .number({ invalid_type_error: "La TNA tiene que ser un número" })
    .min(0, "La TNA no puede ser negativa")
    .max(1000, "La TNA parece demasiado alta")
    .optional(),
  cardCutoffDay: z
    .number({ invalid_type_error: "El día de cierre tiene que ser un número" })
    .int("El día de cierre es un número entero")
    .min(1, "El día de cierre va de 1 a 31")
    .max(31, "El día de cierre va de 1 a 31")
    .optional(),
  cardDueDay: z
    .number({ invalid_type_error: "El día de vencimiento tiene que ser un número" })
    .int("El día de vencimiento es un número entero")
    .min(1, "El día de vencimiento va de 1 a 31")
    .max(31, "El día de vencimiento va de 1 a 31")
    .optional(),
  salaryPaymentOffsetMonths: z
    .number({ invalid_type_error: "Tiene que ser un número" })
    .int()
    .min(0, "No puede ser negativo")
    .max(12, "Máximo 12 meses")
    .optional(),
  // Bootstrap: sólo tienen efecto en desarrollo local (se guardan en disco);
  // en Vercel vienen de variables de entorno.
  googleSheetId: z
    .string()
    .trim()
    .max(200)
    .regex(/^[A-Za-z0-9_-]*$/, "El Sheet ID sólo tiene letras, números, guiones y guiones bajos")
    .optional(),
  googleCredsPath: z.string().trim().max(500).optional(),
});

export type ConfigInput = z.infer<typeof ConfigSchema>;

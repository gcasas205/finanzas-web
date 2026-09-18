import { z } from "zod";

export const TransactionSchema = z.object({
  id: z.string().optional(),
  fechaConsumo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato inválido (YYYY-MM-DD)"),
  fechaPago: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato inválido (YYYY-MM-DD)").optional(),
  tipo: z.enum(["ingreso", "egreso"]),
  descripcion: z.string().min(2, "Descripción muy corta").max(100),
  monto: z.number().positive("El monto debe ser mayor a 0"),
  moneda: z.enum(["ARS", "USD"]).default("ARS"),
  categoria: z.string().min(1),
  subcategoria: z.string().min(1),
  fuente: z.enum(["manual", "tarjeta", "recibo"]).default("manual"),
  cuotaTotal: z.number().int().min(1).default(1),
  cuotaNumero: z.number().int().min(1).default(1),
  notas: z.string().optional(),
  createdAt: z.string().optional(),
  origen: z.enum(["regla", "emergencia", "auto", "mud", "vac", "tec", "largo"]).optional(),
  asigMediano: z.number().optional(),
  asigLargo: z.number().optional(),
});

export type TransactionInput = z.infer<typeof TransactionSchema>;

import type { Doc } from '../../../convex/_generated/dataModel';

export type MedioPago = Doc<'movimientosCaja'>['medio'];

export const MEDIOS_DE_PAGO: MedioPago[] = ['efectivo', 'transferencia', 'mercadopago', 'otro'];

export const NOMBRE_MEDIO: Record<MedioPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  mercadopago: 'Mercado Pago',
  otro: 'Otro',
};

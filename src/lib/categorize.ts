import type { ItemType } from './types';

export interface Category {
  type: ItemType;
  group: string;
}

/**
 * Map a Spanish chart-of-accounts code (PGC) to a high-level category
 * suitable for grouping rows in the dashboard.
 *
 * Rules ported from the design bundle (data.jsx) — see CODING AGENTS bundle for source.
 * 7xxx = ingresos, 6xxx = gastos.
 */
export function categorize(account: string | null | undefined): Category {
  const a = (account ?? '').toString();

  if (a.startsWith('7')) {
    if (/^705101|^705102|^705103|^705105/.test(a)) return { type: 'income', group: 'Ventas recurrentes' };
    if (/^705104|^705106|^705107/.test(a)) return { type: 'income', group: 'Ventas no recurrentes' };
    if (/^705201|^705202|^705203/.test(a)) return { type: 'income', group: 'Ventas distribuidores' };
    if (a.startsWith('705000')) return { type: 'income', group: 'Otras ventas' };
    if (a.startsWith('740')) return { type: 'income', group: 'Subvenciones' };
    if (/^752|^759|^754/.test(a)) return { type: 'income', group: 'Otros ingresos' };
    if (a.startsWith('778')) return { type: 'income', group: 'Extraordinarios' };
    return { type: 'income', group: 'Otros ingresos' };
  }

  if (/^640|^641/.test(a)) return { type: 'expense', group: 'Salarios' };
  if (/^642|^649/.test(a)) return { type: 'expense', group: 'Seg. Social' };
  if (a.startsWith('623')) return { type: 'expense', group: 'Profesionales' };
  if (/^629100|^6291/.test(a)) return { type: 'expense', group: 'Subscripciones SaaS' };
  if (a.startsWith('629')) return { type: 'expense', group: 'Otros servicios' };
  if (a.startsWith('621')) return { type: 'expense', group: 'Alquileres' };
  if (a.startsWith('622')) return { type: 'expense', group: 'Reparaciones' };
  if (a.startsWith('625')) return { type: 'expense', group: 'Seguros' };
  if (a.startsWith('626')) return { type: 'expense', group: 'Banca' };
  if (a.startsWith('627')) return { type: 'expense', group: 'Publicidad/Viajes' };
  if (a.startsWith('628')) return { type: 'expense', group: 'Suministros' };
  if (a.startsWith('624')) return { type: 'expense', group: 'Transportes' };
  if (/^630|^631/.test(a)) return { type: 'expense', group: 'Impuestos' };
  if (/^659|^662|^668|^671|^678/.test(a)) return { type: 'expense', group: 'Excepcionales/Financ.' };
  if (a.startsWith('681')) return { type: 'expense', group: 'Amortización' };
  if (/^600|^601|^602|^610|^620/.test(a)) return { type: 'expense', group: 'Aprovisionamientos' };

  return { type: 'expense', group: 'Otros' };
}

export const GROUP_ORDER: readonly string[] = [
  // income groups
  'Ventas recurrentes',
  'Ventas no recurrentes',
  'Ventas distribuidores',
  'Otras ventas',
  'Subvenciones',
  'Otros ingresos',
  'Extraordinarios',
  // expense groups
  'Salarios',
  'Seg. Social',
  'Profesionales',
  'Subscripciones SaaS',
  'Otros servicios',
  'Alquileres',
  'Seguros',
  'Banca',
  'Publicidad/Viajes',
  'Suministros',
  'Transportes',
  'Impuestos',
  'Excepcionales/Financ.',
  'Amortización',
  'Aprovisionamientos',
  'Reparaciones',
  'Otros',
];

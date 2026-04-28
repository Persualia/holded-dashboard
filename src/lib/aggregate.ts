import type { Aggregation, EffectiveItem, Item } from './types';

/**
 * Aggregate a list of P&L items by month and by group.
 * Income contributes positively; expenses are stored signed (already negative).
 * `net` = income + expense (since expense values are already negative).
 */
export function aggregate(items: Array<Item | EffectiveItem>): Aggregation {
  const income = new Array(12).fill(0);
  const expense = new Array(12).fill(0);
  const byGroup: Aggregation['byGroup'] = {};

  for (const it of items) {
    for (let m = 0; m < 12; m++) {
      const v = it.values[m] ?? 0;
      if (it.type === 'income') income[m] += v;
      else expense[m] += v;
    }
    if (!byGroup[it.group]) {
      byGroup[it.group] = {
        type: it.type,
        values: new Array(12).fill(0),
        total: 0,
        items: [],
      };
    }
    const g = byGroup[it.group];
    g.items.push(it);
    for (let m = 0; m < 12; m++) {
      const v = it.values[m] ?? 0;
      g.values[m] += v;
      g.total += v;
    }
  }

  const net = income.map((v, i) => v + expense[i]);
  const totals = {
    income: income.reduce((a, b) => a + b, 0),
    expense: expense.reduce((a, b) => a + b, 0),
    net: net.reduce((a, b) => a + b, 0),
  };
  return { income, expense, net, byGroup, totals };
}

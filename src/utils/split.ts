export type SplitMember = { id: string; name: string };
export type SplitExpense = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  paidBy: string;
  sharedBy: string[];
};

const toCents = (n: number) => Math.round(n * 100);

// Splits an amount in cents between people. Leftover cents go to the first people in the list,
// so the shares always add up exactly.
function shareCents(cents: number, n: number, index: number): number {
  const base = Math.floor(cents / n);
  const extra = cents - base * n;
  return base + (index < extra ? 1 : 0);
}

export function computeBalances(members: SplitMember[], expenses: SplitExpense[]) {
  const paid = new Map<string, number>();
  const owed = new Map<string, number>();
  members.forEach((m) => {
    paid.set(m.id, 0);
    owed.set(m.id, 0);
  });

  let groupCents = 0;
  for (const e of expenses) {
    const cents = toCents(e.total);
    groupCents += cents;
    paid.set(e.paidBy, (paid.get(e.paidBy) ?? 0) + cents);

    const n = e.sharedBy.length;
    if (n === 0) continue;
    e.sharedBy.forEach((id, i) => {
      owed.set(id, (owed.get(id) ?? 0) + shareCents(cents, n, i));
    });
  }

  const balances = members.map((m) => {
    const p = paid.get(m.id) ?? 0;
    const o = owed.get(m.id) ?? 0;
    return { id: m.id, name: m.name, paid: p / 100, owed: o / 100, net: (p - o) / 100 };
  });

  // Pair the largest debtor with the largest creditor until everyone is settled.
  const net = members.map((m) => ({ id: m.id, c: (paid.get(m.id) ?? 0) - (owed.get(m.id) ?? 0) }));
  const creditors = net.filter((x) => x.c > 0).sort((a, b) => b.c - a.c);
  const debtors = net.filter((x) => x.c < 0).map((x) => ({ id: x.id, c: -x.c })).sort((a, b) => b.c - a.c);

  const settlements: { from: string; to: string; amount: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].c, creditors[j].c);
    if (amt > 0) {
      settlements.push({ from: debtors[i].id, to: creditors[j].id, amount: amt / 100 });
    }
    debtors[i].c -= amt;
    creditors[j].c -= amt;
    if (debtors[i].c === 0) i++;
    if (creditors[j].c === 0) j++;
  }

  return { groupTotal: groupCents / 100, balances, settlements };
}

// Each item one member is included in, with their share, for summaries.
export function itemsFor(memberId: string, expenses: SplitExpense[]) {
  const items: { name: string; quantity: number; unitPrice: number; total: number; share: number }[] = [];
  let owedCents = 0;
  for (const e of expenses) {
    const idx = e.sharedBy.indexOf(memberId);
    if (idx < 0) continue;
    const share = shareCents(toCents(e.total), e.sharedBy.length, idx);
    owedCents += share;
    items.push({
      name: e.name,
      quantity: e.quantity,
      unitPrice: e.unitPrice,
      total: e.total,
      share: share / 100,
    });
  }
  return { items, owed: owedCents / 100 };
}
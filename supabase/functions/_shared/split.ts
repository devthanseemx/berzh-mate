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
export type SplitPayment = { from: string; to: string; amount: number };
type Options = { advances?: Record<string, number>; payments?: SplitPayment[] };

const toCents = (n: number) => Math.round(n * 100);

// Splits an amount in cents. Leftover cents go to the first people in the list.
function shareCents(cents: number, n: number, index: number): number {
  const base = Math.floor(cents / n);
  const extra = cents - base * n;
  return base + (index < extra ? 1 : 0);
}

// net > 0 means the group owes this person. net < 0 means they still owe.
// Net includes expenses paid, advances, what each person owes, and payments made later.
export function computeBalances(members: SplitMember[], expenses: SplitExpense[], opts: Options = {}) {
  const paidExp = new Map<string, number>();
  const owed = new Map<string, number>();
  const adv = new Map<string, number>();
  const net = new Map<string, number>();

  members.forEach((m) => {
    paidExp.set(m.id, 0);
    owed.set(m.id, 0);
    adv.set(m.id, toCents(opts.advances?.[m.id] ?? 0));
  });

  let groupCents = 0;
  for (const e of expenses) {
    const cents = toCents(e.total);
    groupCents += cents;
    paidExp.set(e.paidBy, (paidExp.get(e.paidBy) ?? 0) + cents);

    const n = e.sharedBy.length;
    if (n === 0) continue;
    e.sharedBy.forEach((id, i) => {
      owed.set(id, (owed.get(id) ?? 0) + shareCents(cents, n, i));
    });
  }

  members.forEach((m) => {
    net.set(m.id, (paidExp.get(m.id) ?? 0) + (adv.get(m.id) ?? 0) - (owed.get(m.id) ?? 0));
  });

  // A payment from A to B: A has paid part of their debt, and B has received it.
  for (const p of opts.payments ?? []) {
    if (!net.has(p.from) || !net.has(p.to)) continue;
    const c = toCents(p.amount);
    net.set(p.from, (net.get(p.from) ?? 0) + c);
    net.set(p.to, (net.get(p.to) ?? 0) - c);
  }

  const balances = members.map((m) => ({
    id: m.id,
    name: m.name,
    paid: (paidExp.get(m.id) ?? 0) / 100,
    advance: (adv.get(m.id) ?? 0) / 100,
    owed: (owed.get(m.id) ?? 0) / 100,
    net: (net.get(m.id) ?? 0) / 100,
  }));

  // Pair the largest debtor with the largest creditor until everyone is settled.
  const creditors = members
    .map((m) => ({ id: m.id, c: net.get(m.id) ?? 0 }))
    .filter((x) => x.c > 0)
    .sort((a, b) => b.c - a.c);
  const debtors = members
    .map((m) => ({ id: m.id, c: -(net.get(m.id) ?? 0) }))
    .filter((x) => x.c > 0)
    .sort((a, b) => b.c - a.c);

  const settlements: { from: string; to: string; amount: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].c, creditors[j].c);
    if (amt > 0) settlements.push({ from: debtors[i].id, to: creditors[j].id, amount: amt / 100 });
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
    items.push({ name: e.name, quantity: e.quantity, unitPrice: e.unitPrice, total: e.total, share: share / 100 });
  }
  return { items, owed: owedCents / 100 };
}
import { createClient } from 'npm:@supabase/supabase-js@2';
import { computeBalances, itemsFor } from '../_shared/split.ts';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const money = (n: number) => `LKR ${n.toFixed(2)}`;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const { group_id } = await req.json().catch(() => ({}));
  if (!group_id) return json({ error: 'group_id is required' }, 400);

  // Runs as the signed-in user, so row-level security applies.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Not signed in' }, 401);

  const { data: group } = await supabase.from('groups').select('id,name,owner_id').eq('id', group_id).single();
  if (!group || group.owner_id !== user.id) {
    return json({ error: 'Only the trip owner can send summaries' }, 403);
  }

  const { data: members } = await supabase.from('group_members').select('id,email,name').eq('group_id', group_id);
  const { data: rows } = await supabase
    .from('group_expenses')
    .select('id,name,quantity,unit_price,total,paid_by,created_at,group_expense_shares(member_id)')
    .eq('group_id', group_id)
    .order('created_at');

  const expenses = (rows ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    quantity: Number(r.quantity),
    unitPrice: Number(r.unit_price),
    total: Number(r.total),
    paidBy: r.paid_by,
    sharedBy: (r.group_expense_shares ?? []).map((s: any) => s.member_id),
  }));
  const people = (members ?? []).map((m: any) => ({ id: m.id, name: m.name || m.email }));
  const { groupTotal, balances, settlements } = computeBalances(people, expenses);
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? '';

  const apiKey = Deno.env.get('MAILEROO_API_KEY');
  const fromAddress = Deno.env.get('FROM_ADDRESS');
  const fromName = Deno.env.get('FROM_NAME') ?? 'Berzh Mate';
  if (!apiKey || !fromAddress) return json({ error: 'Email is not configured on the server' }, 500);
  const looksValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fromAddress);
  if (!looksValid || fromAddress.includes('yourdomain.com')) {
    return json(
      { error: 'FROM_ADDRESS is not set to a real address on your verified Maileroo domain. Update it with supabase secrets set.' },
      500
    );
  }

  const sent: string[] = [];
  const failed: string[] = [];
  let lastError: string | undefined;

  for (const m of members ?? []) {
    const { items, owed } = itemsFor(m.id, expenses);
    const mine = settlements.filter((s) => s.from === m.id || s.to === m.id);
    const payLines = mine.map((s) =>
      s.from === m.id
        ? `You pay ${money(s.amount)} to ${esc(nameOf(s.to))}`
        : `${esc(nameOf(s.from))} pays you ${money(s.amount)}`
    );

    const itemRows = items
      .map(
        (i) =>
          `<tr><td>${esc(i.name)}</td><td>${i.quantity} × ${money(i.unitPrice)}</td>` +
          `<td style="text-align:right">${money(i.share)}</td></tr>`
      )
      .join('');

    const html = `
      <div style="font-family:Arial,sans-serif;color:#111">
        <h2>${esc(group.name)}</h2>
        <p>Hi ${esc(m.name || m.email)}, here is your share of the trip costs.</p>
        <table style="width:100%;border-collapse:collapse" cellpadding="6">
          <tr><th align="left">Item</th><th align="left">Qty × price</th><th align="right">Your share</th></tr>
          ${itemRows || '<tr><td colspan="3">No items you are included in.</td></tr>'}
        </table>
        <p><strong>You owe: ${money(owed)}</strong></p>
        ${payLines.length ? `<p>${payLines.join('<br>')}</p>` : ''}
        <p style="color:#666">Trip total: ${money(groupTotal)}</p>
      </div>`;

    // Maileroo Email API: POST /emails with the sending key in X-Api-Key.
    const res = await fetch('https://smtp.maileroo.com/api/v2/emails', {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: { address: fromAddress, display_name: fromName },
        to: [{ address: m.email, display_name: m.name || m.email }],
        subject: `${group.name}: you owe ${money(owed)}`,
        html,
      }),
    });

    const body = await res.json().catch(() => ({} as any));
    if (res.ok && body.success !== false) {
      sent.push(m.email);
    } else {
      failed.push(m.email);
      lastError = body.message ?? `Maileroo error ${res.status}`;
    }
  }

  return json({ sent: sent.length, failed, lastError });
});
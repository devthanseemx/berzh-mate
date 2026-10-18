import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedButton } from '../../components/AnimatedButton';
import { TextField } from '../../components/TextField';
import {
    addExpense,
    addMember,
    claimInvites,
    createInvite,
    currentUserId,
    deleteExpense,
    deletePayment,
    endGroup,
    getGroup,
    inviteUrl,
    recordPayment,
    removeMember,
    revokeInvites,
    sendSummary,
    setAdvance,
} from '../../services/groups';
import { colors, radius } from '../../theme/colors';
import { money } from '../../utils/fare';
import { computeBalances } from '../../utils/split';

type Detail = Awaited<ReturnType<typeof getGroup>>;

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
    return (
        <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
        </Pressable>
    );
}

export default function GroupDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [data, setData] = useState<Detail | null>(null);
    const [me, setMe] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [invite, setInvite] = useState<{ code: string; url: string } | null>(null);

    const [memberEmail, setMemberEmail] = useState('');
    const [memberName, setMemberName] = useState('');

    const [advanceFor, setAdvanceFor] = useState<string | null>(null);
    const [advanceText, setAdvanceText] = useState('');

    const [expName, setExpName] = useState('');
    const [qty, setQty] = useState('1');
    const [price, setPrice] = useState('');
    const [paidBy, setPaidBy] = useState<string | null>(null);
    const [included, setIncluded] = useState<string[]>([]);

    const [payMember, setPayMember] = useState<string | null>(null);
    const [payAmount, setPayAmount] = useState('');
    const [payNote, setPayNote] = useState('');

    const load = useCallback(async () => {
        try {
            setData(await getGroup(id));
            setError(null);
        } catch (e: any) {
            setError(e.message);
        }
    }, [id]);

    useFocusEffect(
        useCallback(() => {
            (async () => {
                await claimInvites();
                setMe(await currentUserId());
                await load();
            })();
        }, [load])
    );

    const members = data?.members ?? [];
    const group = data?.group;
    const finished = group?.status === 'finished';
    const isOwner = !!group && group.owner_id === me;
    const myMember = members.find((m) => m.user_id === me) ?? null;
    const nameOf = (mid: string) => {
        const m = members.find((x) => x.id === mid);
        return m ? m.name || m.email : 'Unknown';
    };
    const addedBy = (userId: string) => {
        const m = members.find((x) => x.user_id === userId);
        return m ? m.name || m.email : 'Someone';
    };

    // Defaults: you are the payer, everyone is included, and you are the payer for payments.
    useEffect(() => {
        if (!data) return;
        setPaidBy((p) => p ?? myMember?.id ?? members[0]?.id ?? null);
        setIncluded((inc) =>
            inc.length ? inc.filter((x) => members.some((m) => m.id === x)) : members.map((m) => m.id)
        );
    }, [data]);

    const summary = useMemo(() => {
        if (!data) return null;
        return computeBalances(
            data.members.map((m) => ({ id: m.id, name: m.name || m.email })),
            data.expenses.map((e) => ({
                id: e.id,
                name: e.name,
                quantity: e.quantity,
                unitPrice: e.unit_price,
                total: e.total,
                paidBy: e.paid_by,
                sharedBy: e.shares,
            })),
            {
                advances: Object.fromEntries(data.members.map((m) => [m.id, m.advance_paid])),
                payments: data.payments.map((p) => ({ from: p.from_member, amount: p.amount })),
            }
        );
    }, [data]);

    const lineTotal = (Number(qty) || 0) * (Number(price) || 0);

    const run = async (fn: () => Promise<unknown>, after?: () => void) => {
        setBusy(true);
        setError(null);
        try {
            await fn();
            after?.();
            await load();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    const saveMember = () =>
        run(() => addMember(id, memberEmail, memberName), () => {
            setMemberEmail('');
            setMemberName('');
        });

    const saveAdvance = () => {
        if (!advanceFor) return;
        const amount = Number(advanceText) || 0;
        if (amount < 0) return setError('Amount cannot be negative.');
        return run(() => setAdvance(advanceFor, amount), () => setAdvanceFor(null));
    };

    const saveExpense = () => {
        if (!paidBy) return setError('Choose who paid.');
        if (!expName.trim()) return setError('Enter a name for the expense.');
        if (!(Number(qty) > 0)) return setError('Quantity must be more than 0.');
        if (price.trim() === '' || Number(price) < 0) return setError('Enter a price.');
        if (!included.length) return setError('Choose at least one person to split with.');
        return run(
            () =>
                addExpense({
                    group: id,
                    name: expName,
                    quantity: Number(qty),
                    unitPrice: Number(price),
                    paidBy,
                    sharedBy: included,
                }),
            () => {
                setExpName('');
                setPrice('');
                setQty('1');
            }
        );
    };

    const savePayment = () => {
        if (!payMember) return setError('Choose who paid.');
        if (!(Number(payAmount) > 0)) return setError('Enter an amount greater than 0.');
        return run(
            () => recordPayment({ group: id, member: payMember, amount: Number(payAmount), note: payNote }),
            () => {
                setPayAmount('');
                setPayNote('');
            }
        );
    };

    const confirmRemove = (memberId: string, label: string) =>
        Alert.alert('Remove person?', `${label} will be removed from the trip.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => run(() => removeMember(memberId)) },
        ]);

    const confirmEnd = () =>
        Alert.alert('End this trip?', 'Live location sharing stops for everyone. Expenses and payments stay.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'End trip', style: 'destructive', onPress: () => run(() => endGroup(id)) },
        ]);

    const sendEmails = () =>
        run(async () => {
            const r = await sendSummary(id);
            Alert.alert(
                r.failed.length ? 'Some emails failed' : 'Summaries sent',
                r.failed.length
                    ? `${r.sent} sent. Failed: ${r.failed.join(', ')}.${r.lastError ? `\n\nReason: ${r.lastError}` : ''}`
                    : `${r.sent} email(s) sent.`
            );
        });

    const getInvite = async () => {
        if (invite) return invite;
        const code = await createInvite(id);
        const next = { code, url: inviteUrl(code) };
        setInvite(next);
        return next;
    };

    const shareLink = async () => {
        try {
            const { code, url } = await getInvite();
            await Share.share({
                message: `Join my trip "${group?.name ?? ''}" on Berzh Mate.\nCode: ${code}\n${url}`,
            });
        } catch (e: any) {
            setError(e.message);
        }
    };

    const copyLink = async () => {
        try {
            const { code, url } = await getInvite();
            await Clipboard.setStringAsync(`Join my trip on Berzh Mate. Code: ${code} ${url}`);
            Alert.alert('Copied', 'Paste it into any app to invite people.');
        } catch (e: any) {
            setError(e.message);
        }
    };

    const revokeLinks = () =>
        Alert.alert('Revoke all invite links?', 'Links already shared will stop working.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Revoke',
                style: 'destructive',
                onPress: () =>
                    run(async () => {
                        await revokeInvites(id);
                        setInvite(null);
                    }),
            },
        ]);

    if (!group || !summary) {
        return (
            <SafeAreaView style={styles.safe}>
                <Text style={styles.muted}>{error ?? 'Loading…'}</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>{group.name}</Text>
                <Text style={[styles.badge, finished ? styles.badgeDone : styles.badgeActive]}>
                    {finished ? 'Finished' : 'Active'} · {isOwner ? 'You own this trip' : 'Member'}
                </Text>

                <View style={styles.totalCard}>
                    <Text style={styles.label}>TRIP TOTAL</Text>
                    <Text style={styles.total}>{money(summary.groupTotal)}</Text>
                </View>

                <AnimatedButton label="Live map" variant="ghost" onPress={() => router.push(`/groups/live/${id}`)} />

                {error && <Text style={styles.error}>{error}</Text>}

                <View style={styles.card}>
                    <Text style={styles.section}>Trip collection</Text>
                    <View style={styles.row}>
                        <Text style={styles.rowName}>Collected in</Text>
                        <Text style={styles.net}>
                            {money(summary.balances.reduce((s, b) => s + b.advance, 0) + data.payments.reduce((s, p) => s + p.amount, 0))}
                        </Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.rowName}>Spent on expenses</Text>
                        <Text style={styles.net}>{money(summary.groupTotal)}</Text>
                    </View>
                </View>

                {/* Balances */}
                <View style={styles.card}>
                    <Text style={styles.section}>Balances</Text>
                    {summary.balances.map((b) => (
                        <View key={b.id} style={styles.balanceRow}>
                            <Text style={styles.rowName} numberOfLines={1}>{b.name}</Text>
                            <Text style={styles.muted}>
                                paid {money(b.paid + b.advance)} · share {money(b.owed)}
                            </Text>
                            <Text style={[styles.net, { color: b.net >= 0 ? colors.primary : colors.danger }]}>
                                {Math.abs(b.net) < 0.005 ? 'settled' : b.net > 0 ? `gets ${money(b.net)}` : `owes ${money(-b.net)}`}
                            </Text>
                        </View>
                    ))}

                    {summary.settlements.length > 0 && <Text style={[styles.section, { marginTop: 12 }]}>Still to settle</Text>}
                    {summary.settlements.map((s, i) => (
                        <Text key={i} style={styles.settle}>
                            {nameOf(s.from)} → {nameOf(s.to)}: {money(s.amount)}
                        </Text>
                    ))}
                    {summary.settlements.length === 0 && <Text style={styles.muted}>Everyone is settled.</Text>}
                </View>

                {/* Payments made later */}
                {/* Payments into the trip collection (owner only) */}
                {isOwner && !finished && members.length > 0 && (
                    <View style={styles.card}>
                        <Text style={styles.section}>Record a payment</Text>
                        <Text style={styles.muted}>Add money someone has paid into the trip collection.</Text>
                        <Text style={styles.label}>Who paid</Text>
                        <View style={styles.chips}>
                            {members.map((m) => (
                                <Chip key={m.id} label={m.name || m.email} on={payMember === m.id} onPress={() => setPayMember(m.id)} />
                            ))}
                        </View>
                        <TextField label="Amount (LKR)" value={payAmount} onChangeText={setPayAmount} keyboard="decimal-pad" placeholder="0" />
                        <TextField label="Note (optional)" value={payNote} onChangeText={setPayNote} placeholder="Cash, bank transfer…" />
                        <AnimatedButton label="Save payment" disabled={busy} onPress={savePayment} style={{ marginTop: 6 }} />
                    </View>
                )}

                {data && data.payments.length > 0 && (
                    <View style={styles.card}>
                        <Text style={styles.section}>Payments into the collection ({data.payments.length})</Text>
                        {data.payments.map((p) => (
                            <View key={p.id} style={styles.expense}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.rowName}>
                                        {nameOf(p.from_member)} paid {money(p.amount)}
                                    </Text>
                                    <Text style={styles.muted}>
                                        {new Date(p.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        {p.note ? ` · ${p.note}` : ''}
                                    </Text>
                                </View>
                                {isOwner && !finished && (
                                    <Pressable onPress={() => run(() => deletePayment(p.id))}>
                                        <Text style={styles.link}>Delete</Text>
                                    </Pressable>
                                )}
                            </View>
                        ))}
                    </View>
                )}

                {/* Invite */}
                {!finished && myMember && (
                    <View style={styles.card}>
                        <Text style={styles.section}>Invite people</Text>
                        <Text style={styles.muted}>Share the link or code through WhatsApp, Gmail, or any app. Links expire after 7 days.</Text>
                        {invite && <Text style={styles.code}>Code: {invite.code}</Text>}
                        <AnimatedButton label="Share invite" onPress={shareLink} disabled={busy} />
                        <AnimatedButton label="Copy invite" variant="ghost" onPress={copyLink} disabled={busy} />
                        {isOwner && <AnimatedButton label="Revoke all links" variant="danger" onPress={revokeLinks} disabled={busy} />}
                    </View>
                )}

                {/* People */}
                <View style={styles.card}>
                    <Text style={styles.section}>People ({members.length})</Text>
                    {members.map((m) => {
                        const canSetAdvance = !finished && (isOwner || m.user_id === me);
                        const canRemove = isOwner && m.user_id !== group.owner_id && !finished;
                        return (
                            <View key={m.id}>
                                <View style={styles.row}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.rowName} numberOfLines={1}>
                                            {m.name || m.email} {m.user_id === me ? '(you)' : ''}
                                        </Text>
                                        <Text style={styles.muted} numberOfLines={1}>
                                            {m.email} · advance {money(m.advance_paid)}
                                            {m.user_id ? '' : ' · not signed in yet'}
                                        </Text>
                                    </View>
                                    {canSetAdvance && (
                                        <Pressable
                                            onPress={() => {
                                                setAdvanceFor(m.id);
                                                setAdvanceText(m.advance_paid ? String(m.advance_paid) : '');
                                            }}
                                        >
                                            <Text style={styles.link}>Advance</Text>
                                        </Pressable>
                                    )}
                                    {canRemove && (
                                        <Pressable onPress={() => confirmRemove(m.id, m.name || m.email)}>
                                            <Text style={[styles.link, { color: colors.danger }]}>Remove</Text>
                                        </Pressable>
                                    )}
                                </View>
                                {advanceFor === m.id && (
                                    <View style={styles.inline}>
                                        <TextField label="Amount already paid in (LKR)" value={advanceText} onChangeText={setAdvanceText} keyboard="decimal-pad" placeholder="0" />
                                        <View style={styles.twoCol}>
                                            <AnimatedButton label="Save" disabled={busy} onPress={saveAdvance} style={{ flex: 1 }} />
                                            <AnimatedButton label="Cancel" variant="ghost" onPress={() => setAdvanceFor(null)} style={{ flex: 1 }} />
                                        </View>
                                    </View>
                                )}
                            </View>
                        );
                    })}

                    {isOwner && !finished && (
                        <View style={{ marginTop: 12, gap: 8 }}>
                            <TextField label="Gmail address" value={memberEmail} onChangeText={setMemberEmail} keyboard="email-address" placeholder="friend@gmail.com" />
                            <TextField label="Name (optional)" value={memberName} onChangeText={setMemberName} placeholder="Nimal" />
                            <AnimatedButton label="Add person" variant="ghost" disabled={busy || !memberEmail} onPress={saveMember} />
                        </View>
                    )}
                </View>

                {/* Add expense */}
                {!finished && myMember && (
                    <View style={styles.card}>
                        <Text style={styles.section}>Add expense</Text>
                        <Text style={styles.hint}>
                            Adding as {myMember.name || myMember.email}. Your name will show as "added by" on this expense.
                        </Text>
                        <TextField label="Name" value={expName} onChangeText={setExpName} placeholder="Lunch, Fuel, Entry tickets" />
                        <View style={styles.twoCol}>
                            <View style={{ flex: 1 }}>
                                <TextField label="Quantity" value={qty} onChangeText={setQty} keyboard="decimal-pad" />
                            </View>
                            <View style={{ flex: 2 }}>
                                <TextField label="Price each (LKR)" value={price} onChangeText={setPrice} keyboard="decimal-pad" placeholder="0" />
                            </View>
                        </View>
                        <Text style={styles.line}>Line total: {money(lineTotal)}</Text>

                        <Text style={styles.label}>Paid by</Text>
                        <View style={styles.chips}>
                            {members.map((m) => (
                                <Chip key={m.id} label={m.name || m.email} on={paidBy === m.id} onPress={() => setPaidBy(m.id)} />
                            ))}
                        </View>

                        <Text style={[styles.label, { marginTop: 10 }]}>Split with</Text>
                        <View style={styles.chips}>
                            {members.map((m) => {
                                const on = included.includes(m.id);
                                return (
                                    <Chip
                                        key={m.id}
                                        label={m.name || m.email}
                                        on={on}
                                        onPress={() => setIncluded((inc) => (on ? inc.filter((x) => x !== m.id) : [...inc, m.id]))}
                                    />
                                );
                            })}
                        </View>
                        <Text style={styles.muted}>
                            Split equally between {included.length} {included.length === 1 ? 'person' : 'people'}.
                        </Text>

                        <AnimatedButton label={busy ? 'Saving…' : 'Add expense'} disabled={busy} onPress={saveExpense} style={{ marginTop: 14 }} />
                    </View>
                )}

                {/* Expenses */}
                <View style={styles.card}>
                    <Text style={styles.section}>Expenses ({data.expenses.length})</Text>
                    {data.expenses.length === 0 && <Text style={styles.muted}>No expenses yet.</Text>}
                    {data.expenses.map((e) => {
                        const excluded = members.filter((m) => !e.shares.includes(m.id));
                        const canDelete = !finished && (e.created_by === me || isOwner);
                        return (
                            <View key={e.id} style={styles.expense}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.rowName}>{e.name}</Text>
                                    <Text style={styles.muted}>
                                        {e.quantity} × {money(e.unit_price)} = {money(e.total)}
                                    </Text>
                                    <Text style={styles.muted}>
                                        Paid by {nameOf(e.paid_by)} · added by {addedBy(e.created_by)}
                                    </Text>
                                    <Text style={styles.muted}>
                                        Split {e.shares.length === members.length ? 'with everyone' : `with ${e.shares.map(nameOf).join(', ')}`}
                                    </Text>
                                    {excluded.length > 0 && (
                                        <Text style={styles.muted}>Not included: {excluded.map((x) => x.name || x.email).join(', ')}</Text>
                                    )}
                                </View>
                                {canDelete && (
                                    <Pressable onPress={() => run(() => deleteExpense(e.id))}>
                                        <Text style={styles.link}>Delete</Text>
                                    </Pressable>
                                )}
                            </View>
                        );
                    })}
                </View>

                {/* Owner actions */}
                {isOwner && (
                    <View style={styles.card}>
                        <Text style={styles.section}>Trip actions</Text>
                        <AnimatedButton label={busy ? 'Sending…' : 'Email each person their share'} variant="ghost" disabled={busy} onPress={sendEmails} />
                        {!finished && <AnimatedButton label="End trip" variant="danger" disabled={busy} onPress={confirmEnd} style={{ marginTop: 10 }} />}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 20, gap: 14 },
    title: { color: colors.text, fontSize: 26, fontWeight: '800' },
    badge: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', color: colors.bg },
    badgeActive: { backgroundColor: colors.primary },
    badgeDone: { backgroundColor: colors.muted },
    totalCard: { backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, padding: 18, borderWidth: 1, borderColor: colors.accent },
    total: { color: colors.accent, fontSize: 32, fontWeight: '800', marginTop: 4 },
    card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 8 },
    section: { color: colors.text, fontWeight: '800', fontSize: 16 },
    label: { color: colors.muted, fontSize: 13 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    balanceRow: { gap: 2, paddingVertical: 6, borderBottomWidth: 1, borderColor: colors.border },
    rowName: { color: colors.text, fontWeight: '600', flexShrink: 1 },
    net: { fontWeight: '700', fontSize: 13 },
    settle: { color: colors.text, paddingVertical: 2 },
    muted: { color: colors.muted, fontSize: 12 },
    hint: { color: colors.primary, fontSize: 12 },
    code: { color: colors.accent, fontWeight: '800', letterSpacing: 2, fontSize: 18 },
    link: { color: colors.primary, fontWeight: '600' },
    error: { color: colors.danger },
    line: { color: colors.accent, fontWeight: '700' },
    twoCol: { flexDirection: 'row', gap: 10 },
    inline: { gap: 6, paddingBottom: 8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
    chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
    chipTextOn: { color: colors.bg },
    expense: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderColor: colors.border },
});
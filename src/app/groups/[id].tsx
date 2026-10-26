import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedButton } from '../../components/AnimatedButton';
import { BackButton } from '../../components/BackButton';
import { useConfirm } from '../../components/Confirm';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/Toast';
import { capitalize } from '../../utils/format';
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
} from '../../services/groups';
import { cardStyle, colors, radius } from '../../theme/colors';
import { fonts } from '../../theme/font';
import { money } from '../../utils/fare';
import { computeBalances } from '../../utils/split';

type Detail = Awaited<ReturnType<typeof getGroup>>;

// Chip with a small initial circle — used for the "paid by" / "split with" people.
function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
    return (
        <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
            <View style={[styles.chipAvatar, on && styles.chipAvatarOn]}>
                <Text style={[styles.chipAvatarText, on && styles.chipAvatarTextOn]}>
                    {(label || '?').charAt(0).toUpperCase()}
                </Text>
            </View>
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
        </Pressable>
    );
}

// Section heading with a small icon.
function Section({ icon, children, style }: { icon: keyof typeof Ionicons.glyphMap; children: ReactNode; style?: object }) {
    return (
        <View style={[styles.sectionHead, style]}>
            <Ionicons name={icon} size={15} color={colors.accent} />
            <Text style={styles.section}>{children}</Text>
        </View>
    );
}

function CollapsibleCard({
    icon,
    title,
    children,
}: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    children: ReactNode;
}) {
    const [expanded, setExpanded] = useState(false);
    return (
        <View style={styles.card}>
            <Pressable
                onPress={() => setExpanded((value) => !value)}
                style={styles.collapseHeader}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
            >
                <Section icon={icon}>{title}</Section>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
            </Pressable>
            {expanded && <View style={styles.collapseContent}>{children}</View>}
        </View>
    );
}

export default function GroupDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const toast = useToast();
    const confirm = useConfirm();
    const [data, setData] = useState<Detail | null>(null);
    const [me, setMe] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [invite, setInvite] = useState<{ code: string; url: string } | null>(null);

    const [memberEmail, setMemberEmail] = useState('');
    const [memberName, setMemberName] = useState('');

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
            toast.error('Could not load trip', e.message);
        }
    }, [id, toast]);

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

    const run = async (fn: () => Promise<unknown>, after?: () => void, done?: [string, string]) => {
        setBusy(true);
        setError(null);
        try {
            await fn();
            after?.();
            if (done) toast.success(done[0], done[1]);
            await load();
        } catch (e: any) {
            toast.error('Could not complete action', e.message);
        } finally {
            setBusy(false);
        }
    };

    const showValidationError = (message: string) => toast.error('Check the details', message);

    const saveMember = () => {
        const email = memberEmail.trim();
        if (!email) return showValidationError('Enter a Gmail address.');
        if (!/^[^\s@]+@gmail\.com$/i.test(email)) return showValidationError('Enter a valid Gmail address.');
        return run(
            () => addMember(id, email, memberName.trim()),
            () => {
                setMemberEmail('');
                setMemberName('');
            },
            ['Added', 'Person added to the trip.']
        );
    };

    const saveExpense = () => {
        const unitPrice = Number(price);
        if (!paidBy) return showValidationError('Choose who paid for this expense.');
        if (!expName.trim()) return showValidationError('Enter a name for the expense.');
        if (!(Number(qty) > 0)) return showValidationError('Quantity must be more than 0.');
        if (price.trim() === '' || !Number.isFinite(unitPrice) || unitPrice < 0) {
            return showValidationError('Enter a valid price.');
        }
        if (!included.length) return showValidationError('Choose at least one person to split with.');
        return run(
            () =>
                addExpense({
                    group: id,
                    name: expName,
                    quantity: Number(qty),
                    unitPrice,
                    paidBy,
                    sharedBy: included,
                }),
            () => {
                setExpName('');
                setPrice('');
                setQty('1');
            },
            ['Saved', 'Expense added to the trip.']
        );
    };

    const savePayment = () => {
        if (!payMember) return showValidationError('Choose who made the payment.');
        if (!(Number(payAmount) > 0)) return showValidationError('Enter an amount greater than 0.');
        return run(
            () => recordPayment({ group: id, member: payMember, amount: Number(payAmount), note: payNote }),
            () => {
                setPayAmount('');
                setPayNote('');
            },
            ['Saved', 'Payment recorded in the collection.']
        );
    };

    const confirmRemove = async (memberId: string, label: string) => {
        const ok = await confirm({
            title: 'Remove person?',
            message: `${label} will be removed from the trip.`,
            confirmLabel: 'Remove',
            danger: true,
        });
        if (ok) run(() => removeMember(memberId), undefined, ['Removed', 'Person removed from the trip.']);
    };

    const confirmEnd = async () => {
        const ok = await confirm({
            title: 'End this trip?',
            message: 'Live location sharing stops for everyone. Expenses and payments stay.',
            confirmLabel: 'End trip',
            danger: true,
        });
        if (ok)
            run(
                async () => {
                    await endGroup(id);
                    router.replace('/(tabs)/groups');
                },
                undefined,
                ['Trip ended', 'Live sharing has stopped.']
            );
    };

    const sendEmails = async () => {
        setBusy(true);
        try {
            const r = await sendSummary(id);
            if (r.failed.length) {
                toast.error('Email problem', `${r.sent} sent. Failed: ${r.failed.join(', ')}.${r.lastError ? ` Reason: ${r.lastError}` : ''}`);
            } else {
                toast.success('Sent', `${r.sent} summary email${r.sent === 1 ? '' : 's'} sent.`);
            }
        } catch (e: any) {
            toast.error('Could not send', e.message);
        } finally {
            setBusy(false);
        }
    };

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
            toast.error('Could not create invite', e.message);
        }
    };

    const copyLink = async () => {
        try {
            const { code, url } = await getInvite();
            await Clipboard.setStringAsync(`Join my trip on Berzh Mate. Code: ${code} ${url}`);
            toast.success('Copied', 'Invite is in your clipboard.');
        } catch (e: any) {
            toast.error('Could not copy invite', e.message);
        }
    };

    const revokeLinks = async () => {
        const ok = await confirm({
            title: 'Revoke all invite links?',
            message: 'Links already shared will stop working.',
            confirmLabel: 'Revoke',
            danger: true,
        });
        if (ok)
            run(async () => {
                await revokeInvites(id);
                setInvite(null);
            }, undefined, ['Revoked', 'Invite links no longer work.']);
    };

    if (!group || !summary) {
        return (
            <SafeAreaView style={styles.safe}>
      <BackButton />
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={colors.primaryStrong} />
                    <Text style={[styles.loadingText, !!error && { color: colors.danger }]}>{error ?? 'Loading trip…'}</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safe}>
      <BackButton />
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>{capitalize(group.name)}</Text>
                <Text style={[styles.badge, finished ? styles.badgeDone : styles.badgeActive]}>
                    {finished ? 'Complete' : 'Active'} · {isOwner ? 'You own this trip' : 'Member'}
                </Text>

                {/* Hero: trip total with the collection summary inside */}
                <View style={styles.totalCard}>
                    <Text style={styles.label}>TRIP TOTAL</Text>
                    <Text style={styles.total}>{money(summary.groupTotal)}</Text>
                    <View style={styles.heroStats}>
                        <View style={styles.heroStat}>
                            <Text style={styles.heroValue}>
                                {money(summary.balances.reduce((s, b) => s + b.advance, 0) + data.payments.reduce((s, p) => s + p.amount, 0))}
                            </Text>
                            <Text style={styles.heroLabel}>Collected in</Text>
                        </View>
                        <View style={styles.heroDivider} />
                        <View style={styles.heroStat}>
                            <Text style={styles.heroValue}>{money(summary.groupTotal)}</Text>
                            <Text style={styles.heroLabel}>Spent on expenses</Text>
                        </View>
                    </View>
                    <AnimatedButton label="Live map" variant="ghost" onPress={() => router.push(`/groups/live/${id}`)} style={{ marginTop: 14 }} />
                </View>

                {/* Balances */}
                <CollapsibleCard icon="wallet-outline" title={`Balances (${summary.balances.length})`}>
                    {summary.balances.map((b) => {
                        const settled = Math.abs(b.net) < 0.005;
                        return (
                            <View key={b.id} style={styles.balanceRow}>
                                <View style={styles.avatarSm}>
                                    <Text style={styles.avatarSmText}>{(b.name || '?').charAt(0).toUpperCase()}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.rowName} numberOfLines={1}>{b.name}</Text>
                                    <Text style={styles.balanceDetail}>Paid: {money(b.paid + b.advance)}</Text>
                                    <Text style={styles.balanceDetail}>Share: {money(b.owed)}</Text>
                                </View>
                                <View style={[styles.netBadge, settled ? styles.netSettled : b.net > 0 ? styles.netGet : styles.netOwe]}>
                                    <Text style={[styles.netLabel, settled ? { color: colors.muted } : b.net > 0 ? styles.netGetText : styles.netOweText]}>
                                        {settled ? 'Settled' : b.net > 0 ? 'Gets' : 'Owes'}
                                    </Text>
                                    {!settled && (
                                        <Text style={[styles.netAmount, b.net > 0 ? styles.netGetText : styles.netOweText]} numberOfLines={1} adjustsFontSizeToFit>
                                            {money(Math.abs(b.net))}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        );
                    })}

                    {summary.settlements.length > 0 && (
                        <Section icon="git-compare-outline" style={{ marginTop: 12 }}>Still to settle</Section>
                    )}
                    {summary.settlements.map((s, i) => (
                        <Text key={i} style={styles.settle}>
                            {nameOf(s.from)} → {nameOf(s.to)}: {money(s.amount)}
                        </Text>
                    ))}
                    {summary.settlements.length === 0 && <Text style={styles.muted}>Everyone is settled.</Text>}
                </CollapsibleCard>

                {/* Payments into the trip collection (owner only) */}
                {isOwner && !finished && members.length > 0 && (
                    <View style={styles.card}>
                        <Section icon="cash-outline">Record a payment</Section>
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
                    <CollapsibleCard icon="card-outline" title={`Payments into collection (${data.payments.length})`}>
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
                                    <Pressable
                                        onPress={async () => {
                                            const ok = await confirm({
                                                title: 'Delete payment?',
                                                message: `Remove ${money(p.amount)} from the trip collection?`,
                                                confirmLabel: 'Delete',
                                                danger: true,
                                            });
                                            if (ok) run(() => deletePayment(p.id), undefined, ['Deleted', 'Payment removed.']);
                                        }}
                                    >
                                        <Text style={styles.link}>Delete</Text>
                                    </Pressable>
                                )}
                            </View>
                        ))}
                    </CollapsibleCard>
                )}

                {/* Add expense */}
                {!finished && myMember && (
                    <CollapsibleCard icon="receipt-outline" title="Add expense">
                        <Text style={styles.hint}>
                            Adding as {myMember.name || myMember.email}. Your name will show as “added by” on this expense.
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
                    </CollapsibleCard>
                )}

                {/* Expenses */}
                <CollapsibleCard icon="list-outline" title={`Expenses (${data.expenses.length})`}>
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
                                    <Pressable
                                        onPress={async () => {
                                            const ok = await confirm({
                                                title: 'Delete expense?',
                                                message: `Remove “${e.name}” (${money(e.total)}) from this trip?`,
                                                confirmLabel: 'Delete',
                                                danger: true,
                                            });
                                            if (ok) run(() => deleteExpense(e.id), undefined, ['Deleted', 'Expense removed.']);
                                        }}
                                    >
                                        <Text style={styles.link}>Delete</Text>
                                    </Pressable>
                                )}
                            </View>
                        );
                    })}
                </CollapsibleCard>

                {/* People */}
                <CollapsibleCard icon="people-outline" title={`People (${members.length})`}>
                    {members.map((m) => {
                        const canRemove = isOwner && m.user_id !== group.owner_id && !finished;
                        return (
                            <View key={m.id} style={styles.row}>
                                <View style={styles.avatarSm}>
                                    <Text style={styles.avatarSmText}>{(m.name || m.email || '?').charAt(0).toUpperCase()}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.rowName} numberOfLines={1}>
                                        {m.name || m.email} {m.user_id === me ? '(you)' : ''}
                                    </Text>
                                    <Text style={styles.muted} numberOfLines={1}>
                                        {m.email}
                                        {m.user_id ? '' : ' · not signed in yet'}
                                    </Text>
                                </View>
                                {canRemove && (
                                    <Pressable onPress={() => confirmRemove(m.id, m.name || m.email)}>
                                        <Text style={[styles.link, { color: colors.danger }]}>Remove</Text>
                                    </Pressable>
                                )}
                            </View>
                        );
                    })}

                    {isOwner && !finished && (
                        <View style={{ marginTop: 12, gap: 8 }}>
                            <TextField label="Gmail address" value={memberEmail} onChangeText={setMemberEmail} keyboard="email-address" placeholder="friend@gmail.com" />
                            <TextField label="Name (optional)" value={memberName} onChangeText={setMemberName} placeholder="Nimal" />
                            <AnimatedButton label="Add person" variant="ghost" disabled={busy} onPress={saveMember} />
                        </View>
                    )}
                </CollapsibleCard>

                {/* Invite */}
                {!finished && myMember && (
                    <View style={styles.card}>
                        <Section icon="person-add-outline">Invite people</Section>
                        <Text style={styles.muted}>Share the link or code through WhatsApp, Gmail, or any app. Links expire after 7 days.</Text>
                        {invite && <Text style={styles.code}>Code: {invite.code}</Text>}
                        <View style={styles.twoCol}>
                            <AnimatedButton label="Share" onPress={shareLink} disabled={busy} icon={<Ionicons name="share-outline" size={17} color={colors.onPrimary} />} style={{ flex: 1 }} />
                            <AnimatedButton label="Copy" variant="ghost" onPress={copyLink} disabled={busy} icon={<Ionicons name="copy-outline" size={17} color={colors.text} />} style={{ flex: 1 }} />
                        </View>
                        {isOwner && <AnimatedButton label="Revoke all links" variant="danger" onPress={revokeLinks} disabled={busy} style={{ marginTop: 10 }} />}
                    </View>
                )}

                {/* Owner actions */}
                {isOwner && (
                    <View style={styles.card}>
                        <Section icon="ellipsis-horizontal-circle-outline">Trip actions</Section>
                        <Text style={styles.muted}>Send each person their expense breakdown and amount owed.</Text>
                        <AnimatedButton
                            label={busy ? 'Sending summaries…' : 'Email expense summaries'}
                            variant="ghost"
                            disabled={busy}
                            onPress={sendEmails}
                            icon={<Ionicons name="mail-outline" size={17} color={colors.text} />}
                        />
                        {!finished && (
                            <AnimatedButton
                                label="End trip"
                                variant="danger"
                                disabled={busy}
                                onPress={confirmEnd}
                                icon={<Ionicons name="flag-outline" size={17} color="#FFFFFF" />}
                            />
                        )}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 20, paddingTop: 64, gap: 14, paddingBottom: 40 },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { color: colors.muted, fontSize: 14 },
    title: { color: colors.text, fontSize: 26, fontWeight: '800', fontFamily: fonts.extrabold, letterSpacing: -0.4 },
    badge: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', color: colors.accent },
    badgeActive: { backgroundColor: colors.primarySoft },
    badgeDone: { backgroundColor: colors.muted, color: '#FFFFFF' },
    totalCard: { ...cardStyle, borderRadius: radius.lg, padding: 20 },
    total: { color: colors.accent, fontSize: 36, fontWeight: '800', marginTop: 4, fontFamily: fonts.extrabold, letterSpacing: -0.5 },
    heroStats: { flexDirection: 'row', marginTop: 16, borderTopWidth: 1, borderColor: colors.border, paddingTop: 14 },
    heroStat: { flex: 1, gap: 2 },
    heroDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: 14 },
    heroValue: { color: colors.text, fontSize: 17, fontWeight: '800', fontFamily: fonts.bold },
    heroLabel: { color: colors.muted, fontSize: 12 },
    avatarSm: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
    avatarSmText: { color: colors.accent, fontWeight: '800', fontSize: 15, fontFamily: fonts.bold },
    netBadge: { minWidth: 78, alignItems: 'flex-end', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 12, overflow: 'hidden' },
    netGet: { backgroundColor: '#D1FAE5' },
    netOwe: { backgroundColor: '#FFE4E6' },
    netSettled: { backgroundColor: colors.surfaceAlt },
    netLabel: { fontSize: 10, fontWeight: '700', textAlign: 'right' },
    netAmount: { fontSize: 13, fontWeight: '800', textAlign: 'right', flexShrink: 1 },
    netGetText: { color: '#065F46' },
    netOweText: { color: colors.danger },
    card: { ...cardStyle, borderRadius: radius.lg, padding: 16, gap: 8 },
    section: { color: colors.text, fontWeight: '800', fontSize: 16 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  balanceDetail: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  collapseHeader: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  collapseContent: { gap: 8 },
    label: { color: colors.muted, fontSize: 13 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.border },
    rowName: { color: colors.text, fontWeight: '600', flexShrink: 1 },
    net: { fontWeight: '700', fontSize: 13 },
    settle: { color: colors.text, paddingVertical: 2 },
    muted: { color: colors.muted, fontSize: 12 },
    hint: { color: colors.accent, fontSize: 12 },
    code: { color: colors.accent, fontWeight: '800', letterSpacing: 2, fontSize: 18 },
    link: { color: colors.accent, fontWeight: '600' },
    line: { color: colors.accent, fontWeight: '700' },
    twoCol: { flexDirection: 'row', gap: 10 },
    inline: { gap: 6, paddingBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  chipAvatarOn: { backgroundColor: '#2563EB' },
  chipAvatarText: { fontSize: 10, fontWeight: '700', color: colors.text },
  chipAvatarTextOn: { color: '#FFFFFF' },
  chipOn: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: '#1D4ED8' },
    expense: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderColor: colors.border },
});
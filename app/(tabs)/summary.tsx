import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { useStore } from '../../src/store';
import { calcTripSummary } from '../../src/calculator';
import { formatAmount } from '../../src/types';
import { useT } from '../../src/LanguageContext';

const C = {
  primary: '#4F7FFF', bg: '#F4F6FA', card: '#FFFFFF',
  text1: '#1A1D23', text2: '#5A6173', text3: '#9CA3AF',
  border: '#E8ECF4', danger: '#FF5A5A', success: '#22C493',
};

const CAT_COLORS: Record<string, string> = {
  dining: '#FF8C42', accommodation: '#5C9BFF', shopping: '#9B59F5', other: '#34C5A0',
};

type ViewMode = 'person' | 'family' | 'date';

export default function SummaryScreen() {
  const { trip } = useStore();
  const t = useT();
  const [view, setView] = useState<ViewMode>('person');

  const { memberSummaries, familySummaries, dailySummaries, totalExpenseCents } =
    useMemo(() => calcTripSummary(trip), [trip]);

  const CAT_LABELS: Record<string, string> = {
    dining: `🍜 ${t.cat_dining}`,
    accommodation: `🏨 ${t.cat_accommodation}`,
    shopping: `🛍 ${t.cat_shopping}`,
    other: `📦 ${t.cat_other}`,
  };

  const netColor = (n: number) => n > 0 ? C.success : n < 0 ? C.danger : C.text3;
  const netBg    = (n: number) => n > 0 ? '#E6FAF3' : n < 0 ? '#FFF0F0' : C.bg;
  const netLabel = (n: number) => {
    if (n === 0) return t.net_zero;
    return n > 0 ? t.net_positive(formatAmount(n, trip.currency)) : t.net_negative(formatAmount(-n, trip.currency));
  };

  const TABS: { key: ViewMode; label: string }[] = [
    { key: 'person', label: t.view_person },
    { key: 'family', label: t.view_family },
    { key: 'date',   label: t.view_date },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={s.header}>
        <Text style={s.title}>{t.expense_summary}</Text>
        <View style={s.overviewRow}>
          <OverviewItem value={formatAmount(totalExpenseCents, trip.currency)} label={t.total_expenses} />
          <View style={s.ovDivider} />
          <OverviewItem value={`${trip.members.length}`} label={t.tab_members} />
          <View style={s.ovDivider} />
          <OverviewItem value={`${trip.expenses.length}`} label={t.tab_expenses} />
        </View>
      </View>

      <View style={s.toggle}>
        {TABS.map(tab => (
          <TouchableOpacity key={tab.key} style={[s.toggleBtn, view === tab.key && s.toggleBtnActive]}
            onPress={() => setView(tab.key)}>
            <Text style={[s.toggleText, view === tab.key && s.toggleTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={s.list} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

        {/* 个人视图 */}
        {view === 'person' && (
          memberSummaries.length === 0
            ? <EmptyHint text={t.empty_data} hint={t.no_members_hint} />
            : memberSummaries.map(ms => (
              <View key={ms.memberId} style={s.card}>
                <View style={s.cardTop}>
                  <Text style={{ fontSize: 36 }}>{ms.memberAvatar}</Text>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.name}>{ms.memberName}</Text>
                    <Text style={s.sub}>{t.part_ratio((trip.members.find(m => m.id === ms.memberId)?.storedPart ?? 100) / 100)}</Text>
                  </View>
                  <View style={[s.netBadge, { backgroundColor: netBg(ms.netCents) }]}>
                    <Text style={[s.netText, { color: netColor(ms.netCents) }]}>{netLabel(ms.netCents)}</Text>
                  </View>
                </View>
                <View style={s.statsRow}>
                  <StatBox label={t.paid_col} value={formatAmount(ms.totalPaidCents, trip.currency)} />
                  <View style={s.statDiv} />
                  <StatBox label={t.owed_col} value={formatAmount(ms.totalOwedCents, trip.currency)} />
                  <View style={s.statDiv} />
                  <StatBox label={t.net_col}
                    value={(ms.netCents > 0 ? '+' : '') + formatAmount(ms.netCents, trip.currency)}
                    color={netColor(ms.netCents)} />
                </View>
              </View>
            ))
        )}

        {/* 家庭视图 */}
        {view === 'family' && (
          familySummaries.length === 0
            ? <EmptyHint text={t.no_families} hint={t.no_families_hint} />
            : familySummaries.map(fs => (
              <View key={fs.familyId} style={s.card}>
                <View style={s.cardTop}>
                  <View style={s.familyIcon}><Text style={{ fontSize: 24 }}>🏠</Text></View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.name}>{fs.familyName}</Text>
                    <Text style={s.sub}>{fs.memberNames.join('、')}</Text>
                  </View>
                  <View style={[s.netBadge, { backgroundColor: netBg(fs.netCents) }]}>
                    <Text style={[s.netText, { color: netColor(fs.netCents) }]}>{netLabel(fs.netCents)}</Text>
                  </View>
                </View>
                <View style={s.statsRow}>
                  <StatBox label={t.paid_col}  value={formatAmount(fs.totalPaidCents, trip.currency)} />
                  <View style={s.statDiv} />
                  <StatBox label={t.owed_col}  value={formatAmount(fs.totalOwedCents, trip.currency)} />
                  <View style={s.statDiv} />
                  <StatBox label={t.net_col}
                    value={(fs.netCents > 0 ? '+' : '') + formatAmount(fs.netCents, trip.currency)}
                    color={netColor(fs.netCents)} />
                </View>
              </View>
            ))
        )}

        {/* 日期视图 */}
        {view === 'date' && (
          dailySummaries.length === 0
            ? <EmptyHint text={t.no_expenses_summary} hint={t.no_expenses_summary_hint} />
            : dailySummaries.map(day => (
              <View key={day.dateLabel} style={s.card}>
                <View style={s.dateHeader}>
                  <Text style={s.dateTitle}>{day.dateLabel}</Text>
                  <Text style={[s.dateTotal, { color: C.primary }]}>
                    {formatAmount(day.totalCents, trip.currency)}
                  </Text>
                </View>

                {Object.entries(day.byCategory).map(([cat, cents]) => {
                  const pct = (cents / day.totalCents) * 100;
                  return (
                    <View key={cat} style={s.catBarRow}>
                      <Text style={s.catBarLabel}>{CAT_LABELS[cat] ?? cat}</Text>
                      <View style={s.catBarTrack}>
                        <View style={[s.catBarFill, { width: `${pct}%`, backgroundColor: CAT_COLORS[cat] ?? C.primary }]} />
                      </View>
                      <Text style={s.catBarAmt}>{formatAmount(cents, trip.currency)}</Text>
                    </View>
                  );
                })}

                <View style={s.dayExpenses}>
                  {day.expenses.map(e => (
                    <View key={e.id} style={s.dayExpRow}>
                      <Text style={s.dayExpTitle}>{e.title}</Text>
                      {e.location ? <Text style={s.dayExpLoc}>📍{e.location}</Text> : null}
                      <Text style={[s.dayExpAmt, { color: CAT_COLORS[e.category] }]}>
                        {formatAmount(e.totalAmountCents, trip.currency)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function OverviewItem({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 3 }}>{label}</Text>
    </View>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: color ?? C.text1 }}>{value}</Text>
      <Text style={{ fontSize: 11, color: C.text3, marginTop: 3 }}>{label}</Text>
    </View>
  );
}

function EmptyHint({ text, hint }: { text: string; hint: string }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 60 }}>
      <Text style={{ fontSize: 50 }}>📭</Text>
      <Text style={{ fontSize: 16, fontWeight: '600', color: C.text2, marginTop: 16 }}>{text}</Text>
      <Text style={{ fontSize: 13, color: C.text3, marginTop: 8 }}>{hint}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.primary },
  header: { backgroundColor: C.primary, paddingHorizontal: 20, paddingBottom: 20, paddingTop: 10 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  overviewRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 16, padding: 14, marginTop: 12, alignItems: 'center' },
  ovDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.3)' },
  toggle: { flexDirection: 'row', backgroundColor: C.bg, margin: 16, borderRadius: 12, padding: 4 },
  toggleBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
  toggleBtnActive: { backgroundColor: C.card, shadowColor: C.primary, shadowOffset: { width:0, height:2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
  toggleText: { fontSize: 13, fontWeight: '600', color: C.text2 },
  toggleTextActive: { color: C.primary },
  list: { flex: 1, backgroundColor: C.bg, marginTop: -16 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: C.primary, shadowOffset: { width:0, height:2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: C.text1 },
  sub: { fontSize: 12, color: C.text3, marginTop: 2 },
  netBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  netText: { fontSize: 12, fontWeight: '700' },
  statsRow: { flexDirection: 'row', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border, alignItems: 'center' },
  statDiv: { width: 1, height: 32, backgroundColor: C.border },
  familyIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#FFF3E8', alignItems: 'center', justifyContent: 'center' },
  dateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dateTitle: { fontSize: 15, fontWeight: '700', color: C.text1 },
  dateTotal: { fontSize: 16, fontWeight: '800' },
  catBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  catBarLabel: { fontSize: 12, width: 70, color: C.text2 },
  catBarTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: C.border, overflow: 'hidden' },
  catBarFill: { height: 8, borderRadius: 4 },
  catBarAmt: { fontSize: 12, fontWeight: '600', color: C.text1, width: 60, textAlign: 'right' },
  dayExpenses: { marginTop: 10, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
  dayExpRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  dayExpTitle: { flex: 1, fontSize: 13, color: C.text1 },
  dayExpLoc: { fontSize: 11, color: C.text3, marginRight: 8 },
  dayExpAmt: { fontSize: 13, fontWeight: '600' },
});

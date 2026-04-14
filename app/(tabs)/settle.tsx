import React, { useMemo, useState } from 'react';
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

export default function SettleScreen() {
  const { trip } = useStore();
  const t = useT();
  const { settlements, totalExpenseCents } = useMemo(() => calcTripSummary(trip), [trip]);
  const [done, setDone] = useState<Set<number>>(new Set());

  // 检测数据异常的支出
  const invalidExpenses = useMemo(() => {
    const memberIds = new Set(trip.members.map(m => m.id));
    return trip.expenses.filter(e => {
      if (!memberIds.has(e.payerId)) return true;           // 付款人不存在
      if (!e.isGift && e.participantIds.length === 0) return true; // 非礼物但无参与者
      return false;
    });
  }, [trip]);

  const toggleDone = (idx: number) =>
    setDone(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });

  const remaining = settlements.length - done.size;
  const allDone = settlements.length > 0 && remaining === 0;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={s.header}>
        <Text style={s.title}>{t.settle_title}</Text>
        <Text style={s.subtitle}>{t.settle_subtitle}</Text>
        <View style={s.badge}>
          <Text style={s.badgeText}>
            {allDone ? t.all_settled : settlements.length === 0 ? t.no_transfer_needed : t.remaining(remaining)}
          </Text>
        </View>
      </View>

      <ScrollView style={s.list} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

        {allDone && (
          <View style={s.doneBanner}>
            <Text style={s.doneBannerTitle}>{t.trip_cleared}</Text>
            <Text style={s.doneBannerSub}>{formatAmount(totalExpenseCents, trip.currency)}</Text>
          </View>
        )}

        {/* 数据异常红字提示 */}
        {invalidExpenses.length > 0 && (
          <View style={s.errorCard}>
            <Text style={s.errorTitle}>{t.data_errors_title}</Text>
            {invalidExpenses.map(e => {
              const memberIds = new Set(trip.members.map(m => m.id));
              const msg = !memberIds.has(e.payerId)
                ? t.expense_invalid_payer(e.title)
                : t.expense_no_participants(e.title);
              return <Text key={e.id} style={s.errorItem}>• {msg}</Text>;
            })}
          </View>
        )}

        {trip.expenses.length === 0 && (
          <View style={s.empty}>
            <Text style={{ fontSize: 50 }}>📭</Text>
            <Text style={s.emptyText}>{t.no_expenses_settle}</Text>
            <Text style={s.emptyHint}>{t.go_add_expenses}</Text>
          </View>
        )}

        {trip.expenses.length > 0 && settlements.length === 0 && (
          <View style={s.empty}>
            <Text style={{ fontSize: 50 }}>✅</Text>
            <Text style={s.emptyText}>{t.no_transfer_needed}</Text>
            <Text style={s.emptyHint}>{t.balance_msg}</Text>
          </View>
        )}

        {settlements.map((st, idx) => (
          <View key={idx} style={[s.card, done.has(idx) && s.cardDone]}>
            <View style={s.personCol}>
              <View style={[s.avatar, { backgroundColor: '#FFF0F0' }]}>
                <Text style={{ fontSize: 28 }}>{st.fromAvatar}</Text>
              </View>
              <Text style={s.personName}>{st.fromMemberName}</Text>
              <Text style={s.personRole}>{t.payer_role}</Text>
            </View>

            <View style={s.arrowCol}>
              <View style={s.amountPill}>
                <Text style={s.amountText}>{formatAmount(st.amountCents, trip.currency)}</Text>
              </View>
              <Text style={s.arrow}>→</Text>
            </View>

            <View style={s.personCol}>
              <View style={[s.avatar, { backgroundColor: '#E6FAF3' }]}>
                <Text style={{ fontSize: 28 }}>{st.toAvatar}</Text>
              </View>
              <Text style={s.personName}>{st.toMemberName}</Text>
              <Text style={s.personRole}>{t.receiver_role}</Text>
            </View>

            <TouchableOpacity style={[s.doneBtn, done.has(idx) && s.doneBtnActive]} onPress={() => toggleDone(idx)}>
              <Text style={[s.doneBtnText, done.has(idx) && { color: '#fff' }]}>✓</Text>
            </TouchableOpacity>
          </View>
        ))}

        {settlements.length > 0 && (
          <View style={s.explainCard}>
            <Text style={s.explainTitle}>{t.algo_title}</Text>
            <Text style={s.explainBody}>{t.algo_desc}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.primary },
  header: { backgroundColor: C.primary, paddingHorizontal: 20, paddingBottom: 20, paddingTop: 10 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 },
  badge: { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start', marginTop: 10 },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  list: { flex: 1, backgroundColor: C.bg },
  doneBanner: { backgroundColor: C.success, borderRadius: 16, padding: 18, marginBottom: 16, alignItems: 'center' },
  doneBannerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  doneBannerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 18, marginBottom: 12, flexDirection: 'row', alignItems: 'center', shadowColor: C.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  cardDone: { opacity: 0.45 },
  personCol: { flex: 1, alignItems: 'center', gap: 6 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  personName: { fontSize: 13, fontWeight: '700', color: C.text1, textAlign: 'center' },
  personRole: { fontSize: 11, color: C.text3 },
  arrowCol: { flex: 1.2, alignItems: 'center', gap: 6 },
  amountPill: { backgroundColor: '#EEF2FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  amountText: { color: C.primary, fontSize: 15, fontWeight: '800' },
  arrow: { fontSize: 22, color: C.primary, fontWeight: '700' },
  doneBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  doneBtnActive: { backgroundColor: C.success, borderColor: C.success },
  doneBtnText: { fontSize: 16, color: C.text3, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, fontWeight: '600', color: C.text2, marginTop: 16 },
  emptyHint: { fontSize: 13, color: C.text3, marginTop: 8 },
  explainCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginTop: 4 },
  explainTitle: { fontSize: 14, fontWeight: '700', color: C.text2, marginBottom: 8 },
  explainBody: { fontSize: 13, color: C.text3, lineHeight: 20 },
  errorCard: { backgroundColor: '#FFF0F0', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: C.danger },
  errorTitle: { fontSize: 13, fontWeight: '700', color: C.danger, marginBottom: 8 },
  errorItem: { fontSize: 13, color: C.danger, lineHeight: 22 },
});

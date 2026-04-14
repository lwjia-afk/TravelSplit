import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  TextInput, StyleSheet, SafeAreaView, Alert, StatusBar,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useStore } from '../../src/store';
import { inputToCents, formatAmount, CURRENCIES } from '../../src/types';
import { calcShares } from '../../src/calculator';
import { ExpenseCategory, SplitMode, SplitTarget, Expense } from '../../src/types';
import { useT } from '../../src/LanguageContext';

const C = {
  primary: '#4F7FFF', bg: '#F4F6FA', card: '#FFFFFF',
  text1: '#1A1D23', text2: '#5A6173', text3: '#9CA3AF',
  border: '#E8ECF4', dining: '#FF8C42', accommodation: '#5C9BFF',
  shopping: '#9B59F5', other: '#34C5A0', danger: '#FF5A5A',
  family: '#FF8C42',
};

function fmtTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ExpensesScreen() {
  const { trip, addExpense, updateExpense, removeExpense } = useStore();
  const t = useT();
  const currencyInfo = CURRENCIES.find(c => c.code === trip.currency)!;

  const CAT_INFO: Record<ExpenseCategory, { emoji: string; label: string; color: string; bg: string; defaultTarget?: SplitTarget }> = {
    dining:        { emoji: '🍜', label: t.cat_dining,        color: C.dining,        bg: '#FFF0E6' },
    accommodation: { emoji: '🏨', label: t.cat_accommodation, color: C.accommodation, bg: '#E6EEFF' },
    shopping:      { emoji: '🛍', label: t.cat_shopping,      color: C.shopping,      bg: '#F0E8FF' },
    other:         { emoji: '📦', label: t.cat_other,         color: C.other,         bg: '#E0F7F2' },
    car_rental:    { emoji: '🚗', label: t.cat_car_rental,    color: '#E67E22',        bg: '#FEF0E0', defaultTarget: 'family' },
    fuel:          { emoji: '⛽', label: t.cat_fuel,           color: '#27AE60',        bg: '#E8F8EE', defaultTarget: 'family' },
  };

  const [filter, setFilter] = useState<ExpenseCategory | 'all'>('all');
  const filtered = useMemo(() =>
    filter === 'all' ? trip.expenses : trip.expenses.filter(e => e.category === filter),
    [trip.expenses, filter]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    [...filtered].sort((a, b) => b.time - a.time).forEach(e => {
      const key = new Date(e.time).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    return Object.entries(groups);
  }, [filtered]);

  const total = useMemo(() =>
    trip.expenses.reduce((s, e) => s + e.totalAmountCents, 0), [trip.expenses]);

  // ── 弹窗状态 ─────────────────────────────────────────
  const [showModal, setShowModal]       = useState(false);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [step, setStep]                 = useState(1);
  const [title, setTitle]               = useState('');
  const [amount, setAmount]             = useState('');
  const [category, setCategory]         = useState<ExpenseCategory>('dining');
  const [participants, setParticipants] = useState<string[]>([]);
  const [payerId, setPayerId]           = useState('');
  const [splitMode, setSplitMode]       = useState<SplitMode>('by_part');
  const [splitTarget, setSplitTarget]   = useState<SplitTarget>('person');
  const [isGift, setIsGift]             = useState(false);
  const [expTime, setExpTime]           = useState(new Date());
  const [location, setLocation]         = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [optionsExpense, setOptionsExpense] = useState<Expense | null>(null);

  const resetForm = () => {
    setTitle(''); setAmount(''); setCategory('dining'); setStep(1);
    setParticipants(trip.members.map(m => m.id));
    setPayerId(trip.members[0]?.id ?? '');
    setSplitMode('by_part');
    setSplitTarget('person');
    setIsGift(false);
    setExpTime(new Date());
    setLocation('');
  };

  const openAddModal = () => {
    if (trip.members.length === 0) { Alert.alert(t.hint, t.add_member_first); return; }
    setEditingId(null);
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (e: Expense) => {
    setOptionsExpense(null);
    setEditingId(e.id);
    setTitle(e.title);
    const ci = CURRENCIES.find(c => c.code === trip.currency)!;
    setAmount(ci.noDecimal ? String(e.totalAmountCents) : (e.totalAmountCents / 100).toFixed(2));
    setCategory(e.category);
    setParticipants([...e.participantIds]);
    setPayerId(e.payerId);
    setSplitMode(e.splitMode);
    setSplitTarget(e.splitTarget ?? 'person');
    setIsGift(e.isGift ?? false);
    setExpTime(new Date(e.time));
    setLocation(e.location ?? '');
    setStep(1);
    setShowModal(true);
  };

  const toggleParticipant = (id: string) =>
    setParticipants(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  const previewShares = useMemo(() => {
    if (!amount || participants.length === 0) return [];
    const cents = inputToCents(amount);
    const fake = {
      id:'', title:'', totalAmountCents: cents, category, splitMode, splitTarget,
      isGift: isGift || undefined,
      participantIds: participants, payerId, time: 0, shares: [], createdAt: 0,
    };
    return calcShares(fake, trip.members);
  }, [amount, category, splitMode, splitTarget, participants, trip.members]);

  // 按家庭分组显示（用于预览）
  const familyPreviewGroups = useMemo(() => {
    if (splitTarget !== 'family') return null;
    const groups: Array<{ familyName: string; memberIds: string[] }> = [];
    const seen = new Set<string>();
    participants.forEach(pid => {
      const member = trip.members.find(m => m.id === pid);
      if (!member) return;
      const key = member.familyId ?? `solo_${pid}`;
      if (seen.has(key)) {
        const g = groups.find(g => g.memberIds.includes(pid) || (member.familyId && g.familyName !== member.name));
        if (g && member.familyId && g.familyName === (trip.families.find(f => f.id === member.familyId)?.name ?? '')) {
          g.memberIds.push(pid);
          return;
        }
      }
      seen.add(key);
      if (member.familyId) {
        const existing = groups.find(g => g.familyName === (trip.families.find(f => f.id === member.familyId)?.name ?? ''));
        if (existing) { existing.memberIds.push(pid); return; }
        groups.push({ familyName: trip.families.find(f => f.id === member.familyId)?.name ?? member.name, memberIds: [pid] });
      } else {
        groups.push({ familyName: member.name, memberIds: [pid] });
      }
    });
    return groups;
  }, [splitTarget, participants, trip.members, trip.families]);

  const submit = () => {
    if (!title.trim()) { Alert.alert(t.hint, t.enter_title); return; }
    const cents = inputToCents(amount);
    if (cents <= 0) { Alert.alert(t.hint, t.valid_amount); return; }
    if (participants.length === 0) { Alert.alert(t.hint, t.select_participant); return; }
    const data = {
      title: title.trim(), totalAmountCents: cents, category, splitMode, splitTarget,
      isGift: isGift || undefined,
      participantIds: participants, payerId,
      time: expTime.getTime(),
      location: location.trim() || undefined,
    };
    if (editingId) { updateExpense(editingId, data); } else { addExpense(data); }
    setShowModal(false);
  };

  const confirmDelete = (id: string, expTitle: string) => {
    setOptionsExpense(null);
    Alert.alert(t.delete_expense_title, t.delete_expense_msg(expTitle), [
      { text: t.cancel, style: 'cancel' },
      { text: t.delete, style: 'destructive', onPress: () => removeExpense(id) },
    ]);
  };

  const getMemberName = (id: string) => trip.members.find(m => m.id === id)?.name ?? '?';

  const isAdding = editingId === null;
  const hasFamilies = trip.families.length > 0;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      <View style={s.header}>
        <Text style={s.tripName}>{trip.emoji} {trip.name}</Text>
        <View style={s.totalCard}>
          <Text style={s.totalLabel}>{t.trip_total}</Text>
          <Text style={s.totalAmount}>{formatAmount(total, trip.currency)}</Text>
          <Text style={s.totalSub}>{t.expenses_count(trip.expenses.length)} · {t.members_count(trip.members.length)}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {(['all', 'dining', 'accommodation', 'shopping', 'other', 'car_rental', 'fuel'] as const).map(f => (
          <TouchableOpacity key={f} style={[s.chip, filter === f && s.chipActive]} onPress={() => setFilter(f)}>
            <Text style={[s.chipText, filter === f && s.chipTextActive]}>
              {f === 'all' ? t.expense_filter_all : `${CAT_INFO[f].emoji} ${CAT_INFO[f].label}`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={s.list} contentContainerStyle={{ paddingBottom: 100 }}>
        {grouped.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 60 }}>📭</Text>
            <Text style={s.emptyText}>{t.no_expenses}</Text>
            <Text style={s.emptyHint}>{t.no_expenses_hint}</Text>
          </View>
        ) : grouped.map(([date, exps]) => (
          <View key={date} style={s.group}>
            <Text style={s.dateLabel}>{date}</Text>
            {exps.map(e => {
              const cat = CAT_INFO[e.category];
              const isFamilySplit = e.splitTarget === 'family';
              return (
                <TouchableOpacity key={e.id} style={s.expCard} onPress={() => setOptionsExpense(e)}>
                  <View style={[s.catIcon, { backgroundColor: cat.bg }]}>
                    <Text style={{ fontSize: 22 }}>{cat.emoji}</Text>
                  </View>
                  <View style={s.expInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={s.expTitle}>{e.title}</Text>
                      {isFamilySplit && (
                        <View style={s.familyBadge}>
                          <Text style={s.familyBadgeText}>🏠</Text>
                        </View>
                      )}
                      {e.isGift && (
                        <View style={[s.familyBadge, { backgroundColor: '#FFF0F8' }]}>
                          <Text style={s.familyBadgeText}>🎁</Text>
                        </View>
                      )}
                    </View>
                    <Text style={s.expMeta}>
                      {cat.label} · {t.paid_by(getMemberName(e.payerId))}
                    </Text>
                    <Text style={s.expTime}>
                      🕐 {fmtTime(e.time)}{e.location ? `  📍 ${e.location}` : ''}
                    </Text>
                  </View>
                  <Text style={[s.expAmount, { color: cat.color }]}>
                    {formatAmount(e.totalAmountCents, trip.currency)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={s.fab} onPress={openAddModal}>
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>

      {/* 支出操作菜单 */}
      <Modal visible={!!optionsExpense} animationType="fade" transparent onRequestClose={() => setOptionsExpense(null)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setOptionsExpense(null)}>
          <TouchableOpacity style={s.optionsSheet} activeOpacity={1}>
            <View style={s.handle} />
            <Text style={s.optionsTitle}>{t.expense_options}</Text>
            {optionsExpense && <Text style={s.optionsSubtitle}>{optionsExpense.title}</Text>}
            <TouchableOpacity style={s.optionBtn} onPress={() => optionsExpense && openEditModal(optionsExpense)}>
              <Text style={s.optionBtnText}>✏️  {t.edit}</Text>
            </TouchableOpacity>
            <View style={s.optionDiv} />
            <TouchableOpacity style={s.optionBtn}
              onPress={() => optionsExpense && confirmDelete(optionsExpense.id, optionsExpense.title)}>
              <Text style={[s.optionBtnText, { color: C.danger }]}>🗑  {t.delete}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.optionBtn, { marginTop: 8 }]} onPress={() => setOptionsExpense(null)}>
              <Text style={[s.optionBtnText, { color: C.text3 }]}>{t.cancel}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 添加/编辑支出弹窗 */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowModal(false)}>
          <TouchableOpacity style={s.sheet} activeOpacity={1}>
            <View style={s.handle} />
            <Text style={s.modalTitle}>{isAdding ? t.add_expense_title : t.edit_expense_title}</Text>
            <View style={s.stepRow}>
              {[1,2].map(n => <View key={n} style={[s.stepDot, step >= n && s.stepDotActive]} />)}
            </View>

            <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled">
              {step === 1 ? (
                <View style={s.modalBody}>
                  {/* 金额 */}
                  <Text style={s.label}>{t.amount_label}（{currencyInfo.name}）</Text>
                  <View style={s.amountRow}>
                    <Text style={s.currencySign}>{currencyInfo.symbol}</Text>
                    <TextInput style={s.amountInput} keyboardType="decimal-pad"
                      placeholder="0.00" placeholderTextColor={C.text3}
                      value={amount} onChangeText={setAmount} />
                  </View>

                  {/* 标题 */}
                  <Text style={[s.label, { marginTop: 18 }]}>{t.title_label}</Text>
                  <TextInput style={s.input} placeholder={t.title_placeholder}
                    placeholderTextColor={C.text3} value={title} onChangeText={setTitle} />

                  {/* 类型 */}
                  <Text style={[s.label, { marginTop: 18 }]}>{t.category_label}</Text>
                  <View style={s.catGrid}>
                    {(Object.entries(CAT_INFO) as [ExpenseCategory, any][]).map(([key, info]) => (
                      <TouchableOpacity key={key} style={[s.catBtn, category === key && s.catBtnActive]}
                        onPress={() => {
                          setCategory(key);
                          if (info.defaultTarget) setSplitTarget(info.defaultTarget);
                        }}>
                        <Text style={{ fontSize: 24 }}>{info.emoji}</Text>
                        <Text style={[s.catBtnLabel, category === key && { color: C.primary }]}>{info.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* 礼物勾选 */}
                  <TouchableOpacity style={s.giftRow} onPress={() => setIsGift(v => !v)}>
                    <View style={[s.checkbox, isGift && s.checkboxActive]}>
                      {isGift && <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>✓</Text>}
                    </View>
                    <Text style={[s.giftLabel, isGift && { color: '#E91E8C' }]}>{t.is_gift}</Text>
                  </TouchableOpacity>
                  {isGift && (
                    <Text style={s.giftHint}>{t.gift_hint}</Text>
                  )}

                  {/* ── 分配对象（按个人 / 按家庭）── */}
                  <Text style={[s.label, { marginTop: 18 }]}>{t.split_target_label}</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {(['person', 'family'] as SplitTarget[]).map(tgt => (
                      <TouchableOpacity key={tgt}
                        style={[s.targetBtn, splitTarget === tgt && s.targetBtnActive]}
                        onPress={() => setSplitTarget(tgt)}>
                        <Text style={[s.targetBtnText, splitTarget === tgt && { color: tgt === 'family' ? C.family : C.primary }]}>
                          {tgt === 'person' ? t.split_target_person : t.split_target_family}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {splitTarget === 'family' && (
                    <Text style={s.targetHint}>{t.family_split_hint}</Text>
                  )}

                  {/* 时间 */}
                  <Text style={[s.label, { marginTop: 18 }]}>{t.time_label}</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity style={[s.timeBtn, { flex: 1 }]} onPress={() => setShowDatePicker(true)}>
                      <Text style={s.timeBtnText}>📅 {expTime.toLocaleDateString('zh-CN')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.timeBtn, { flex: 1 }]} onPress={() => setShowTimePicker(true)}>
                      <Text style={s.timeBtnText}>🕐 {expTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* 地点 */}
                  <Text style={[s.label, { marginTop: 18 }]}>{t.location_label}</Text>
                  <TextInput style={s.input} placeholder={t.location_placeholder}
                    placeholderTextColor={C.text3} value={location} onChangeText={setLocation} />

                  <TouchableOpacity style={s.btnPrimary}
                    onPress={() => {
                      if (!amount || inputToCents(amount) <= 0) { Alert.alert(t.hint, t.enter_amount); return; }
                      setStep(2);
                    }}>
                    <Text style={s.btnPrimaryText}>{t.next_step}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={s.modalBody}>
                  {/* 参与成员 */}
                  <Text style={s.label}>{t.participants_label}</Text>

                  {splitTarget === 'family' ? (
                    /* 按家庭模式：显示家庭分组 */
                    <>
                      {/* 有家庭的成员 */}
                      {trip.families.map(family => {
                        const familyMembers = trip.members.filter(m => m.familyId === family.id);
                        if (familyMembers.length === 0) return null;
                        const allSelected = familyMembers.every(m => participants.includes(m.id));
                        return (
                          <View key={family.id} style={s.familyGroup}>
                            <TouchableOpacity style={s.familyGroupHeader}
                              onPress={() => {
                                // 点家庭标题 = 全选/全取消该家庭
                                const ids = familyMembers.map(m => m.id);
                                if (allSelected) {
                                  setParticipants(prev => prev.filter(id => !ids.includes(id)));
                                } else {
                                  setParticipants(prev => [...new Set([...prev, ...ids])]);
                                }
                              }}>
                              <View style={[s.checkbox, allSelected && s.checkboxActive]}>
                                {allSelected && <Text style={{ color:'#fff', fontSize:14, fontWeight:'700' }}>✓</Text>}
                              </View>
                              <Text style={s.familyGroupName}>🏠 {family.name}</Text>
                            </TouchableOpacity>
                            {familyMembers.map(m => (
                              <TouchableOpacity key={m.id} style={[s.memberRow, { paddingLeft: 32 }]}
                                onPress={() => toggleParticipant(m.id)}>
                                <Text style={{ fontSize: 22 }}>{m.avatar}</Text>
                                <View style={{ flex: 1, marginLeft: 8 }}>
                                  <Text style={s.memberName}>{m.name}</Text>
                                  <Text style={s.memberPart}>part ×{(m.storedPart/100).toFixed(2)}</Text>
                                </View>
                                <View style={[s.checkbox, participants.includes(m.id) && s.checkboxActive]}>
                                  {participants.includes(m.id) && <Text style={{ color:'#fff', fontSize:14, fontWeight:'700' }}>✓</Text>}
                                </View>
                              </TouchableOpacity>
                            ))}
                          </View>
                        );
                      })}
                      {/* 无家庭成员 */}
                      {trip.members.filter(m => !m.familyId).map(m => (
                        <TouchableOpacity key={m.id} style={s.memberRow} onPress={() => toggleParticipant(m.id)}>
                          <Text style={{ fontSize: 28 }}>{m.avatar}</Text>
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={s.memberName}>{m.name}</Text>
                            <Text style={s.memberPart}>part ×{(m.storedPart/100).toFixed(2)}</Text>
                          </View>
                          <View style={[s.checkbox, participants.includes(m.id) && s.checkboxActive]}>
                            {participants.includes(m.id) && <Text style={{ color:'#fff', fontSize:14, fontWeight:'700' }}>✓</Text>}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </>
                  ) : (
                    /* 按个人模式（原有） */
                    trip.members.map(m => (
                      <TouchableOpacity key={m.id} style={s.memberRow} onPress={() => toggleParticipant(m.id)}>
                        <Text style={{ fontSize: 28 }}>{m.avatar}</Text>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={s.memberName}>{m.name}</Text>
                          <Text style={s.memberPart}>
                            part ×{(m.storedPart/100).toFixed(2)}
                            {m.sponsors?.length ? '  📌' : ''}
                          </Text>
                        </View>
                        <View style={[s.checkbox, participants.includes(m.id) && s.checkboxActive]}>
                          {participants.includes(m.id) && <Text style={{ color:'#fff', fontSize:14, fontWeight:'700' }}>✓</Text>}
                        </View>
                      </TouchableOpacity>
                    ))
                  )}

                  {/* 垫付人（全员可选，包括未参与者） */}
                  <Text style={[s.label, { marginTop: 18 }]}>{t.payer_label}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {trip.members.map(m => (
                        <TouchableOpacity key={m.id} style={[s.payerBtn, payerId === m.id && s.payerBtnActive]}
                          onPress={() => setPayerId(m.id)}>
                          <Text style={{ fontSize: 16 }}>{m.avatar}</Text>
                          <Text style={[s.payerBtnText, payerId === m.id && { color: C.primary }]}>{m.name}</Text>
                          {!participants.includes(m.id) && (
                            <Text style={{ fontSize: 9, color: C.danger }}>未参与</Text>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                  {payerId && !participants.includes(payerId) && (
                    <Text style={s.nonParticipantHint}>{t.nonparticipant_payer_hint}</Text>
                  )}

                  {/* 分摊方式（仅个人模式 + other 类型时显示） */}
                  {splitTarget === 'person' && category === 'other' && (
                    <>
                      <Text style={[s.label, { marginTop: 18 }]}>{t.split_mode_label}</Text>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        {(['by_part','equal'] as SplitMode[]).map(mode => (
                          <TouchableOpacity key={mode} style={[s.payerBtn, splitMode === mode && s.payerBtnActive]}
                            onPress={() => setSplitMode(mode)}>
                            <Text style={[s.payerBtnText, splitMode === mode && { color: C.primary }]}>
                              {mode === 'by_part' ? t.split_by_part : t.split_equal}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

                  {/* 分摊预览 */}
                  {previewShares.length > 0 && (
                    <View style={s.preview}>
                      <Text style={s.previewTitle}>{t.preview_title}</Text>
                      {splitTarget === 'family' && familyPreviewGroups && (
                        /* 按家庭分组显示预览 */
                        familyPreviewGroups.map((grp, gi) => {
                          const groupTotal = grp.memberIds.reduce((sum, mid) => {
                            const share = previewShares.find(ps => ps.memberId === mid);
                            return sum + (share?.amountCents ?? 0);
                          }, 0);
                          return (
                            <View key={gi} style={s.previewFamilyGroup}>
                              <View style={s.previewFamilyHeader}>
                                <Text style={s.previewFamilyName}>
                                  {grp.memberIds.length > 1 ? `🏠 ${grp.familyName}` : `👤 ${grp.familyName}`}
                                </Text>
                                <Text style={s.previewFamilyTotal}>
                                  {formatAmount(groupTotal, trip.currency)}
                                </Text>
                              </View>
                              {grp.memberIds.length > 1 && grp.memberIds.map(mid => {
                                const m = trip.members.find(m => m.id === mid);
                                const share = previewShares.find(ps => ps.memberId === mid);
                                if (!share) return null;
                                return (
                                  <View key={mid} style={[s.previewRow, { paddingLeft: 16 }]}>
                                    <Text style={s.previewName}>{m?.avatar} {m?.name}</Text>
                                    <Text style={[s.previewAmt, { color: C.text3 }]}>
                                      {formatAmount(share.amountCents, trip.currency)}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>
                          );
                        })
                      )}
                      {splitTarget === 'person' && previewShares.map(share => {
                        const m = trip.members.find(m => m.id === share.memberId);
                        return (
                          <View key={share.memberId} style={s.previewRow}>
                            <Text style={s.previewName}>{m?.avatar} {m?.name}</Text>
                            <Text style={s.previewAmt}>{formatAmount(share.amountCents, trip.currency)}</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                    <TouchableOpacity style={s.btnSecondary} onPress={() => setStep(1)}>
                      <Text style={s.btnSecondaryText}>{t.back}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.btnPrimary, { flex: 1, marginTop: 0 }]} onPress={submit}>
                      <Text style={s.btnPrimaryText}>{isAdding ? t.record_expense : t.update_expense}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 日期/时间选择器 */}
      {showDatePicker && (
        <DateTimePicker value={expTime} mode="date" display="default"
          onChange={(_, d) => { setShowDatePicker(false); if (d) setExpTime(new Date(d.getFullYear(), d.getMonth(), d.getDate(), expTime.getHours(), expTime.getMinutes())); }} />
      )}
      {showTimePicker && (
        <DateTimePicker value={expTime} mode="time" display="default"
          onChange={(_, d) => { setShowTimePicker(false); if (d) setExpTime(new Date(expTime.getFullYear(), expTime.getMonth(), expTime.getDate(), d.getHours(), d.getMinutes())); }} />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.primary },
  header: { backgroundColor: C.primary, paddingHorizontal: 20, paddingBottom: 20, paddingTop: 10 },
  tripName: { color: '#fff', fontSize: 20, fontWeight: '800' },
  totalCard: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 16, padding: 14, marginTop: 12 },
  totalLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  totalAmount: { color: '#fff', fontSize: 32, fontWeight: '800', marginVertical: 4 },
  totalSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  filterBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: C.border, maxHeight: 56 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.bg, borderWidth: 1.5, borderColor: 'transparent', alignSelf: 'center' },
  chipActive: { backgroundColor: '#EEF2FF', borderColor: C.primary },
  chipText: { fontSize: 13, fontWeight: '500', color: C.text2 },
  chipTextActive: { color: C.primary },
  list: { flex: 1, backgroundColor: C.bg },
  group: { paddingHorizontal: 16 },
  dateLabel: { fontSize: 12, color: C.text3, fontWeight: '600', paddingTop: 14, paddingBottom: 8 },
  expCard: { backgroundColor: C.card, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10, shadowColor: C.primary, shadowOffset: { width:0, height:2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  catIcon: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  expInfo: { flex: 1 },
  expTitle: { fontSize: 15, fontWeight: '600', color: C.text1 },
  expMeta: { fontSize: 12, color: C.text3, marginTop: 3 },
  expTime: { fontSize: 11, color: C.text3, marginTop: 3 },
  expAmount: { fontSize: 17, fontWeight: '700', flexShrink: 0 },
  familyBadge: { backgroundColor: '#FFF3E8', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  familyBadgeText: { fontSize: 11 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 17, fontWeight: '600', color: C.text2, marginTop: 16 },
  emptyHint: { fontSize: 13, color: C.text3, marginTop: 8 },
  fab: { position: 'absolute', bottom: 80, right: 20, width: 58, height: 58, borderRadius: 29, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', shadowColor: C.primary, shadowOffset: { width:0, height:4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  fabText: { color: '#fff', fontSize: 30, fontWeight: '300', lineHeight: 34 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '94%' },
  optionsSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 30 },
  optionsTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', color: C.text1, paddingTop: 4, paddingBottom: 2 },
  optionsSubtitle: { fontSize: 13, color: C.text3, textAlign: 'center', paddingBottom: 12 },
  optionBtn: { paddingVertical: 16, paddingHorizontal: 24, alignItems: 'center' },
  optionBtnText: { fontSize: 16, fontWeight: '600', color: C.text1 },
  optionDiv: { height: 1, backgroundColor: C.border, marginHorizontal: 24 },
  handle: { width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  modalTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center', paddingVertical: 10, color: C.text1 },
  stepRow: { flexDirection: 'row', gap: 6, justifyContent: 'center', paddingBottom: 8 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.border },
  stepDotActive: { backgroundColor: C.primary },
  modalBody: { padding: 20 },
  label: { fontSize: 13, fontWeight: '600', color: C.text2, marginBottom: 8 },
  amountRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2.5, borderBottomColor: C.primary, paddingBottom: 4 },
  currencySign: { fontSize: 24, fontWeight: '700', color: C.text2, marginRight: 6 },
  amountInput: { flex: 1, fontSize: 34, fontWeight: '800', color: C.text1 },
  input: { borderWidth: 1.5, borderColor: C.border, borderRadius: 12, padding: 12, fontSize: 16, color: C.text1 },
  catGrid: { flexDirection: 'row', gap: 10 },
  catBtn: { flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 14, paddingVertical: 12, alignItems: 'center', gap: 6, backgroundColor: C.bg },
  catBtnActive: { borderColor: C.primary, backgroundColor: '#EEF2FF' },
  catBtnLabel: { fontSize: 11, fontWeight: '600', color: C.text2 },
  targetBtn: { flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 14, paddingVertical: 12, alignItems: 'center', backgroundColor: C.bg },
  targetBtnActive: { borderColor: C.primary, backgroundColor: '#EEF2FF' },
  targetBtnText: { fontSize: 13, fontWeight: '600', color: C.text2 },
  targetHint: { fontSize: 12, color: C.family, marginTop: 6, fontStyle: 'italic' },
  timeBtn: { borderWidth: 1.5, borderColor: C.border, borderRadius: 12, padding: 12, alignItems: 'center' },
  timeBtnText: { fontSize: 13, color: C.text1, fontWeight: '500' },
  familyGroup: { borderWidth: 1.5, borderColor: '#D8E4FF', borderRadius: 12, marginBottom: 8, overflow: 'hidden' },
  familyGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F0F4FF', paddingHorizontal: 12, paddingVertical: 10 },
  familyGroupName: { fontSize: 14, fontWeight: '700', color: C.primary },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  memberName: { fontSize: 15, fontWeight: '600', color: C.text1 },
  memberPart: { fontSize: 12, color: C.text3, marginTop: 1 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: C.primary, borderColor: C.primary },
  payerBtn: { borderWidth: 1.5, borderColor: C.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.bg, alignItems: 'center' },
  payerBtnActive: { borderColor: C.primary, backgroundColor: '#EEF2FF' },
  payerBtnText: { fontSize: 13, fontWeight: '500', color: C.text2 },
  giftRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, paddingVertical: 4 },
  giftLabel: { fontSize: 14, fontWeight: '600', color: C.text2 },
  giftHint: { fontSize: 12, color: '#E91E8C', marginTop: 4, fontStyle: 'italic' },
  nonParticipantHint: { fontSize: 12, color: C.danger, marginTop: 6, fontStyle: 'italic' },
  preview: { backgroundColor: '#EEF2FF', borderRadius: 12, padding: 14, marginTop: 16 },
  previewTitle: { fontSize: 12, fontWeight: '700', color: C.primary, marginBottom: 8 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  previewName: { fontSize: 13, color: C.text1 },
  previewAmt: { fontSize: 13, fontWeight: '600', color: C.text1 },
  previewFamilyGroup: { marginBottom: 8 },
  previewFamilyHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(79,127,255,0.2)', marginBottom: 2 },
  previewFamilyName: { fontSize: 13, fontWeight: '700', color: C.primary },
  previewFamilyTotal: { fontSize: 14, fontWeight: '800', color: C.primary },
  btnPrimary: { backgroundColor: C.primary, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 20 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnSecondary: { borderWidth: 1.5, borderColor: C.border, borderRadius: 14, padding: 16, alignItems: 'center', paddingHorizontal: 20 },
  btnSecondaryText: { color: C.text2, fontSize: 15, fontWeight: '600' },
});

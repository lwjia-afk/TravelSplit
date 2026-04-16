import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  TextInput, StyleSheet, SafeAreaView, Alert, StatusBar, Share,
  ActivityIndicator,
} from 'react-native';
import { useStore } from '../../src/store';
import { Currency, CURRENCIES } from '../../src/types';
import { useLanguage, useT } from '../../src/LanguageContext';
import { LANG_FLAGS, LANG_LABELS } from '../../src/i18n';
import { firebaseReady } from '../../src/firebase';

const C = {
  primary: '#4F7FFF', bg: '#F4F6FA', card: '#FFFFFF',
  text1: '#1A1D23', text2: '#5A6173', text3: '#9CA3AF',
  border: '#E8ECF4', danger: '#FF5A5A', success: '#22C493',
  cloud: '#7C3AED',
};

const EMOJIS = ['✈️','🏖','🏔','🎡','🗼','🏯','🎭','🚢','🚂','🏕','🌴','🎿'];

export default function ProjectsScreen() {
  const { trip, trips, createTrip, deleteTrip, switchTrip, updateTrip, shareTrip, joinTrip, isSyncing } = useStore();
  const { lang, toggleLang } = useLanguage();
  const t = useT();

  const [showCreate, setShowCreate]     = useState(false);
  const [showEdit, setShowEdit]         = useState(false);
  const [showShare, setShowShare]       = useState(false);
  const [showJoin, setShowJoin]         = useState(false);
  const [name, setName]                 = useState('');
  const [emoji, setEmoji]               = useState('✈️');
  const [currency, setCurrency]         = useState<Currency>('CNY');
  const [shareCode, setShareCode]       = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [joinCode, setJoinCode]         = useState('');
  const [joinLoading, setJoinLoading]   = useState(false);

  const openCreate = () => {
    setName(''); setEmoji('✈️'); setCurrency('CNY');
    setShowCreate(true);
  };

  const openEdit = () => {
    setName(trip.name); setEmoji(trip.emoji); setCurrency(trip.currency);
    setShowEdit(true);
  };

  const handleCreate = () => {
    if (!name.trim()) { Alert.alert(t.hint, t.project_name); return; }
    createTrip(name.trim(), emoji, currency);
    setShowCreate(false);
  };

  const handleEdit = () => {
    if (!name.trim()) { Alert.alert(t.hint, t.project_name); return; }
    updateTrip({ name: name.trim(), emoji, currency });
    setShowEdit(false);
  };

  const confirmDelete = (id: string, tName: string) => {
    if (trips.length <= 1) { Alert.alert(t.hint, t.keep_one_project); return; }
    Alert.alert(t.delete_project_title, t.delete_project_msg(tName), [
      { text: t.cancel, style: 'cancel' },
      { text: t.delete, style: 'destructive', onPress: () => deleteTrip(id) },
    ]);
  };

  // ── 分享 ──────────────────────────────────────────────────────
  const openShare = async () => {
    if (!firebaseReady) {
      Alert.alert(t.hint, t.join_no_firebase);
      return;
    }
    setShowShare(true);
    setShareLoading(true);
    try {
      const code = await shareTrip();
      setShareCode(code);
    } catch (e: any) {
      setShowShare(false);
      Alert.alert('上传失败', e?.message ?? '请检查 Firebase 权限规则');
    } finally {
      setShareLoading(false);
    }
  };

  const handleSend = () => {
    Share.share({
      message: `${t.share_send_msg} ${shareCode}\n\n${t.share_instruction}`,
      title: t.share_title,
    });
  };

  // ── 加入 ──────────────────────────────────────────────────────
  const openJoin = () => {
    if (!firebaseReady) {
      Alert.alert(t.hint, t.join_no_firebase);
      return;
    }
    setJoinCode('');
    setShowJoin(true);
  };

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase().replace(/\s/g, '');
    if (code.length !== 6) {
      Alert.alert(t.hint, t.join_placeholder);
      return;
    }
    setJoinLoading(true);
    const result = await joinTrip(code);
    setJoinLoading(false);
    setShowJoin(false);

    if (result === 'success') {
      Alert.alert('✅', t.join_success);
    } else if (result === 'not_found') {
      Alert.alert(t.hint, t.join_not_found);
    } else {
      Alert.alert(t.hint, t.join_already);
    }
  };

  const totalExp = (tr: typeof trip) =>
    tr.expenses.reduce((s, e) => s + e.totalAmountCents, 0);

  const currencySymbol = (c: Currency) => CURRENCIES.find(x => x.code === c)?.symbol ?? '¥';

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={s.header}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.title}>📁 {t.my_projects}</Text>
            <Text style={s.subtitle}>{t.project_count(trips.length)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {/* 同步指示器 */}
            {isSyncing && (
              <View style={s.syncBadge}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={s.syncText}>{t.syncing}</Text>
              </View>
            )}
            {/* 语言切换按钮 */}
            <TouchableOpacity style={s.langBtn} onPress={toggleLang}>
              <Text style={s.langBtnFlag}>{LANG_FLAGS[lang]}</Text>
              <Text style={s.langBtnLabel}>{LANG_LABELS[lang]}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView style={s.list} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {trips.map(tr => {
          const isCurrent = tr.id === trip.id;
          const isShared  = !!tr.shareCode;
          return (
            <View key={tr.id} style={[s.card, isCurrent && s.cardActive]}>
              <TouchableOpacity style={s.cardLeft} onPress={() => switchTrip(tr.id)}>
                <Text style={s.cardEmoji}>{tr.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={s.cardName}>{tr.name}</Text>
                    {isCurrent && (
                      <View style={s.activeBadge}>
                        <Text style={s.activeBadgeText}>{t.current_badge}</Text>
                      </View>
                    )}
                    {isShared && (
                      <View style={s.cloudBadge}>
                        <Text style={s.cloudBadgeText}>{t.cloud_badge} {tr.shareCode}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.cardMeta}>
                    {t.members_count(tr.members.length)} · {t.expenses_count(tr.expenses.length)} ·{' '}
                    {CURRENCIES.find(c => c.code === tr.currency)?.name ?? tr.currency}
                  </Text>
                  <Text style={[s.cardTotal, { color: isCurrent ? C.primary : C.text2 }]}>
                    {t.total_label} {currencySymbol(tr.currency)}{(totalExp(tr) / 100).toFixed(tr.currency === 'JPY' || tr.currency === 'KRW' ? 0 : 2)}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={s.delBtn} onPress={() => confirmDelete(tr.id, tr.name)}>
                <Text style={s.delBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      {/* 底部按钮区 */}
      <View style={s.bottomBar}>
        <TouchableOpacity style={[s.btn, { backgroundColor: '#EEF2FF', flex: 1 }]} onPress={openEdit}>
          <Text style={[s.btnText, { color: C.primary }]}>{t.edit_current_project}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, { backgroundColor: '#F3E8FF', flex: 0 }]} onPress={openShare}>
          <Text style={[s.btnText, { color: C.cloud }]}>{t.share_trip}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, { backgroundColor: '#ECFDF5', flex: 0 }]} onPress={openJoin}>
          <Text style={[s.btnText, { color: C.success }]}>{t.join_trip}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, { backgroundColor: C.primary, flex: 1 }]} onPress={openCreate}>
          <Text style={[s.btnText, { color: '#fff' }]}>{t.new_project}</Text>
        </TouchableOpacity>
      </View>

      {/* ── 新建弹窗 ──────────────────────────────────────────── */}
      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowCreate(false)}>
          <TouchableOpacity style={s.sheet} activeOpacity={1}>
            <View style={s.handle} />
            <Text style={s.modalTitle}>{t.new_project}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 500 }}>
              <View style={s.modalBody}>
                <Text style={s.label}>{t.project_icon}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {EMOJIS.map(e => (
                      <TouchableOpacity key={e} style={[s.emojiBtn, emoji === e && s.emojiBtnActive]}
                        onPress={() => setEmoji(e)}>
                        <Text style={{ fontSize: 28 }}>{e}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                <Text style={[s.label, { marginTop: 18 }]}>{t.project_name}</Text>
                <TextInput style={s.input} placeholder={t.project_name_placeholder} placeholderTextColor={C.text3}
                  value={name} onChangeText={setName} />
                <Text style={[s.label, { marginTop: 18 }]}>{t.project_currency}</Text>
                <View style={s.currencyGrid}>
                  {CURRENCIES.map(c => (
                    <TouchableOpacity key={c.code}
                      style={[s.currencyBtn, currency === c.code && s.currencyBtnActive]}
                      onPress={() => setCurrency(c.code)}>
                      <Text style={[s.currencySymbol, currency === c.code && { color: C.primary }]}>{c.symbol}</Text>
                      <Text style={[s.currencyCode, currency === c.code && { color: C.primary }]}>{c.code}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={s.btnPrimary} onPress={handleCreate}>
                  <Text style={s.btnPrimaryText}>{t.create_project}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── 编辑弹窗 ──────────────────────────────────────────── */}
      <Modal visible={showEdit} animationType="slide" transparent onRequestClose={() => setShowEdit(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowEdit(false)}>
          <TouchableOpacity style={s.sheet} activeOpacity={1}>
            <View style={s.handle} />
            <Text style={s.modalTitle}>{t.edit_current_project}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 500 }}>
              <View style={s.modalBody}>
                <Text style={s.label}>{t.project_icon}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {EMOJIS.map(e => (
                      <TouchableOpacity key={e} style={[s.emojiBtn, emoji === e && s.emojiBtnActive]}
                        onPress={() => setEmoji(e)}>
                        <Text style={{ fontSize: 28 }}>{e}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                <Text style={[s.label, { marginTop: 18 }]}>{t.project_name}</Text>
                <TextInput style={s.input} placeholder={t.project_name_placeholder} placeholderTextColor={C.text3}
                  value={name} onChangeText={setName} />
                <Text style={[s.label, { marginTop: 18 }]}>{t.project_currency}</Text>
                <View style={s.currencyGrid}>
                  {CURRENCIES.map(c => (
                    <TouchableOpacity key={c.code}
                      style={[s.currencyBtn, currency === c.code && s.currencyBtnActive]}
                      onPress={() => setCurrency(c.code)}>
                      <Text style={[s.currencySymbol, currency === c.code && { color: C.primary }]}>{c.symbol}</Text>
                      <Text style={[s.currencyCode, currency === c.code && { color: C.primary }]}>{c.code}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={s.btnPrimary} onPress={handleEdit}>
                  <Text style={s.btnPrimaryText}>{t.save_changes}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── 分享弹窗 ──────────────────────────────────────────── */}
      <Modal visible={showShare} animationType="slide" transparent onRequestClose={() => setShowShare(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowShare(false)}>
          <TouchableOpacity style={s.sheet} activeOpacity={1}>
            <View style={s.handle} />
            <Text style={s.modalTitle}>{t.share_title}</Text>
            <View style={s.modalBody}>
              <Text style={s.label}>{t.share_code_label}</Text>

              {shareLoading ? (
                <View style={s.codeBox}>
                  <ActivityIndicator size="large" color={C.cloud} />
                  <Text style={[s.syncText, { color: C.text2, marginTop: 8 }]}>{t.syncing}</Text>
                </View>
              ) : (
                <View style={s.codeBox}>
                  <Text style={s.codeText}>{shareCode}</Text>
                </View>
              )}

              <Text style={s.shareHint}>{t.share_instruction}</Text>

              <TouchableOpacity
                style={[s.btnPrimary, { backgroundColor: C.cloud }]}
                onPress={handleSend}
                disabled={!shareCode}>
                <Text style={s.btnPrimaryText}>{t.share_send}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── 加入弹窗 ──────────────────────────────────────────── */}
      <Modal visible={showJoin} animationType="slide" transparent onRequestClose={() => setShowJoin(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowJoin(false)}>
          <TouchableOpacity style={s.sheet} activeOpacity={1} onPress={() => {}}>
            <View style={s.handle} />
            <Text style={s.modalTitle}>{t.join_title}</Text>
<<<<<<< HEAD
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={s.modalBody}>
                <Text style={s.label}>{t.share_code_label}</Text>
                <TextInput
                  style={[s.input, s.codeInput]}
                  placeholder={t.join_placeholder}
                  placeholderTextColor={C.text3}
                  value={joinCode}
                  onChangeText={v => setJoinCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  keyboardType="default"
                />
                <TouchableOpacity
                  style={[s.btnPrimary, { backgroundColor: C.success }, joinLoading && { opacity: 0.7 }]}
                  onPress={handleJoin}
                  disabled={joinLoading}>
                  {joinLoading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.btnPrimaryText}>{t.join_btn}</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
=======
            <View style={s.modalBody}>
              <Text style={s.label}>{t.share_code_label}</Text>
              <TextInput
                style={[s.input, s.codeInput]}
                placeholder={t.join_placeholder}
                placeholderTextColor={C.text3}
                value={joinCode}
                onChangeText={v => setJoinCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                autoCapitalize="characters"
                autoCorrect={false}
                keyboardType="default"
              />
              <TouchableOpacity
                style={[s.btnPrimary, { backgroundColor: C.success }, joinLoading && { opacity: 0.7 }]}
                onPress={handleJoin}
                disabled={joinLoading}>
                {joinLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnPrimaryText}>{t.join_btn}</Text>}
              </TouchableOpacity>
            </View>
>>>>>>> 49986c6f4a5136fe540beb85c43c8d1f9b056afd
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.primary },
  header: { backgroundColor: C.primary, paddingHorizontal: 20, paddingBottom: 20, paddingTop: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 },
  syncBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  syncText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  langBtn: { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center', gap: 2 },
  langBtnFlag: { fontSize: 20 },
  langBtnLabel: { fontSize: 11, color: '#fff', fontWeight: '700' },
  list: { flex: 1, backgroundColor: C.bg },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: 'transparent', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  cardActive: { borderColor: C.primary },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardEmoji: { fontSize: 36 },
  cardName: { fontSize: 16, fontWeight: '700', color: C.text1 },
  cardMeta: { fontSize: 12, color: C.text3, marginTop: 3 },
  cardTotal: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  activeBadge: { backgroundColor: '#EEF2FF', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  activeBadgeText: { fontSize: 11, color: C.primary, fontWeight: '600' },
  cloudBadge: { backgroundColor: '#F3E8FF', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  cloudBadgeText: { fontSize: 11, color: C.cloud, fontWeight: '700' },
  delBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  delBtnText: { fontSize: 14, color: C.danger },
  bottomBar: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border, flexWrap: 'wrap' },
  btn: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center' },
  btnText: { fontSize: 13, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  handle: { width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  modalTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center', paddingVertical: 10, color: C.text1 },
  modalBody: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '600', color: C.text2, marginBottom: 8 },
  input: { borderWidth: 1.5, borderColor: C.border, borderRadius: 12, padding: 12, fontSize: 16, color: C.text1 },
  codeInput: { fontSize: 24, fontWeight: '800', textAlign: 'center', letterSpacing: 6, color: C.cloud },
  emojiBtn: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  emojiBtnActive: { borderColor: C.primary, backgroundColor: '#EEF2FF' },
  currencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  currencyBtn: { borderWidth: 1.5, borderColor: C.border, borderRadius: 12, padding: 10, alignItems: 'center', width: '22%', backgroundColor: C.bg },
  currencyBtnActive: { borderColor: C.primary, backgroundColor: '#EEF2FF' },
  currencySymbol: { fontSize: 18, fontWeight: '800', color: C.text2 },
  currencyCode: { fontSize: 11, color: C.text3, marginTop: 2 },
  btnPrimary: { backgroundColor: C.primary, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 24 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  codeBox: { backgroundColor: '#F3E8FF', borderRadius: 16, paddingVertical: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  codeText: { fontSize: 38, fontWeight: '900', color: C.cloud, letterSpacing: 8 },
  shareHint: { fontSize: 13, color: C.text2, lineHeight: 20, textAlign: 'center', marginBottom: 4 },
});

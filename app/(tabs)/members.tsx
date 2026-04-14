import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  TextInput, StyleSheet, SafeAreaView, Alert, StatusBar,
} from 'react-native';
import { useStore } from '../../src/store';
import { Member, Sponsor } from '../../src/types';
import { useT } from '../../src/LanguageContext';

const C = {
  primary: '#4F7FFF', bg: '#F4F6FA', card: '#FFFFFF',
  text1: '#1A1D23', text2: '#5A6173', text3: '#9CA3AF',
  border: '#E8ECF4', danger: '#FF5A5A',
};

const AVATARS = ['👨','👩','🧒','👴','👵','🧑','👦','👧','🧔','👱','🐱','🐶'];
const PARTS   = [0.25, 0.5, 0.75, 1.0];
const PCT_PRESETS = [
  { label: '50 / 50', values: [50, 50] },
  { label: '60 / 40', values: [60, 40] },
  { label: '70 / 30', values: [70, 30] },
  { label: '80 / 20', values: [80, 20] },
  { label: '100 / 0', values: [100, 0] },
];

export default function MembersScreen() {
  const { trip, addMember, updateMember, removeMember, addFamily, removeFamily } = useStore();
  const t = useT();

  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingMember, setEditingMember]     = useState<Member | null>(null);
  const [mName, setMName]                     = useState('');
  const [mAvatar, setMAvatar]                 = useState('👤');
  const [mPart, setMPart]                     = useState(1.0);
  const [mFamilyId, setMFamilyId]             = useState<string | undefined>(undefined);
  const [hasSponsors, setHasSponsors]         = useState(false);
  const [sponsorIds, setSponsorIds]           = useState<string[]>([]);
  const [sponsorPcts, setSponsorPcts]         = useState<number[]>([]);

  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [fName, setFName]                     = useState('');

  const openAdd = () => {
    setEditingMember(null);
    setMName(''); setMAvatar('👤'); setMPart(1.0); setMFamilyId(undefined);
    setHasSponsors(false); setSponsorIds([]); setSponsorPcts([]);
    setShowMemberModal(true);
  };

  const openEdit = (m: Member) => {
    setEditingMember(m);
    setMName(m.name); setMAvatar(m.avatar);
    setMPart(m.storedPart / 100); setMFamilyId(m.familyId);
    if (m.sponsors && m.sponsors.length > 0) {
      setHasSponsors(true);
      setSponsorIds(m.sponsors.map(s => s.memberId));
      setSponsorPcts(m.sponsors.map(s => s.percentage));
    } else {
      setHasSponsors(false); setSponsorIds([]); setSponsorPcts([]);
    }
    setShowMemberModal(true);
  };

  const toggleSponsorMember = (id: string) => {
    if (sponsorIds.includes(id)) {
      const idx = sponsorIds.indexOf(id);
      setSponsorIds(sponsorIds.filter(s => s !== id));
      setSponsorPcts(sponsorPcts.filter((_, i) => i !== idx));
    } else {
      setSponsorIds([...sponsorIds, id]);
      setSponsorPcts([...sponsorPcts, 0]);
    }
  };

  const applyPreset = (values: number[]) => {
    if (sponsorIds.length !== 2) return;
    setSponsorPcts(values);
  };

  const totalPct = sponsorPcts.reduce((s, p) => s + p, 0);

  const saveMember = () => {
    if (!mName.trim()) { Alert.alert(t.hint, t.enter_name); return; }
    if (hasSponsors) {
      if (sponsorIds.length === 0) { Alert.alert(t.hint, t.select_sponsor); return; }
      if (totalPct !== 100) { Alert.alert(t.hint, t.pct_must_100(totalPct)); return; }
    }
    const sponsors: Sponsor[] | undefined = hasSponsors
      ? sponsorIds.map((id, i) => ({ memberId: id, percentage: sponsorPcts[i] })).filter(s => s.percentage > 0)
      : undefined;
    const data = { name: mName.trim(), avatar: mAvatar, storedPart: Math.round(mPart * 100), familyId: mFamilyId, sponsors };
    if (editingMember) {
      updateMember(editingMember.id, data);
    } else {
      addMember(data);
    }
    setShowMemberModal(false);
  };

  const confirmDelete = (m: Member) =>
    Alert.alert(t.delete, `确认删除"${m.name}"？`, [
      { text: t.cancel, style: 'cancel' },
      { text: t.delete, style: 'destructive', onPress: () => removeMember(m.id) },
    ]);

  const saveFamily = () => {
    if (!fName.trim()) { Alert.alert(t.hint, t.enter_name); return; }
    addFamily(fName.trim()); setFName(''); setShowFamilyModal(false);
  };

  const unassigned = trip.members.filter(m => !m.familyId);
  const candidateSponsors = trip.members.filter(m => m.id !== editingMember?.id);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={s.header}>
        <Text style={s.title}>{t.member_management}</Text>
        <Text style={s.subtitle}>{t.members_count(trip.members.length)} · {t.families_count(trip.families.length)}</Text>
      </View>

      <ScrollView style={s.list} contentContainerStyle={{ paddingBottom: 120 }}>
        {trip.families.map(family => {
          const fMembers = trip.members.filter(m => m.familyId === family.id);
          return (
            <View key={family.id} style={s.section}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>🏠 {family.name}</Text>
                <TouchableOpacity onPress={() => Alert.alert(t.delete_family_title, t.delete_family_msg(family.name), [
                  { text: t.cancel, style: 'cancel' },
                  { text: t.delete, style: 'destructive', onPress: () => removeFamily(family.id) },
                ])}>
                  <Text style={s.deleteLink}>{t.delete}</Text>
                </TouchableOpacity>
              </View>
              {fMembers.length === 0
                ? <Text style={s.emptyFamily}>{t.no_members}</Text>
                : fMembers.map(m => (
                  <MemberCard key={m.id} member={m}
                    editLabel={t.edit}
                    sponsorNames={m.sponsors?.map(sp => trip.members.find(x => x.id === sp.memberId)?.name ?? '?')}
                    sponsoredByText={names => t.sponsored_by(names)}
                    partDisplayText={p => t.part_display(p)}
                    onEdit={() => openEdit(m)} onDelete={() => confirmDelete(m)} />
                ))
              }
            </View>
          );
        })}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>{t.unassigned}</Text>
          </View>
          {unassigned.length === 0
            ? <Text style={s.emptyFamily}>{t.no_members}</Text>
            : unassigned.map(m => (
              <MemberCard key={m.id} member={m}
                editLabel={t.edit}
                sponsorNames={m.sponsors?.map(sp => trip.members.find(x => x.id === sp.memberId)?.name ?? '?')}
                sponsoredByText={names => t.sponsored_by(names)}
                partDisplayText={p => t.part_display(p)}
                onEdit={() => openEdit(m)} onDelete={() => confirmDelete(m)} />
            ))
          }
        </View>
      </ScrollView>

      <View style={s.bottomBar}>
        <TouchableOpacity style={[s.btn, { backgroundColor: '#EEF2FF', flex: 1 }]}
          onPress={() => { setFName(''); setShowFamilyModal(true); }}>
          <Text style={[s.btnText, { color: C.primary }]}>{t.add_family}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, { backgroundColor: C.primary, flex: 1 }]} onPress={openAdd}>
          <Text style={[s.btnText, { color: '#fff' }]}>{t.add_member}</Text>
        </TouchableOpacity>
      </View>

      {/* 成员弹窗 */}
      <Modal visible={showMemberModal} animationType="slide" transparent onRequestClose={() => setShowMemberModal(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowMemberModal(false)}>
          <TouchableOpacity style={s.sheet} activeOpacity={1}>
            <View style={s.handle} />
            <Text style={s.modalTitle}>{editingMember ? t.edit_member_title : t.add_member_title}</Text>
            <ScrollView style={{ maxHeight: 560 }} keyboardShouldPersistTaps="handled">
              <View style={s.modalBody}>
                {/* 头像 */}
                <Text style={s.label}>{t.avatar_label}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {AVATARS.map(a => (
                      <TouchableOpacity key={a} style={[s.avatarBtn, mAvatar === a && s.avatarBtnActive]} onPress={() => setMAvatar(a)}>
                        <Text style={{ fontSize: 28 }}>{a}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* 姓名 */}
                <Text style={[s.label, { marginTop: 18 }]}>{t.name_label}</Text>
                <TextInput style={s.input} placeholder={t.name_placeholder} placeholderTextColor={C.text3}
                  value={mName} onChangeText={setMName} />

                {/* Part 系数 */}
                <Text style={[s.label, { marginTop: 18 }]}>{t.part_label}</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {PARTS.map(p => (
                    <TouchableOpacity key={p} style={[s.partBtn, mPart === p && s.partBtnActive]} onPress={() => setMPart(p)}>
                      <Text style={[s.partBtnText, mPart === p && { color: C.primary }]}>×{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={s.hint}>{mPart === 1 ? t.adult_default : t.child_special(mPart)}</Text>

                {/* 家庭 */}
                <Text style={[s.label, { marginTop: 18 }]}>{t.family_label}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={[s.partBtn, !mFamilyId && s.partBtnActive]} onPress={() => setMFamilyId(undefined)}>
                      <Text style={[s.partBtnText, !mFamilyId && { color: C.primary }]}>{t.no_family}</Text>
                    </TouchableOpacity>
                    {trip.families.map(f => (
                      <TouchableOpacity key={f.id} style={[s.partBtn, mFamilyId === f.id && s.partBtnActive]} onPress={() => setMFamilyId(f.id)}>
                        <Text style={[s.partBtnText, mFamilyId === f.id && { color: C.primary }]}>{f.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* 赞助设置 */}
                <View style={s.sponsorToggleRow}>
                  <View>
                    <Text style={s.label}>{t.sponsor_toggle}</Text>
                    <Text style={s.hint}>{t.sponsor_hint}</Text>
                  </View>
                  <TouchableOpacity style={[s.toggle, hasSponsors && s.toggleOn]}
                    onPress={() => setHasSponsors(!hasSponsors)}>
                    <View style={[s.toggleThumb, hasSponsors && s.toggleThumbOn]} />
                  </TouchableOpacity>
                </View>

                {hasSponsors && (
                  <View style={s.sponsorBox}>
                    <Text style={s.label}>{t.sponsor_select}</Text>
                    {candidateSponsors.length === 0
                      ? <Text style={s.hint}>{t.no_sponsors_hint}</Text>
                      : candidateSponsors.map(m => (
                        <View key={m.id} style={s.sponsorRow}>
                          <TouchableOpacity style={s.sponsorCheckRow} onPress={() => toggleSponsorMember(m.id)}>
                            <View style={[s.checkbox, sponsorIds.includes(m.id) && s.checkboxActive]}>
                              {sponsorIds.includes(m.id) && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
                            </View>
                            <Text style={{ fontSize: 22 }}>{m.avatar}</Text>
                            <Text style={s.memberName}>{m.name}</Text>
                          </TouchableOpacity>
                          {sponsorIds.includes(m.id) && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8, marginLeft: 36 }}>
                              <Text style={s.hint}>{t.sponsor_pct}</Text>
                              {[10,20,30,40,50,60,70,80,90,100].map(pct => {
                                const sidx = sponsorIds.indexOf(m.id);
                                return (
                                  <TouchableOpacity key={pct}
                                    style={[s.pctBtn, sponsorPcts[sidx] === pct && s.pctBtnActive]}
                                    onPress={() => {
                                      const newPcts = [...sponsorPcts];
                                      newPcts[sidx] = pct;
                                      setSponsorPcts(newPcts);
                                    }}>
                                    <Text style={[s.pctBtnText, sponsorPcts[sidx] === pct && { color: C.primary }]}>{pct}%</Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          )}
                        </View>
                      ))
                    }

                    {sponsorIds.length === 2 && (
                      <>
                        <Text style={[s.hint, { marginTop: 10 }]}>{t.quick_preset}</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                            {PCT_PRESETS.map(preset => (
                              <TouchableOpacity key={preset.label} style={s.presetBtn} onPress={() => applyPreset(preset.values)}>
                                <Text style={s.presetBtnText}>{preset.label}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </ScrollView>
                      </>
                    )}

                    <View style={[s.pctSumRow, { backgroundColor: totalPct === 100 ? '#E6FAF3' : '#FFF0F0' }]}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: totalPct === 100 ? '#22C493' : '#FF5A5A' }}>
                        {t.pct_total(totalPct)} {totalPct === 100 ? t.pct_ok : t.pct_short(totalPct)}
                      </Text>
                    </View>
                  </View>
                )}

                <TouchableOpacity style={s.btnPrimary} onPress={saveMember}>
                  <Text style={s.btnPrimaryText}>{editingMember ? t.save_changes : t.add_member_title}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 家庭弹窗 */}
      <Modal visible={showFamilyModal} animationType="slide" transparent onRequestClose={() => setShowFamilyModal(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowFamilyModal(false)}>
          <TouchableOpacity style={s.sheet} activeOpacity={1}>
            <View style={s.handle} />
            <Text style={s.modalTitle}>{t.add_family_title}</Text>
            <View style={s.modalBody}>
              <Text style={s.label}>{t.family_name}</Text>
              <TextInput style={s.input} placeholder={t.family_name_placeholder} placeholderTextColor={C.text3}
                value={fName} onChangeText={setFName} />
              <TouchableOpacity style={s.btnPrimary} onPress={saveFamily}>
                <Text style={s.btnPrimaryText}>{t.add_family_title}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function MemberCard({ member, sponsorNames, editLabel, sponsoredByText, partDisplayText, onEdit, onDelete }:
  {
    member: Member;
    sponsorNames?: string[];
    editLabel: string;
    sponsoredByText: (names: string) => string;
    partDisplayText: (p: number) => string;
    onEdit: () => void;
    onDelete: () => void;
  }) {
  return (
    <View style={s.memberCard}>
      <Text style={{ fontSize: 32 }}>{member.avatar}</Text>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.memberName}>{member.name}</Text>
        <Text style={s.memberPart}>{partDisplayText(member.storedPart / 100)}</Text>
        {sponsorNames && sponsorNames.length > 0 && (
          <Text style={[s.memberPart, { color: '#FF8C42' }]}>
            {sponsoredByText(sponsorNames.join('、'))}
          </Text>
        )}
      </View>
      <TouchableOpacity style={s.editBtn} onPress={onEdit}>
        <Text style={s.editBtnText}>{editLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.delBtn} onPress={onDelete}>
        <Text style={s.delBtnText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.primary },
  header: { backgroundColor: C.primary, paddingHorizontal: 20, paddingBottom: 20, paddingTop: 10 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 },
  list: { flex: 1, backgroundColor: C.bg },
  section: { marginHorizontal: 16, marginTop: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: C.text2 },
  deleteLink: { fontSize: 13, color: C.danger },
  emptyFamily: { fontSize: 13, color: C.text3, textAlign: 'center', paddingVertical: 12 },
  memberCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 8, shadowColor: '#000', shadowOffset: { width:0, height:1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  memberName: { fontSize: 15, fontWeight: '600', color: C.text1 },
  memberPart: { fontSize: 12, color: C.text3, marginTop: 2 },
  editBtn: { borderWidth: 1.5, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginRight: 8 },
  editBtnText: { fontSize: 12, color: C.text2 },
  delBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' },
  delBtnText: { fontSize: 14, color: C.danger },
  bottomBar: { flexDirection: 'row', gap: 12, padding: 16, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border },
  btn: { borderRadius: 14, padding: 14, alignItems: 'center' },
  btnText: { fontSize: 15, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  handle: { width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  modalTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center', paddingVertical: 10, color: C.text1 },
  modalBody: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '600', color: C.text2, marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: C.border, borderRadius: 12, padding: 12, fontSize: 16, color: C.text1 },
  avatarBtn: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  avatarBtnActive: { borderColor: C.primary, backgroundColor: '#EEF2FF' },
  partBtn: { borderWidth: 1.5, borderColor: C.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.bg },
  partBtnActive: { borderColor: C.primary, backgroundColor: '#EEF2FF' },
  partBtnText: { fontSize: 14, fontWeight: '600', color: C.text2 },
  hint: { fontSize: 12, color: C.text3, marginTop: 4 },
  sponsorToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  toggle: { width: 50, height: 28, borderRadius: 14, backgroundColor: C.border, padding: 3, justifyContent: 'center' },
  toggleOn: { backgroundColor: C.primary },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: 'flex-start' },
  toggleThumbOn: { alignSelf: 'flex-end' },
  sponsorBox: { backgroundColor: '#F8F9FF', borderRadius: 14, padding: 14, marginTop: 12, borderWidth: 1.5, borderColor: '#D8E4FF' },
  sponsorRow: { marginBottom: 8 },
  sponsorCheckRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: C.primary, borderColor: C.primary },
  pctBtn: { borderWidth: 1.5, borderColor: C.border, borderRadius: 16, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.bg },
  pctBtnActive: { borderColor: C.primary, backgroundColor: '#EEF2FF' },
  pctBtnText: { fontSize: 12, color: C.text2, fontWeight: '600' },
  pctSumRow: { borderRadius: 10, padding: 10, marginTop: 12, alignItems: 'center' },
  presetBtn: { borderWidth: 1.5, borderColor: C.primary, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#EEF2FF' },
  presetBtnText: { fontSize: 12, color: C.primary, fontWeight: '700' },
  btnPrimary: { backgroundColor: C.primary, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 24 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

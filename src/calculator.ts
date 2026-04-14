import type {
  Expense, Member, MemberSummary, FamilySummary,
  Settlement, Trip, DailySummary, ExpenseShare,
} from './types';

// ── 分摊计算（含赞助逻辑）────────────────────────────────
export function calcShares(expense: Expense, members: Member[]): ExpenseShare[] {
  if (expense.isGift) return []; // 礼物不分摊
  const { participantIds, totalAmountCents, category, splitMode, splitTarget } = expense;
  const participants = members.filter(m => participantIds.includes(m.id));
  if (participants.length === 0) return [];

  let rawShares: ExpenseShare[];

  if (splitTarget === 'family') {
    // 按家庭平均分：每个家庭各出一份，家庭内再按 part 系数分给各成员
    rawShares = familySplit(participants, totalAmountCents);
  } else {
    // 按个人分（原有逻辑）
    const usePartCoeff =
      category === 'dining' ||
      (category === 'other' && splitMode === 'by_part');

    if (usePartCoeff) {
      const totalPart = participants.reduce((s, m) => s + m.storedPart, 0);
      if (totalPart === 0) {
        rawShares = equalSplit(participants, totalAmountCents);
      } else {
        let allocated = 0;
        rawShares = participants.map((m, i) => {
          const isLast = i === participants.length - 1;
          const amount = isLast
            ? totalAmountCents - allocated
            : Math.floor((totalAmountCents * m.storedPart) / totalPart);
          allocated += amount;
          return { memberId: m.id, amountCents: amount };
        });
      }
    } else {
      rawShares = equalSplit(participants, totalAmountCents);
    }
  }

  // 应用赞助逻辑
  return applySponsors(rawShares, members);
}

/**
 * 家庭分摊：
 *   1. 将参与成员按家庭分组（无家庭的成员各自单独成一组）
 *   2. 各家庭组平均分担总金额
 *   3. 组内按每人 storedPart 系数再次分配
 */
function familySplit(participants: Member[], total: number): ExpenseShare[] {
  // 按 familyId 分组；无家庭成员用 `solo_${memberId}` 作为 key
  const groupMap = new Map<string, Member[]>();
  participants.forEach(m => {
    const key = m.familyId ?? `solo_${m.id}`;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(m);
  });

  const groups = Array.from(groupMap.values());
  const numGroups = groups.length;
  const shares: ExpenseShare[] = [];
  let totalAllocated = 0;

  groups.forEach((groupMembers, gIdx) => {
    const isLastGroup = gIdx === numGroups - 1;
    // 每个家庭的份额（等份）
    const groupAmount = isLastGroup
      ? total - totalAllocated
      : Math.floor(total / numGroups);
    totalAllocated += groupAmount;

    // 家庭内平均分（按家庭分账时，家庭内部各成员平摊）
    shares.push(...equalSplit(groupMembers, groupAmount));
  });

  return shares;
}

/** 返回参与此支出的家庭组信息（用于 UI 预览）*/
export function getFamilyGroups(participantIds: string[], members: Member[]):
  Array<{ label: string; memberIds: string[] }> {
  const groupMap = new Map<string, { label: string; memberIds: string[] }>();
  const participants = members.filter(m => participantIds.includes(m.id));
  participants.forEach(m => {
    const key = m.familyId ?? `solo_${m.id}`;
    if (!groupMap.has(key)) {
      const familyName = m.familyId
        ? (members.find(x => x.id === m.id) ?? m).familyId  // placeholder; caller uses trip.families
        : m.name;
      groupMap.set(key, { label: familyName ?? m.name, memberIds: [] });
    }
    groupMap.get(key)!.memberIds.push(m.id);
  });
  return Array.from(groupMap.values());
}

/** 赞助重分配：将被赞助成员的份额转移到 sponsors */
function applySponsors(shares: ExpenseShare[], members: Member[]): ExpenseShare[] {
  const result = shares.map(s => ({ ...s }));

  result.forEach(share => {
    if (share.amountCents === 0) return;
    const member = members.find(m => m.id === share.memberId);
    const sponsors = member?.sponsors;
    if (!sponsors || sponsors.length === 0) return;

    const totalPct = sponsors.reduce((s, sp) => s + sp.percentage, 0);
    if (totalPct !== 100) return; // 百分比不完整时不处理

    let distributed = 0;
    sponsors.forEach((sp, idx) => {
      const isLast = idx === sponsors.length - 1;
      const amount = isLast
        ? share.amountCents - distributed
        : Math.floor(share.amountCents * sp.percentage / 100);
      distributed += amount;

      const existing = result.find(s => s.memberId === sp.memberId);
      if (existing) {
        existing.amountCents += amount;
      } else {
        result.push({ memberId: sp.memberId, amountCents: amount });
      }
    });
    share.amountCents = 0; // 被赞助者自己不出钱
  });

  return result.filter(s => s.amountCents > 0);
}

function equalSplit(participants: Member[], total: number): ExpenseShare[] {
  const n = participants.length;
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  return participants.map((m, i) => ({
    memberId: m.id,
    amountCents: i === 0 ? base + remainder : base,
  }));
}

// ── 个人汇总 ─────────────────────────────────────────────
export function calcMemberSummaries(trip: Trip): MemberSummary[] {
  const ledger = new Map<string, { owed: number; paid: number }>();
  trip.members.forEach(m => ledger.set(m.id, { owed: 0, paid: 0 }));

  trip.expenses.forEach(exp => {
    if (exp.isGift) return; // 礼物不计入账务
    const payer = ledger.get(exp.payerId);
    if (payer) payer.paid += exp.totalAmountCents;
    exp.shares.forEach(share => {
      const entry = ledger.get(share.memberId);
      if (entry) entry.owed += share.amountCents;
    });
  });

  return trip.members.map(m => {
    const { owed, paid } = ledger.get(m.id)!;
    return {
      memberId: m.id,
      memberName: m.name,
      memberAvatar: m.avatar,
      familyId: m.familyId,
      totalOwedCents: owed,
      totalPaidCents: paid,
      netCents: paid - owed,
    };
  });
}

// ── 家庭汇总 ─────────────────────────────────────────────
export function calcFamilySummaries(trip: Trip, memberSummaries: MemberSummary[]): FamilySummary[] {
  return trip.families.map(family => {
    const ms = memberSummaries.filter(s => s.familyId === family.id);
    return {
      familyId: family.id,
      familyName: family.name,
      memberNames: ms.map(s => s.memberName),
      totalOwedCents: ms.reduce((s, m) => s + m.totalOwedCents, 0),
      totalPaidCents: ms.reduce((s, m) => s + m.totalPaidCents, 0),
      netCents: ms.reduce((s, m) => s + m.netCents, 0),
    };
  });
}

// ── 结算算法（最少转账次数贪心）──────────────────────────
export function calcSettlements(memberSummaries: MemberSummary[]): Settlement[] {
  const settlements: Settlement[] = [];
  const balances = memberSummaries.map(ms => ({
    memberId: ms.memberId, memberName: ms.memberName,
    avatar: ms.memberAvatar, net: ms.netCents,
  }));

  while (true) {
    balances.sort((a, b) => b.net - a.net);
    const creditor = balances[0];
    const debtor = balances[balances.length - 1];
    if (!creditor || !debtor || creditor.net <= 0 || debtor.net >= 0) break;

    const amount = Math.min(creditor.net, -debtor.net);
    settlements.push({
      fromMemberId: debtor.memberId, fromMemberName: debtor.memberName, fromAvatar: debtor.avatar,
      toMemberId: creditor.memberId, toMemberName: creditor.memberName, toAvatar: creditor.avatar,
      amountCents: amount,
    });
    creditor.net -= amount;
    debtor.net += amount;
  }
  return settlements;
}

// ── 按日期分组 ────────────────────────────────────────────
export function calcDailySummaries(trip: Trip): DailySummary[] {
  const map = new Map<string, DailySummary>();

  [...trip.expenses]
    .sort((a, b) => b.time - a.time)
    .forEach(exp => {
      const d = new Date(exp.time);
      const label = d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
      if (!map.has(label)) {
        map.set(label, { dateLabel: label, totalCents: 0, byCategory: {}, expenses: [] });
      }
      const day = map.get(label)!;
      day.totalCents += exp.totalAmountCents;
      day.byCategory[exp.category] = (day.byCategory[exp.category] ?? 0) + exp.totalAmountCents;
      day.expenses.push(exp);
    });

  return Array.from(map.values());
}

// ── 一次性计算全部视图数据 ────────────────────────────────
export function calcTripSummary(trip: Trip) {
  const memberSummaries = calcMemberSummaries(trip);
  const familySummaries = calcFamilySummaries(trip, memberSummaries);
  const settlements = calcSettlements(memberSummaries);
  const dailySummaries = calcDailySummaries(trip);
  const totalExpenseCents = trip.expenses.reduce((s, e) => s + e.totalAmountCents, 0);
  return { memberSummaries, familySummaries, settlements, dailySummaries, totalExpenseCents };
}

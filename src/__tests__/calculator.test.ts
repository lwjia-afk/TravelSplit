import {
  calcShares,
  calcMemberSummaries,
  calcSettlements,
  calcFamilySummaries,
  calcTripSummary,
} from '../calculator';
import type { Member, Expense, Trip } from '../types';

// ── 测试数据工厂 ──────────────────────────────────────────────

function makeMember(overrides: Partial<Member> & { id: string; name: string }): Member {
  return {
    avatar: '😀',
    storedPart: 100,
    createdAt: 0,
    ...overrides,
  };
}

function makeExpense(overrides: Partial<Expense> & { id: string }): Expense {
  return {
    title: 'Test',
    totalAmountCents: 10000,
    category: 'dining',
    splitMode: 'equal',
    splitTarget: 'person',
    participantIds: [],
    payerId: 'a',
    time: 0,
    shares: [],
    createdAt: 0,
    ...overrides,
  };
}

function makeTrip(members: Member[], expenses: Expense[]): Trip {
  return {
    id: 'trip1',
    name: 'Test Trip',
    emoji: '✈️',
    currency: 'CNY',
    members,
    families: [],
    expenses,
    createdAt: 0,
    updatedAt: 0,
  };
}

// ── calcShares ────────────────────────────────────────────────

describe('calcShares', () => {

  const alice = makeMember({ id: 'a', name: 'Alice', storedPart: 100 });
  const bob   = makeMember({ id: 'b', name: 'Bob',   storedPart: 100 });
  const carol = makeMember({ id: 'c', name: 'Carol', storedPart: 100 });

  test('礼物支出返回空分摊', () => {
    const exp = makeExpense({ id: 'e1', isGift: true, participantIds: ['a', 'b'], totalAmountCents: 5000 });
    expect(calcShares(exp, [alice, bob])).toEqual([]);
  });

  test('无参与者返回空分摊', () => {
    const exp = makeExpense({ id: 'e1', participantIds: [], totalAmountCents: 6000 });
    expect(calcShares(exp, [alice, bob])).toEqual([]);
  });

  test('单人参与全额承担', () => {
    const exp = makeExpense({ id: 'e1', participantIds: ['a'], totalAmountCents: 3000 });
    const shares = calcShares(exp, [alice, bob]);
    expect(shares).toHaveLength(1);
    expect(shares[0]).toEqual({ memberId: 'a', amountCents: 3000 });
  });

  test('两人平均分 — 整除', () => {
    const exp = makeExpense({ id: 'e1', participantIds: ['a', 'b'], totalAmountCents: 8000 });
    const shares = calcShares(exp, [alice, bob]);
    const total = shares.reduce((s, x) => s + x.amountCents, 0);
    expect(total).toBe(8000);
    expect(shares.find(s => s.memberId === 'a')?.amountCents).toBe(4000);
    expect(shares.find(s => s.memberId === 'b')?.amountCents).toBe(4000);
  });

  test('三人平均分 — 余数正确分配，总和不丢分', () => {
    // 100 / 3 = 33.33...，余数 1 分给第一人
    const exp = makeExpense({ id: 'e1', participantIds: ['a', 'b', 'c'], totalAmountCents: 100 });
    const shares = calcShares(exp, [alice, bob, carol]);
    const total = shares.reduce((s, x) => s + x.amountCents, 0);
    expect(total).toBe(100);
  });

  test('dining 按 part 比例分', () => {
    const adult = makeMember({ id: 'a', name: 'Adult', storedPart: 200 }); // part=2
    const child = makeMember({ id: 'c', name: 'Child', storedPart: 100 }); // part=1
    const exp = makeExpense({
      id: 'e1', category: 'dining', splitMode: 'by_part',
      participantIds: ['a', 'c'], totalAmountCents: 300,
    });
    const shares = calcShares(exp, [adult, child]);
    const total = shares.reduce((s, x) => s + x.amountCents, 0);
    expect(total).toBe(300);
    const adultShare = shares.find(s => s.memberId === 'a')!.amountCents;
    const childShare = shares.find(s => s.memberId === 'c')!.amountCents;
    // 成人出 2/3，儿童出 1/3
    expect(adultShare).toBe(200);
    expect(childShare).toBe(100);
  });

  test('part 全为 0 时降级为平均分', () => {
    const m1 = makeMember({ id: 'a', name: 'A', storedPart: 0 });
    const m2 = makeMember({ id: 'b', name: 'B', storedPart: 0 });
    const exp = makeExpense({
      id: 'e1', category: 'dining', splitMode: 'by_part',
      participantIds: ['a', 'b'], totalAmountCents: 200,
    });
    const shares = calcShares(exp, [m1, m2]);
    const total = shares.reduce((s, x) => s + x.amountCents, 0);
    expect(total).toBe(200);
    expect(shares.find(s => s.memberId === 'a')?.amountCents).toBe(100);
    expect(shares.find(s => s.memberId === 'b')?.amountCents).toBe(100);
  });

  test('other + equal 强制平均分，忽略 part 系数', () => {
    const adult = makeMember({ id: 'a', name: 'Adult', storedPart: 200 });
    const child = makeMember({ id: 'c', name: 'Child', storedPart: 100 });
    const exp = makeExpense({
      id: 'e1', category: 'other', splitMode: 'equal',
      participantIds: ['a', 'c'], totalAmountCents: 200,
    });
    const shares = calcShares(exp, [adult, child]);
    expect(shares.find(s => s.memberId === 'a')?.amountCents).toBe(100);
    expect(shares.find(s => s.memberId === 'c')?.amountCents).toBe(100);
  });

  test('油费/租车家庭分账 — 家庭内平均分，60元两人各30', () => {
    const m1 = makeMember({ id: 'a', name: 'A', storedPart: 100, familyId: 'f1' });
    const m2 = makeMember({ id: 'b', name: 'B', storedPart: 150, familyId: 'f1' }); // 不同 part 也应各出一半
    const exp = makeExpense({
      id: 'e1', category: 'fuel', splitTarget: 'family',
      participantIds: ['a', 'b'], totalAmountCents: 6000,
    });
    const shares = calcShares(exp, [m1, m2]);
    const total = shares.reduce((s, x) => s + x.amountCents, 0);
    expect(total).toBe(6000);
    expect(shares.find(s => s.memberId === 'a')?.amountCents).toBe(3000);
    expect(shares.find(s => s.memberId === 'b')?.amountCents).toBe(3000);
  });

  test('家庭分账 — 两家庭各出一半', () => {
    const a1 = makeMember({ id: 'a1', name: 'A1', storedPart: 100, familyId: 'f1' });
    const a2 = makeMember({ id: 'a2', name: 'A2', storedPart: 100, familyId: 'f1' });
    const b1 = makeMember({ id: 'b1', name: 'B1', storedPart: 100, familyId: 'f2' });
    const exp = makeExpense({
      id: 'e1', category: 'car_rental', splitTarget: 'family',
      participantIds: ['a1', 'a2', 'b1'], totalAmountCents: 10000,
    });
    const shares = calcShares(exp, [a1, a2, b1]);
    const total = shares.reduce((s, x) => s + x.amountCents, 0);
    expect(total).toBe(10000);
    // 家庭 f1 合计 5000，家庭 f2 合计 5000
    const f1Total = shares.filter(s => ['a1','a2'].includes(s.memberId))
                          .reduce((s, x) => s + x.amountCents, 0);
    const f2Total = shares.find(s => s.memberId === 'b1')!.amountCents;
    expect(f1Total).toBe(5000);
    expect(f2Total).toBe(5000);
  });

  test('赞助逻辑 — 被赞助成员份额转移给赞助人', () => {
    const parent = makeMember({ id: 'p', name: 'Parent', storedPart: 100 });
    const child  = makeMember({
      id: 'k', name: 'Child', storedPart: 100,
      sponsors: [{ memberId: 'p', percentage: 100 }],
    });
    const exp = makeExpense({
      id: 'e1', participantIds: ['p', 'k'], totalAmountCents: 200,
    });
    const shares = calcShares(exp, [parent, child]);
    // 孩子的 100 全部转给父母
    expect(shares.find(s => s.memberId === 'k')).toBeUndefined();
    expect(shares.find(s => s.memberId === 'p')?.amountCents).toBe(200);
  });

  test('赞助比例不等于100时不处理', () => {
    const parent = makeMember({ id: 'p', name: 'Parent', storedPart: 100 });
    const child  = makeMember({
      id: 'k', name: 'Child', storedPart: 100,
      sponsors: [{ memberId: 'p', percentage: 80 }], // 只有80%，不完整
    });
    const exp = makeExpense({
      id: 'e1', participantIds: ['p', 'k'], totalAmountCents: 200,
    });
    const shares = calcShares(exp, [parent, child]);
    // 不处理赞助，正常平均分
    expect(shares.find(s => s.memberId === 'k')?.amountCents).toBe(100);
    expect(shares.find(s => s.memberId === 'p')?.amountCents).toBe(100);
  });

  test('所有金额总和始终等于原始金额 — 大金额', () => {
    const members = ['a','b','c','d','e'].map(id =>
      makeMember({ id, name: id, storedPart: 100 })
    );
    const exp = makeExpense({
      id: 'e1', participantIds: ['a','b','c','d','e'], totalAmountCents: 99999,
    });
    const shares = calcShares(exp, members);
    const total = shares.reduce((s, x) => s + x.amountCents, 0);
    expect(total).toBe(99999);
  });

  test('金额为1分，多人参与，总和不丢分', () => {
    const members = ['a','b','c'].map(id => makeMember({ id, name: id, storedPart: 100 }));
    const exp = makeExpense({ id: 'e1', participantIds: ['a','b','c'], totalAmountCents: 1 });
    const shares = calcShares(exp, members);
    const total = shares.reduce((s, x) => s + x.amountCents, 0);
    expect(total).toBe(1);
  });
});

// ── calcMemberSummaries ───────────────────────────────────────

describe('calcMemberSummaries', () => {

  test('无支出时净额全为0', () => {
    const trip = makeTrip(
      [makeMember({ id: 'a', name: 'A' }), makeMember({ id: 'b', name: 'B' })],
      []
    );
    const summaries = calcMemberSummaries(trip);
    summaries.forEach(s => {
      expect(s.netCents).toBe(0);
      expect(s.totalPaidCents).toBe(0);
      expect(s.totalOwedCents).toBe(0);
    });
  });

  test('礼物不计入账务', () => {
    const alice = makeMember({ id: 'a', name: 'Alice' });
    const bob   = makeMember({ id: 'b', name: 'Bob' });
    const gift  = makeExpense({
      id: 'e1', isGift: true, payerId: 'a',
      participantIds: ['a', 'b'], totalAmountCents: 5000,
      shares: [],
    });
    const trip = makeTrip([alice, bob], [gift]);
    const summaries = calcMemberSummaries(trip);
    summaries.forEach(s => expect(s.netCents).toBe(0));
  });

  test('付款人净额为正，欠款人净额为负', () => {
    const alice = makeMember({ id: 'a', name: 'Alice' });
    const bob   = makeMember({ id: 'b', name: 'Bob' });
    const exp   = makeExpense({
      id: 'e1', payerId: 'a', participantIds: ['a', 'b'],
      totalAmountCents: 10000,
      shares: [{ memberId: 'a', amountCents: 5000 }, { memberId: 'b', amountCents: 5000 }],
    });
    const trip = makeTrip([alice, bob], [exp]);
    const summaries = calcMemberSummaries(trip);
    const aliceSummary = summaries.find(s => s.memberId === 'a')!;
    const bobSummary   = summaries.find(s => s.memberId === 'b')!;
    expect(aliceSummary.netCents).toBe(5000);   // 付了10000，欠5000，净+5000
    expect(bobSummary.netCents).toBe(-5000);     // 付了0，欠5000，净-5000
  });

  test('多笔支出累加正确', () => {
    const alice = makeMember({ id: 'a', name: 'Alice' });
    const bob   = makeMember({ id: 'b', name: 'Bob' });
    const exp1  = makeExpense({
      id: 'e1', payerId: 'a', participantIds: ['a', 'b'],
      totalAmountCents: 10000,
      shares: [{ memberId: 'a', amountCents: 5000 }, { memberId: 'b', amountCents: 5000 }],
    });
    const exp2  = makeExpense({
      id: 'e2', payerId: 'b', participantIds: ['a', 'b'],
      totalAmountCents: 4000,
      shares: [{ memberId: 'a', amountCents: 2000 }, { memberId: 'b', amountCents: 2000 }],
    });
    const trip = makeTrip([alice, bob], [exp1, exp2]);
    const summaries = calcMemberSummaries(trip);
    const aliceSummary = summaries.find(s => s.memberId === 'a')!;
    const bobSummary   = summaries.find(s => s.memberId === 'b')!;
    // Alice: paid 10000, owed 7000 → net +3000
    // Bob:   paid 4000,  owed 7000 → net -3000
    expect(aliceSummary.netCents).toBe(3000);
    expect(bobSummary.netCents).toBe(-3000);
  });

  test('所有成员净额之和为零（守恒）', () => {
    const members = ['a','b','c'].map(id => makeMember({ id, name: id }));
    const exp = makeExpense({
      id: 'e1', payerId: 'a', participantIds: ['a','b','c'],
      totalAmountCents: 9000,
      shares: [
        { memberId: 'a', amountCents: 3000 },
        { memberId: 'b', amountCents: 3000 },
        { memberId: 'c', amountCents: 3000 },
      ],
    });
    const trip = makeTrip(members, [exp]);
    const summaries = calcMemberSummaries(trip);
    const totalNet = summaries.reduce((s, m) => s + m.netCents, 0);
    expect(totalNet).toBe(0);
  });
});

// ── calcSettlements ───────────────────────────────────────────

describe('calcSettlements', () => {

  test('无成员时返回空', () => {
    expect(calcSettlements([])).toEqual([]);
  });

  test('全部平衡时无需转账', () => {
    const summaries = [
      { memberId: 'a', memberName: 'A', memberAvatar: '😀', familyId: undefined, totalOwedCents: 100, totalPaidCents: 100, netCents: 0 },
      { memberId: 'b', memberName: 'B', memberAvatar: '😀', familyId: undefined, totalOwedCents: 100, totalPaidCents: 100, netCents: 0 },
    ];
    expect(calcSettlements(summaries)).toEqual([]);
  });

  test('两人：A 欠 B，生成一笔转账', () => {
    const summaries = [
      { memberId: 'a', memberName: 'A', memberAvatar: '😀', familyId: undefined, totalOwedCents: 5000, totalPaidCents: 0,    netCents: -5000 },
      { memberId: 'b', memberName: 'B', memberAvatar: '😀', familyId: undefined, totalOwedCents: 0,    totalPaidCents: 5000, netCents: 5000  },
    ];
    const settlements = calcSettlements(summaries);
    expect(settlements).toHaveLength(1);
    expect(settlements[0].fromMemberId).toBe('a');
    expect(settlements[0].toMemberId).toBe('b');
    expect(settlements[0].amountCents).toBe(5000);
  });

  test('三人：最少转账次数', () => {
    // A 净 +6000，B 净 -2000，C 净 -4000 → 最多 2 笔
    const summaries = [
      { memberId: 'a', memberName: 'A', memberAvatar: '😀', familyId: undefined, totalOwedCents: 0,    totalPaidCents: 6000, netCents: 6000  },
      { memberId: 'b', memberName: 'B', memberAvatar: '😀', familyId: undefined, totalOwedCents: 2000, totalPaidCents: 0,    netCents: -2000 },
      { memberId: 'c', memberName: 'C', memberAvatar: '😀', familyId: undefined, totalOwedCents: 4000, totalPaidCents: 0,    netCents: -4000 },
    ];
    const settlements = calcSettlements(summaries);
    expect(settlements.length).toBeLessThanOrEqual(2);
    // 验证所有转账后账目清零
    const netAfter = { a: 6000, b: -2000, c: -4000 };
    settlements.forEach(s => {
      (netAfter as any)[s.fromMemberId] += s.amountCents;
      (netAfter as any)[s.toMemberId]   -= s.amountCents;
    });
    Object.values(netAfter).forEach(v => expect(v).toBe(0));
  });

  test('结算后所有净额归零', () => {
    const summaries = [
      { memberId: 'a', memberName: 'A', memberAvatar: '😀', familyId: undefined, totalOwedCents: 1000, totalPaidCents: 7000, netCents: 6000  },
      { memberId: 'b', memberName: 'B', memberAvatar: '😀', familyId: undefined, totalOwedCents: 3000, totalPaidCents: 0,    netCents: -3000 },
      { memberId: 'c', memberName: 'C', memberAvatar: '😀', familyId: undefined, totalOwedCents: 2000, totalPaidCents: 0,    netCents: -2000 },
      { memberId: 'd', memberName: 'D', memberAvatar: '😀', familyId: undefined, totalOwedCents: 1000, totalPaidCents: 0,    netCents: -1000 },
    ];
    const settlements = calcSettlements(summaries);
    const net: Record<string, number> = { a: 6000, b: -3000, c: -2000, d: -1000 };
    settlements.forEach(s => {
      net[s.fromMemberId] += s.amountCents;
      net[s.toMemberId]   -= s.amountCents;
    });
    Object.values(net).forEach(v => expect(v).toBe(0));
  });

  test('单人无需结算', () => {
    const summaries = [
      { memberId: 'a', memberName: 'A', memberAvatar: '😀', familyId: undefined, totalOwedCents: 100, totalPaidCents: 100, netCents: 0 },
    ];
    expect(calcSettlements(summaries)).toEqual([]);
  });
});

// ── calcTripSummary ───────────────────────────────────────────

describe('calcTripSummary', () => {

  test('空旅行返回全零', () => {
    const trip = makeTrip([], []);
    const result = calcTripSummary(trip);
    expect(result.settlements).toEqual([]);
    expect(result.memberSummaries).toEqual([]);
    expect(result.totalExpenseCents).toBe(0);
    expect(result.dailySummaries).toEqual([]);
  });

  test('totalExpenseCents 包含礼物金额', () => {
    const members = [makeMember({ id: 'a', name: 'A' })];
    const expenses = [
      makeExpense({ id: 'e1', totalAmountCents: 3000, payerId: 'a', participantIds: ['a'], shares: [{ memberId: 'a', amountCents: 3000 }] }),
      makeExpense({ id: 'e2', totalAmountCents: 2000, isGift: true, payerId: 'a', participantIds: ['a'], shares: [] }),
    ];
    const trip = makeTrip(members, expenses);
    const result = calcTripSummary(trip);
    expect(result.totalExpenseCents).toBe(5000); // 礼物也计入总金额展示
  });

  test('按日期正确分组', () => {
    const members = [makeMember({ id: 'a', name: 'A' })];
    const day1 = new Date('2024-01-01T10:00:00').getTime();
    const day2 = new Date('2024-01-02T10:00:00').getTime();
    const expenses = [
      makeExpense({ id: 'e1', time: day1, payerId: 'a', participantIds: ['a'], totalAmountCents: 1000, shares: [{ memberId: 'a', amountCents: 1000 }] }),
      makeExpense({ id: 'e2', time: day2, payerId: 'a', participantIds: ['a'], totalAmountCents: 2000, shares: [{ memberId: 'a', amountCents: 2000 }] }),
    ];
    const trip = makeTrip(members, expenses);
    const result = calcTripSummary(trip);
    expect(result.dailySummaries).toHaveLength(2);
  });
});

// ── formatAmount & inputToCents ───────────────────────────────

import { formatAmount, inputToCents } from '../types';

describe('formatAmount', () => {
  test('CNY 显示两位小数', () => {
    expect(formatAmount(10000, 'CNY')).toBe('¥100.00');
  });

  test('JPY 不显示小数', () => {
    expect(formatAmount(10000, 'JPY')).toBe('¥100');
  });

  test('KRW 不显示小数', () => {
    expect(formatAmount(50000, 'KRW')).toBe('₩500');
  });

  test('USD 显示两位小数', () => {
    expect(formatAmount(999, 'USD')).toBe('$9.99');
  });

  test('金额为0', () => {
    expect(formatAmount(0, 'CNY')).toBe('¥0.00');
  });

  test('大金额', () => {
    expect(formatAmount(1000000, 'CNY')).toBe('¥10000.00');
  });
});

describe('inputToCents', () => {
  test('整数转换', () => {
    expect(inputToCents('100')).toBe(10000);
  });

  test('小数转换', () => {
    expect(inputToCents('9.99')).toBe(999);
  });

  test('空字符串返回0', () => {
    expect(inputToCents('')).toBe(0);
  });

  test('浮点精度问题处理', () => {
    // 0.1 + 0.2 = 0.30000000000000004，需要 round
    expect(inputToCents('0.30')).toBe(30);
  });
});

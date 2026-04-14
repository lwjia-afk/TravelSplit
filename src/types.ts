export type ExpenseCategory = 'dining' | 'accommodation' | 'shopping' | 'other' | 'car_rental' | 'fuel';
export type SplitMode = 'by_part' | 'equal';
export type SplitTarget = 'person' | 'family'; // 按个人分 or 按家庭分
export type Currency = 'CNY' | 'USD' | 'JPY' | 'EUR' | 'GBP' | 'HKD' | 'KRW' | 'TWD';

export const CURRENCIES: { code: Currency; symbol: string; name: string; noDecimal: boolean }[] = [
  { code: 'CNY', symbol: '¥',   name: '人民币 CNY', noDecimal: false },
  { code: 'USD', symbol: '$',   name: '美元 USD',   noDecimal: false },
  { code: 'JPY', symbol: '¥',  name: '日元 JPY',   noDecimal: true  },
  { code: 'EUR', symbol: '€',   name: '欧元 EUR',   noDecimal: false },
  { code: 'GBP', symbol: '£',   name: '英镑 GBP',   noDecimal: false },
  { code: 'HKD', symbol: 'HK$', name: '港币 HKD',   noDecimal: false },
  { code: 'KRW', symbol: '₩',   name: '韩元 KRW',   noDecimal: true  },
  { code: 'TWD', symbol: 'NT$', name: '新台币 TWD',  noDecimal: false },
];

/** 格式化金额显示（分 → 字符串） */
export function formatAmount(cents: number, currency: Currency): string {
  const info = CURRENCIES.find(c => c.code === currency)!;
  const value = info.noDecimal
    ? Math.round(cents / 100).toString()
    : (cents / 100).toFixed(2);
  return `${info.symbol}${value}`;
}

/** 输入字符串 → 分（整数）*/
export function inputToCents(input: string): number {
  return Math.round(parseFloat(input || '0') * 100);
}

// ── 赞助人：承担某成员部分或全部费用 ──────────────────────
export interface Sponsor {
  memberId: string;
  percentage: number; // 0–100 整数，所有 sponsors 之和必须 = 100
}

export interface Family {
  id: string;
  name: string;
  createdAt: number;
}

export interface Member {
  id: string;
  name: string;
  avatar: string;
  storedPart: number;        // part × 100（整数）
  familyId?: string;
  sponsors?: Sponsor[];      // 若设置，该成员费用由 sponsors 承担
  createdAt: number;
}

export interface ExpenseShare {
  memberId: string;
  amountCents: number;
}

export interface Expense {
  id: string;
  title: string;
  totalAmountCents: number;
  category: ExpenseCategory;
  splitMode: SplitMode;
  splitTarget: SplitTarget;  // 'person'（按个人）| 'family'（按家庭）默认 'person'
  isGift?: boolean;          // 礼物：记录但不计入账务结算
  participantIds: string[];
  payerId: string;
  time: number;              // Unix 时间戳（ms），可手动修改
  location?: string;         // 可选地点
  note?: string;
  shares: ExpenseShare[];
  createdAt: number;
}

export interface Trip {
  id: string;
  name: string;
  emoji: string;
  currency: Currency;
  members: Member[];
  families: Family[];
  expenses: Expense[];
  createdAt: number;
  updatedAt: number;
  shareCode?: string;   // 设置后即为共享项目，6位大写码
}

// ── 视图用 ────────────────────────────────────────────────
export interface MemberSummary {
  memberId: string;
  memberName: string;
  memberAvatar: string;
  familyId?: string;
  totalOwedCents: number;
  totalPaidCents: number;
  netCents: number;
}

export interface FamilySummary {
  familyId: string;
  familyName: string;
  memberNames: string[];
  totalOwedCents: number;
  totalPaidCents: number;
  netCents: number;
}

export interface Settlement {
  fromMemberId: string;
  fromMemberName: string;
  fromAvatar: string;
  toMemberId: string;
  toMemberName: string;
  toAvatar: string;
  amountCents: number;
}

// 按日期汇总
export interface DailySummary {
  dateLabel: string;
  totalCents: number;
  byCategory: Partial<Record<ExpenseCategory, number>>;
  expenses: Expense[];
}

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Trip, Member, Expense, Currency } from './types';
import { calcShares } from './calculator';
import {
  syncTripToCloud,
  fetchTripFromCloud,
  subscribeTripUpdates,
  generateShareCode,
  firebaseReady,
} from './firebase';

const STORAGE_KEY = '@travel_split_v2';

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const makeDefaultTrip = (): Trip => ({
  id: uid(),
  name: '我的旅行',
  emoji: '✈️',
  currency: 'CNY',
  members: [],
  families: [],
  expenses: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

interface AppData {
  trips: Trip[];
  currentTripId: string;
}

interface StoreCtx {
  trip: Trip;
  trips: Trip[];
  // 项目操作
  createTrip: (name: string, emoji: string, currency: Currency) => void;
  deleteTrip: (id: string) => void;
  switchTrip: (id: string) => void;
  updateTrip: (updates: Partial<Pick<Trip, 'name' | 'emoji' | 'currency'>>) => void;
  // 成员操作
  addMember: (m: Omit<Member, 'id' | 'createdAt'>) => void;
  updateMember: (id: string, updates: Partial<Member>) => void;
  removeMember: (id: string) => void;
  // 家庭操作
  addFamily: (name: string) => void;
  updateFamily: (id: string, name: string) => void;
  removeFamily: (id: string) => void;
  // 支出操作
  addExpense: (e: Omit<Expense, 'id' | 'shares' | 'createdAt'>) => void;
  updateExpense: (id: string, e: Omit<Expense, 'id' | 'shares' | 'createdAt'>) => void;
  removeExpense: (id: string) => void;
  // 云共享
  shareTrip: () => Promise<string>;          // 生成分享码并上传，返回 6 位码
  joinTrip: (code: string) => Promise<'success' | 'not_found' | 'already_joined'>;
  isSyncing: boolean;
}

const StoreContext = createContext<StoreCtx | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialTrip = makeDefaultTrip();
  const [data, setData] = useState<AppData>({
    trips: [initialTrip],
    currentTripId: initialTrip.id,
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // ── 本地持久化 ────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        try {
          const parsed: AppData = JSON.parse(raw);
          parsed.trips = parsed.trips.map(t => ({
            emoji: '✈️',
            currency: 'CNY' as Currency,
            members: [],
            families: [],
            ...t,
            expenses: (t.expenses ?? []).map(e => ({
              time: e.createdAt ?? Date.now(),
              splitTarget: 'person',
              ...e,
            })),
          }));
          setData(parsed);
        } catch {}
      }
    });
  }, []);

  // ── 本地保存（不触发 Firebase 推送）──────────────────────
  const saveLocal = useCallback((newData: AppData) => {
    setData(newData);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
  }, []);

  // ── Firebase 实时监听：订阅所有共享项目的远程变化 ─────────
  useEffect(() => {
    if (!firebaseReady) return;
    const unsubscribers: (() => void)[] = [];

    data.trips.forEach(localTrip => {
      if (!localTrip.shareCode) return;

      const unsub = subscribeTripUpdates(localTrip.shareCode, (remoteTrip) => {
        setData(prev => {
          const current = prev.trips.find(t => t.shareCode === localTrip.shareCode);
          if (!current) return prev;
          // 只有远端数据更新时才覆盖本地
          if ((remoteTrip.updatedAt || 0) <= (current.updatedAt || 0)) return prev;
          const newData: AppData = {
            ...prev,
            trips: prev.trips.map(t =>
              t.shareCode === localTrip.shareCode
                ? { members: [], families: [], expenses: [], ...remoteTrip, id: t.id }  // 保留本地 ID，其余用远端数据
                : t
            ),
          };
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
          return newData;
        });
      });

      unsubscribers.push(unsub);
    });

    return () => unsubscribers.forEach(u => u());
  // 依赖：共享码列表变化时重新订阅
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.trips.map(t => t.shareCode ?? '').join(',')]);

  // ── 获取当前项目 ──────────────────────────────────────────
  const trip = data.trips.find(t => t.id === data.currentTripId) ?? data.trips[0];

  /**
   * 更新当前项目，同时：
   *   1. 保存到 AsyncStorage
   *   2. 若项目已共享，推送到 Firebase
   */
  const updateCurrentTrip = (updater: (t: Trip) => Trip) => {
    const updated = updater(trip);
    const newData: AppData = {
      ...data,
      trips: data.trips.map(t => t.id === trip.id ? updated : t),
    };
    saveLocal(newData);
    // 同步到云端
    if (updated.shareCode && firebaseReady) {
      syncTripToCloud(updated.shareCode, updated);
    }
  };

  // ── 项目操作 ──────────────────────────────────────────────
  const createTrip = (name: string, emoji: string, currency: Currency) => {
    const newTrip = { ...makeDefaultTrip(), name, emoji, currency };
    saveLocal({ trips: [...data.trips, newTrip], currentTripId: newTrip.id });
  };

  const deleteTrip = (id: string) => {
    if (data.trips.length <= 1) return;
    const remaining = data.trips.filter(t => t.id !== id);
    const currentTripId = data.currentTripId === id ? remaining[0].id : data.currentTripId;
    saveLocal({ trips: remaining, currentTripId });
  };

  const switchTrip = (id: string) =>
    saveLocal({ ...data, currentTripId: id });

  const updateTrip = (updates: Partial<Pick<Trip, 'name' | 'emoji' | 'currency'>>) =>
    updateCurrentTrip(t => ({ ...t, ...updates, updatedAt: Date.now() }));

  // ── 成员操作 ──────────────────────────────────────────────
  const addMember = (m: Omit<Member, 'id' | 'createdAt'>) =>
    updateCurrentTrip(t => ({
      ...t,
      members: [...t.members, { ...m, id: uid(), createdAt: Date.now() }],
      updatedAt: Date.now(),
    }));

  const updateMember = (id: string, updates: Partial<Member>) =>
    updateCurrentTrip(t => ({
      ...t,
      members: t.members.map(m => m.id === id ? { ...m, ...updates } : m),
      updatedAt: Date.now(),
    }));

  const removeMember = (id: string) =>
    updateCurrentTrip(t => ({
      ...t,
      members: t.members.filter(m => m.id !== id),
      expenses: t.expenses.map(e => ({
        ...e,
        participantIds: e.participantIds.filter(pid => pid !== id),
        payerId: e.payerId === id
          ? (e.participantIds.find(pid => pid !== id) ?? e.payerId)
          : e.payerId,
      })),
      updatedAt: Date.now(),
    }));

  // ── 家庭操作 ──────────────────────────────────────────────
  const addFamily = (name: string) =>
    updateCurrentTrip(t => ({
      ...t,
      families: [...t.families, { id: uid(), name, createdAt: Date.now() }],
      updatedAt: Date.now(),
    }));

  const updateFamily = (id: string, name: string) =>
    updateCurrentTrip(t => ({
      ...t,
      families: t.families.map(f => f.id === id ? { ...f, name } : f),
      updatedAt: Date.now(),
    }));

  const removeFamily = (id: string) =>
    updateCurrentTrip(t => ({
      ...t,
      families: t.families.filter(f => f.id !== id),
      members: t.members.map(m => m.familyId === id ? { ...m, familyId: undefined } : m),
      updatedAt: Date.now(),
    }));

  // ── 支出操作 ──────────────────────────────────────────────
  const addExpense = (e: Omit<Expense, 'id' | 'shares' | 'createdAt'>) =>
    updateCurrentTrip(t => {
      const newExp: Expense = { ...e, id: uid(), shares: [], createdAt: Date.now() };
      newExp.shares = calcShares(newExp, t.members);
      return { ...t, expenses: [...t.expenses, newExp], updatedAt: Date.now() };
    });

  const updateExpense = (id: string, e: Omit<Expense, 'id' | 'shares' | 'createdAt'>) =>
    updateCurrentTrip(t => {
      const existing = t.expenses.find(x => x.id === id);
      if (!existing) return t;
      const updated: Expense = { ...existing, ...e, id, shares: [] };
      updated.shares = calcShares(updated, t.members);
      return {
        ...t,
        expenses: t.expenses.map(x => x.id === id ? updated : x),
        updatedAt: Date.now(),
      };
    });

  const removeExpense = (id: string) =>
    updateCurrentTrip(t => ({
      ...t,
      expenses: t.expenses.filter(e => e.id !== id),
      updatedAt: Date.now(),
    }));

  // ── 云共享操作 ────────────────────────────────────────────

  /**
   * 分享当前项目：
   *   - 若已有分享码，直接返回
   *   - 否则生成新码，上传到 Firebase
   */
  const shareTrip = async (): Promise<string> => {
    if (!firebaseReady) return '';

    // 若已有分享码，重新同步一次以防之前上传失败
    if (trip.shareCode) {
      setIsSyncing(true);
      try {
        await syncTripToCloud(trip.shareCode, trip);
      } finally {
        setIsSyncing(false);
      }
      return trip.shareCode;
    }

    const code = generateShareCode();
    const sharedTrip: Trip = { ...trip, shareCode: code, updatedAt: Date.now() };
    const newData: AppData = {
      ...data,
      trips: data.trips.map(t => t.id === trip.id ? sharedTrip : t),
    };
    saveLocal(newData);

    setIsSyncing(true);
    try {
      await syncTripToCloud(code, sharedTrip);
    } finally {
      setIsSyncing(false);
    }

    return code;
  };

  /**
   * 加入他人分享的项目：
   *   - 'success'       → 成功加入
   *   - 'not_found'     → 分享码不存在
   *   - 'already_joined'→ 已经加入过了
   */
  const joinTrip = async (
    code: string
  ): Promise<'success' | 'not_found' | 'already_joined'> => {
    if (!firebaseReady) return 'not_found';

    const upperCode = code.toUpperCase().replace(/\s/g, '');
    if (data.trips.some(t => t.shareCode === upperCode)) return 'already_joined';

    setIsSyncing(true);
    const remoteTrip = await fetchTripFromCloud(upperCode);
    setIsSyncing(false);

    if (!remoteTrip) return 'not_found';

    // 用新 ID 保存在本地，shareCode 保持一致用于后续同步
    const localId = uid();
    const joinedTrip: Trip = {
      members: [],
      families: [],
      expenses: [],
      ...remoteTrip,
      id: localId,
    };
    saveLocal({ trips: [...data.trips, joinedTrip], currentTripId: localId });

    return 'success';
  };

  return (
    <StoreContext.Provider value={{
      trip, trips: data.trips,
      createTrip, deleteTrip, switchTrip, updateTrip,
      addMember, updateMember, removeMember,
      addFamily, updateFamily, removeFamily,
      addExpense, updateExpense, removeExpense,
      shareTrip, joinTrip, isSyncing,
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be inside StoreProvider');
  return ctx;
};

/**
 * firebase.ts — 云同步模块
 *
 * 使用 Firebase Realtime Database 让家人共享同一个旅行项目。
 * 首次使用前请先按照 FIREBASE_SETUP.md 的步骤填入下方配置。
 */

import { getApps, initializeApp } from 'firebase/app';
import { get, getDatabase, off, onValue, ref, set } from 'firebase/database';
import type { Trip } from './types';

// ──────────────────────────────────────────────────────────────
// ⚠️  请将下方占位符替换为你自己的 Firebase 项目配置
//    获取方式：Firebase 控制台 → 项目设置 → 你的应用 → SDK 配置
// ──────────────────────────────────────────────────────────────
export const FIREBASE_CONFIG = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY            ?? '',
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN        ?? '',
  databaseURL:       process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL       ?? '',
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID         ?? '',
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET     ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID             ?? '',
};

// 检测是否已填写真实配置（防止用占位符启动时 SDK 报错）
const isConfigured = !!FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.startsWith('YOUR_');

let db: ReturnType<typeof getDatabase> | null = null;

if (isConfigured) {
  try {
    const app = getApps().length === 0
      ? initializeApp(FIREBASE_CONFIG)
      : getApps()[0];
    db = getDatabase(app);
  } catch (e) {
    console.warn('[Firebase] 初始化失败:', e);
  }
}

/** Firebase 是否已初始化并可用 */
export const firebaseReady = isConfigured && db !== null;

// ── 工具函数 ──────────────────────────────────────────────────

/** 生成 6 位分享码（去掉 0/O/I/1 等易混淆字符） */
export function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

// ── Firebase 操作 ─────────────────────────────────────────────

const withTimeout = <T>(promise: Promise<T>, ms = 10000): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Firebase timeout')), ms)
    ),
  ]);

/** 去除对象中所有 undefined 字段（Firebase 不接受 undefined） */
function stripUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/** 将旅行项目上传（或更新）到 Firebase，失败时抛出错误 */
export async function syncTripToCloud(shareCode: string, trip: Trip): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');
  await withTimeout(set(ref(db, `trips/${shareCode}`), stripUndefined(trip)));
}

/** 从 Firebase 获取指定分享码的旅行项目 */
export async function fetchTripFromCloud(shareCode: string): Promise<Trip | null> {
  if (!db) return null;
  try {
    const snapshot = await withTimeout(get(ref(db, `trips/${shareCode}`)));
    return snapshot.exists() ? (snapshot.val() as Trip) : null;
  } catch (e) {
    console.warn('[Firebase] 获取失败:', e);
    return null;
  }
}

/**
 * 订阅 Firebase 中旅行项目的实时变化。
 * 返回取消订阅函数，在组件卸载时调用。
 */
export function subscribeTripUpdates(
  shareCode: string,
  onUpdate: (trip: Trip) => void
): () => void {
  if (!db) return () => {};
  const tripRef = ref(db, `trips/${shareCode}`);
  onValue(tripRef, snapshot => {
    if (snapshot.exists()) onUpdate(snapshot.val() as Trip);
  });
  return () => off(tripRef);
}

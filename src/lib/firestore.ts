import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  Category,
  Product,
  Shift,
  Transaction,
  OpenBill,
  Kasbon,
  Pengeluaran,
  UserProfile,
} from '@/lib/types';

// Helper: fetch with fallback - tries indexed query first, falls back to client-side filtering
async function fetchWithFallback<T>(
  buildIndexedQuery: () => any,
  buildFallbackQuery: () => any,
  mapDoc: (d: any) => T,
  clientFilter?: (item: T) => boolean,
): Promise<T[]> {
  try {
    const q = buildIndexedQuery();
    const snap = await getDocs(q);
    let results = snap.docs.map(mapDoc);
    if (clientFilter) results = results.filter(clientFilter);
    return results;
  } catch {
    const q = buildFallbackQuery();
    const snap = await getDocs(q);
    let results = snap.docs.map(mapDoc);
    if (clientFilter) results = results.filter(clientFilter);
    return results;
  }
}

// --- USERS ---
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile));
}

export async function createUserProfile(uid: string, data: Omit<UserProfile, 'uid'>) {
  await setDoc(doc(db, 'users', uid), { uid, ...data });
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>) {
  await updateDoc(doc(db, 'users', uid), data);
}

// --- CATEGORIES ---
export async function getCategories(): Promise<Category[]> {
  const q = query(collection(db, 'categories'), orderBy('order', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
}

export async function addCategory(data: Omit<Category, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'categories'), data);
  return ref.id;
}

export async function updateCategory(id: string, data: Partial<Category>) {
  await updateDoc(doc(db, 'categories', id), data);
}

export async function deleteCategory(id: string) {
  await deleteDoc(doc(db, 'categories', id));
}

// --- PRODUCTS ---
export async function getProducts(): Promise<Product[]> {
  const q = query(collection(db, 'products'), orderBy('name', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
}

export async function getActiveProducts(): Promise<Product[]> {
  return fetchWithFallback<Product>(
    () => query(collection(db, 'products'), where('active', '==', true), orderBy('name', 'asc')),
    () => query(collection(db, 'products'), orderBy('name', 'asc')),
    (d) => ({ id: d.id, ...d.data() } as Product),
    (p) => p.active === true,
  );
}

export async function addProduct(data: Omit<Product, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'products'), data);
  return ref.id;
}

export async function updateProduct(id: string, data: Partial<Product>) {
  await updateDoc(doc(db, 'products', id), data);
}

export async function deleteProduct(id: string) {
  await deleteDoc(doc(db, 'products', id));
}

// --- SHIFTS ---
export async function getActiveShift(kasirUid: string): Promise<Shift | null> {
  // Avoid composite index: query by status only, filter by uid client-side
  return fetchWithFallback<Shift>(
    () => query(collection(db, 'shifts'), where('kasirUid', '==', kasirUid), where('status', '==', 'open'), orderBy('openedAt', 'desc'), limit(1)),
    () => query(collection(db, 'shifts'), where('status', '==', 'open'), orderBy('openedAt', 'desc')),
    (d) => ({ id: d.id, ...d.data() } as Shift),
    (s) => s.kasirUid === kasirUid,
  ).then((results) => results[0] || null);
}

export async function openShift(data: Omit<Shift, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'shifts'), data);
  return ref.id;
}

export async function closeShift(id: string) {
  await updateDoc(doc(db, 'shifts', id), {
    closedAt: Date.now(),
    status: 'closed',
  });
}

export async function getShiftsByDateRange(startDate: string, endDate: string): Promise<Shift[]> {
  return fetchWithFallback<Shift>(
    () => query(collection(db, 'shifts'), where('openedDate', '>=', startDate), where('openedDate', '<=', endDate), orderBy('openedDate', 'desc')),
    () => query(collection(db, 'shifts'), orderBy('openedDate', 'desc')),
    (d) => ({ id: d.id, ...d.data() } as Shift),
    (s) => s.openedDate >= startDate && s.openedDate <= endDate,
  );
}

// --- TRANSACTIONS ---
export async function addTransaction(data: Omit<Transaction, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'transactions'), data);
  return ref.id;
}

export async function voidTransaction(
  id: string,
  reason: string,
  voidedBy: string
) {
  await updateDoc(doc(db, 'transactions', id), {
    status: 'voided',
    voidReason: reason,
    voidedBy,
    voidedAt: Date.now(),
  });
}

export async function getTransactionsByShift(shiftId: string): Promise<Transaction[]> {
  return fetchWithFallback<Transaction>(
    () => query(collection(db, 'transactions'), where('shiftId', '==', shiftId), orderBy('createdAt', 'desc')),
    () => query(collection(db, 'transactions'), where('shiftId', '==', shiftId)),
    (d) => ({ id: d.id, ...d.data() } as Transaction),
  );
}

export async function getTransactionsByDateRange(startDate: string, endDate: string): Promise<Transaction[]> {
  return fetchWithFallback<Transaction>(
    () => query(collection(db, 'transactions'), where('shiftDate', '>=', startDate), where('shiftDate', '<=', endDate), orderBy('shiftDate', 'desc'), orderBy('createdAt', 'desc')),
    () => query(collection(db, 'transactions'), orderBy('createdAt', 'desc')),
    (d) => ({ id: d.id, ...d.data() } as Transaction),
    (t) => t.shiftDate >= startDate && t.shiftDate <= endDate,
  );
}

// --- OPEN BILLS ---
export async function getOpenBills(shiftId: string): Promise<OpenBill[]> {
  return fetchWithFallback<OpenBill>(
    () => query(collection(db, 'openBills'), where('shiftId', '==', shiftId), orderBy('createdAt', 'desc')),
    () => query(collection(db, 'openBills'), where('shiftId', '==', shiftId)),
    (d) => ({ id: d.id, ...d.data() } as OpenBill),
  );
}

export async function addOpenBill(data: Omit<OpenBill, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'openBills'), data);
  return ref.id;
}

export async function updateOpenBill(id: string, data: Partial<OpenBill>) {
  await updateDoc(doc(db, 'openBills', id), data);
}

export async function deleteOpenBill(id: string) {
  await deleteDoc(doc(db, 'openBills', id));
}

// --- KASBON ---
export async function addKasbon(data: Omit<Kasbon, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'kasbon'), data);
  return ref.id;
}

export async function settleKasbon(
  kasbonId: string,
  settlementData: {
    settledAt: number;
    settledShiftId: string;
    settledShiftDate: string;
    settlementTransactionId: string;
  }
) {
  await updateDoc(doc(db, 'kasbon', kasbonId), {
    status: 'lunas',
    ...settlementData,
  });
}

export async function getOutstandingKasbon(): Promise<Kasbon[]> {
  return fetchWithFallback<Kasbon>(
    () => query(collection(db, 'kasbon'), where('status', '==', 'outstanding'), orderBy('createdAt', 'desc')),
    () => query(collection(db, 'kasbon'), where('status', '==', 'outstanding')),
    (d) => ({ id: d.id, ...d.data() } as Kasbon),
  );
}

export async function getSettledKasbon(): Promise<Kasbon[]> {
  return fetchWithFallback<Kasbon>(
    () => query(collection(db, 'kasbon'), where('status', '==', 'lunas'), orderBy('settledAt', 'desc')),
    () => query(collection(db, 'kasbon'), where('status', '==', 'lunas')),
    (d) => ({ id: d.id, ...d.data() } as Kasbon),
  );
}

export async function getKasbonByShift(shiftId: string): Promise<Kasbon[]> {
  return fetchWithFallback<Kasbon>(
    () => query(collection(db, 'kasbon'), where('shiftId', '==', shiftId), orderBy('createdAt', 'desc')),
    () => query(collection(db, 'kasbon'), where('shiftId', '==', shiftId)),
    (d) => ({ id: d.id, ...d.data() } as Kasbon),
  );
}

export async function updateKasbon(id: string, data: Partial<Kasbon>) {
  await updateDoc(doc(db, 'kasbon', id), data);
}

export async function deleteKasbon(id: string) {
  await deleteDoc(doc(db, 'kasbon', id));
}

// --- PENGELUARAN ---
export async function addPengeluaran(data: Omit<Pengeluaran, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'pengeluaran'), data);
  return ref.id;
}

export async function deletePengeluaran(id: string) {
  await deleteDoc(doc(db, 'pengeluaran', id));
}

export async function getPengeluaranByShift(shiftId: string): Promise<Pengeluaran[]> {
  return fetchWithFallback<Pengeluaran>(
    () => query(collection(db, 'pengeluaran'), where('shiftId', '==', shiftId), orderBy('createdAt', 'desc')),
    () => query(collection(db, 'pengeluaran'), where('shiftId', '==', shiftId)),
    (d) => ({ id: d.id, ...d.data() } as Pengeluaran),
  );
}

export async function getPengeluaranByDateRange(startDate: string, endDate: string): Promise<Pengeluaran[]> {
  return fetchWithFallback<Pengeluaran>(
    () => query(collection(db, 'pengeluaran'), where('shiftDate', '>=', startDate), where('shiftDate', '<=', endDate), orderBy('shiftDate', 'desc'), orderBy('createdAt', 'desc')),
    () => query(collection(db, 'pengeluaran'), orderBy('createdAt', 'desc')),
    (d) => ({ id: d.id, ...d.data() } as Pengeluaran),
    (p) => p.shiftDate >= startDate && p.shiftDate <= endDate,
  );
}

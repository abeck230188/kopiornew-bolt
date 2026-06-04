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
  BahanBaku,
  Purchase,
  ResepProduk,
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

  // Reduce stock based on recipes
  for (const item of data.items) {
    try {
      // Get recipe for this product
      const resepItems = await getResepByProductId(item.productId);

      // For each ingredient in recipe, reduce stock
      for (const resepItem of resepItems) {
        const bahan = await getDoc(doc(db, 'bahan_baku', resepItem.bahan_baku_id));
        if (bahan.exists()) {
          const bahanData = bahan.data() as BahanBaku;
          const stockToReduce = resepItem.qty_per_serving * item.qty;
          const newStock = Math.max(0, bahanData.stokSaatIni - stockToReduce);

          await updateBahanBaku(resepItem.bahan_baku_id, {
            stokSaatIni: newStock,
            updatedAt: Date.now(),
          });
        }
      }
    } catch (err) {
      console.error(`Failed to reduce stock for product ${item.productId}:`, err);
    }
  }

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

export async function getAllOpenBills(): Promise<OpenBill[]> {
  return fetchWithFallback<OpenBill>(
    () => query(collection(db, 'openBills'), orderBy('createdAt', 'desc')),
    () => query(collection(db, 'openBills')),
    (d) => ({ id: d.id, ...d.data() } as OpenBill),
  );
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

// --- BAHAN BAKU ---
export async function addBahanBaku(data: Omit<BahanBaku, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'bahan_baku'), data);
  return ref.id;
}

export async function getBahanBakuList(): Promise<BahanBaku[]> {
  const q = query(collection(db, 'bahan_baku'), orderBy('namaBahan', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as BahanBaku));
}

export async function updateBahanBaku(id: string, data: Partial<BahanBaku>) {
  await updateDoc(doc(db, 'bahan_baku', id), data);
}

export async function deleteBahanBaku(id: string) {
  await deleteDoc(doc(db, 'bahan_baku', id));
}

// --- PURCHASES ---
export async function addPurchase(data: Omit<Purchase, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'purchases'), data);
  return ref.id;
}

export async function getPurchaseList(): Promise<Purchase[]> {
  const q = query(collection(db, 'purchases'), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Purchase));
}

export async function updatePurchase(id: string, data: Partial<Purchase>) {
  await updateDoc(doc(db, 'purchases', id), data);
}

export async function deletePurchase(id: string) {
  await deleteDoc(doc(db, 'purchases', id));
}

export async function deletePurchaseWithRevert(purchaseId: string, bahanId: string, qty: number) {
  // Get the purchase to find the pengeluaran
  const purchase = await getDoc(doc(db, 'purchases', purchaseId));
  if (!purchase.exists()) return;

  const purchaseData = purchase.data() as Purchase;

  // Revert stock
  const bahan = await getDoc(doc(db, 'bahan_baku', bahanId));
  if (bahan.exists()) {
    const bahanData = bahan.data() as BahanBaku;
    await updateBahanBaku(bahanId, {
      stokSaatIni: Math.max(0, bahanData.stokSaatIni - qty),
      updatedAt: Date.now(),
    });
  }

  // Find and delete related pengeluaran entry
  const shiftDate = new Date(purchaseData.date).toISOString().split('T')[0];
  const pengeluaranQ = query(
    collection(db, 'pengeluaran'),
    where('shiftDate', '==', shiftDate),
    where('kategori', '==', 'Belanja Bahan'),
  );
  const pengeluaranSnap = await getDocs(pengeluaranQ);

  // Delete all matching pengeluaran entries for this date
  for (const doc of pengeluaranSnap.docs) {
    await deleteDoc(doc.ref);
  }

  // Delete the purchase
  await deleteDoc(doc(db, 'purchases', purchaseId));
}

export async function savePurchaseSession(
  purchases: Array<{ bahanId: string; bahanName: string; satuan: string; qty: number; totalPrice: number; date: number }>,
  createdBy: string,
  date: number,
) {
  // Get today's shift date
  const shiftDate = new Date(date).toISOString().split('T')[0];

  // Save each purchase to purchases collection
  for (const p of purchases) {
    const hargaSatuan = p.qty > 0 ? Math.round(p.totalPrice / p.qty) : 0;

    await addPurchase({
      date,
      item_name: p.bahanName,
      category: 'Belanja Bahan',
      quantity: p.qty,
      unit: 'unit',
      satuan: p.satuan,
      price_per_unit: hargaSatuan,
      total_price: p.totalPrice,
      created_by: createdBy,
      createdAt: Date.now(),
    });

    // Update stok_saat_ini, hargaSatuan, and hargaBeli for this bahan
    const bahan = await getDoc(doc(db, 'bahan_baku', p.bahanId));
    if (bahan.exists()) {
      const currentStok = (bahan.data() as BahanBaku).stokSaatIni;
      await updateBahanBaku(p.bahanId, {
        stokSaatIni: currentStok + p.qty,
        hargaSatuan,
        hargaBeli: hargaSatuan,
        updatedAt: Date.now(),
      });
    }
  }

  // Add to pengeluaran if there's an active shift
  const activeShift = await getActiveShift(createdBy);
  if (activeShift) {
    const totalSpent = purchases.reduce((sum, p) => sum + p.totalPrice, 0);
    await addDoc(collection(db, 'pengeluaran'), {
      shiftId: activeShift.id,
      shiftDate,
      kasirUid: createdBy,
      kasirName: activeShift.kasirName,
      deskripsi: `Belanja Bahan: ${purchases.map((p) => p.bahanName).join(', ')}`,
      jumlah: totalSpent,
      kategori: 'Belanja Bahan',
      createdAt: Date.now(),
    } as Pengeluaran);
  }
}

// --- RESEP PRODUK ---
export async function getResepByProductId(productId: string): Promise<ResepProduk[]> {
  const q = query(collection(db, 'resep_produk'), where('product_id', '==', productId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ResepProduk));
}

export async function saveResepIngredient(
  productId: string,
  bahanId: string,
  qtyPerServing: number,
): Promise<string> {
  const existing = await getDocs(
    query(
      collection(db, 'resep_produk'),
      where('product_id', '==', productId),
      where('bahan_baku_id', '==', bahanId),
    ),
  );

  if (existing.docs.length > 0) {
    await updateDoc(existing.docs[0].ref, { qty_per_serving: qtyPerServing });
    return existing.docs[0].id;
  }

  const ref = await addDoc(collection(db, 'resep_produk'), {
    product_id: productId,
    bahan_baku_id: bahanId,
    qty_per_serving: qtyPerServing,
    created_at: Date.now(),
  });
  return ref.id;
}

export async function deleteResepIngredient(id: string) {
  await deleteDoc(doc(db, 'resep_produk', id));
}

export async function calculateResepHpp(productId: string, bahanList: BahanBaku[]): Promise<number> {
  const resepItems = await getResepByProductId(productId);
  if (resepItems.length === 0) return 0;

  return resepItems.reduce((total, item) => {
    const bahan = bahanList.find((b) => b.id === item.bahan_baku_id);
    if (!bahan) return total;

    const hargaSatuan = bahan.hargaSatuan || Math.round(bahan.hargaBeli / bahan.qtyPembelian);
    return total + item.qty_per_serving * hargaSatuan;
  }, 0);
}

export async function updateProductHpp(productId: string, hpp: number) {
  await updateDoc(doc(db, 'products', productId), { hpp });
}

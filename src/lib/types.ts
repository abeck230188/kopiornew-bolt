export type UserRole = 'admin' | 'kasir';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  order: number;
  createdAt: number;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  hargaJual: number;
  hpp: number;
  photoUrl: string;
  active: boolean;
  createdAt: number;
}

export interface CartItem {
  product: Product;
  qty: number;
  hargaSnapshot: number;
  hppSnapshot: number;
}

export interface Shift {
  id: string;
  kasirUid: string;
  kasirName: string;
  modalAwal: number;
  openedAt: number;
  openedDate: string;
  closedAt: number | null;
  status: 'open' | 'closed';
  totalCashIn: number;
  totalQrisIn: number;
  totalExpense: number;
  totalKasbon: number;
}

export interface Transaction {
  id: string;
  shiftId: string;
  shiftDate: string; // shift opening date
  kasirUid: string;
  kasirName: string;
  items: TransactionItem[];
  total: number;
  totalHpp: number;
  paymentMethod: 'cash' | 'qris' | 'open_bill' | 'kasbon';
  cashReceived: number;
  change: number;
  customerName: string;
  status: 'paid' | 'voided' | 'open_bill' | 'kasbon';
  voidReason: string;
  voidedBy: string;
  voidedAt: number;
  createdAt: number;
  isKasbonSettlement: boolean;
  settledKasbonId: string;
}

export interface TransactionItem {
  productId: string;
  productName: string;
  qty: number;
  harga: number;
  hpp: number;
  subtotal: number;
}

export interface OpenBill {
  id: string;
  shiftId: string;
  shiftDate: string;
  kasirUid: string;
  kasirName: string;
  customerName: string;
  items: TransactionItem[];
  total: number;
  totalHpp: number;
  createdAt: number;
  updatedAt: number;
}

export interface Kasbon {
  id: string;
  shiftId: string;
  shiftDate: string;
  kasirUid: string;
  kasirName: string;
  customerName: string;
  items: TransactionItem[];
  total: number;
  totalHpp: number;
  status: 'outstanding' | 'lunas';
  createdAt: number;
  settledAt: number | null;
  settledShiftId: string;
  settledShiftDate: string;
  settlementTransactionId: string;
  editHistory?: string[];
  deleteReason?: string;
}

export interface Pengeluaran {
  id: string;
  shiftId: string;
  shiftDate: string;
  kasirUid: string;
  kasirName: string;
  deskripsi: string;
  jumlah: number;
  kategori: 'Belanja Bahan' | 'Operasional' | 'Lain-lain';
  createdAt: number;
}

export type PengeluaranKategori = Pengeluaran['kategori'];

export interface BahanBaku {
  id: string;
  namaBahan: string;
  kategori?: string;
  hargaBeli: number;
  qtyPembelian: number;
  satuan: 'gram' | 'ml' | 'liter' | 'kg' | 'pcs' | 'botol' | 'sachet' | 'lainnya';
  stokSaatIni: number;
  stokMinimum: number;
  createdAt: number;
  updatedAt: number;
}

export interface Purchase {
  id: string;
  date: number;
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  total_price: number;
  created_by: string;
  notes?: string;
  createdAt: number;
}


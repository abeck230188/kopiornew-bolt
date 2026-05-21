import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  getOpenBills,
  updateOpenBill,
  deleteOpenBill,
  addTransaction,
  addKasbon,
  getActiveProducts,
} from '@/lib/firestore';
import { formatRupiah, generateQuickNominals } from '@/lib/format';
import type { OpenBill, Product, Shift, TransactionItem } from '@/lib/types';
import type { Page } from '@/components/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Receipt, Plus, Minus, Trash2, CreditCard, QrCode, Search, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  activeShift: Shift | null;
  onNavigate: (p: Page) => void;
}

type PayMode = 'none' | 'cash' | 'qris' | 'kasbon';

export default function OpenBillPage({ activeShift, onNavigate }: Props) {
  const { profile } = useAuth();
  const [bills, setBills] = useState<OpenBill[]>([]);
  const [selectedBill, setSelectedBill] = useState<OpenBill | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [payMode, setPayMode] = useState<PayMode>('none');
  const [cashReceived, setCashReceived] = useState('');
  const [customNominal, setCustomNominal] = useState(false);
  const [processing, setProcessing] = useState(false);

  const loadBills = useCallback(async () => {
    if (!activeShift) return;
    const data = await getOpenBills(activeShift.id);
    setBills(data);
    if (selectedBill) {
      const updated = data.find((b) => b.id === selectedBill.id);
      if (updated) setSelectedBill(updated);
    }
  }, [activeShift, selectedBill]);

  useEffect(() => {
    loadBills();
    getActiveProducts().then(setProducts);
  }, [activeShift]);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const addItemToBill = async (product: Product) => {
    if (!selectedBill) return;
    const existing = selectedBill.items.find((i) => i.productId === product.id);
    let newItems: TransactionItem[];
    if (existing) {
      newItems = selectedBill.items.map((i) =>
        i.productId === product.id
          ? { ...i, qty: i.qty + 1, subtotal: (i.qty + 1) * i.harga }
          : i
      );
    } else {
      newItems = [
        ...selectedBill.items,
        { productId: product.id, productName: product.name, qty: 1, harga: product.hargaJual, hpp: product.hpp, subtotal: product.hargaJual },
      ];
    }
    const total = newItems.reduce((s, i) => s + i.subtotal, 0);
    const totalHpp = newItems.reduce((s, i) => s + i.hpp * i.qty, 0);
    await updateOpenBill(selectedBill.id, { items: newItems, total, totalHpp, updatedAt: Date.now() });
    await loadBills();
    toast.success(`${product.name} ditambahkan`);
  };

  const updateItemQty = async (productId: string, delta: number) => {
    if (!selectedBill) return;
    const newItems = selectedBill.items
      .map((i) =>
        i.productId === productId
          ? { ...i, qty: Math.max(0, i.qty + delta), subtotal: Math.max(0, i.qty + delta) * i.harga }
          : i
      )
      .filter((i) => i.qty > 0);
    const total = newItems.reduce((s, i) => s + i.subtotal, 0);
    const totalHpp = newItems.reduce((s, i) => s + i.hpp * i.qty, 0);
    await updateOpenBill(selectedBill.id, { items: newItems, total, totalHpp, updatedAt: Date.now() });
    await loadBills();
  };

  const removeItem = async (productId: string) => {
    if (!selectedBill) return;
    const newItems = selectedBill.items.filter((i) => i.productId !== productId);
    const total = newItems.reduce((s, i) => s + i.subtotal, 0);
    const totalHpp = newItems.reduce((s, i) => s + i.hpp * i.qty, 0);
    await updateOpenBill(selectedBill.id, { items: newItems, total, totalHpp, updatedAt: Date.now() });
    await loadBills();
  };

  const quickNominals = generateQuickNominals(selectedBill?.total || 0);
  const change = parseInt(cashReceived || '0') - (selectedBill?.total || 0);

  const handleCashPayment = async () => {
    if (!profile || !activeShift || !selectedBill) return;
    const received = parseInt(cashReceived);
    if (!received || received < selectedBill.total) {
      toast.error('Jumlah bayar kurang');
      return;
    }
    setProcessing(true);
    try {
      await addTransaction({
        shiftId: activeShift.id,
        shiftDate: activeShift.openedDate,
        kasirUid: profile.uid,
        kasirName: profile.displayName,
        items: selectedBill.items,
        total: selectedBill.total,
        totalHpp: selectedBill.totalHpp,
        paymentMethod: 'cash',
        cashReceived: received,
        change: received - selectedBill.total,
        customerName: selectedBill.customerName,
        status: 'paid',
        voidReason: '',
        voidedBy: '',
        voidedAt: 0,
        createdAt: Date.now(),
        isKasbonSettlement: false,
        settledKasbonId: '',
      });
      await deleteOpenBill(selectedBill.id);
      toast.success(`Dibayar cash! Kembalian: ${formatRupiah(received - selectedBill.total)}`);
      setSelectedBill(null);
      setPayMode('none');
      setCashReceived('');
      setCustomNominal(false);
      loadBills();
    } catch (err: any) {
      toast.error('Gagal: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleQrisPayment = async () => {
    if (!profile || !activeShift || !selectedBill) return;
    setProcessing(true);
    try {
      await addTransaction({
        shiftId: activeShift.id,
        shiftDate: activeShift.openedDate,
        kasirUid: profile.uid,
        kasirName: profile.displayName,
        items: selectedBill.items,
        total: selectedBill.total,
        totalHpp: selectedBill.totalHpp,
        paymentMethod: 'qris',
        cashReceived: 0,
        change: 0,
        customerName: selectedBill.customerName,
        status: 'paid',
        voidReason: '',
        voidedBy: '',
        voidedAt: 0,
        createdAt: Date.now(),
        isKasbonSettlement: false,
        settledKasbonId: '',
      });
      await deleteOpenBill(selectedBill.id);
      toast.success('Dibayar QRIS!');
      setSelectedBill(null);
      setPayMode('none');
      loadBills();
    } catch (err: any) {
      toast.error('Gagal: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleKasbon = async () => {
    if (!profile || !activeShift || !selectedBill) return;
    setProcessing(true);
    try {
      await addKasbon({
        shiftId: activeShift.id,
        shiftDate: activeShift.openedDate,
        kasirUid: profile.uid,
        kasirName: profile.displayName,
        customerName: selectedBill.customerName,
        items: selectedBill.items,
        total: selectedBill.total,
        totalHpp: selectedBill.totalHpp,
        status: 'outstanding',
        createdAt: Date.now(),
        settledAt: null,
        settledShiftId: '',
        settledShiftDate: '',
        settlementTransactionId: '',
      });
      await deleteOpenBill(selectedBill.id);
      toast.success('Kasbon dicatat!');
      setSelectedBill(null);
      setPayMode('none');
      loadBills();
    } catch (err: any) {
      toast.error('Gagal: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (!activeShift) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Buka shift terlebih dahulu</p>
        <Button className="mt-3" onClick={() => onNavigate('shift')}>Buka Shift</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-bold">Open Bill</h2>

      {bills.length === 0 ? (
        <Card className="border-amber-200">
          <CardContent className="py-8 text-center text-muted-foreground">
            <Receipt className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Belum ada open bill</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Bill List */}
          <div className="space-y-2">
            {bills.map((bill) => (
              <button
                key={bill.id}
                onClick={() => setSelectedBill(bill)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  selectedBill?.id === bill.id
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-amber-200 bg-card hover:border-primary/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{bill.customerName}</p>
                    <p className="text-xs text-muted-foreground">{bill.items.length} item</p>
                  </div>
                  <Badge variant="secondary" className="text-primary font-bold">
                    {formatRupiah(bill.total)}
                  </Badge>
                </div>
              </button>
            ))}
          </div>

          {/* Selected Bill Detail */}
          {selectedBill && (
            <Card className="border-amber-200">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-lg flex items-center justify-between">
                  <span>{selectedBill.customerName}</span>
                  <Badge variant="secondary">{formatRupiah(selectedBill.total)}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Items */}
                <div className="space-y-2">
                  {selectedBill.items.map((item) => (
                    <div key={item.productId} className="flex items-center justify-between text-sm">
                      <div className="flex-1">
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">{formatRupiah(item.harga)} x {item.qty}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatRupiah(item.subtotal)}</span>
                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateItemQty(item.productId, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateItemQty(item.productId, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => removeItem(item.productId)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Product */}
                <Button variant="outline" className="w-full" onClick={() => setShowProductPicker(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Tambah Produk
                </Button>

                {/* Payment Buttons */}
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <Button className="bg-green-600 hover:bg-green-700" onClick={() => setPayMode('cash')}>
                    <CreditCard className="h-4 w-4 mr-1" /> Cash
                  </Button>
                  <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setPayMode('qris')}>
                    <QrCode className="h-4 w-4 mr-1" /> QRIS
                  </Button>
                  <Button className="bg-amber-600 hover:bg-amber-700" onClick={() => setPayMode('kasbon')}>
                    <ShoppingCart className="h-4 w-4 mr-1" /> Kasbon
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Product Picker Dialog */}
      <Dialog open={showProductPicker} onOpenChange={setShowProductPicker}>
        <DialogContent className="sm:max-w-md max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Tambah Produk</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari produk..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { addItemToBill(p); setShowProductPicker(false); }}
                  className="w-full text-left flex items-center justify-between p-2 rounded-lg hover:bg-amber-50 transition-colors"
                >
                  <span className="text-sm">{p.name}</span>
                  <span className="text-sm font-medium text-primary">{formatRupiah(p.hargaJual)}</span>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cash Payment Modal */}
      <Dialog open={payMode === 'cash'} onOpenChange={(open) => { if (!open) setPayMode('none'); }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Bayar Cash</DialogTitle>
            <DialogDescription>Total: {formatRupiah(selectedBill?.total || 0)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-2">
              {quickNominals.map((nom) => (
                <Button key={nom} variant={cashReceived === String(nom) ? 'default' : 'outline'} className="text-sm" onClick={() => { setCashReceived(String(nom)); setCustomNominal(false); }}>
                  {formatRupiah(nom)}
                </Button>
              ))}
              <Button variant={customNominal ? 'default' : 'outline'} className="text-sm" onClick={() => { setCustomNominal(true); setCashReceived(''); }}>
                Nominal Lain
              </Button>
            </div>
            {customNominal && <Input type="number" placeholder="Masukkan nominal" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} autoFocus />}
            {parseInt(cashReceived) >= (selectedBill?.total || 0) && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <p className="text-sm text-green-700">Kembalian</p>
                <p className="text-2xl font-bold text-green-600">{formatRupiah(change)}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayMode('none')}>Batalkan</Button>
            <Button onClick={handleCashPayment} disabled={processing || parseInt(cashReceived) < (selectedBill?.total || 0)}>
              {processing ? 'Memproses...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QRIS Payment Modal */}
      <Dialog open={payMode === 'qris'} onOpenChange={(open) => { if (!open) setPayMode('none'); }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Bayar QRIS</DialogTitle>
            <DialogDescription>Total: {formatRupiah(selectedBill?.total || 0)}</DialogDescription>
          </DialogHeader>
          <div className="py-4 text-center">
            <QrCode className="h-16 w-16 mx-auto text-blue-500 mb-3" />
            <p className="text-sm text-muted-foreground">Pastikan pembayaran QRIS sudah masuk</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayMode('none')}>Batalkan</Button>
            <Button onClick={handleQrisPayment} disabled={processing}>{processing ? 'Memproses...' : 'Konfirmasi'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kasbon Confirm Modal */}
      <Dialog open={payMode === 'kasbon'} onOpenChange={(open) => { if (!open) setPayMode('none'); }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Kasbon</DialogTitle>
            <DialogDescription>
              {selectedBill?.customerName} - {formatRupiah(selectedBill?.total || 0)}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Kasbon tidak dihitung sebagai omzet. Akan dicatat sebagai piutang sampai dilunasi.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayMode('none')}>Batalkan</Button>
            <Button onClick={handleKasbon} disabled={processing}>{processing ? 'Memproses...' : 'Simpan Kasbon'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

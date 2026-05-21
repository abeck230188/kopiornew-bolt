import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getActiveProducts, getCategories, addTransaction, addOpenBill } from '@/lib/firestore';
import { formatRupiah, generateQuickNominals } from '@/lib/format';
import type { Product, Category, CartItem, Shift } from '@/lib/types';
import type { Page } from '@/components/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CreditCard, QrCode, Receipt, X, Plus, Minus, Search, TriangleAlert as AlertTriangle, Coffee } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  activeShift: Shift | null;
  onNavigate: (p: Page) => void;
}

type PaymentStep = 'none' | 'cash' | 'qris' | 'open_bill';

export default function POSPage({ activeShift, onNavigate }: Props) {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('none');
  const [showPayment, setShowPayment] = useState(false);
  const [cashReceived, setCashReceived] = useState('');
  const [customNominal, setCustomNominal] = useState(false);
  const [openBillName, setOpenBillName] = useState('');
  const [showNoShiftDialog, setShowNoShiftDialog] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [prods, cats] = await Promise.all([getActiveProducts(), getCategories()]);
        setProducts(prods);
        setCategories(cats);
      } catch (err: any) {
        toast.error('Gagal memuat produk: ' + err.message);
      }
    };
    load();
  }, [activeShift]);

  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCategory === 'all' || p.categoryId === selectedCategory;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.hargaSnapshot * item.qty, 0);
  const cartTotalHpp = cart.reduce((sum, item) => sum + item.hppSnapshot * item.qty, 0);

  const addToCart = (product: Product) => {
    if (!activeShift) {
      setShowNoShiftDialog(true);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { product, qty: 1, hargaSnapshot: product.hargaJual, hppSnapshot: product.hpp }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) =>
          item.product.id === productId ? { ...item, qty: Math.max(0, item.qty + delta) } : item
        )
        .filter((item) => item.qty > 0);
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const quickNominals = generateQuickNominals(cartTotal);
  const change = parseInt(cashReceived || '0') - cartTotal;

  const handleCashPayment = async () => {
    if (!profile || !activeShift) return;
    const received = parseInt(cashReceived);
    if (!received || received < cartTotal) {
      toast.error('Jumlah bayar kurang dari total');
      return;
    }
    setProcessing(true);
    try {
      const items = cart.map((c) => ({
        productId: c.product.id,
        productName: c.product.name,
        qty: c.qty,
        harga: c.hargaSnapshot,
        hpp: c.hppSnapshot,
        subtotal: c.hargaSnapshot * c.qty,
      }));
      await addTransaction({
        shiftId: activeShift.id,
        shiftDate: activeShift.openedDate,
        kasirUid: profile.uid,
        kasirName: profile.displayName,
        items,
        total: cartTotal,
        totalHpp: cartTotalHpp,
        paymentMethod: 'cash',
        cashReceived: received,
        change: received - cartTotal,
        customerName: '',
        status: 'paid',
        voidReason: '',
        voidedBy: '',
        voidedAt: 0,
        createdAt: Date.now(),
        isKasbonSettlement: false,
        settledKasbonId: '',
      });
      toast.success(`Transaksi berhasil! Kembalian: ${formatRupiah(received - cartTotal)}`);
      setCart([]);
      setPaymentStep('none');
      setShowPayment(false);
      setCashReceived('');
      setCustomNominal(false);
    } catch (err: any) {
      toast.error('Gagal: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleQrisPayment = async () => {
    if (!profile || !activeShift) return;
    setProcessing(true);
    try {
      const items = cart.map((c) => ({
        productId: c.product.id,
        productName: c.product.name,
        qty: c.qty,
        harga: c.hargaSnapshot,
        hpp: c.hppSnapshot,
        subtotal: c.hargaSnapshot * c.qty,
      }));
      await addTransaction({
        shiftId: activeShift.id,
        shiftDate: activeShift.openedDate,
        kasirUid: profile.uid,
        kasirName: profile.displayName,
        items,
        total: cartTotal,
        totalHpp: cartTotalHpp,
        paymentMethod: 'qris',
        cashReceived: 0,
        change: 0,
        customerName: '',
        status: 'paid',
        voidReason: '',
        voidedBy: '',
        voidedAt: 0,
        createdAt: Date.now(),
        isKasbonSettlement: false,
        settledKasbonId: '',
      });
      toast.success('Pembayaran QRIS berhasil!');
      setCart([]);
      setPaymentStep('none');
      setShowPayment(false);
    } catch (err: any) {
      toast.error('Gagal: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenBill = async () => {
    if (!profile || !activeShift) return;
    if (!openBillName.trim()) {
      toast.error('Masukkan nama pelanggan');
      return;
    }
    setProcessing(true);
    try {
      const items = cart.map((c) => ({
        productId: c.product.id,
        productName: c.product.name,
        qty: c.qty,
        harga: c.hargaSnapshot,
        hpp: c.hppSnapshot,
        subtotal: c.hargaSnapshot * c.qty,
      }));
      await addOpenBill({
        shiftId: activeShift.id,
        shiftDate: activeShift.openedDate,
        kasirUid: profile.uid,
        kasirName: profile.displayName,
        customerName: openBillName.trim(),
        items,
        total: cartTotal,
        totalHpp: cartTotalHpp,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      toast.success('Open Bill dibuat!');
      setCart([]);
      setPaymentStep('none');
      setShowPayment(false);
      setOpenBillName('');
      onNavigate('open_bill');
    } catch (err: any) {
      toast.error('Gagal: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] lg:h-[calc(100vh-80px)]">
      {/* No Shift Dialog */}
      <Dialog open={showNoShiftDialog} onOpenChange={setShowNoShiftDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Shift Belum Aktif
            </DialogTitle>
            <DialogDescription>Buka shift terlebih dahulu sebelum bertransaksi</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNoShiftDialog(false)}>Batalkan</Button>
            <Button onClick={() => { setShowNoShiftDialog(false); onNavigate('shift'); }}>Buka Shift</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Grid */}
      <div className="flex-1 overflow-auto">
        {/* Search */}
        <div className="mb-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari produk..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 border-amber-200"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              selectedCategory === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
            }`}
          >
            Semua
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Products */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              className="bg-card rounded-xl border border-amber-200 p-3 text-left hover:shadow-md hover:border-primary transition-all active:scale-95"
            >
              {product.photoUrl ? (
                <img
                  src={product.photoUrl}
                  alt={product.name}
                  className="w-full h-20 object-cover rounded-lg mb-2"
                />
              ) : (
                <div className="w-full h-20 bg-amber-100 rounded-lg mb-2 flex items-center justify-center">
                  <Coffee className="h-6 w-6 text-amber-400" />
                </div>
              )}
              <p className="text-sm font-medium truncate">{product.name}</p>
              <p className="text-sm font-bold text-primary">{formatRupiah(product.hargaJual)}</p>
            </button>
          ))}
          {filteredProducts.length === 0 && (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              Tidak ada produk ditemukan
            </div>
          )}
        </div>
      </div>

      {/* Cart Panel */}
      {cart.length > 0 && (
        <div className="border-t border-amber-200 bg-card shadow-lg">
          <div className="max-h-48 overflow-y-auto p-3 space-y-2">
            {cart.map((item) => (
              <div key={item.product.id} className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.product.name}</p>
                  <p className="text-xs text-muted-foreground">{formatRupiah(item.hargaSnapshot)} x {item.qty}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(item.product.id, -1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-sm font-medium w-6 text-center">{item.qty}</span>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(item.product.id, 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                  <span className="text-sm font-bold w-20 text-right">{formatRupiah(item.hargaSnapshot * item.qty)}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => removeFromCart(item.product.id)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between p-3 border-t border-amber-100">
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-xl font-bold text-primary">{formatRupiah(cartTotal)}</p>
            </div>
            <Button size="lg" onClick={() => { setPaymentStep('none'); setShowPayment(true); }} className="bg-primary hover:bg-primary/90">
              Bayar
            </Button>
          </div>
        </div>
      )}

      {/* Payment Selection Modal */}
      <Dialog open={showPayment && paymentStep === 'none' && cartTotal > 0} onOpenChange={(open) => { if (!open) { setShowPayment(false); setPaymentStep('none'); } }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Pilih Pembayaran</DialogTitle>
            <DialogDescription>Total: {formatRupiah(cartTotal)}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 py-4">
            <Button
              className="h-20 flex-col gap-1 bg-green-600 hover:bg-green-700"
              onClick={() => setPaymentStep('cash')}
            >
              <CreditCard className="h-6 w-6" />
              <span className="text-sm">Cash</span>
            </Button>
            <Button
              className="h-20 flex-col gap-1 bg-blue-600 hover:bg-blue-700"
              onClick={() => setPaymentStep('qris')}
            >
              <QrCode className="h-6 w-6" />
              <span className="text-sm">QRIS</span>
            </Button>
            <Button
              className="h-20 flex-col gap-1 bg-amber-600 hover:bg-amber-700"
              onClick={() => setPaymentStep('open_bill')}
            >
              <Receipt className="h-6 w-6" />
              <span className="text-sm">Open Bill</span>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCart([]); setPaymentStep('none'); setShowPayment(false); }}>Batalkan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cash Payment Modal */}
      <Dialog open={paymentStep === 'cash'} onOpenChange={(open) => { if (!open) setPaymentStep('none'); }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Bayar Cash</DialogTitle>
            <DialogDescription>Total: {formatRupiah(cartTotal)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-2">
              {quickNominals.map((nom) => (
                <Button
                  key={nom}
                  variant={cashReceived === String(nom) ? 'default' : 'outline'}
                  className="text-sm"
                  onClick={() => { setCashReceived(String(nom)); setCustomNominal(false); }}
                >
                  {formatRupiah(nom)}
                </Button>
              ))}
              <Button
                variant={customNominal ? 'default' : 'outline'}
                className="text-sm"
                onClick={() => { setCustomNominal(true); setCashReceived(''); }}
              >
                Nominal Lain
              </Button>
            </div>
            {customNominal && (
              <Input
                type="number"
                placeholder="Masukkan nominal"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                autoFocus
              />
            )}
            {parseInt(cashReceived) >= cartTotal && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <p className="text-sm text-green-700">Kembalian</p>
                <p className="text-2xl font-bold text-green-600">{formatRupiah(change)}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentStep('none')}>Batalkan</Button>
            <Button onClick={handleCashPayment} disabled={processing || parseInt(cashReceived) < cartTotal}>
              {processing ? 'Memproses...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QRIS Payment Modal */}
      <Dialog open={paymentStep === 'qris'} onOpenChange={(open) => { if (!open) setPaymentStep('none'); }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Bayar QRIS</DialogTitle>
            <DialogDescription>Total: {formatRupiah(cartTotal)}</DialogDescription>
          </DialogHeader>
          <div className="py-4 text-center">
            <QrCode className="h-16 w-16 mx-auto text-blue-500 mb-3" />
            <p className="text-sm text-muted-foreground">Pastikan pembayaran QRIS sudah masuk</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentStep('none')}>Batalkan</Button>
            <Button onClick={handleQrisPayment} disabled={processing}>
              {processing ? 'Memproses...' : 'Konfirmasi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Open Bill Modal */}
      <Dialog open={paymentStep === 'open_bill'} onOpenChange={(open) => { if (!open) setPaymentStep('none'); }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Open Bill</DialogTitle>
            <DialogDescription>Total: {formatRupiah(cartTotal)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nama Pelanggan</label>
              <Input
                placeholder="Masukkan nama pelanggan"
                value={openBillName}
                onChange={(e) => setOpenBillName(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentStep('none')}>Batalkan</Button>
            <Button onClick={handleOpenBill} disabled={processing}>
              {processing ? 'Memproses...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

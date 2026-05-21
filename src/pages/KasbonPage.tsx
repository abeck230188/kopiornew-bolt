import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  getOutstandingKasbon,
  getSettledKasbon,
  settleKasbon,
  addTransaction,
  updateKasbon,
  deleteKasbon,
  getActiveProducts,
} from '@/lib/firestore';
import { formatRupiah, formatDateTime } from '@/lib/format';
import type { Kasbon, Shift, TransactionItem, Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CreditCard, CircleCheck as CheckCircle, Clock, DollarSign, ChevronDown, ChevronUp, Pencil, Trash2, Plus, Minus, X } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  activeShift: Shift | null;
}

function KasbonCard({
  k,
  isAdmin,
  activeShift,
  onSettle,
  onEdit,
  onDelete,
}: {
  k: Kasbon;
  isAdmin: boolean;
  activeShift: Shift | null;
  onSettle: (k: Kasbon) => void;
  onEdit: (k: Kasbon) => void;
  onDelete: (k: Kasbon) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="border-amber-200">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div
            className="flex-1 min-w-0 cursor-pointer"
            onClick={() => setExpanded(!expanded)}
          >
            <div className="flex items-center gap-2">
              <p className="font-medium">{k.customerName}</p>
              {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
            <p className="text-xs text-muted-foreground">Dibuat: {formatDateTime(k.createdAt)}</p>
            {k.status === 'lunas' && k.settledAt && (
              <p className="text-xs text-muted-foreground">Dilunasi: {formatDateTime(k.settledAt)}</p>
            )}
            <p className="text-xs text-muted-foreground">{k.items.length} item</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              {k.status === 'lunas' && <Badge className="bg-green-100 text-green-700 mb-1">Lunas</Badge>}
              <p className="text-lg font-bold text-amber-700">{formatRupiah(k.total)}</p>
              {k.status === 'outstanding' && activeShift && (
                <Button size="sm" className="mt-1" onClick={() => onSettle(k)}>
                  <DollarSign className="h-3 w-3 mr-1" /> Pelunasan
                </Button>
              )}
            </div>
            {isAdmin && k.status === 'outstanding' && (
              <div className="flex flex-col gap-1 ml-1">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:text-amber-800 hover:bg-amber-50" onClick={() => onEdit(k)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-red-50" onClick={() => onDelete(k)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-amber-100">
            <div className="space-y-1.5">
              {k.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{item.productName}</span>
                    <span className="text-muted-foreground ml-1">x{item.qty}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs text-muted-foreground">{formatRupiah(item.harga)} @</span>
                    <span className="font-medium ml-2">{formatRupiah(item.subtotal)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-amber-100 flex justify-between text-sm font-bold">
              <span>Total</span>
              <span>{formatRupiah(k.total)}</span>
            </div>
            {k.editHistory && k.editHistory.length > 0 && (
              <div className="mt-2 pt-2 border-t border-amber-100">
                {k.editHistory.map((note, i) => (
                  <p key={i} className="text-xs text-muted-foreground">{note}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function KasbonPage({ activeShift }: Props) {
  const { profile, isAdmin } = useAuth();
  const [outstanding, setOutstanding] = useState<Kasbon[]>([]);
  const [settled, setSettled] = useState<Kasbon[]>([]);
  const [settleTarget, setSettleTarget] = useState<Kasbon | null>(null);
  const [settleMethod, setSettleMethod] = useState<'cash' | 'qris'>('cash');
  const [processing, setProcessing] = useState(false);

  // Edit state
  const [editTarget, setEditTarget] = useState<Kasbon | null>(null);
  const [editItems, setEditItems] = useState<TransactionItem[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [addProductSearch, setAddProductSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Kasbon | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    const [out, set] = await Promise.all([getOutstandingKasbon(), getSettledKasbon()]);
    setOutstanding(out);
    setSettled(set);
  };

  useEffect(() => { loadData(); }, []);

  const handleSettle = async () => {
    if (!profile || !activeShift || !settleTarget) return;
    setProcessing(true);
    try {
      const txId = await addTransaction({
        shiftId: activeShift.id,
        shiftDate: activeShift.openedDate,
        kasirUid: profile.uid,
        kasirName: profile.displayName,
        items: settleTarget.items,
        total: settleTarget.total,
        totalHpp: settleTarget.totalHpp,
        paymentMethod: settleMethod,
        cashReceived: settleMethod === 'cash' ? settleTarget.total : 0,
        change: 0,
        customerName: settleTarget.customerName,
        status: 'paid',
        voidReason: '',
        voidedBy: '',
        voidedAt: 0,
        createdAt: Date.now(),
        isKasbonSettlement: true,
        settledKasbonId: settleTarget.id,
      });

      await settleKasbon(settleTarget.id, {
        settledAt: Date.now(),
        settledShiftId: activeShift.id,
        settledShiftDate: activeShift.openedDate,
        settlementTransactionId: txId,
      });

      toast.success('Kasbon dilunasi!');
      setSettleTarget(null);
      loadData();
    } catch (err: any) {
      toast.error('Gagal: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Edit handlers
  const openEditDialog = async (k: Kasbon) => {
    setEditTarget(k);
    setEditItems([...k.items]);
    setAddProductSearch('');
    try {
      const prods = await getActiveProducts();
      setAllProducts(prods);
    } catch {
      setAllProducts([]);
    }
  };

  const updateEditItemQty = (index: number, delta: number) => {
    setEditItems((prev) => {
      const next = [...prev];
      const newQty = next[index].qty + delta;
      if (newQty <= 0) return next;
      next[index] = {
        ...next[index],
        qty: newQty,
        subtotal: newQty * next[index].harga,
      };
      return next;
    });
  };

  const removeEditItem = (index: number) => {
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addProductToEdit = (product: Product) => {
    setEditItems((prev) => {
      const existing = prev.findIndex((i) => i.productId === product.id);
      if (existing >= 0) {
        const next = [...prev];
        const newQty = next[existing].qty + 1;
        next[existing] = {
          ...next[existing],
          qty: newQty,
          subtotal: newQty * next[existing].harga,
        };
        return next;
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          qty: 1,
          harga: product.hargaJual,
          hpp: product.hpp,
          subtotal: product.hargaJual,
        },
      ];
    });
  };

  const editTotal = editItems.reduce((s, i) => s + i.subtotal, 0);
  const editTotalHpp = editItems.reduce((s, i) => s + i.hpp * i.qty, 0);

  const handleSaveEdit = async () => {
    if (!editTarget || editItems.length === 0) {
      toast.error('Kasbon harus memiliki minimal 1 item');
      return;
    }
    setSaving(true);
    try {
      const editNote = `Diedit oleh Admin pada ${formatDateTime(Date.now())}`;
      const existingHistory = editTarget.editHistory || [];
      await updateKasbon(editTarget.id, {
        items: editItems,
        total: editTotal,
        totalHpp: editTotalHpp,
        editHistory: [...existingHistory, editNote],
      });
      toast.success('Kasbon diperbarui');
      setEditTarget(null);
      loadData();
    } catch (err: any) {
      toast.error('Gagal menyimpan: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete handlers
  const handleDelete = async () => {
    if (!deleteTarget || !deleteReason.trim()) {
      toast.error('Masukkan alasan penghapusan');
      return;
    }
    setDeleting(true);
    try {
      await deleteKasbon(deleteTarget.id);
      toast.success('Kasbon dihapus');
      setDeleteTarget(null);
      setDeleteReason('');
      loadData();
    } catch (err: any) {
      toast.error('Gagal menghapus: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Filter products for add dialog
  const filteredProducts = allProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(addProductSearch.toLowerCase()) &&
      !editItems.some((ei) => ei.productId === p.id)
  );

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-bold">Kasbon</h2>

      <Tabs defaultValue="outstanding">
        <TabsList className="bg-amber-100">
          <TabsTrigger value="outstanding" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Clock className="h-4 w-4 mr-1" /> Outstanding
          </TabsTrigger>
          <TabsTrigger value="lunas" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <CheckCircle className="h-4 w-4 mr-1" /> Lunas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="outstanding" className="space-y-3 mt-4">
          {outstanding.length === 0 ? (
            <Card className="border-amber-200">
              <CardContent className="py-8 text-center text-muted-foreground">
                <CreditCard className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Tidak ada kasbon outstanding</p>
              </CardContent>
            </Card>
          ) : (
            outstanding.map((k) => (
              <KasbonCard
                key={k.id}
                k={k}
                isAdmin={isAdmin}
                activeShift={activeShift}
                onSettle={setSettleTarget}
                onEdit={openEditDialog}
                onDelete={setDeleteTarget}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="lunas" className="space-y-3 mt-4">
          {settled.length === 0 ? (
            <Card className="border-amber-200">
              <CardContent className="py-8 text-center text-muted-foreground">
                <CheckCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Belum ada kasbon yang dilunasi</p>
              </CardContent>
            </Card>
          ) : (
            settled.map((k) => (
              <KasbonCard
                key={k.id}
                k={k}
                isAdmin={isAdmin}
                activeShift={activeShift}
                onSettle={setSettleTarget}
                onEdit={openEditDialog}
                onDelete={setDeleteTarget}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Settle Dialog */}
      <Dialog open={!!settleTarget} onOpenChange={(open) => { if (!open) setSettleTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pelunasan Kasbon</DialogTitle>
            <DialogDescription>
              {settleTarget?.customerName} - {formatRupiah(settleTarget?.total || 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Pilih metode pembayaran:</p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={settleMethod === 'cash' ? 'default' : 'outline'}
                className="h-16"
                onClick={() => setSettleMethod('cash')}
              >
                <DollarSign className="h-5 w-5 mr-2" /> Cash
              </Button>
              <Button
                variant={settleMethod === 'qris' ? 'default' : 'outline'}
                className="h-16"
                onClick={() => setSettleMethod('qris')}
              >
                <CreditCard className="h-5 w-5 mr-2" /> QRIS
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleTarget(null)}>Batalkan</Button>
            <Button onClick={handleSettle} disabled={processing}>
              {processing ? 'Memproses...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Kasbon Dialog - Admin only */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Kasbon - {editTarget?.customerName}</DialogTitle>
            <DialogDescription>Tambah, hapus, atau ubah jumlah produk</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {editItems.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">{formatRupiah(item.harga)} @</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateEditItemQty(idx, -1)} disabled={item.qty <= 1}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center font-medium text-sm">{item.qty}</span>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateEditItemQty(idx, 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                  <span className="w-24 text-right font-medium text-sm">{formatRupiah(item.subtotal)}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeEditItem(idx)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}

            {editItems.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Tidak ada item. Tambahkan produk di bawah.</p>
            )}

            <div className="flex justify-between font-bold text-sm pt-2 border-t">
              <span>Total</span>
              <span>{formatRupiah(editTotal)}</span>
            </div>

            {/* Add product section */}
            <div className="pt-2 border-t">
              <Label className="text-sm font-medium">Tambah Produk</Label>
              <Input
                placeholder="Cari produk..."
                value={addProductSearch}
                onChange={(e) => setAddProductSearch(e.target.value)}
                className="mt-1"
              />
              {addProductSearch && filteredProducts.length > 0 && (
                <div className="mt-1 max-h-32 overflow-y-auto border rounded-lg bg-white">
                  {filteredProducts.slice(0, 10).map((p) => (
                    <button
                      key={p.id}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-amber-50 flex justify-between items-center"
                      onClick={() => { addProductToEdit(p); setAddProductSearch(''); }}
                    >
                      <span>{p.name}</span>
                      <span className="text-xs text-muted-foreground">{formatRupiah(p.hargaJual)}</span>
                    </button>
                  ))}
                </div>
              )}
              {addProductSearch && filteredProducts.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Produk tidak ditemukan</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Batal</Button>
            <Button onClick={handleSaveEdit} disabled={saving || editItems.length === 0}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Kasbon Dialog - Admin only */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Hapus Kasbon
            </DialogTitle>
            <DialogDescription>
              Hapus kasbon <span className="font-medium">{deleteTarget?.customerName}</span> sebesar <span className="font-medium">{formatRupiah(deleteTarget?.total || 0)}</span>?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Alasan Penghapusan</Label>
              <Input
                placeholder="Masukkan alasan"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteReason(''); }}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting || !deleteReason.trim()}>
              {deleting ? 'Menghapus...' : 'Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

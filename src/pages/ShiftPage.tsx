import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  openShift,
  closeShift,
  getTransactionsByShift,
  getOpenBills,
  getPengeluaranByShift,
  getKasbonByShift,
  getOutstandingKasbon,
  addPengeluaran,
  deletePengeluaran,
} from '@/lib/firestore';
import { formatRupiah, formatDateTime, getShiftDate } from '@/lib/format';
import type { Shift, Transaction, OpenBill, Pengeluaran, Kasbon, PengeluaranKategori } from '@/lib/types';
import type { Page } from '@/components/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Clock, TrendingDown, ChevronDown, ChevronUp, Trash2, Plus, TriangleAlert as AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  activeShift: Shift | null;
  onShiftChange: () => void;
  onNavigate?: (p: Page) => void;
}

export default function ShiftPage({ activeShift, onShiftChange, onNavigate }: Props) {
  const { profile } = useAuth();
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [openBillsList, setOpenBillsList] = useState<OpenBill[]>([]);
  const [opening, setOpening] = useState(false);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pengeluaran, setPengeluaran] = useState<Pengeluaran[]>([]);
  const [kasbonShift, setKasbonShift] = useState<Kasbon[]>([]);
  const [outstandingKasbon, setOutstandingKasbon] = useState<Kasbon[]>([]);
  const [showOutstanding, setShowOutstanding] = useState(false);

  const [showPengeluaranDialog, setShowPengeluaranDialog] = useState(false);
  const [pengDeskripsi, setPengDeskripsi] = useState('');
  const [pengJumlah, setPengJumlah] = useState('');
  const [pengKategori, setPengKategori] = useState<PengeluaranKategori>('Operasional');
  const [showDeletePengDialog, setShowDeletePengDialog] = useState(false);
  const [pengToDelete, setPengToDelete] = useState<Pengeluaran | null>(null);

  const loadShiftData = useCallback(async () => {
    if (!activeShift) return;
    try {
      const [txns, pengs, kbs, outstanding] = await Promise.all([
        getTransactionsByShift(activeShift.id),
        getPengeluaranByShift(activeShift.id),
        getKasbonByShift(activeShift.id),
        getOutstandingKasbon(),
      ]);
      setTransactions(txns);
      setPengeluaran(pengs);
      setKasbonShift(kbs);
      setOutstandingKasbon(outstanding);
      const bills = await getOpenBills(activeShift.id);
      setOpenBillsList(bills);
    } catch (err: any) {
      toast.error('Gagal memuat data shift: ' + err.message);
    }
  }, [activeShift]);

  useEffect(() => { loadShiftData(); }, [loadShiftData]);

  const handleOpenShift = async () => {
    if (!profile) return;
    if (activeShift) {
      toast.error('Anda sudah memiliki shift aktif. Tutup shift terlebih dahulu sebelum membuka shift baru.');
      return;
    }
    setOpening(true);
    try {
      await openShift({
        kasirUid: profile.uid,
        kasirName: profile.displayName,
        modalAwal: 0,
        openedAt: Date.now(),
        openedDate: getShiftDate(),
        closedAt: null,
        status: 'open',
        totalCashIn: 0,
        totalQrisIn: 0,
        totalExpense: 0,
        totalKasbon: 0,
      });
      toast.success('Shift berhasil dibuka');
      await onShiftChange();
      if (onNavigate) onNavigate('pos');
    } catch (err: any) {
      toast.error('Gagal membuka shift: ' + err.message);
    } finally {
      setOpening(false);
    }
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;
    const bills = await getOpenBills(activeShift.id);
    if (bills.length > 0) {
      setOpenBillsList(bills);
      setShowCloseWarning(true);
      return;
    }
    setShowCloseDialog(true);
  };

  const confirmCloseShift = async () => {
    if (!activeShift) return;
    try {
      await closeShift(activeShift.id);
      toast.success('Shift berhasil ditutup!');
      setShowCloseDialog(false);
      onShiftChange();
    } catch (err: any) {
      toast.error('Gagal menutup shift: ' + err.message);
    }
  };

  const handleAddPengeluaran = async () => {
    if (!profile || !activeShift) return;
    const jumlah = parseInt(pengJumlah);
    if (!pengDeskripsi || !jumlah || jumlah <= 0) {
      toast.error('Lengkapi data pengeluaran');
      return;
    }
    try {
      await addPengeluaran({
        shiftId: activeShift.id,
        shiftDate: activeShift.openedDate,
        kasirUid: profile.uid,
        kasirName: profile.displayName,
        deskripsi: pengDeskripsi,
        jumlah,
        kategori: pengKategori,
        createdAt: Date.now(),
      });
      toast.success('Pengeluaran ditambahkan');
      setShowPengeluaranDialog(false);
      setPengDeskripsi('');
      setPengJumlah('');
      setPengKategori('Operasional');
      loadShiftData();
    } catch (err: any) {
      toast.error('Gagal: ' + err.message);
    }
  };

  const handleDeletePengeluaran = async () => {
    if (!pengToDelete) return;
    try {
      await deletePengeluaran(pengToDelete.id);
      toast.success('Pengeluaran dihapus');
      setShowDeletePengDialog(false);
      setPengToDelete(null);
      loadShiftData();
    } catch (err: any) {
      toast.error('Gagal menghapus: ' + err.message);
    }
  };

  const cashMasuk = transactions
    .filter((t) => t.status === 'paid' && t.paymentMethod === 'cash' && !t.isKasbonSettlement)
    .reduce((sum, t) => sum + t.total, 0)
    + transactions
    .filter((t) => t.status === 'paid' && t.isKasbonSettlement && t.paymentMethod === 'cash')
    .reduce((sum, t) => sum + t.total, 0);

  const qrisMasuk = transactions
    .filter((t) => t.status === 'paid' && t.paymentMethod === 'qris' && !t.isKasbonSettlement)
    .reduce((sum, t) => sum + t.total, 0)
    + transactions
    .filter((t) => t.status === 'paid' && t.isKasbonSettlement && t.paymentMethod === 'qris')
    .reduce((sum, t) => sum + t.total, 0);

  const totalPengeluaran = pengeluaran.reduce((sum, p) => sum + p.jumlah, 0);
  const saldoKasAkhir = cashMasuk - totalPengeluaran;
  const totalOmzet = cashMasuk + qrisMasuk;

  const kasbonDibuat = kasbonShift.filter((k) => k.status === 'outstanding' || k.createdAt >= (activeShift?.openedAt || 0));
  const kasbonDilunasi = kasbonShift.filter((k) => k.status === 'lunas' && k.settledShiftId === activeShift?.id);

  if (!activeShift) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="text-center">
            <Clock className="h-12 w-12 mx-auto text-amber-700 mb-2" />
            <CardTitle className="font-display text-xl text-amber-900">Belum Ada Shift Aktif</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-amber-700 mb-4">Buka shift terlebih dahulu untuk mulai bertransaksi</p>
            <Button onClick={handleOpenShift} size="lg" className="w-full" disabled={opening}>
              {opening ? 'Membuka Shift...' : 'Buka Shift Sekarang'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      {/* Shift Header */}
      <Card className="border-amber-300 bg-gradient-to-r from-amber-700 to-amber-800 text-white">
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80">Shift Aktif</p>
              <p className="font-display text-lg font-bold">{activeShift.kasirName}</p>
              <p className="text-sm opacity-80">Dibuka: {formatDateTime(activeShift.openedAt)}</p>
            </div>
            <Button variant="secondary" onClick={handleCloseShift}>
              Tutup Shift
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* TOTAL OMZET HARI INI */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-5">
          <p className="text-xs font-semibold tracking-widest text-amber-800 uppercase">Total Omzet Hari Ini</p>
          <p className="text-3xl font-bold text-amber-900 mt-1">{formatRupiah(totalOmzet)}</p>
          <div className="mt-2 flex gap-4 text-sm">
            <span className="text-amber-700">Cash: <span className="font-semibold text-amber-900">{formatRupiah(cashMasuk)}</span></span>
            <span className="text-amber-700">QRIS: <span className="font-semibold text-amber-900">{formatRupiah(qrisMasuk)}</span></span>
          </div>
        </CardContent>
      </Card>

      {/* Open Bill Aktif */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold tracking-widest text-amber-800 uppercase">Open Bill Aktif</p>
            <Badge variant="secondary" className="bg-amber-200 text-amber-800">{openBillsList.length}</Badge>
          </div>
          {openBillsList.length === 0 ? (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <p className="text-sm text-green-700">Tidak ada bill terbuka</p>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {openBillsList.map((b) => (
                <div key={b.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-100">
                  <div>
                    <p className="font-medium text-sm text-amber-900">{b.customerName}</p>
                    <p className="text-xs text-amber-600">{b.items.length} item</p>
                  </div>
                  <span className="font-semibold text-sm text-amber-900">{formatRupiah(b.total)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cash Masuk */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-5">
          <p className="text-xs font-semibold tracking-widest text-amber-800 uppercase">Cash Masuk</p>
          <p className="text-2xl font-bold text-amber-900 mt-1">{formatRupiah(cashMasuk)}</p>
        </CardContent>
      </Card>

      {/* QRIS Masuk */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-5">
          <p className="text-xs font-semibold tracking-widest text-amber-800 uppercase">QRIS Masuk</p>
          <p className="text-2xl font-bold text-amber-900 mt-1">{formatRupiah(qrisMasuk)}</p>
        </CardContent>
      </Card>

      {/* Pengeluaran */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-5">
          <p className="text-xs font-semibold tracking-widest text-amber-800 uppercase">Pengeluaran</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{formatRupiah(totalPengeluaran)}</p>
        </CardContent>
      </Card>

      {/* Kasbon (informasi) */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-5 space-y-3">
          <p className="text-xs font-semibold tracking-widest text-amber-800 uppercase">Kasbon (informasi)</p>

          <div className="flex justify-between items-center text-sm">
            <span className="text-amber-700">Kasbon Dibuat shift ini</span>
            <span className="font-semibold text-amber-900">{formatRupiah(kasbonDibuat.reduce((s, k) => s + k.total, 0))}</span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-amber-700">Kasbon Dilunasi shift ini</span>
            <span className="font-semibold text-amber-900">{formatRupiah(kasbonDilunasi.reduce((s, k) => s + k.total, 0))}</span>
          </div>

          <div>
            <div className="flex justify-between items-center text-sm">
              <button
                className="flex items-center gap-1 text-amber-700 hover:text-amber-900 transition-colors"
                onClick={() => setShowOutstanding(!showOutstanding)}
              >
                Kasbon Outstanding semua shift
                {showOutstanding ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              <span className="font-semibold text-red-700">
                {formatRupiah(outstandingKasbon.reduce((s, k) => s + k.total, 0))}
              </span>
            </div>
            {showOutstanding && (
              <div className="mt-2 space-y-1 pl-2">
                {outstandingKasbon.length === 0 ? (
                  <p className="text-xs text-amber-600">Tidak ada kasbon outstanding</p>
                ) : (
                  outstandingKasbon.map((k) => (
                    <div key={k.id} className="flex justify-between text-xs bg-white rounded px-2 py-1.5 border border-amber-100">
                      <span className="text-amber-800">{k.customerName}</span>
                      <span className="font-medium text-red-700">{formatRupiah(k.total)}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <p className="text-xs text-amber-500 pt-1">Tidak mempengaruhi Cash/QRIS Masuk atau Saldo Kas Akhir</p>
        </CardContent>
      </Card>

      {/* Saldo Kas Akhir */}
      <Card className="border-amber-300 bg-amber-100">
        <CardContent className="pt-5">
          <p className="text-xs font-semibold tracking-widest text-amber-800 uppercase">Saldo Kas Akhir</p>
          <p className="text-3xl font-bold text-amber-900 mt-1">{formatRupiah(saldoKasAkhir)}</p>
          <p className="text-xs text-amber-500 mt-1">Cash Masuk - Pengeluaran</p>
        </CardContent>
      </Card>

      {/* Pengeluaran Shift Ini - Detail List */}
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-display text-base text-amber-900 flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Pengeluaran Shift Ini
            </CardTitle>
            <Button size="sm" variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100" onClick={() => setShowPengeluaranDialog(true)}>
              <Plus className="h-4 w-4 mr-1" /> Tambah
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {pengeluaran.length === 0 ? (
            <p className="text-sm text-amber-600">Belum ada pengeluaran</p>
          ) : (
            <div className="space-y-2">
              {pengeluaran.map((p) => (
                <div key={p.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-100">
                  <div>
                    <p className="font-medium text-sm text-amber-900">{p.deskripsi}</p>
                    <p className="text-xs text-amber-600">{p.kategori}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-red-700">-{formatRupiah(p.jumlah)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-amber-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => { setPengToDelete(p); setShowDeletePengDialog(true); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Close Shift Warning */}
      <Dialog open={showCloseWarning} onOpenChange={setShowCloseWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Tidak Dapat Menutup Shift
            </DialogTitle>
            <DialogDescription>Masih ada open bill yang belum diselesaikan</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {openBillsList.map((b) => (
              <div key={b.id} className="flex justify-between bg-amber-50 rounded px-3 py-2 text-sm">
                <span>{b.customerName}</span>
                <span className="font-medium">{formatRupiah(b.total)}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowCloseWarning(false)}>Mengerti</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Shift Confirm */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tutup Shift</DialogTitle>
            <DialogDescription>Yakin ingin menutup shift? Saldo Kas Akhir: {formatRupiah(saldoKasAkhir)}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>Batalkan</Button>
            <Button onClick={confirmCloseShift}>Tutup Shift</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Pengeluaran Dialog */}
      <Dialog open={showPengeluaranDialog} onOpenChange={setShowPengeluaranDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Pengeluaran</DialogTitle>
            <DialogDescription>Catat pengeluaran shift ini</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Input placeholder="Contoh: Beli kopi arabika" value={pengDeskripsi} onChange={(e) => setPengDeskripsi(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Jumlah</Label>
              <Input type="number" placeholder="Contoh: 50000" value={pengJumlah} onChange={(e) => setPengJumlah(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={pengKategori} onValueChange={(v) => setPengKategori(v as PengeluaranKategori)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Belanja Bahan">Belanja Bahan</SelectItem>
                  <SelectItem value="Operasional">Operasional</SelectItem>
                  <SelectItem value="Lain-lain">Lain-lain</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPengeluaranDialog(false)}>Batalkan</Button>
            <Button onClick={handleAddPengeluaran}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Pengeluaran Dialog */}
      <Dialog open={showDeletePengDialog} onOpenChange={setShowDeletePengDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Pengeluaran</DialogTitle>
            <DialogDescription>Yakin ingin menghapus pengeluaran "{pengToDelete?.deskripsi}"?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeletePengDialog(false)}>Batalkan</Button>
            <Button variant="destructive" onClick={handleDeletePengeluaran}>Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

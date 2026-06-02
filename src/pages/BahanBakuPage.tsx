import { useState, useEffect } from 'react';
import {
  addBahanBaku,
  getBahanBakuList,
  updateBahanBaku,
  deleteBahanBaku,
} from '@/lib/firestore';
import { formatRupiah } from '@/lib/format';
import type { BahanBaku } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const SATUAN_OPTIONS = ['gram', 'ml', 'liter', 'kg', 'pcs', 'botol', 'sachet', 'lainnya'] as const;

export default function BahanBakuPage() {
  const [bahanList, setBahanList] = useState<BahanBaku[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingBahan, setEditingBahan] = useState<BahanBaku | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BahanBaku | null>(null);
  const [loading, setLoading] = useState(false);

  // Form fields
  const [namaBahan, setNamaBahan] = useState('');
  const [kategori, setKategori] = useState('');
  const [hargaBeli, setHargaBeli] = useState('');
  const [qtyPembelian, setQtyPembelian] = useState('');
  const [satuan, setSatuan] = useState<typeof SATUAN_OPTIONS[number]>('gram');
  const [stokSaatIni, setStokSaatIni] = useState('');
  const [stokMinimum, setStokMinimum] = useState('');
  const [processing, setProcessing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getBahanBakuList();
      setBahanList(data);
    } catch (err: any) {
      toast.error('Gagal memuat data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openDialog = (bahan?: BahanBaku) => {
    if (bahan) {
      setEditingBahan(bahan);
      setNamaBahan(bahan.namaBahan);
      setKategori(bahan.kategori || '');
      setHargaBeli(String(bahan.hargaBeli));
      setQtyPembelian(String(bahan.qtyPembelian));
      setSatuan(bahan.satuan);
      setStokSaatIni(String(bahan.stokSaatIni));
      setStokMinimum(String(bahan.stokMinimum));
    } else {
      setEditingBahan(null);
      setNamaBahan('');
      setKategori('');
      setHargaBeli('');
      setQtyPembelian('');
      setSatuan('gram');
      setStokSaatIni('');
      setStokMinimum('');
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!namaBahan.trim() || !hargaBeli || !qtyPembelian || !stokSaatIni || stokMinimum === '') {
      toast.error('Lengkapi semua field wajib');
      return;
    }
    setProcessing(true);
    try {
      const data = {
        namaBahan: namaBahan.trim(),
        kategori: kategori.trim() || undefined,
        hargaBeli: parseInt(hargaBeli),
        qtyPembelian: parseFloat(qtyPembelian),
        satuan,
        stokSaatIni: parseFloat(stokSaatIni),
        stokMinimum: parseFloat(stokMinimum),
        updatedAt: Date.now(),
      };

      if (editingBahan) {
        await updateBahanBaku(editingBahan.id, data);
        toast.success('Bahan baku diperbarui');
      } else {
        await addBahanBaku({ ...data, createdAt: Date.now() });
        toast.success('Bahan baku ditambahkan');
      }
      setShowDialog(false);
      loadData();
    } catch (err: any) {
      toast.error('Gagal: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setProcessing(true);
    try {
      await deleteBahanBaku(deleteTarget.id);
      toast.success('Bahan baku dihapus');
      setShowDeleteDialog(false);
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      toast.error('Gagal: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const getStokStatus = (stok: number, minimum: number) => {
    if (stok === 0) return { label: 'Habis', color: 'bg-red-100 text-red-700' };
    if (stok <= minimum) return { label: 'Menipis', color: 'bg-orange-100 text-orange-700' };
    return { label: 'Aman', color: 'bg-green-100 text-green-700' };
  };

  const calculateHargaPerSatuan = (harga: number, qty: number) => {
    return qty > 0 ? Math.round(harga / qty) : 0;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bahan Baku</h1>
          <p className="text-sm text-muted-foreground">Kelola inventori bahan baku</p>
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="h-4 w-4 mr-2" /> Tambah Bahan
        </Button>
      </div>

      {bahanList.length === 0 ? (
        <Card className="border-amber-200">
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Belum ada bahan baku</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Daftar Bahan Baku ({bahanList.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-amber-50">
                    <TableHead>Nama Bahan</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Satuan</TableHead>
                    <TableHead className="text-right">Harga/Satuan</TableHead>
                    <TableHead className="text-right">Stok Saat Ini</TableHead>
                    <TableHead className="text-right">Stok Minimum</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bahanList.map((bahan) => {
                    const status = getStokStatus(bahan.stokSaatIni, bahan.stokMinimum);
                    const hargaPerSatuan = calculateHargaPerSatuan(bahan.hargaBeli, bahan.qtyPembelian);
                    return (
                      <TableRow key={bahan.id}>
                        <TableCell className="font-medium">{bahan.namaBahan}</TableCell>
                        <TableCell>{bahan.kategori || '-'}</TableCell>
                        <TableCell>{bahan.satuan}</TableCell>
                        <TableCell className="text-right font-medium">{formatRupiah(hargaPerSatuan)}</TableCell>
                        <TableCell className="text-right">{bahan.stokSaatIni}</TableCell>
                        <TableCell className="text-right">{bahan.stokMinimum}</TableCell>
                        <TableCell>
                          <Badge className={status.color}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openDialog(bahan)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                setDeleteTarget(bahan);
                                setShowDeleteDialog(true);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBahan ? 'Edit Bahan Baku' : 'Tambah Bahan Baku'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Nama Bahan *</Label>
              <Input
                value={namaBahan}
                onChange={(e) => setNamaBahan(e.target.value)}
                placeholder="Contoh: Kopi Arabica"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Kategori (Opsional)</Label>
              <Input
                value={kategori}
                onChange={(e) => setKategori(e.target.value)}
                placeholder="Contoh: Biji Kopi"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Harga Beli (Rp) *</Label>
                <Input
                  type="number"
                  value={hargaBeli}
                  onChange={(e) => setHargaBeli(e.target.value)}
                  placeholder="100000"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Qty Pembelian *</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={qtyPembelian}
                  onChange={(e) => setQtyPembelian(e.target.value)}
                  placeholder="1"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Satuan *</Label>
              <Select value={satuan} onValueChange={(v: any) => setSatuan(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SATUAN_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Stok Saat Ini *</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={stokSaatIni}
                  onChange={(e) => setStokSaatIni(e.target.value)}
                  placeholder="100"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Stok Minimum *</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={stokMinimum}
                  onChange={(e) => setStokMinimum(e.target.value)}
                  placeholder="20"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={processing}
            >
              Batalkan
            </Button>
            <Button onClick={handleSave} disabled={processing}>
              {processing ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">Hapus Bahan Baku</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Yakin ingin menghapus <span className="font-semibold">{deleteTarget?.namaBahan}</span>?
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={processing}
            >
              Batalkan
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={processing}
            >
              {processing ? 'Menghapus...' : 'Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

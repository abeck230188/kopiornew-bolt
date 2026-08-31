import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  getTransactionsByDateRange,
  getPengeluaranByDateRange,
  getOutstandingKasbon,
  getSettledKasbon,
  voidTransaction,
  deletePengeluaran,
} from '@/lib/firestore';
import { formatRupiah, formatDateTime, getShiftDate } from '@/lib/format';
import type { Transaction, Pengeluaran, Kasbon } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Download,
  Ban,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

type FilterPeriod = 'today' | '7days' | 'month' | 'last_month' | 'custom';

function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDateRange(period: FilterPeriod): { start: string; end: string } {
  const now = new Date();
  const today = getShiftDate();
  switch (period) {
    case 'today':
      return { start: today, end: today };
    case '7days': {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      return { start: formatLocalDate(d), end: today };
    }
    case 'month': {
      const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      return { start, end: today };
    }
    case 'last_month': {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const le = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        start: `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, '0')}-01`,
        end: formatLocalDate(le),
      };
    }
    default:
      return { start: today, end: today };
  }
}

export default function ReportsPage() {
  const { profile } = useAuth();
  const [period, setPeriod] = useState<FilterPeriod>('today');
  const [customStart, setCustomStart] = useState(getShiftDate());
  const [customEnd, setCustomEnd] = useState(getShiftDate());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pengeluaran, setPengeluaran] = useState<Pengeluaran[]>([]);
  const [outstandingKasbon, setOutstandingKasbon] = useState<Kasbon[]>([]);
  const [settledKasbon, setSettledKasbon] = useState<Kasbon[]>([]);
  const [loading, setLoading] = useState(false);

  const [voidTarget, setVoidTarget] = useState<Transaction | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const [expandedTxnId, setExpandedTxnId] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Pengeluaran | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const range = period === 'custom'
        ? { start: customStart, end: customEnd }
        : getDateRange(period);
      const [txns, pengs, outK, setK] = await Promise.all([
        getTransactionsByDateRange(range.start, range.end),
        getPengeluaranByDateRange(range.start, range.end),
        getOutstandingKasbon(),
        getSettledKasbon(),
      ]);
      setTransactions(txns);
      setPengeluaran(pengs);
      setOutstandingKasbon(outK);
      setSettledKasbon(setK);
    } catch (err: any) {
      toast.error('Gagal memuat data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [period]);

  const paidTxns = useMemo(() => transactions.filter((t) => t.status === 'paid'), [transactions]);
  const voidedTxns = useMemo(() => transactions.filter((t) => t.status === 'voided'), [transactions]);

  const productMap = useMemo(() => {
    const map: Record<string, { name: string; category: string; qty: number; omzet: number; hpp: number }> = {};
    paidTxns.forEach((t) => {
      t.items.forEach((item) => {
        if (!map[item.productId]) {
          map[item.productId] = { name: item.productName, category: '', qty: 0, omzet: 0, hpp: 0 };
        }
        map[item.productId].qty += item.qty;
        map[item.productId].omzet += item.subtotal;
        map[item.productId].hpp += item.hpp * item.qty;
      });
    });
    return Object.entries(map).map(([id, data]) => ({
      id,
      ...data,
      profit: data.omzet - data.hpp,
      margin: data.omzet > 0 ? ((data.omzet - data.hpp) / data.omzet * 100).toFixed(1) : '0',
    }));
  }, [paidTxns]);

  const handleVoid = async () => {
    if (!voidTarget || !voidReason.trim()) {
      toast.error('Masukkan alasan void');
      return;
    }
    setProcessing(true);
    try {
      await voidTransaction(voidTarget.id, voidReason.trim(), profile?.uid || '');
      toast.success('Transaksi di-void');
      setVoidTarget(null);
      setVoidReason('');
      loadData();
    } catch (err: any) {
      toast.error('Gagal: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleDeletePengeluaran = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePengeluaran(deleteTarget.id);
      toast.success('Pengeluaran dihapus');
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      toast.error('Gagal menghapus: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const exportExcel = (data: any[], sheetName: string, filename: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}.xlsx`);
    toast.success('Export berhasil!');
  };

  const exportTransactions = () => {
    const range = period === 'custom'
      ? { start: customStart, end: customEnd }
      : getDateRange(period);

    const rows: Record<string, any>[] = [];
    let no = 0;

    paidTxns
      .sort((a, b) => a.createdAt - b.createdAt)
      .forEach((t) => {
        no++;
        const txDate = new Date(t.createdAt);
        const dateStr = txDate.toISOString().slice(0, 10);
        const timeStr = txDate.toTimeString().slice(0, 8);
        const method = t.paymentMethod.toUpperCase();

        t.items.forEach((item, idx) => {
          rows.push({
            'No': idx === 0 ? no : '',
            'Tanggal': idx === 0 ? dateStr : '',
            'Waktu': idx === 0 ? timeStr : '',
            'Kasir': idx === 0 ? t.kasirName : '',
            'Pelanggan': idx === 0 ? (t.customerName || '-') : '',
            'Metode Bayar': idx === 0 ? method : '',
            'Nama Produk': item.productName,
            'Qty': item.qty,
            'Harga Satuan': item.harga,
            'Subtotal': item.subtotal,
            'Total Transaksi': idx === 0 ? t.total : '',
          });
        });

        // Blank separator row between transactions
        rows.push({
          'No': '', 'Tanggal': '', 'Waktu': '', 'Kasir': '', 'Pelanggan': '',
          'Metode Bayar': '', 'Nama Produk': '', 'Qty': '', 'Harga Satuan': '',
          'Subtotal': '', 'Total Transaksi': '',
        });
      });

    // Grand total row
    const grandTotal = paidTxns.reduce((s, t) => s + t.total, 0);
    rows.push({
      'No': '', 'Tanggal': '', 'Waktu': '', 'Kasir': '', 'Pelanggan': '',
      'Metode Bayar': '', 'Nama Produk': 'GRAND TOTAL', 'Qty': '', 'Harga Satuan': '',
      'Subtotal': '', 'Total Transaksi': grandTotal,
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 5 },   // No
      { wch: 12 },  // Tanggal
      { wch: 10 },  // Waktu
      { wch: 18 },  // Kasir
      { wch: 18 },  // Pelanggan
      { wch: 12 },  // Metode Bayar
      { wch: 28 },  // Nama Produk
      { wch: 6 },   // Qty
      { wch: 14 },  // Harga Satuan
      { wch: 14 },  // Subtotal
      { wch: 16 },  // Total Transaksi
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transaksi');
    XLSX.writeFile(wb, `Laporan-Transaksi-${range.start}-sd-${range.end}.xlsx`);
    toast.success('Export berhasil!');
  };

  const exportProducts = () => {
    const data = productMap.map((p) => ({
      Produk: p.name,
      Kategori: p.category,
      Qty: p.qty,
      Omzet: p.omzet,
      HPP: p.hpp,
      Laba: p.profit,
      Margin: p.margin + '%',
    }));
    exportExcel(data, 'Produk', `laporan-produk-${getShiftDate()}`);
  };

  const exportPengeluaran = () => {
    const data = pengeluaran.map((p) => ({
      Tanggal: formatDateTime(p.createdAt),
      Deskripsi: p.deskripsi,
      Kategori: p.kategori,
      Jumlah: p.jumlah,
    }));
    exportExcel(data, 'Pengeluaran', `laporan-pengeluaran-${getShiftDate()}`);
  };

  const exportKasbon = (items: Kasbon[], label: string) => {
    const data = items.map((k) => ({
      Pelanggan: k.customerName,
      Total: k.total,
      Dibuat: formatDateTime(k.createdAt),
      Status: k.status === 'lunas' ? 'Lunas' : 'Outstanding',
      'Dilunasi': k.settledAt ? formatDateTime(k.settledAt) : '-',
    }));
    exportExcel(data, label, `laporan-kasbon-${label.toLowerCase()}-${getShiftDate()}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-display text-xl font-bold">Laporan Detail</h2>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as FilterPeriod)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hari Ini</SelectItem>
              <SelectItem value="7days">7 Hari Terakhir</SelectItem>
              <SelectItem value="month">Bulan Ini</SelectItem>
              <SelectItem value="last_month">Bulan Lalu</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          {period === 'custom' && (
            <>
              <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-36" />
              <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-36" />
              <Button size="sm" onClick={loadData}>Filter</Button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <Tabs defaultValue="transactions">
          <TabsList className="bg-amber-100 flex-wrap">
            <TabsTrigger value="transactions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Per Transaksi</TabsTrigger>
            <TabsTrigger value="products" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Per Produk</TabsTrigger>
            <TabsTrigger value="kasbon" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Kasbon</TabsTrigger>
            <TabsTrigger value="pengeluaran" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Pengeluaran</TabsTrigger>
          </TabsList>

          {/* Transactions - expandable rows */}
          <TabsContent value="transactions" className="space-y-3 mt-4">
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={exportTransactions}>
                <Download className="h-4 w-4 mr-1" /> Export Excel
              </Button>
            </div>
            {paidTxns.length === 0 && voidedTxns.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Tidak ada transaksi</p>
            ) : (
              [...paidTxns, ...voidedTxns].sort((a, b) => b.createdAt - a.createdAt).map((t) => {
                const isExpanded = expandedTxnId === t.id;
                return (
                  <Card key={t.id} className={`border-amber-200 ${t.status === 'voided' ? 'opacity-60' : ''}`}>
                    <CardContent className="pt-4">
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedTxnId(isExpanded ? null : t.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{formatDateTime(t.createdAt)}</p>
                            {t.status === 'voided' && <Badge variant="destructive" className="text-xs">VOID</Badge>}
                            {t.isKasbonSettlement && <Badge className="bg-amber-100 text-amber-700 text-xs">Kasbon Lunas</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {t.kasirName} | {t.paymentMethod.toUpperCase()}
                            {t.customerName ? ` | ${t.customerName}` : ''}
                            {' | '}{t.items.length} item
                          </p>
                          {t.status === 'voided' && (
                            <p className="text-xs text-red-500">Alasan: {t.voidReason}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className="font-bold">{formatRupiah(t.total)}</p>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                          {t.status === 'paid' && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); setVoidTarget(t); setVoidReason(''); }}>
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-amber-100">
                          <div className="space-y-1.5">
                            {t.items.map((item, idx) => (
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
                            <span>{formatRupiah(t.total)}</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* Products */}
          <TabsContent value="products" className="space-y-3 mt-4">
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={exportProducts}>
                <Download className="h-4 w-4 mr-1" /> Export Excel
              </Button>
            </div>
            {productMap.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Tidak ada data produk</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Produk</th>
                      <th className="text-right py-2 px-2">Qty</th>
                      <th className="text-right py-2 px-2">Omzet</th>
                      <th className="text-right py-2 px-2">HPP</th>
                      <th className="text-right py-2 px-2">Laba</th>
                      <th className="text-right py-2 px-2">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productMap.map((p) => (
                      <tr key={p.id} className="border-b">
                        <td className="py-2 px-2">{p.name}</td>
                        <td className="py-2 px-2 text-right">{p.qty}</td>
                        <td className="py-2 px-2 text-right">{formatRupiah(p.omzet)}</td>
                        <td className="py-2 px-2 text-right">{formatRupiah(p.hpp)}</td>
                        <td className="py-2 px-2 text-right font-medium">{formatRupiah(p.profit)}</td>
                        <td className="py-2 px-2 text-right">{p.margin}%</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold bg-amber-50">
                      <td className="py-2 px-2">Total</td>
                      <td className="py-2 px-2 text-right">{productMap.reduce((s, p) => s + p.qty, 0)}</td>
                      <td className="py-2 px-2 text-right">{formatRupiah(productMap.reduce((s, p) => s + p.omzet, 0))}</td>
                      <td className="py-2 px-2 text-right">{formatRupiah(productMap.reduce((s, p) => s + p.hpp, 0))}</td>
                      <td className="py-2 px-2 text-right">{formatRupiah(productMap.reduce((s, p) => s + p.profit, 0))}</td>
                      <td className="py-2 px-2 text-right">
                        {(() => {
                          const totalOmzetP = productMap.reduce((s, p) => s + p.omzet, 0);
                          const totalProfit = productMap.reduce((s, p) => s + p.profit, 0);
                          return totalOmzetP > 0 ? (totalProfit / totalOmzetP * 100).toFixed(1) : '0';
                        })()}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </TabsContent>

          {/* Kasbon */}
          <TabsContent value="kasbon" className="space-y-4 mt-4">
            <Tabs defaultValue="outstanding">
              <TabsList className="bg-amber-100">
                <TabsTrigger value="outstanding" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Outstanding</TabsTrigger>
                <TabsTrigger value="lunas" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Lunas</TabsTrigger>
              </TabsList>
              <TabsContent value="outstanding" className="mt-3">
                <div className="flex justify-end mb-2">
                  <Button size="sm" variant="outline" onClick={() => exportKasbon(outstandingKasbon, 'Outstanding')}>
                    <Download className="h-4 w-4 mr-1" /> Export
                  </Button>
                </div>
                {outstandingKasbon.length === 0 ? (
                  <p className="text-center py-4 text-muted-foreground text-sm">Tidak ada kasbon outstanding</p>
                ) : (
                  outstandingKasbon.map((k) => (
                    <Card key={k.id} className="border-amber-200 mb-2">
                      <CardContent className="pt-4 py-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-sm">{k.customerName}</p>
                            <p className="text-xs text-muted-foreground">{formatDateTime(k.createdAt)}</p>
                          </div>
                          <p className="font-bold text-amber-700">{formatRupiah(k.total)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
              <TabsContent value="lunas" className="mt-3">
                <div className="flex justify-end mb-2">
                  <Button size="sm" variant="outline" onClick={() => exportKasbon(settledKasbon, 'Lunas')}>
                    <Download className="h-4 w-4 mr-1" /> Export
                  </Button>
                </div>
                {settledKasbon.length === 0 ? (
                  <p className="text-center py-4 text-muted-foreground text-sm">Tidak ada kasbon lunas</p>
                ) : (
                  settledKasbon.map((k) => (
                    <Card key={k.id} className="border-amber-200 mb-2">
                      <CardContent className="pt-4 py-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-sm">{k.customerName}</p>
                            <p className="text-xs text-muted-foreground">Dilunasi: {k.settledAt ? formatDateTime(k.settledAt) : '-'}</p>
                          </div>
                          <div className="text-right">
                            <Badge className="bg-green-100 text-green-700 text-xs">Lunas</Badge>
                            <p className="font-bold text-sm">{formatRupiah(k.total)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Pengeluaran - with delete */}
          <TabsContent value="pengeluaran" className="space-y-3 mt-4">
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={exportPengeluaran}>
                <Download className="h-4 w-4 mr-1" /> Export Excel
              </Button>
            </div>
            {pengeluaran.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Tidak ada pengeluaran</p>
            ) : (
              pengeluaran.map((p) => (
                <Card key={p.id} className="border-amber-200">
                  <CardContent className="pt-4 py-3">
                    <div className="flex justify-between items-center">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{p.deskripsi}</p>
                        <p className="text-xs text-muted-foreground">{p.kategori} | {formatDateTime(p.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <p className="font-bold text-red-600">{formatRupiah(p.jumlah)}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTarget(p)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Void Dialog */}
      <Dialog open={!!voidTarget} onOpenChange={(open) => { if (!open) setVoidTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Ban className="h-5 w-5" />
              Void Transaksi
            </DialogTitle>
            <DialogDescription>
              Transaksi {formatRupiah(voidTarget?.total || 0)} akan di-void dan dikecualikan dari omzet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Alasan Void</Label>
              <Input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Masukkan alasan" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidTarget(null)}>Batalkan</Button>
            <Button variant="destructive" onClick={handleVoid} disabled={processing || !voidReason.trim()}>
              {processing ? 'Memproses...' : 'Void'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Pengeluaran Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Hapus Pengeluaran
            </DialogTitle>
            <DialogDescription>
              Hapus pengeluaran ini? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="py-2 space-y-1">
              <p className="text-sm font-medium">{deleteTarget.deskripsi}</p>
              <p className="text-lg font-bold text-red-600">{formatRupiah(deleteTarget.jumlah)}</p>
              <p className="text-xs text-muted-foreground">{deleteTarget.kategori} | {formatDateTime(deleteTarget.createdAt)}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDeletePengeluaran} disabled={deleting}>
              {deleting ? 'Menghapus...' : 'Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

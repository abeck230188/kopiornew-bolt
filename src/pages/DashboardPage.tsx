import { useState, useEffect, useMemo } from 'react';
import {
  getTransactionsByDateRange,
  getPengeluaranByDateRange,
  getOutstandingKasbon,
} from '@/lib/firestore';
import { formatRupiah, getShiftDate } from '@/lib/format';
import type { Transaction, Pengeluaran, Kasbon } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TrendingUp, DollarSign, Receipt, CreditCard, TrendingDown, ShoppingCart, ChartBar as BarChart3, Package, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

type FilterPeriod = 'today' | '7days' | 'month' | 'last_month' | 'custom';

function getDateRange(period: FilterPeriod): { start: string; end: string } {
  const now = new Date();
  const today = getShiftDate();
  switch (period) {
    case 'today':
      return { start: today, end: today };
    case '7days': {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      return { start: d.toISOString().slice(0, 10), end: today };
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
        end: le.toISOString().slice(0, 10),
      };
    }
    default:
      return { start: today, end: today };
  }
}

function getPreviousRange(period: FilterPeriod): { start: string; end: string } | null {
  const now = new Date();
  switch (period) {
    case 'today': {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const ds = d.toISOString().slice(0, 10);
      return { start: ds, end: ds };
    }
    case '7days': {
      const end = new Date();
      end.setDate(end.getDate() - 7);
      const start = new Date();
      start.setDate(start.getDate() - 13);
      return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
    }
    case 'month': {
      const pm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const pe = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        start: `${pm.getFullYear()}-${String(pm.getMonth() + 1).padStart(2, '0')}-01`,
        end: pe.toISOString().slice(0, 10),
      };
    }
    case 'last_month': {
      const pm = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const pe = new Date(now.getFullYear(), now.getMonth() - 1, 0);
      return {
        start: `${pm.getFullYear()}-${String(pm.getMonth() + 1).padStart(2, '0')}-01`,
        end: pe.toISOString().slice(0, 10),
      };
    }
    default:
      return null;
  }
}

const CHART_COLORS = ['#d97706', '#92400e', '#b45309', '#a16207', '#ca8a04'];

function TrendIndicator({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null || previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const isUp = pct >= 0;
  return (
    <div className={`flex items-center gap-0.5 text-xs ${isUp ? 'text-emerald-600' : 'text-red-500'}`}>
      {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      <span>{isUp ? '+' : ''}{pct.toFixed(1)}%</span>
    </div>
  );
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<FilterPeriod>('today');
  const [customStart, setCustomStart] = useState(getShiftDate());
  const [customEnd, setCustomEnd] = useState(getShiftDate());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pengeluaran, setPengeluaran] = useState<Pengeluaran[]>([]);
  const [outstandingKasbon, setOutstandingKasbon] = useState<Kasbon[]>([]);
  const [loading, setLoading] = useState(false);

  // Previous period data for trend
  const [prevTransactions, setPrevTransactions] = useState<Transaction[]>([]);
  const [prevPengeluaran, setPrevPengeluaran] = useState<Pengeluaran[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const range = period === 'custom'
        ? { start: customStart, end: customEnd }
        : getDateRange(period);
      const [txns, pengs, kasbon] = await Promise.all([
        getTransactionsByDateRange(range.start, range.end),
        getPengeluaranByDateRange(range.start, range.end),
        getOutstandingKasbon(),
      ]);
      setTransactions(txns);
      setPengeluaran(pengs);
      setOutstandingKasbon(kasbon);

      // Load previous period for trends
      const prevRange = getPreviousRange(period);
      if (prevRange) {
        const [pTxns, pPengs] = await Promise.all([
          getTransactionsByDateRange(prevRange.start, prevRange.end),
          getPengeluaranByDateRange(prevRange.start, prevRange.end),
        ]);
        setPrevTransactions(pTxns);
        setPrevPengeluaran(pPengs);
      } else {
        setPrevTransactions([]);
        setPrevPengeluaran([]);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [period]);

  const paidTxns = useMemo(() => transactions.filter((t) => t.status === 'paid'), [transactions]);
  const prevPaidTxns = useMemo(() => prevTransactions.filter((t) => t.status === 'paid'), [prevTransactions]);

  const cashOmzet = useMemo(() => paidTxns.filter((t) => t.paymentMethod === 'cash').reduce((s, t) => s + t.total, 0), [paidTxns]);
  const qrisOmzet = useMemo(() => paidTxns.filter((t) => t.paymentMethod === 'qris').reduce((s, t) => s + t.total, 0), [paidTxns]);
  const totalOmzet = cashOmzet + qrisOmzet;
  const totalHpp = useMemo(() => paidTxns.reduce((s, t) => s + t.totalHpp, 0), [paidTxns]);
  const labaKotor = totalOmzet - totalHpp;
  const marginKotor = totalOmzet > 0 ? (labaKotor / totalOmzet * 100).toFixed(1) : '0';

  const totalPengeluaran = pengeluaran.reduce((s, p) => s + p.jumlah, 0);
  const pengByCategory = pengeluaran.reduce((acc, p) => {
    if (!acc[p.kategori]) acc[p.kategori] = 0;
    acc[p.kategori] += p.jumlah;
    return acc;
  }, {} as Record<string, number>);

  const saldoKasFisik = cashOmzet - totalPengeluaran;
  const kasBersih = totalOmzet - totalPengeluaran;
  const labaBersih = totalOmzet - totalHpp - totalPengeluaran;
  const marginBersih = totalOmzet > 0 ? (labaBersih / totalOmzet * 100).toFixed(1) : '0';
  const totalTxCount = paidTxns.length;
  const kasbonTotal = outstandingKasbon.reduce((s, k) => s + k.total, 0);

  // Previous period calculations
  const prevCashOmzet = prevPaidTxns.filter((t) => t.paymentMethod === 'cash').reduce((s, t) => s + t.total, 0);
  const prevQrisOmzet = prevPaidTxns.filter((t) => t.paymentMethod === 'qris').reduce((s, t) => s + t.total, 0);
  const prevTotalOmzet = prevCashOmzet + prevQrisOmzet;
  const prevTotalHpp = prevPaidTxns.reduce((s, t) => s + t.totalHpp, 0);
  const prevLabaKotor = prevTotalOmzet - prevTotalHpp;
  const prevTotalPengeluaran = prevPengeluaran.reduce((s, p) => s + p.jumlah, 0);
  const prevSaldoKasFisik = prevCashOmzet - prevTotalPengeluaran;
  const prevKasBersih = prevTotalOmzet - prevTotalPengeluaran;
  const prevLabaBersih = prevTotalOmzet - prevTotalHpp - prevTotalPengeluaran;
  const prevTxCount = prevPaidTxns.length;

  const hasPrevData = prevPaidTxns.length > 0 || prevPengeluaran.length > 0;

  // Daily revenue chart data
  const dailyRevenue = useMemo(() => {
    const map: Record<string, number> = {};
    paidTxns.forEach((t) => {
      const day = t.shiftDate;
      map[day] = (map[day] || 0) + t.total;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({
        date: date.slice(5),
        total,
      }));
  }, [paidTxns]);

  // Top 5 best selling products
  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; qty: number; omzet: number }> = {};
    paidTxns.forEach((t) => {
      t.items.forEach((item) => {
        if (!map[item.productId]) {
          map[item.productId] = { name: item.productName, qty: 0, omzet: 0 };
        }
        map[item.productId].qty += item.qty;
        map[item.productId].omzet += item.subtotal;
      });
    });
    return Object.entries(map)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.omzet - a.omzet)
      .slice(0, 5);
  }, [paidTxns]);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header + Filter */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Ringkasan performa bisnis</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          {/* KPI Row 1: Omzet, Saldo Kas Fisik, Kas Bersih, Total HPP */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Omzet */}
            <Card className="border-amber-200">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-muted-foreground">Omzet</span>
                  </div>
                  {hasPrevData && <TrendIndicator current={totalOmzet} previous={prevTotalOmzet} />}
                </div>
                <p className="text-lg font-bold">{formatRupiah(totalOmzet)}</p>
                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                  <div className="flex justify-between"><span>Cash</span><span className="font-medium text-emerald-600">{formatRupiah(cashOmzet)}</span></div>
                  <div className="flex justify-between"><span>QRIS</span><span className="font-medium text-blue-600">{formatRupiah(qrisOmzet)}</span></div>
                </div>
              </CardContent>
            </Card>

            {/* Saldo Kas Fisik - light blue background */}
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-blue-600" />
                    <span className="text-xs text-blue-700 font-medium">Saldo Kas Fisik</span>
                  </div>
                  {hasPrevData && <TrendIndicator current={saldoKasFisik} previous={prevSaldoKasFisik} />}
                </div>
                <p className="text-lg font-bold text-blue-900">{formatRupiah(saldoKasFisik)}</p>
                <p className="text-xs text-blue-400 mt-0.5">Cash Masuk - Pengeluaran</p>
                <div className="text-xs text-blue-600 mt-1 space-y-0.5">
                  <div className="flex justify-between"><span>Cash Masuk</span><span>{formatRupiah(cashOmzet)}</span></div>
                  <div className="flex justify-between"><span>Pengeluaran</span><span>-{formatRupiah(totalPengeluaran)}</span></div>
                </div>
              </CardContent>
            </Card>

            {/* Kas Bersih */}
            <Card className="border-amber-200">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-blue-500" />
                    <span className="text-xs text-muted-foreground">Kas Bersih</span>
                  </div>
                  {hasPrevData && <TrendIndicator current={kasBersih} previous={prevKasBersih} />}
                </div>
                <p className="text-lg font-bold">{formatRupiah(kasBersih)}</p>
                <p className="text-xs text-muted-foreground">Omzet - Pengeluaran</p>
              </CardContent>
            </Card>

            {/* Total HPP */}
            <Card className="border-amber-200">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-amber-500" />
                    <span className="text-xs text-muted-foreground">Total HPP</span>
                  </div>
                  {hasPrevData && <TrendIndicator current={totalHpp} previous={prevTotalHpp} />}
                </div>
                <p className="text-lg font-bold">{formatRupiah(totalHpp)}</p>
              </CardContent>
            </Card>
          </div>

          {/* KPI Row 2: Laba Kotor, Total Pengeluaran, Laba Bersih, Kasbon Outstanding */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Laba Kotor */}
            <Card className="border-amber-200">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-green-600" />
                    <span className="text-xs text-muted-foreground">Laba Kotor</span>
                  </div>
                  {hasPrevData && <TrendIndicator current={labaKotor} previous={prevLabaKotor} />}
                </div>
                <p className="text-lg font-bold">{formatRupiah(labaKotor)}</p>
                <p className="text-xs text-muted-foreground">Margin: {marginKotor}%</p>
              </CardContent>
            </Card>

            {/* Total Pengeluaran */}
            <Card className="border-amber-200">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    <span className="text-xs text-muted-foreground">Total Pengeluaran</span>
                  </div>
                  {hasPrevData && <TrendIndicator current={totalPengeluaran} previous={prevTotalPengeluaran} />}
                </div>
                <p className="text-lg font-bold text-red-600">{formatRupiah(totalPengeluaran)}</p>
                <div className="text-xs text-muted-foreground mt-1">
                  {Object.entries(pengByCategory).map(([cat, amt]) => (
                    <div key={cat} className="flex justify-between"><span>{cat}</span><span>{formatRupiah(amt)}</span></div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Laba Bersih */}
            <Card className="border-2 border-green-300 bg-green-50">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-700" />
                    <span className="text-xs text-green-700 font-medium">Laba Bersih</span>
                  </div>
                  {hasPrevData && <TrendIndicator current={labaBersih} previous={prevLabaBersih} />}
                </div>
                <p className="text-xl font-bold text-green-700">{formatRupiah(labaBersih)}</p>
                <p className="text-xs text-green-600 font-medium">Margin: {marginBersih}%</p>
              </CardContent>
            </Card>

            {/* Kasbon Outstanding */}
            <Card className="border-amber-200">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="h-4 w-4 text-amber-600" />
                  <span className="text-xs text-muted-foreground">Kasbon Outstanding</span>
                </div>
                <p className="text-lg font-bold text-amber-700">{formatRupiah(kasbonTotal)}</p>
              </CardContent>
            </Card>
          </div>

          {/* KPI Row 3: Total Transaksi */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-amber-200">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    <span className="text-xs text-muted-foreground">Total Transaksi</span>
                  </div>
                  {hasPrevData && <TrendIndicator current={totalTxCount} previous={prevTxCount} />}
                </div>
                <p className="text-2xl font-bold">{totalTxCount}</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Daily Revenue Bar Chart */}
            <Card className="border-amber-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Pendapatan Harian
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dailyRevenue.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Tidak ada data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dailyRevenue} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f0e8" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: number) => [formatRupiah(value), 'Omzet']}
                        labelFormatter={(label: string) => `Tanggal: ${label}`}
                        contentStyle={{ borderRadius: 8, border: '1px solid #f5f0e8' }}
                      />
                      <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                        {dailyRevenue.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Top 5 Products */}
            <Card className="border-amber-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Top 5 Produk Terlaris
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Tidak ada data</p>
                ) : (
                  <div className="space-y-3">
                    {topProducts.map((p, i) => (
                      <div key={p.id} className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            <p className="text-sm font-bold ml-2">{formatRupiah(p.omzet)}</p>
                          </div>
                          <div className="w-full bg-amber-100 rounded-full h-1.5 mt-1">
                            <div
                              className="bg-amber-600 h-1.5 rounded-full transition-all"
                              style={{ width: `${(p.omzet / topProducts[0].omzet) * 100}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{p.qty} terjual</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
